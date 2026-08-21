/**
 * Asana Adapter — Maps Asana custom fields to InitiativeStore model and syncs task data.
 * @module adapters/asana-adapter
 */

let _config = null;

/**
 * Extract a custom field value from an Asana task by GID.
 * @param {Array} customFields - The custom_fields array from an Asana task
 * @param {string} gid - The GID of the custom field to find
 * @returns {object|null} The matching custom field object, or null
 */
function findFieldByGid(customFields, gid) {
  if (!Array.isArray(customFields)) return null;
  return customFields.find(f => f.gid === gid) || null;
}

/**
 * Parse a dollar value from a custom field's number_value.
 * @param {object|null} field - The custom field object
 * @returns {number} Parsed numeric value, or 0 if not parseable
 */
function parseDollarValue(field) {
  if (!field || field.number_value == null) return 0;
  const val = Number(field.number_value);
  return Number.isFinite(val) ? val : 0;
}

/**
 * Map a stage enum value to a valid pipeline stage.
 * @param {object|null} field - The custom field object with enum_value
 * @param {object} stageValueMap - Mapping of Asana enum names to internal stage values
 * @returns {string} The mapped stage value, defaults to 'identified'
 */
function mapStage(field, stageValueMap) {
  if (!field || !field.enum_value || !field.enum_value.name) {
    console.warn('[AsanaAdapter] Stage field missing or has no enum_value, defaulting to "identified"');
    return 'identified';
  }

  const enumName = field.enum_value.name;
  const mapped = stageValueMap[enumName];

  if (!mapped) {
    console.warn(`[AsanaAdapter] Unrecognized stage value "${enumName}", defaulting to "identified"`);
    return 'identified';
  }

  return mapped;
}

/**
 * Resolve the access token from the environment variable reference.
 * @param {string} accessTokenRef - The environment variable name
 * @returns {string|null} The resolved token value
 */
function resolveAccessToken(accessTokenRef) {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[accessTokenRef] || null;
  }
  return null;
}

/**
 * Create a structured error response.
 * @param {string} code - Error code
 * @param {string} message - Human-readable message
 * @param {number|null} retryAfter - Seconds to wait before retry (rate limiting only)
 * @returns {object} Structured error object
 */
function createErrorResponse(code, message, retryAfter = null) {
  return {
    success: false,
    error: {
      code,
      message,
      retryAfter,
    },
  };
}

const AsanaAdapter = {
  /**
   * Configure the adapter with project settings and field mappings.
   * @param {object} config - Configuration object
   * @param {string} config.projectId - Asana project GID
   * @param {string} config.accessTokenRef - Environment variable name for access token
   * @param {object} config.fieldMappings - Map of field names to custom field GIDs
   * @param {object} [config.stageValueMap] - Map of Asana enum names to internal stage values
   */
  configure(config) {
    _config = {
      projectId: config.projectId,
      accessTokenRef: config.accessTokenRef,
      fieldMappings: config.fieldMappings || {},
      stageValueMap: config.stageValueMap || {
        'Identified': 'identified',
        'Validated': 'validated',
        'Negotiating': 'negotiating',
        'Implementing': 'implementing',
        'Realized': 'realized',
      },
    };
  },

  /**
   * Map fields from a single Asana task to a partial initiative object.
   * @param {object} asanaTask - An Asana task object with custom_fields array
   * @returns {object} Partial initiative object for merging
   */
  mapFields(asanaTask) {
    if (!_config) {
      throw new Error('AsanaAdapter not configured. Call configure() first.');
    }

    const { fieldMappings, stageValueMap } = _config;
    const customFields = asanaTask.custom_fields || [];

    // Extract savings fields
    const savings = {
      baseline: parseDollarValue(findFieldByGid(customFields, fieldMappings.baseline)),
      target: parseDollarValue(findFieldByGid(customFields, fieldMappings.target)),
      validated: parseDollarValue(findFieldByGid(customFields, fieldMappings.validated)),
      realized: parseDollarValue(findFieldByGid(customFields, fieldMappings.realized)),
    };

    // Extract and map stage
    const stageField = findFieldByGid(customFields, fieldMappings.stage);
    const stage = mapStage(stageField, stageValueMap);

    // Timestamp
    const lastSyncedAt = new Date().toISOString();

    return {
      name: asanaTask.name || null,
      asanaGid: asanaTask.gid || null,
      savings,
      stage,
      lastSyncedAt,
    };
  },

  /**
   * Perform a full sync from the configured Asana project.
   * Fetches all tasks from the project and maps their fields.
   * @param {object} initiativeStore - The InitiativeStore instance
   * @returns {Promise<object>} Result with updated initiatives and any errors
   */
  async sync(initiativeStore) {
    if (!_config) {
      return createErrorResponse('ASANA_AUTH_FAILED', 'Adapter not configured. Call configure() first.');
    }

    const accessToken = resolveAccessToken(_config.accessTokenRef);
    if (!accessToken) {
      return createErrorResponse('ASANA_AUTH_FAILED', `Access token not found in environment variable "${_config.accessTokenRef}".`);
    }

    const url = `https://app.asana.com/api/1.0/projects/${_config.projectId}/tasks?opt_fields=gid,name,custom_fields,custom_fields.gid,custom_fields.name,custom_fields.number_value,custom_fields.enum_value,custom_fields.enum_value.name`;

    let response;
    try {
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
    } catch (err) {
      return createErrorResponse('ASANA_NETWORK_ERROR', `Network error while contacting Asana API: ${err.message}`);
    }

    // Handle HTTP error responses
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return createErrorResponse('ASANA_AUTH_FAILED', `Authentication failed (HTTP ${response.status}). Check your Asana access token.`);
      }
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After'), 10) || 60;
        return createErrorResponse('ASANA_RATE_LIMITED', 'Asana API rate limit exceeded. Retry later.', retryAfter);
      }
      return createErrorResponse('ASANA_NETWORK_ERROR', `Asana API returned HTTP ${response.status}: ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      return createErrorResponse('ASANA_NETWORK_ERROR', `Failed to parse Asana API response: ${err.message}`);
    }

    const tasks = data.data || [];
    const updated = [];
    const errors = [];

    for (const task of tasks) {
      try {
        const mapped = this.mapFields(task);
        updated.push(mapped);
      } catch (err) {
        errors.push({ taskGid: task.gid, error: err.message });
      }
    }

    return {
      success: true,
      updated,
      errors,
    };
  },
};

export default AsanaAdapter;
