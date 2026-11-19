import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const password = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number");

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,16}$/, "Enter a valid phone number")
  .or(z.literal(""));

export const registerSchema = z.object({
  name: z.string({ required_error: "Name is required" }).trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Enter a valid email address"),
  password,
});

export const loginSchema = z.object({
  email: z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Enter a valid email address"),
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(60).optional(),
    phone: phone.optional(),
  })
  .refine((v) => v.name !== undefined || v.phone !== undefined, { message: "Nothing to update" });

export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: "Current password is required" }).min(1, "Current password is required"),
  newPassword: password,
});

export const listServicesQuery = z.object({
  search: z.string().trim().max(60).optional(),
  category: z.string().trim().max(40).optional(),
  featured: z.enum(["true", "false"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(["popular", "price_asc", "price_desc", "rating", "newest"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const availabilityQuery = z.object({
  date: z.string({ required_error: "date is required (YYYY-MM-DD)" }),
});

export const createAppointmentSchema = z.object({
  serviceId: objectId,
  startAt: z.string({ required_error: "startAt is required" }).datetime({ message: "startAt must be an ISO date-time" }),
  notes: z.string().trim().max(300, "Notes can be at most 300 characters").optional().default(""),
});

export const listAppointmentsQuery = z.object({
  when: z.enum(["upcoming", "past"]).optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["confirmed", "cancelled", "completed"]),
});

export const aiChatSchema = z.object({
  message: z.string({ required_error: "message is required" }).trim().min(1, "Message cannot be empty").max(500, "Message is too long"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(1000),
      })
    )
    .max(12)
    .optional()
    .default([]),
});

// ---------- OTP / password reset ----------
const emailField = z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Enter a valid email address");
const otpField = z.string({ required_error: "Code is required" }).trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export const verifyOtpSchema = z.object({ email: emailField, otp: otpField });
export const emailOnlySchema = z.object({ email: emailField });
export const resetPasswordSchema = z.object({ email: emailField, otp: otpField, newPassword: password });

// ---------- Reviews ----------
export const createReviewSchema = z.object({
  appointmentId: objectId,
  rating: z.coerce.number().int().min(1, "Rating must be 1-5").max(5, "Rating must be 1-5"),
  comment: z.string().trim().max(500, "Comment can be at most 500 characters").optional().default(""),
});
export const reviewsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ---------- Payments ----------
export const paymentSchema = z.object({ appointmentId: objectId });

// ---------- Admin ----------
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:mm");

export const adminAppointmentsQuery = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]).optional(),
  date: dateStr.optional(),
  month: month.optional(),
  search: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const adminStatusSchema = z.object({
  status: z.enum(["confirmed", "cancelled", "completed"]),
  reason: z.string().trim().max(200).optional().default(""),
});
export const adminStatsQuery = z.object({ month: month.optional() });
export const adminReviewsQuery = z.object({ month: month.optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30) });

export const busyCreateSchema = z.object({
  date: dateStr,
  from: hm,
  to: hm,
  serviceId: objectId.nullable().optional(),
  reason: z.string().trim().max(120).optional().default(""),
});

export const serviceBodySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  description: z.string().trim().min(5, "Description is too short").max(1000),
  category: z.string().trim().min(2, "Category is required").max(40),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  durationMinutes: z.coerce.number().int().min(15, "Minimum 15 minutes").max(480, "Maximum 480 minutes"),
  image: z.string().trim().url("Image must be a valid URL").or(z.literal("")).optional().default(""),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});
export const serviceUpdateSchema = serviceBodySchema.partial().refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });
