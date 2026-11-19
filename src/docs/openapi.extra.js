// v2 additions to the OpenAPI document: email OTP, payments, reviews, busy time and the admin API.
const ID = "665f1c2a9b1e4a0012a3b4c5";
const secured = [{ bearerAuth: [] }];
const idParam = { name: "id", in: "path", required: true, schema: { type: "string", example: ID } };
const env = (data, message = "Success") => ({ type: "object", properties: { success: { type: "boolean", example: true }, message: { type: "string", example: message }, data } });
const json = (schema, example) => ({ "application/json": { schema, ...(example ? { example } : {}) } });
const body = (props, required, example) => ({ required: true, content: json({ type: "object", required, properties: props }, example) });
const res = (description, data, example, message) => ({ description, content: json(env(data), { success: true, message: message || "Success", data: example }) });
const err = (description, message, code) => ({ description, content: json({ $ref: "#/components/schemas/ErrorResponse" }, { success: false, message, ...(code ? { code } : {}) }) });
const str = (example) => ({ type: "string", example });
const month = { name: "month", in: "query", description: "YYYY-MM (business time zone). Defaults to the current month.", schema: { type: "string", example: "2026-11" } };
const admin = (tag = "Admin") => ({ tags: [tag], security: secured });
const adminErrors = { 401: { $ref: "#/components/responses/Unauthorized" }, 403: err("Not an admin", "You do not have permission to do this") };

export const applyExtensions = (doc) => {
  doc.info.version = "2.0.0";
  doc.info.description += [
    "",
    "",
    "**v2:** register now sends a 6-digit **email OTP** (Nodemailer); login is blocked until the email is verified. Bookings can be paid with **Stripe** (PaymentIntent + PaymentSheet). Customers can **review** completed bookings. Admins manage requests, busy time, services and see **monthly statistics** under `/admin/*`.",
  ].join("\n");
  doc.tags.push(
    { name: "Reviews", description: "Customer reviews of completed bookings" },
    { name: "Payments", description: "Stripe payments" },
    { name: "Admin", description: "Admin only (role = admin)" }
  );

  delete doc.paths["/appointments/{id}/status"]; // moved to /admin/appointments/{id}/status

  // ---- Auth (OTP) ----
  const reg = doc.paths["/auth/register"]?.post;
  if (reg) {
    reg.summary = "Register (sends a verification code by email)";
    reg.responses["201"] = res("Code sent. The account stays unverified until the code is confirmed.", { type: "object", properties: { email: str("demo@example.com"), requiresVerification: { type: "boolean", example: true } } }, { email: "demo@example.com", requiresVerification: true }, "We sent a 6-digit code to demo@example.com");
  }
  const login = doc.paths["/auth/login"]?.post;
  if (login) login.responses["403"] = err("Email not verified (a new code was sent)", "Please verify your email. We sent you a new code.", "EMAIL_NOT_VERIFIED");

  const tokenData = { type: "object", properties: { user: { $ref: "#/components/schemas/User" }, token: str("eyJhbGciOi...") } };
  const emailBody = body({ email: str("demo@example.com") }, ["email"]);
  doc.paths["/auth/verify-otp"] = {
    post: {
      tags: ["Auth"],
      summary: "Verify email with the 6-digit code",
      description: "Codes expire after 10 minutes, are single use and allow 5 wrong attempts.",
      requestBody: body({ email: str("demo@example.com"), otp: str("482913") }, ["email", "otp"]),
      responses: { 200: res("Verified, session started", tokenData, { user: {}, token: "eyJ..." }, "Email verified"), 400: err("Wrong or expired code", "Incorrect code. 4 attempts left.", "OTP_INVALID"), 429: err("Locked after too many attempts", "Too many incorrect attempts. Please request a new code.", "OTP_LOCKED") },
    },
  };
  doc.paths["/auth/resend-otp"] = { post: { tags: ["Auth"], summary: "Send a new verification code (60 s cooldown)", requestBody: emailBody, responses: { 200: res("Generic answer (does not reveal if the email exists)", { nullable: true }, null), 429: err("Cooldown", "Please wait 42 seconds before requesting a new code", "OTP_COOLDOWN") } } };
  doc.paths["/auth/forgot-password"] = { post: { tags: ["Auth"], summary: "Email a password reset code", requestBody: emailBody, responses: { 200: res("Generic answer", { nullable: true }, null) } } };
  doc.paths["/auth/reset-password"] = {
    post: {
      tags: ["Auth"],
      summary: "Set a new password using the emailed code",
      requestBody: body({ email: str("demo@example.com"), otp: str("482913"), newPassword: str("NewPass123") }, ["email", "otp", "newPassword"]),
      responses: { 200: res("Password reset", { nullable: true }, null, "Password reset successfully. You can log in now."), 400: err("Wrong or expired code", "This code has expired. Please request a new one.", "OTP_EXPIRED") },
    },
  };

  // ---- Reviews ----
  doc.paths["/reviews"] = {
    post: {
      tags: ["Reviews"], security: secured, summary: "Review a completed booking (once per booking)",
      requestBody: body({ appointmentId: str(ID), rating: { type: "integer", minimum: 1, maximum: 5, example: 5 }, comment: str("Great service!") }, ["appointmentId", "rating"]),
      responses: { 201: res("Review saved; the service rating is recalculated", { type: "object", properties: { review: { type: "object" } } }, { review: { id: ID, rating: 5, comment: "Great service!" } }, "Thanks for your review!"), 400: err("Booking not completed", "You can review a service after your booking is completed"), 409: err("Already reviewed", "You have already reviewed this booking") },
    },
  };
  doc.paths["/services/{id}/reviews"] = {
    get: {
      tags: ["Reviews"], summary: "Public reviews of a service", parameters: [idParam, { name: "page", in: "query", schema: { type: "integer" } }, { name: "limit", in: "query", schema: { type: "integer" } }],
      responses: { 200: res("Reviews, newest first", { type: "object", properties: { items: { type: "array", items: { type: "object" } }, total: { type: "integer" } } }, { items: [{ id: ID, rating: 5, comment: "Great!", user: { name: "Demo User" }, createdAt: "2026-11-10T10:00:00.000Z" }], total: 1, page: 1, limit: 20 }) },
    },
  };

  // ---- Payments ----
  const payBody = body({ appointmentId: str(ID) }, ["appointmentId"]);
  doc.paths["/payments/intent"] = {
    post: {
      tags: ["Payments"], security: secured, summary: "Create a Stripe PaymentIntent for a pending/confirmed booking",
      description: "Price (BDT) is converted to `PAYMENT_CURRENCY` using `BDT_PER_CURRENCY_UNIT`. The app passes `clientSecret` to Stripe's PaymentSheet.",
      requestBody: payBody,
      responses: { 200: res("Intent created", { type: "object", properties: { clientSecret: str("pi_..._secret_..."), paymentIntentId: str("pi_123"), publishableKey: str("pk_..."), amount: { type: "integer", example: 2083 }, currency: str("usd") } }, { clientSecret: "pi_123_secret_abc", paymentIntentId: "pi_123", publishableKey: "pk_test_...", amount: 2083, currency: "usd" }), 409: err("Already paid", "This booking is already paid"), 503: err("Stripe not configured", "Online payment is not configured on the server") },
    },
  };
  doc.paths["/payments/confirm"] = {
    post: { tags: ["Payments"], security: secured, summary: "Verify the payment with Stripe and mark the booking paid", requestBody: payBody, responses: { 200: res("Paid", { type: "object", properties: { appointment: { $ref: "#/components/schemas/Appointment" } } }, { appointment: {} }, "Payment successful"), 402: err("Not completed", "Payment not completed (status: requires_payment_method)") } },
  };
  doc.paths["/payments/webhook"] = {
    post: { tags: ["Payments"], summary: "Stripe webhook (payment_intent.succeeded). Signature verified with STRIPE_WEBHOOK_SECRET.", responses: { 200: { description: "Received" }, 400: { description: "Invalid signature" } } },
  };

  // ---- Admin ----
  const apptItem = { $ref: "#/components/schemas/Appointment" };
  doc.paths["/admin/appointments"] = {
    get: {
      ...admin(), summary: "All customer bookings (requests)",
      parameters: [
        { name: "status", in: "query", schema: { type: "string", enum: ["pending", "confirmed", "cancelled", "completed"] } },
        { name: "date", in: "query", description: "YYYY-MM-DD", schema: { type: "string" } }, month,
        { name: "search", in: "query", description: "Customer name or email", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer" } }, { name: "limit", in: "query", schema: { type: "integer" } },
      ],
      responses: { 200: res("Bookings with customer details and per-status counts", { type: "object", properties: { items: { type: "array", items: apptItem }, total: { type: "integer" }, counts: { type: "object" } } }, { items: [], total: 0, page: 1, limit: 30, counts: { pending: 3, confirmed: 2, cancelled: 1, completed: 9 } }), ...adminErrors },
    },
  };
  doc.paths["/admin/appointments/{id}/status"] = {
    patch: {
      ...admin(), summary: "Confirm, deny (cancel) or complete a booking", parameters: [idParam],
      description: "pending → confirmed | cancelled; confirmed → completed | cancelled. Cancelling refunds a paid booking via Stripe and emails the customer (with the optional `reason`).",
      requestBody: body({ status: { type: "string", enum: ["confirmed", "cancelled", "completed"] }, reason: str("Fully booked at that time") }, ["status"]),
      responses: { 200: res("Updated", { type: "object", properties: { appointment: apptItem } }, { appointment: {} }, "Appointment confirmed"), 400: err("Invalid transition", "Cannot change status from completed to confirmed"), ...adminErrors },
    },
  };
  doc.paths["/admin/stats"] = {
    get: {
      ...admin(), summary: "Monthly statistics", parameters: [month],
      description: "`summary` = the selected month (by booking date; reviews by review date). `series` = that month plus the 5 before it.",
      responses: { 200: res("Statistics", { type: "object" }, { month: "2026-11", summary: { total: 14, pending: 3, confirmed: 2, completed: 8, cancelled: 1, reviews: 6, avgRating: 4.6, paidCount: 4, revenue: 9800 }, series: [{ month: "2026-11", total: 14, completed: 8, reviews: 6, avgRating: 4.6 }], topServices: [{ name: "Full Body Massage", bookings: 5 }], overall: { customers: 12, activeServices: 12, pendingRequests: 3 } }), ...adminErrors },
    },
  };
  doc.paths["/admin/reviews"] = { get: { ...admin(), summary: "All reviews (optionally one month)", parameters: [month], responses: { 200: res("Reviews", { type: "object" }, { items: [], total: 0 }), ...adminErrors } } };
  doc.paths["/admin/busy"] = {
    get: { ...admin(), summary: "Upcoming busy (blocked) times", responses: { 200: res("Busy blocks", { type: "object" }, { items: [], total: 0 }), ...adminErrors } },
    post: {
      ...admin(), summary: "Mark a time range as busy",
      description: "Customers cannot book overlapping slots. Omit `serviceId` to block every service. Existing bookings are not touched; `conflictingBookings` tells you how many overlap.",
      requestBody: body({ date: str("2026-11-25"), from: str("14:00"), to: str("18:00"), serviceId: { type: "string", nullable: true }, reason: str("Staff training") }, ["date", "from", "to"]),
      responses: { 201: res("Created", { type: "object" }, { busy: {}, conflictingBookings: 0 }, "Marked as busy"), ...adminErrors },
    },
  };
  doc.paths["/admin/busy/{id}"] = { delete: { ...admin(), summary: "Remove a busy block", parameters: [idParam], responses: { 200: res("Removed", { nullable: true }, null, "Busy time removed"), ...adminErrors } } };
  const svcBody = { name: str("Hair Spa"), description: str("Deep conditioning treatment"), category: str("Salon"), price: { type: "number", example: 1200 }, durationMinutes: { type: "integer", example: 60 }, image: str("https://..."), isFeatured: { type: "boolean" }, isActive: { type: "boolean" } };
  doc.paths["/admin/services"] = {
    get: { ...admin(), summary: "All services including inactive ones", responses: { 200: res("Services", { type: "object" }, { items: [], total: 0 }), ...adminErrors } },
    post: { ...admin(), summary: "Create a service", requestBody: body(svcBody, ["name", "description", "category", "price", "durationMinutes"]), responses: { 201: res("Created", { type: "object" }, { service: {} }, "Service created"), ...adminErrors } },
  };
  doc.paths["/admin/services/{id}"] = {
    put: { ...admin(), summary: "Update a service (send only changed fields; isActive=false hides it)", parameters: [idParam], requestBody: body(svcBody, []), responses: { 200: res("Updated", { type: "object" }, { service: {} }, "Service updated"), ...adminErrors } },
  };

  // schema additions
  const appt = doc.components.schemas.Appointment?.properties;
  if (appt) {
    appt.adminNote = { type: "string", description: "Reason when the admin denied the booking" };
    appt.paymentStatus = { type: "string", enum: ["unpaid", "paid", "refunded", "refund_failed"] };
    appt.reviewed = { type: "boolean" };
  }
  const user = doc.components.schemas.User?.properties;
  if (user) user.isEmailVerified = { type: "boolean" };
  return doc;
};
