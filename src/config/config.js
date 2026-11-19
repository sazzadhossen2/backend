import "dotenv/config";

const required = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const list = (value, fallback = []) =>
  value ? value.split(",").map((s) => s.trim()).filter(Boolean) : fallback;

const num = (value, fallback) => {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) ? n : fallback;
};

export const config = {
  env: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: num(process.env.PORT, 5001),
  mongoUri: required("MONGO_URI"),
  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_SECRET_EXPIRES_IN || "7d",
  },
  corsOrigins: list(process.env.CORS_ORIGINS, ["*"]),
  business: {
    open: process.env.BUSINESS_OPEN || "09:00",
    close: process.env.BUSINESS_CLOSE || "18:00",
    slotMinutes: num(process.env.SLOT_MINUTES, 30),
    tzOffsetMinutes: num(process.env.BUSINESS_TZ_OFFSET_MIN, 360),
    maxAdvanceDays: num(process.env.MAX_ADVANCE_DAYS, 30),
  },
  mail: {
    user: process.env.SMTP_USER || "",
    // Google app passwords are shown with spaces ("abcd efgh ijkl mnop"); SMTP wants them without.
    pass: (process.env.SMTP_PASS || "").replace(/\s+/g, ""),
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: num(process.env.SMTP_PORT, 465),
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE.toLowerCase() === "true"
      : num(process.env.SMTP_PORT, 465) === 465,
    fromName: process.env.MAIL_FROM_NAME || "KicuLagbe",
  },
  otp: {
    length: 6,
    ttlMinutes: num(process.env.OTP_TTL_MINUTES, 10),
    maxAttempts: num(process.env.OTP_MAX_ATTEMPTS, 5),
    resendCooldownSeconds: num(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60),
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    // Stripe cannot charge in BDT for most accounts, so prices (BDT) are converted.
    currency: (process.env.PAYMENT_CURRENCY || "usd").toLowerCase(),
    bdtPerUnit: num(process.env.BDT_PER_CURRENCY_UNIT, 120), // e.g. 120 BDT = 1 USD
  },
  ai: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  },
};
