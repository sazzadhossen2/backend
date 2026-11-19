import mongoose from "mongoose";
import { jsonOptions } from "../utils/modelOptions.js";

export const STATUSES = ["pending", "confirmed", "cancelled", "completed"];
export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded", "refund_failed"];
const ACTIVE = ["pending", "confirmed"];

const appointmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: "pending" },
    notes: { type: String, trim: true, maxlength: 300, default: "" },
    price: { type: Number, required: true, min: 0 }, // price snapshot at booking time
    cancelledAt: { type: Date },
    adminNote: { type: String, trim: true, maxlength: 200, default: "" }, // reason shown to the customer when denied
    // ---- Payment (Stripe) ----
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
    paymentIntentId: { type: String, default: "" },
    paidAt: { type: Date },
    refundId: { type: String, default: "" },
    reviewed: { type: Boolean, default: false },
    // true while pending/confirmed. Used by the partial unique index below.
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonOptions }
);

appointmentSchema.pre("validate", function () {
  this.isActive = ACTIVE.includes(this.status);
});

appointmentSchema.index({ user: 1, startAt: -1 });
appointmentSchema.index({ service: 1, startAt: 1, endAt: 1 });
// Database-level guard against double booking the exact same slot (race conditions).
appointmentSchema.index(
  { service: 1, startAt: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export default mongoose.model("Appointment", appointmentSchema);
