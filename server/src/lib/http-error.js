class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function isHttpError(err) {
  return err && typeof err.status === 'number';
}

module.exports = { HttpError, isHttpError };
