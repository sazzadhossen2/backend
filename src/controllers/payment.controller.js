import Appointment from "../models/Appointment.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { config } from "../config/config.js";
import { getStripe, toMinorUnits, markPaid } from "../services/payment.service.js";

const findPayable = async (appointmentId, userId) => {
  const appointment = await Appointment.findOne({ _id: appointmentId, user: userId }).populate("service");
  if (!appointment) throw new ApiError(404, "Appointment not found");
  if (!["pending", "confirmed"].includes(appointment.status)) throw new ApiError(400, `A ${appointment.status} booking cannot be paid`);
  if (appointment.paymentStatus === "paid") throw new ApiError(409, "This booking is already paid");
  return appointment;
};

// Step 1: the app asks for a PaymentIntent and shows Stripe's PaymentSheet with the returned client secret.
export const createPaymentIntent = asyncHandler(async (req, res) => {
  const stripe = getStripe();
  const appointment = await findPayable(req.body.appointmentId, req.user._id);
  const amount = toMinorUnits(appointment.price);
  const currency = config.stripe.currency;

  // Re-use an open intent for the same booking instead of creating duplicates.
  let intent = null;
  if (appointment.paymentIntentId) {
    const existing = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
    if (existing.status === "succeeded") {
      await markPaid(appointment, existing.id);
      throw new ApiError(409, "This booking is already paid");
    }
    if (existing.status !== "canceled" && existing.amount === amount && existing.currency === currency) intent = existing;
  }

  if (!intent) {
    intent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      description: `${appointment.service?.name || "Service"} booking`,
      receipt_email: req.user.email,
      metadata: { appointmentId: String(appointment._id), userId: String(req.user._id) },
    });
    appointment.paymentIntentId = intent.id;
    await appointment.save();
  }

  ok(res, {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    publishableKey: config.stripe.publishableKey,
    amount,
    currency,
  });
});

// Step 2: after the sheet succeeds, the app calls this. The server verifies with Stripe (never trusts the client).
export const confirmPayment = asyncHandler(async (req, res) => {
  const stripe = getStripe();
  const appointment = await Appointment.findOne({ _id: req.body.appointmentId, user: req.user._id }).populate("service");
  if (!appointment) throw new ApiError(404, "Appointment not found");
  if (!appointment.paymentIntentId) throw new ApiError(400, "No payment started for this booking");

  const intent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
  if (intent.metadata?.appointmentId !== String(appointment._id)) throw new ApiError(400, "Payment does not match this booking");
  if (intent.status !== "succeeded") throw new ApiError(402, `Payment not completed (status: ${intent.status})`);

  await markPaid(appointment, intent.id);
  ok(res, { appointment }, "Payment successful");
});

// Stripe -> server (raw body, signature verified). Keeps bookings correct even if the app closes mid-payment.
export const stripeWebhook = async (req, res) => {
  if (!config.stripe.webhookSecret || !config.stripe.secretKey) return res.status(503).json({ success: false, message: "Webhook not configured" });
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, req.headers["stripe-signature"], config.stripe.webhookSecret);
  } catch {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const appointment = await Appointment.findById(intent.metadata?.appointmentId);
      if (appointment) await markPaid(appointment, intent.id);
    }
    res.json({ received: true });
  } catch (error) {
    console.error("Webhook handling failed:", error);
    res.status(500).json({ success: false, message: "Webhook handler failed" });
  }
};
