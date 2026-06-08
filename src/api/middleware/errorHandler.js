const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details,
    });
  }

  if (err.message.includes('not found')) {
    return res.status(404).json({
      error: 'Not Found',
      message: err.message,
    });
  }

  return res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
};

module.exports = errorHandler;
