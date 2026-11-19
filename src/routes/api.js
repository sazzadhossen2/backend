import { Router } from "express";

import { protect, restrictTo } from "../middlewares/auth.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { authLimiter, aiLimiter, otpLimiter, paymentLimiter } from "../middlewares/rateLimiters.js";
import * as v from "../utils/validators.js";

import * as auth from "../controllers/auth.controller.js";
import * as users from "../controllers/user.controller.js";
import * as services from "../controllers/service.controller.js";
import * as appointments from "../controllers/appointment.controller.js";
import * as ai from "../controllers/ai.controller.js";
import * as reviews from "../controllers/review.controller.js";
import * as payments from "../controllers/payment.controller.js";
import adminRouter from "./admin.js";

const router = Router();
router.param("id", validateObjectId);

router.get("/health", (req, res) => res.json({ success: true, message: "OK", data: { uptime: process.uptime() } }));

// ---- Auth ----
router.post("/auth/register", authLimiter, validate(v.registerSchema), auth.register);
router.post("/auth/login", authLimiter, validate(v.loginSchema), auth.login);
router.post("/auth/verify-otp", otpLimiter, validate(v.verifyOtpSchema), auth.verifyEmail);
router.post("/auth/resend-otp", otpLimiter, validate(v.emailOnlySchema), auth.resendOtp);
router.post("/auth/forgot-password", otpLimiter, validate(v.emailOnlySchema), auth.forgotPassword);
router.post("/auth/reset-password", otpLimiter, validate(v.resetPasswordSchema), auth.resetPassword);
router.post("/auth/logout", protect, auth.logout);

// ---- Current user ----
router.get("/users/me", protect, users.getMe);
router.put("/users/me", protect, validate(v.updateProfileSchema), users.updateMe);
router.put("/users/me/password", protect, validate(v.changePasswordSchema), users.changePassword);

// ---- Services (public) ----
router.get("/services", validate(v.listServicesQuery, "query"), services.listServices);
router.get("/services/categories", services.listCategories);
router.get("/services/:id", services.getService);
router.get("/services/:id/reviews", validate(v.reviewsQuery, "query"), reviews.listServiceReviews);
router.get("/services/:id/availability", validate(v.availabilityQuery, "query"), services.getServiceAvailability);

// ---- Appointments (protected) ----
router.post("/appointments", protect, validate(v.createAppointmentSchema), appointments.createAppointment);
router.get("/appointments", protect, validate(v.listAppointmentsQuery, "query"), appointments.listMyAppointments);
router.get("/appointments/:id", protect, appointments.getMyAppointment);
router.patch("/appointments/:id/cancel", protect, appointments.cancelAppointment);

// ---- Reviews (customer, completed bookings only) ----
router.post("/reviews", protect, validate(v.createReviewSchema), reviews.createReview);

// ---- Payments (Stripe). The webhook itself is mounted in app.js because it needs the raw body ----
router.post("/payments/intent", protect, paymentLimiter, validate(v.paymentSchema), payments.createPaymentIntent);
router.post("/payments/confirm", protect, paymentLimiter, validate(v.paymentSchema), payments.confirmPayment);

// ---- Admin (role = admin) ----
router.use("/admin", protect, restrictTo("admin"), adminRouter);

// ---- AI assistant (protected + rate limited) ----
router.post("/ai/chat", protect, aiLimiter, validate(v.aiChatSchema), ai.chat);

export default router;
