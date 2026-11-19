export default class ApiError extends Error {
  constructor(statusCode, message, errors, code) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code; // machine readable, e.g. EMAIL_NOT_VERIFIED
  }
}
