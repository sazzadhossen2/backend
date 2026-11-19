import { applyExtensions } from "./openapi.extra.js";

// OpenAPI 3.0 specification for the Service Booking API (served by Swagger UI at /api-docs).

const ID = "665f1c2a9b1e4a0012a3b4c5";
const USER_ID = "665e0b7d8a1c3f0011d2e3f4";
const APPT_ID = "6660a1b2c3d4e5f600112233";

const exUser = { id: USER_ID, name: "Demo User", email: "demo@kiculagbe.com", phone: "+8801700000000", role: "user", createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-01T10:00:00.000Z" };
const exService = { id: ID, name: "Full Body Massage", description: "Relaxing 60-minute massage that relieves muscle tension and stress.", price: 2500, durationMinutes: 60, image: "https://picsum.photos/seed/body-massage/800/600", category: "Spa & Wellness", isFeatured: true, rating: 4.9, bookingsCount: 210, isActive: true };
const exAppointment = { id: APPT_ID, user: USER_ID, service: exService, startAt: "2026-11-18T03:00:00.000Z", endAt: "2026-11-18T04:00:00.000Z", status: "pending", notes: "Please call before arriving", price: 2500, isActive: true, createdAt: "2026-11-17T09:00:00.000Z", updatedAt: "2026-11-17T09:00:00.000Z" };

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const respRef = (name) => ({ $ref: `#/components/responses/${name}` });
const jsonBody = (schema, example) => ({ "application/json": { schema, ...(example ? { example } : {}) } });

// Wraps a data schema in the standard { success, message, data } envelope.
const envelope = (dataSchema) => ({
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string", example: "Success" },
    data: dataSchema,
  },
});
const okResponse = (description, dataSchema, exampleData, message = "Success") => ({
  description,
  content: jsonBody(envelope(dataSchema), { success: true, message, data: exampleData }),
});
const nullDataResponse = (description, message) => ({
  description,
  content: jsonBody(envelope({ nullable: true, example: null }), { success: true, message, data: null }),
});

const idParam = { name: "id", in: "path", required: true, description: "MongoDB ObjectId (24 hex characters)", schema: { type: "string", example: ID } };
const secured = [{ bearerAuth: [] }];

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Service Booking & Management API",
    version: "1.0.0",
    description: [
      "REST API for the Service Booking mobile app.",
      "",
      "**Authentication:** call `POST /auth/login`, copy `data.token`, press **Authorize** and paste the token (no `Bearer ` prefix).",
      "",
      "**Response format:** every success is `{ success: true, message, data }`; every error is `{ success: false, message, errors? }`.",
      "",
      "**Demo accounts (after `npm run seed`):** user `demo@kiculagbe.com` / `Demo@12345`, admin `admin@kiculagbe.com` / `Admin@12345`.",
    ].join("\n"),
  },
  servers: [
    { url: "https://backend-9cbi.onrender.com/api/v1", description: "Render production" },
    { url: "/api/v1", description: "Current host" },
    { url: "http://localhost:5001/api/v1", description: "Local development" },
  ],
  tags: [
    { name: "System" },
    { name: "Auth", description: "Registration and login" },
    { name: "Users", description: "Authenticated user profile" },
    { name: "Services", description: "Public service catalogue" },
    { name: "Appointments", description: "Bookings of the authenticated user" },
    { name: "AI Assistant", description: "Service recommendations and questions" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: { 200: okResponse("API is running", { type: "object", properties: { uptime: { type: "number", example: 123.45 } } }, { uptime: 123.45 }, "OK") },
      },
    },

    // ---------------- AUTH ----------------
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        description: "Password rules: 8–72 characters, at least one letter and one number. Returns a JWT so the user is logged in immediately.",
        requestBody: {
          required: true,
          content: jsonBody(
            { type: "object", required: ["name", "email", "password"], properties: { name: { type: "string", minLength: 2, maxLength: 60, example: "Rahim Uddin" }, email: { type: "string", format: "email", example: "rahim@example.com" }, password: { type: "string", format: "password", minLength: 8, example: "Secret123" } } },
            { name: "Rahim Uddin", email: "rahim@example.com", password: "Secret123" }
          ),
        },
        responses: {
          201: okResponse("Registered", ref("AuthResult"), { user: exUser, token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }, "Registration successful"),
          409: { description: "Email already registered", content: jsonBody(ref("ErrorResponse"), { success: false, message: "An account with this email already exists" }) },
          422: respRef("ValidationError"),
          429: respRef("TooManyRequests"),
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        requestBody: {
          required: true,
          content: jsonBody(
            { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email", example: "demo@kiculagbe.com" }, password: { type: "string", format: "password", example: "Demo@12345" } } },
            { email: "demo@kiculagbe.com", password: "Demo@12345" }
          ),
        },
        responses: {
          200: okResponse("Logged in", ref("AuthResult"), { user: exUser, token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }, "Login successful"),
          401: { description: "Wrong email or password", content: jsonBody(ref("ErrorResponse"), { success: false, message: "Invalid email or password" }) },
          422: respRef("ValidationError"),
          429: respRef("TooManyRequests"),
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out",
        description: "JWTs are stateless: the client simply deletes its stored token.",
        security: secured,
        responses: { 200: nullDataResponse("Logged out", "Logged out successfully"), 401: respRef("Unauthorized") },
      },
    },

    // ---------------- USERS ----------------
    "/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get the current user",
        security: secured,
        responses: { 200: okResponse("Current user", { type: "object", properties: { user: ref("User") } }, { user: exUser }), 401: respRef("Unauthorized") },
      },
      put: {
        tags: ["Users"],
        summary: "Update profile",
        description: "Send `name`, `phone` or both. Send an empty `phone` to clear it. Email cannot be changed.",
        security: secured,
        requestBody: {
          required: true,
          content: jsonBody(
            { type: "object", properties: { name: { type: "string", minLength: 2, maxLength: 60, example: "Rahim U." }, phone: { type: "string", example: "+8801700000000" } } },
            { name: "Rahim U.", phone: "+8801700000000" }
          ),
        },
        responses: {
          200: okResponse("Updated user", { type: "object", properties: { user: ref("User") } }, { user: exUser }, "Profile updated successfully"),
          401: respRef("Unauthorized"),
          422: respRef("ValidationError"),
        },
      },
    },
    "/users/me/password": {
      put: {
        tags: ["Users"],
        summary: "Change password",
        security: secured,
        requestBody: {
          required: true,
          content: jsonBody(
            { type: "object", required: ["currentPassword", "newPassword"], properties: { currentPassword: { type: "string", format: "password", example: "Secret123" }, newPassword: { type: "string", format: "password", description: "8–72 chars, a letter and a number", example: "NewSecret456" } } },
            { currentPassword: "Secret123", newPassword: "NewSecret456" }
          ),
        },
        responses: {
          200: nullDataResponse("Password changed", "Password changed successfully"),
          400: { description: "Current password incorrect, or new password equals the old one", content: jsonBody(ref("ErrorResponse"), { success: false, message: "Current password is incorrect" }) },
          401: respRef("Unauthorized"),
          422: respRef("ValidationError"),
        },
      },
    },

    // ---------------- SERVICES ----------------
    "/services": {
      get: {
        tags: ["Services"],
        summary: "List / search / filter services",
        description: "Public endpoint. Default sort is `popular` (featured first, then most booked).",
        parameters: [
          { name: "search", in: "query", description: "Matches name, description and category", schema: { type: "string", example: "massage" } },
          { name: "category", in: "query", description: "Exact category (case-insensitive)", schema: { type: "string", example: "Fitness" } },
          { name: "featured", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          { name: "minPrice", in: "query", schema: { type: "number", example: 500 } },
          { name: "maxPrice", in: "query", schema: { type: "number", example: 3000 } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["popular", "price_asc", "price_desc", "rating", "newest"], default: "popular" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
        ],
        responses: {
          200: okResponse(
            "Services page",
            { type: "object", properties: { items: { type: "array", items: ref("Service") }, total: { type: "integer", example: 12 }, page: { type: "integer", example: 1 }, limit: { type: "integer", example: 50 } } },
            { items: [exService], total: 1, page: 1, limit: 50 }
          ),
          422: respRef("ValidationError"),
        },
      },
    },
    "/services/categories": {
      get: {
        tags: ["Services"],
        summary: "List service categories",
        responses: {
          200: okResponse("Categories", { type: "object", properties: { categories: { type: "array", items: { type: "string" } } } }, { categories: ["Automotive", "Fitness", "Home Services", "Pet Care", "Salon", "Spa & Wellness", "Tech Support"] }),
        },
      },
    },
    "/services/{id}": {
      get: {
        tags: ["Services"],
        summary: "Get one service",
        parameters: [idParam],
        responses: { 200: okResponse("Service", { type: "object", properties: { service: ref("Service") } }, { service: exService }), 404: respRef("NotFound") },
      },
    },
    "/services/{id}/availability": {
      get: {
        tags: ["Services"],
        summary: "Time slots for a date",
        description: "Returns every slot of the business day (default 09:00–18:00, every 30 min) that fits the service duration. `available` is false for past slots and slots that overlap an existing pending/confirmed booking. Dates up to 30 days ahead are allowed.",
        parameters: [
          idParam,
          { name: "date", in: "query", required: true, description: "Business-local date, YYYY-MM-DD", schema: { type: "string", format: "date", example: "2026-11-18" } },
        ],
        responses: {
          200: okResponse(
            "Slots",
            { type: "object", properties: { serviceId: { type: "string" }, date: { type: "string" }, durationMinutes: { type: "integer" }, hours: { type: "object", properties: { open: { type: "string" }, close: { type: "string" }, slotMinutes: { type: "integer" } } }, slots: { type: "array", items: ref("Slot") } } },
            {
              serviceId: ID,
              date: "2026-11-18",
              durationMinutes: 60,
              hours: { open: "09:00", close: "18:00", slotMinutes: 30 },
              slots: [
                { time: "09:00", startAt: "2026-11-18T03:00:00.000Z", endAt: "2026-11-18T04:00:00.000Z", available: true },
                { time: "09:30", startAt: "2026-11-18T03:30:00.000Z", endAt: "2026-11-18T04:30:00.000Z", available: false },
              ],
            }
          ),
          400: { description: "Past date, date too far ahead, or invalid format", content: jsonBody(ref("ErrorResponse"), { success: false, message: "You cannot book a date in the past" }) },
          404: respRef("NotFound"),
        },
      },
    },

    // ---------------- APPOINTMENTS ----------------
    "/appointments": {
      post: {
        tags: ["Appointments"],
        summary: "Create an appointment",
        description: "`startAt` must be the `startAt` of an available slot from the availability endpoint. The booking starts as `pending`.\n\nRejected with **409** if the slot is already taken, or if the user already has an overlapping booking.",
        security: secured,
        requestBody: {
          required: true,
          content: jsonBody(
            { type: "object", required: ["serviceId", "startAt"], properties: { serviceId: { type: "string", example: ID }, startAt: { type: "string", format: "date-time", example: "2026-11-18T03:00:00.000Z" }, notes: { type: "string", maxLength: 300, example: "Please call before arriving" } } },
            { serviceId: ID, startAt: "2026-11-18T03:00:00.000Z", notes: "Please call before arriving" }
          ),
        },
        responses: {
          201: okResponse("Booked", { type: "object", properties: { appointment: ref("Appointment") } }, { appointment: exAppointment }, "Appointment booked successfully"),
          400: { description: "Time is not a valid slot (off the grid, outside hours, in the past)", content: jsonBody(ref("ErrorResponse"), { success: false, message: "Selected time is outside the available time slots" }) },
          401: respRef("Unauthorized"),
          404: respRef("NotFound"),
          409: { description: "Slot taken or overlapping booking", content: jsonBody(ref("ErrorResponse"), { success: false, message: "This time slot is no longer available. Please choose another one." }) },
          422: respRef("ValidationError"),
        },
      },
      get: {
        tags: ["Appointments"],
        summary: "List my appointments",
        description: "`when=upcoming` returns pending/confirmed bookings (soonest first). `when=past` returns completed/cancelled bookings (latest first). Finished bookings are moved to `completed` automatically.",
        security: secured,
        parameters: [
          { name: "when", in: "query", schema: { type: "string", enum: ["upcoming", "past"] } },
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "confirmed", "cancelled", "completed"] } },
        ],
        responses: {
          200: okResponse("Appointments", { type: "object", properties: { items: { type: "array", items: ref("Appointment") }, total: { type: "integer", example: 1 } } }, { items: [exAppointment], total: 1 }),
          401: respRef("Unauthorized"),
          422: respRef("ValidationError"),
        },
      },
    },
    "/appointments/{id}": {
      get: {
        tags: ["Appointments"],
        summary: "Get one of my appointments",
        security: secured,
        parameters: [idParam],
        responses: { 200: okResponse("Appointment", { type: "object", properties: { appointment: ref("Appointment") } }, { appointment: exAppointment }), 401: respRef("Unauthorized"), 404: respRef("NotFound") },
      },
    },
    "/appointments/{id}/cancel": {
      patch: {
        tags: ["Appointments"],
        summary: "Cancel my appointment",
        description: "Only appointments with status `pending` can be cancelled. The time slot becomes available again.",
        security: secured,
        parameters: [idParam],
        responses: {
          200: okResponse("Cancelled", { type: "object", properties: { appointment: ref("Appointment") } }, { appointment: { ...exAppointment, status: "cancelled", isActive: false, cancelledAt: "2026-11-17T10:00:00.000Z" } }, "Appointment cancelled"),
          400: { description: "Not pending", content: jsonBody(ref("ErrorResponse"), { success: false, message: "Only pending appointments can be cancelled (this one is confirmed)" }) },
          401: respRef("Unauthorized"),
          404: respRef("NotFound"),
        },
      },
    },
    "/appointments/{id}/status": {
      patch: {
        tags: ["Appointments"],
        summary: "Change status (admin only)",
        description: "Allowed transitions: `pending → confirmed | cancelled`, `confirmed → completed | cancelled`. Use the admin account.",
        security: secured,
        parameters: [idParam],
        requestBody: {
          required: true,
          content: jsonBody({ type: "object", required: ["status"], properties: { status: { type: "string", enum: ["confirmed", "cancelled", "completed"], example: "confirmed" } } }, { status: "confirmed" }),
        },
        responses: {
          200: okResponse("Updated", { type: "object", properties: { appointment: ref("Appointment") } }, { appointment: { ...exAppointment, status: "confirmed" } }, "Appointment confirmed"),
          400: { description: "Invalid transition", content: jsonBody(ref("ErrorResponse"), { success: false, message: "Cannot change status from completed to confirmed" }) },
          401: respRef("Unauthorized"),
          403: { description: "Not an admin", content: jsonBody(ref("ErrorResponse"), { success: false, message: "You do not have permission to do this" }) },
          404: respRef("NotFound"),
          422: respRef("ValidationError"),
        },
      },
    },

    // ---------------- AI ----------------
    "/ai/chat": {
      post: {
        tags: ["AI Assistant"],
        summary: "Ask the service assistant",
        description: "Answers questions about services, prices and booking, and recommends services. Uses Gemini when `GEMINI_API_KEY` is set on the server, otherwise a built-in rule-based assistant (`source: \"fallback\"`). Limited to 15 requests per minute.",
        security: secured,
        requestBody: {
          required: true,
          content: jsonBody(
            {
              type: "object",
              required: ["message"],
              properties: {
                message: { type: "string", minLength: 1, maxLength: 500, example: "I want something relaxing under 3000" },
                history: { type: "array", maxItems: 12, description: "Previous turns (optional)", items: { type: "object", required: ["role", "text"], properties: { role: { type: "string", enum: ["user", "assistant"] }, text: { type: "string", maxLength: 1000 } } } },
              },
            },
            { message: "I want something relaxing under 3000", history: [{ role: "user", text: "hi" }, { role: "assistant", text: "Hello! How can I help?" }] }
          ),
        },
        responses: {
          200: okResponse(
            "Assistant reply",
            { type: "object", properties: { reply: { type: "string" }, suggestions: { type: "array", items: ref("Service") }, source: { type: "string", enum: ["gemini", "fallback"] } } },
            { reply: "I'd suggest Full Body Massage (৳2,500, 60 min). Tap the card below to book.", suggestions: [exService], source: "fallback" }
          ),
          401: respRef("Unauthorized"),
          422: respRef("ValidationError"),
          429: respRef("TooManyRequests"),
        },
      },
    },
  },

  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Paste the token returned by login/register." } },
    schemas: {
      User: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" }, email: { type: "string", format: "email" }, phone: { type: "string" }, role: { type: "string", enum: ["user", "admin"] }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } },
        example: exUser,
      },
      AuthResult: { type: "object", properties: { user: { $ref: "#/components/schemas/User" }, token: { type: "string", description: "JWT, valid for 7 days by default" } } },
      Service: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, price: { type: "number", description: "BDT" }, durationMinutes: { type: "integer" }, image: { type: "string", format: "uri" }, category: { type: "string" }, isFeatured: { type: "boolean" }, rating: { type: "number" }, bookingsCount: { type: "integer" }, isActive: { type: "boolean" } },
        example: exService,
      },
      Slot: {
        type: "object",
        properties: { time: { type: "string", example: "09:00", description: "Business-local start time" }, startAt: { type: "string", format: "date-time" }, endAt: { type: "string", format: "date-time" }, available: { type: "boolean" } },
      },
      Appointment: {
        type: "object",
        properties: {
          id: { type: "string" },
          user: { type: "string", description: "User id" },
          service: { $ref: "#/components/schemas/Service" },
          startAt: { type: "string", format: "date-time" },
          endAt: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["pending", "confirmed", "cancelled", "completed"] },
          notes: { type: "string" },
          price: { type: "number", description: "Price snapshot at booking time" },
          cancelledAt: { type: "string", format: "date-time" },
          isActive: { type: "boolean", description: "true while pending or confirmed" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        example: exAppointment,
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string" },
          errors: { type: "array", items: { type: "object", properties: { field: { type: "string" }, message: { type: "string" } } } },
        },
      },
    },
    responses: {
      Unauthorized: { description: "Missing, invalid or expired token", content: jsonBody(ref("ErrorResponse"), { success: false, message: "Authentication required" }) },
      NotFound: { description: "Resource not found", content: jsonBody(ref("ErrorResponse"), { success: false, message: "Resource not found" }) },
      ValidationError: {
        description: "Validation failed",
        content: jsonBody(ref("ErrorResponse"), { success: false, message: "Enter a valid email address", errors: [{ field: "email", message: "Enter a valid email address" }] }),
      },
      TooManyRequests: { description: "Rate limit reached", content: jsonBody(ref("ErrorResponse"), { success: false, message: "Too many requests, please try again later." }) },
    },
  },
};

applyExtensions(openapi);
