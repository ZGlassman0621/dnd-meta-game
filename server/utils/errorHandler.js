/**
 * Standardized API Error Response Utility
 *
 * Provides consistent error formatting across all API routes.
 * Logs full error details server-side while returning safe messages to clients.
 */

// Standard error codes for common scenarios
export const ErrorCodes = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFLICT: 'CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED'
};

/**
 * Send a standardized error response
 * @param {Response} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - User-friendly error message
 * @param {string} [code] - Optional error code for client handling
 */
export function sendError(res, status, message, code = null) {
  const response = { error: message };
  if (code) {
    response.code = code;
  }
  return res.status(status).json(response);
}

/**
 * Handle and log internal server errors
 * @param {Response} res - Express response object
 * @param {Error} error - The caught error
 * @param {string} context - Description of what operation failed
 */
export function handleServerError(res, error, context) {
  console.error(`Error ${context}:`, error);
  return sendError(res, 500, `Failed to ${context}`, ErrorCodes.INTERNAL_ERROR);
}

/**
 * Send a 404 Not Found response
 * @param {Response} res - Express response object
 * @param {string} resource - Name of the resource that wasn't found
 */
export function notFound(res, resource) {
  return sendError(res, 404, `${resource} not found`, ErrorCodes.NOT_FOUND);
}

/**
 * Send a 400 Bad Request response for validation errors
 * @param {Response} res - Express response object
 * @param {string} message - Validation error message
 */
export function validationError(res, message) {
  return sendError(res, 400, message, ErrorCodes.VALIDATION_ERROR);
}

/**
 * Send a 409 Conflict response
 * @param {Response} res - Express response object
 * @param {string} message - Conflict description
 */
export function conflict(res, message) {
  return sendError(res, 409, message, ErrorCodes.CONFLICT);
}

export default {
  ErrorCodes,
  sendError,
  handleServerError,
  notFound,
  validationError,
  conflict
};
