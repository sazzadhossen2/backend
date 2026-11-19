import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../utils/token.js";

// Protects a route: requires `Authorization: Bearer <jwt>`.
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) throw new ApiError(401, "Authentication required");

  const payload = verifyToken(token); // JsonWebTokenError / TokenExpiredError handled in error middleware
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, "User no longer exists");

  req.user = user;
  next();
});

export const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) throw new ApiError(403, "You do not have permission to do this");
    next();
  };
