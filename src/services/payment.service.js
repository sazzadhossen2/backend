import Stripe from "stripe";
import { config } from "../config/config.js";
import ApiError from "../utils/ApiError.js";

let stripe = null;
export const getStripe = () => {
  if (!config.stripe.secretKey) throw new ApiError(503, "Online payment is not configured on the server");
  stripe ||= new Stripe(config.stripe.secretKey);
  return stripe;
};

/** Price (BDT) -> smallest unit of the charge currency (e.g. cents). Stripe's minimum is about 0.50. */
export const toMinorUnits = (priceBdt) =>
  Math.max(50, Math.round((priceBdt / config.stripe.bdtPerUnit) * 100));

/** Marks the appointment as paid (idempotent). */
export const markPaid = async (appointment, paymentIntentId) => {
  if (appointment.paymentStatus === "paid") return appointment;
  appointment.paymentStatus = "paid";
  appointment.paymentIntentId = paymentIntentId;
  appointment.paidAt = new Date();
  await appointment.save();
  return appointment;
};

/** Refunds a paid appointment. Never throws: a failed refund is recorded for the admin to handle manually. */
export const refundIfPaid = async (appointment) => {
  if (appointment.paymentStatus !== "paid" || !appointment.paymentIntentId) return;
  try {
    const refund = await getStripe().refunds.create({ payment_intent: appointment.paymentIntentId });
    appointment.paymentStatus = "refunded";
    appointment.refundId = refund.id;
  } catch (error) {
    console.error("Stripe refund failed:", error.message);
    appointment.paymentStatus = "refund_failed";
  }
  await appointment.save();
};
