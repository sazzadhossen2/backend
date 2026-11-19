import Appointment from "../models/Appointment.js";
import Service from "../models/Service.js";
import User from "../models/User.js";
import { refundIfPaid } from "./payment.service.js";
import { sendBookingStatusEmail } from "./mail.service.js";

export const releaseServiceCount = (serviceId) =>
  Service.updateOne({ _id: serviceId, bookingsCount: { $gt: 0 } }, { $inc: { bookingsCount: -1 } });

// Emails must never break an API call.
export const notifyStatus = async (appointment, status, reason) => {
  try {
    const [user, service] = await Promise.all([User.findById(appointment.user), Service.findById(appointment.service)]);
    if (user) await sendBookingStatusEmail({ user, appointment, serviceName: service?.name || "Service", status, reason });
  } catch (error) {
    console.error("Status email failed:", error.message);
  }
};

/** Cancels (by customer, admin or expiry): frees the slot, refunds a paid booking, updates counters. */
export const cancelAppointmentRecord = async (appointment, { reason = "", notify = false } = {}) => {
  appointment.status = "cancelled";
  appointment.cancelledAt = new Date();
  if (reason) appointment.adminNote = reason;
  await appointment.save(); // pre-validate hook flips isActive -> slot is free again
  await refundIfPaid(appointment);
  await releaseServiceCount(appointment.service);
  if (notify) notifyStatus(appointment, "cancelled", reason); // fire and forget
  return appointment;
};

/**
 * Moves finished bookings forward so everyone sees an accurate status:
 *  confirmed + finished  -> completed
 *  pending + time passed -> cancelled (nobody confirmed it)
 * `scope` narrows it (e.g. one user's bookings).
 */
export const sweepExpired = async (scope = {}) => {
  const now = new Date();
  await Appointment.updateMany({ ...scope, status: "confirmed", endAt: { $lt: now } }, { $set: { status: "completed", isActive: false } });

  const stale = await Appointment.find({ ...scope, status: "pending", endAt: { $lt: now } });
  for (const appointment of stale) {
    await cancelAppointmentRecord(appointment, { reason: "Expired without confirmation" });
  }
};
