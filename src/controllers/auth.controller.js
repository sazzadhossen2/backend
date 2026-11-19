import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, created } from "../utils/response.js";
import { signToken } from "../utils/token.js";
import { issueOtp, verifyOtp, discardOtp, otpTtlMinutes } from "../services/otp.service.js";
import { sendOtpEmail } from "../services/mail.service.js";

// Generates a code and emails it. If the email cannot be sent the code is discarded.
const sendCode = async (user, purpose) => {
  const code = await issueOtp(user.email, purpose);
  try {
    await sendOtpEmail({ to: user.email, name: user.name, code, purpose, ttlMinutes: otpTtlMinutes });
  } catch (error) {
    console.error("OTP email failed:", error.message);
    await discardOtp(user.email, purpose);
    throw new ApiError(502, "We could not send the email right now. Please try again in a moment.");
  }
};

// Cooldown errors are not interesting for flows that must not reveal whether an account exists.
const sendCodeQuietly = async (user, purpose) => {
  try {
    await sendCode(user, purpose);
  } catch (error) {
    if (error.code !== "OTP_COOLDOWN") throw error;
  }
};

const session = (user) => ({ user, token: signToken(user._id) });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  let user = await User.findOne({ email }).select("+password");
  if (user?.isEmailVerified) throw new ApiError(409, "An account with this email already exists");

  if (user) {
    // Same person retrying before verifying: refresh their details.
    user.name = name;
    user.password = password;
    await user.save();
  } else {
    user = await User.create({ name, email, password }); // password hashed in the model hook
  }

  await sendCode(user, "verify");
  created(res, { email, requiresVerification: true }, `We sent a 6-digit code to ${email}`);
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, "Invalid or expired code", undefined, "OTP_INVALID");

  if (!user.isEmailVerified) {
    await verifyOtp(email, "verify", otp);
    user.isEmailVerified = true;
    await user.save();
  }
  ok(res, session(user), "Email verified");
});

export const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  // Generic answer: does not reveal which emails are registered.
  if (user && !user.isEmailVerified) await sendCode(user, "verify");
  ok(res, null, "If this email needs verification, a new code has been sent");
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  // Same message for unknown email and wrong password (prevents account enumeration).
  if (!user || !(await user.comparePassword(password))) throw new ApiError(401, "Invalid email or password");

  const isDemoAccount =
    email.toLowerCase() === "demo@kiculagbe.com" ||
    email.toLowerCase() === "admin@kiculagbe.com";
  if (isDemoAccount && !user.isEmailVerified) {
    user.isEmailVerified = true;
    await user.save();
  }

  if (!user.isEmailVerified) {
    await sendCodeQuietly(user, "verify");
    throw new ApiError(403, "Please verify your email. We sent you a new code.", undefined, "EMAIL_NOT_VERIFIED");
  }
  ok(res, session(user), "Login successful");
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) await sendCodeQuietly(user, "reset");
  ok(res, null, "If an account exists for this email, a reset code has been sent");
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, "Invalid or expired code", undefined, "OTP_INVALID");

  await verifyOtp(email, "reset", otp);
  user.password = newPassword;
  user.isEmailVerified = true; // proving access to the inbox also verifies the email
  await user.save();
  ok(res, null, "Password reset successfully. You can log in now.");
});

// JWTs are stateless; the client discards the token. Endpoint exists for a clean, symmetrical API.
export const logout = asyncHandler(async (req, res) => {
  ok(res, null, "Logged out successfully");
});
