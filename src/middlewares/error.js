import ApiError from "../utils/ApiError.js";
import { config } from "../config/config.js";

export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// Central error handler. All errors leave the API in the same shape: { success:false, message, errors? }
export const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  let status = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors;
  const code = err instanceof ApiError ? err.code : undefined; // only our own machine codes are exposed

  if (err.name === "ValidationError" && err.errors && !(err instanceof ApiError)) {
    status = 422;
    message = "Validation failed";
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === "CastError") {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000 && !(err instanceof ApiError)) {
    status = 409;
    message = "A record with these details already exists";
  } else if (err.name === "TokenExpiredError") {
    status = 401;
    message = "Session expired, please log in again";
  } else if (err.name === "JsonWebTokenError") {
    status = 401;
    message = "Invalid authentication token";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Malformed JSON body";
  }

  if (status >= 500) {
    console.error(err);
    if (config.isProd) message = "Internal server error";
  }

  res.status(status).json({ success: false, message, ...(errors ? { errors } : {}), ...(code ? { code } : {}) });
};
