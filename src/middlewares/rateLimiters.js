import rateLimit from "express-rate-limit";

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });

export const apiLimiter = make(15 * 60 * 1000, 300, "Too many requests, please try again later.");
// Brute-force protection for login / register
export const authLimiter = make(15 * 60 * 1000, 20, "Too many attempts, please try again in 15 minutes.");
// Protects the paid AI API from abuse
export const aiLimiter = make(60 * 1000, 15, "You are sending messages too quickly. Please wait a moment.");
// OTP endpoints: stops code guessing and email bombing
export const otpLimiter = make(15 * 60 * 1000, 12, "Too many code requests, please try again in 15 minutes.");
// Payment endpoints
export const paymentLimiter = make(15 * 60 * 1000, 40, "Too many payment requests, please try again later.");
