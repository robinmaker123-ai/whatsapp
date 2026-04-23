const { 
  MongoServerError, 
  MongoNetworkError, 
  MongoTimeoutError,
  MongoAPIError 
} = require('mongodb');

/**
 * Processes MongoDB errors and returns a standardized response object.
 * Useful for Express controllers or Socket.io event handlers.
 */
function handleDatabaseError(error) {
  if (error instanceof MongoServerError) {
    // Handle specific server error codes
    // 11000 is the code for a Duplicate Key error
    if (error.code === 11000) {
      return { status: 400, message: 'Duplicate record found.', detail: error.keyValue };
    }
    console.error('[Database Server Error]', error.message);
    return { status: 500, message: 'Database operation failed.' };
  }

  if (error instanceof MongoNetworkError) {
    console.error('[Database Network Error] Check connection:', error.message);
    return { status: 503, message: 'Database is currently unreachable.' };
  }

  if (error instanceof MongoTimeoutError) {
    return { status: 408, message: 'The database operation timed out.' };
  }

  if (error instanceof MongoAPIError) {
    console.error('[Driver API Usage Error]:', error.message);
    return { status: 500, message: 'Internal application error.' };
  }

  return { status: 500, message: 'An unknown error occurred.' };
}

module.exports = { handleDatabaseError };