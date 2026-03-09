class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Express global error handler
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // Structured server-side log for easier debugging
  console.error('💥 [Billing Error]', {
    path: req.path,
    method: req.method,
    message: err.message,
    code,
    statusCode,
    stack: err.stack
  });

  // Never leak stack traces to the client
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    code,
  });
};

module.exports = {
  AppError,
  errorHandler,
};

