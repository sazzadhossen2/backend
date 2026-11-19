import express from "express";
import helmet from "helmet";
import cors from "cors";
import hpp from "hpp";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import swaggerUi from "swagger-ui-express";

import { config } from "./src/config/config.js";
import router from "./src/routes/api.js";
import { apiLimiter } from "./src/middlewares/rateLimiters.js";
import { notFound, errorHandler } from "./src/middlewares/error.js";
import { openapi } from "./src/docs/openapi.js";
import { stripeWebhook } from "./src/controllers/payment.controller.js";

const app = express();

// Required when running behind a proxy (Render, Railway, Nginx...) so rate limiting sees real IPs.
app.set("trust proxy", 1);
app.set("etag", false);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins.includes("*") ? true : config.corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
if (!config.isProd) app.use(morgan("dev"));

// Stripe webhook needs the RAW body to verify the signature, so it is registered before express.json().
app.post("/api/v1/payments/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// Parsing (must come before sanitizers)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(mongoSanitize());
app.use(hpp());

app.get("/", (req, res) => {
  res.json({ success: true, message: "Service Booking API", data: { health: "/api/v1/health", docs: "/api-docs" } });
});

// Swagger UI (interactive docs) + raw OpenAPI JSON
app.get("/api-docs.json", (req, res) => res.json(openapi));
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(openapi, { customSiteTitle: "Service Booking API", swaggerOptions: { persistAuthorization: true } })
);

app.use("/api/v1", apiLimiter, router);

app.use(notFound);
app.use(errorHandler);

export default app;
