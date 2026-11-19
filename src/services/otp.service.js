import crypto from "crypto";
import otpGenerator from "otp-generator";
import Otp from "../models/Otp.js";
import ApiError from "../utils/ApiError.js";
import { config } from "../config/config.js";

const { length, ttlMinutes, maxAttempts, resendCooldownSeconds } = config.otp;

// Keyed hash (HMAC) so a leaked database does not reveal usable codes.
const hashCode = (email, purpose, code) =>
  crypto.createHmac("sha256", config.jwt.secret).update(`${email}:${purpose}:${code}`).digest("hex");

const safeEqual = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Creates (or replaces) the code for email+purpose and returns the plain code to be emailed. */
export const issueOtp = async (email, purpose) => {
  const existing = await Otp.findOne({ email, purpose }).lean();
  if (existing) {
    const waitSeconds = resendCooldownSeconds - (Date.now() - new Date(existing.lastSentAt).getTime()) / 1000;
    if (waitSeconds > 0) {
      throw new ApiError(429, `Please wait ${Math.ceil(waitSeconds)} seconds before requesting a new code`, undefined, "OTP_COOLDOWN");
    }
  }

  const code = otpGenerator.generate(length, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  await Otp.findOneAndUpdate(
    { email, purpose },
    { codeHash: hashCode(email, purpose, code), attempts: 0, lastSentAt: new Date(), expiresAt: new Date(Date.now() + ttlMinutes * 60000) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return code;
};

export const discardOtp = (email, purpose) => Otp.deleteOne({ email, purpose });

/** Throws unless `code` matches the active code. A correct code is single-use. */
export const verifyOtp = async (email, purpose, code) => {
  // Atomic increment first: parallel guesses cannot exceed the attempt limit.
  const record = await Otp.findOneAndUpdate({ email, purpose, expiresAt: { $gt: new Date() } }, { $inc: { attempts: 1 } }, { new: true });
  if (!record) throw new ApiError(400, "This code has expired. Please request a new one.", undefined, "OTP_EXPIRED");

  if (record.attempts > maxAttempts) {
    await record.deleteOne();
    throw new ApiError(429, "Too many incorrect attempts. Please request a new code.", undefined, "OTP_LOCKED");
  }
  if (!safeEqual(record.codeHash, hashCode(email, purpose, code))) {
    const left = maxAttempts - record.attempts;
    throw new ApiError(400, left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Incorrect code. Request a new one.", undefined, "OTP_INVALID");
  }
  await record.deleteOne();
};

export const otpTtlMinutes = ttlMinutes;
