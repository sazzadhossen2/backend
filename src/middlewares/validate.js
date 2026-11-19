import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";

// Validates req[source] against a zod schema. Parsed (coerced) data replaces the raw input.
export const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return next(new ApiError(422, errors[0]?.message || "Validation failed", errors));
    }
    if (source === "query") req.validatedQuery = result.data;
    else req[source] = result.data;
    next();
  };

// Rejects malformed ObjectIds in :id params with a clean 400/404 instead of a CastError.
export const validateObjectId = (req, res, next, value) => {
  if (!mongoose.isValidObjectId(value)) return next(new ApiError(404, "Resource not found"));
  next();
};
