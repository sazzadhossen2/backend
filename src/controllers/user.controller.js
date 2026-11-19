import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";

export const getMe = asyncHandler(async (req, res) => {
  ok(res, { user: req.user });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
  ok(res, { user: req.user }, "Profile updated successfully");
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) throw new ApiError(400, "Current password is incorrect");
  if (currentPassword === newPassword) throw new ApiError(400, "New password must be different from the current one");

  user.password = newPassword;
  await user.save();
  ok(res, null, "Password changed successfully");
});
