const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // MySQL errors
  if (err.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        error = { message: 'Duplicate entry found', statusCode: 400 };
        break;
      case 'ER_NO_REFERENCED_ROW_2':
        error = { message: 'Referenced record not found', statusCode: 400 };
        break;
      case 'ER_ROW_IS_REFERENCED_2':
        error = { message: 'Cannot delete record as it is referenced by other records', statusCode: 400 };
        break;
      case 'ER_DATA_TOO_LONG':
        error = { message: 'Data too long for field', statusCode: 400 };
        break;
      case 'ER_BAD_NULL_ERROR':
        error = { message: 'Required field cannot be null', statusCode: 400 };
        break;
      default:
        if (process.env.NODE_ENV === 'development') {
          error = { message: err.message, statusCode: 500 };
        } else {
          error = { message: 'Database error occurred', statusCode: 500 };
        }
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = { message: 'Invalid token', statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    error = { message: 'Token expired', statusCode: 401 };
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = { message: 'File too large', statusCode: 400 };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error = { message: 'Too many files', statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = { message: 'Unexpected file field', statusCode: 400 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
