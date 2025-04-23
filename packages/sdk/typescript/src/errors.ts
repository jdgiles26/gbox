// Base error class for all SDK errors
export class GBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GBoxError';
    // Maintain proper stack trace (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GBoxError);
    }
  }
}

// Error for API related issues (e.g., network error, non-2xx response)
export class APIError extends GBoxError {
  public readonly statusCode?: number;
  public readonly responseData?: any;

  constructor(message: string, statusCode?: number, responseData?: any) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.responseData = responseData;
  }
}

// Error for resource not found (e.g., 404)
export class NotFoundError extends APIError {
  constructor(message: string, responseData?: any) {
    super(message, 404, responseData);
    this.name = 'NotFoundError';
  }
}

// Error for resource conflicts (e.g., 409)
export class ConflictError extends APIError {
  constructor(message: string, responseData?: any) {
    super(message, 409, responseData);
    this.name = 'ConflictError';
  }
}

// Add other specific error types as needed (e.g., ValidationError, AuthenticationError) 