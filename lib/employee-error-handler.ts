/**
 * Employee Error Handler
 * Categorizes and provides user-friendly error messages for employee data operations
 */

export enum EmployeeErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  EMPLOYMENT_DATA_MISSING = 'EMPLOYMENT_DATA_MISSING',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
}

export interface EmployeeError {
  type: EmployeeErrorType;
  message: string;
  userMessage: string;
  detail?: string;
  statusCode?: number;
  suggestion?: string;
}

export interface FetchErrorContext {
  status?: number;
  error?: any;
  endpoint?: string;
  responseBody?: any;
}

/**
 * Categorize and create user-friendly error message for employee data fetching
 */
export function handleEmployeeDataError(context: FetchErrorContext): EmployeeError {
  const { status, error, endpoint, responseBody } = context;

  // Network/Connection errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: EmployeeErrorType.NETWORK_ERROR,
      message: 'Network connection failed',
      userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      suggestion: 'Check your network connection and refresh the page.',
      statusCode: 0,
    };
  }

  // Timeout errors
  if (error instanceof Error && error.message.includes('timeout')) {
    return {
      type: EmployeeErrorType.TIMEOUT,
      message: 'Request timeout',
      userMessage: 'The request took too long to complete. Please try again.',
      suggestion: 'Try refreshing the page or contact support if the problem persists.',
    };
  }

  // HTTP status-based errors
  switch (status) {
    case 401:
      return {
        type: EmployeeErrorType.UNAUTHORIZED,
        message: 'Authentication required',
        userMessage: 'Your session has expired. Please log in again to continue.',
        suggestion: 'Refresh the page or log in again.',
        statusCode: 401,
      };

    case 403:
      return {
        type: EmployeeErrorType.FORBIDDEN,
        message: 'Permission denied',
        userMessage:
          responseBody?.error === 'Insufficient permissions to view employee financial data'
            ? 'You do not have permission to view this employee\'s financial information. Contact your administrator if you believe this is incorrect.'
            : responseBody?.error === 'Insufficient permissions to view employee details'
              ? 'You do not have permission to view this employee\'s information. Contact your administrator.'
              : 'You do not have permission to perform this action.',
        detail: responseBody?.error,
        suggestion: 'Contact an administrator to request access.',
        statusCode: 403,
      };

    case 404:
      return {
        type: EmployeeErrorType.NOT_FOUND,
        message: 'Employee not found',
        userMessage: 'The employee record could not be found. The employee may have been deleted or the ID is incorrect.',
        suggestion: 'Go back to the employee list and select a valid employee.',
        statusCode: 404,
      };

    case 400:
      return {
        type: EmployeeErrorType.INVALID_RESPONSE,
        message: 'Invalid request',
        userMessage: 'There was an issue with the request. Please try again.',
        detail: responseBody?.error,
        statusCode: 400,
      };

    case 500:
    case 502:
    case 503:
      return {
        type: EmployeeErrorType.SERVER_ERROR,
        message: `Server error (${status})`,
        userMessage: 'The server encountered an error while processing your request. Please try again later.',
        suggestion: 'Try refreshing the page. If the problem persists, contact support.',
        statusCode: status,
      };

    default:
      break;
  }

  // Check for specific data missing scenarios in response
  if (responseBody?.error?.includes('Employment details not found')) {
    return {
      type: EmployeeErrorType.EMPLOYMENT_DATA_MISSING,
      message: 'Employment data not found',
      userMessage: 'This employee\'s employment information is not available. The record may be incomplete or corrupted.',
      detail: responseBody?.error,
      suggestion: 'Contact support or try updating the employee record.',
      statusCode: 404,
    };
  }

  // Generic error fallback
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    type: EmployeeErrorType.SERVER_ERROR,
    message: errorMessage || 'Unknown error',
    userMessage: 'Failed to load employee details. Please try again.',
    detail: errorMessage,
    suggestion: "Refresh the page or contact support if the problem continues.",
  };
}

/**
 * Extract error details from fetch response
 */
export async function extractResponseError(response: Response): Promise<FetchErrorContext> {
  try {
    const body = await response.json();
    return {
      status: response.status,
      responseBody: body,
      endpoint: response.url,
    };
  } catch (e) {
    return {
      status: response.status,
      endpoint: response.url,
    };
  }
}

/**
 * Helper to get error icon based on type
 */
export function getErrorIcon(type: EmployeeErrorType): 'alert' | 'network' | 'lock' | 'search' | 'server' | 'clock' {
  switch (type) {
    case EmployeeErrorType.NETWORK_ERROR:
      return 'network';
    case EmployeeErrorType.UNAUTHORIZED:
    case EmployeeErrorType.FORBIDDEN:
      return 'lock';
    case EmployeeErrorType.NOT_FOUND:
    case EmployeeErrorType.EMPLOYMENT_DATA_MISSING:
      return 'search';
    case EmployeeErrorType.SERVER_ERROR:
      return 'server';
    case EmployeeErrorType.TIMEOUT:
      return 'clock';
    default:
      return 'alert';
  }
}
