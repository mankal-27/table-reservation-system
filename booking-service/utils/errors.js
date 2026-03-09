class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  console.error('💥 [Booking Error]', {
    path: req.path,
    method: req.method,
    message: err.message,
    code,
    statusCode,
    stack: err.stack
  });

  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    code,
  });
};

module.exports = {
  AppError,
  errorHandler,
};

