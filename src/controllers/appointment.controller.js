import Appointment from "../models/Appointment.js";
import Service from "../models/Service.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, created } from "../utils/response.js";
import { assertValidSlot, findBusyBlocks } from "../services/availability.service.js";
import { cancelAppointmentRecord, sweepExpired } from "../services/appointment.service.js";

const MS_MIN = 60000;

export const createAppointment = asyncHandler(async (req, res) => {
  const { serviceId, startAt, notes } = req.body;

  const service = await Service.findOne({ _id: serviceId, isActive: true });
  if (!service) throw new ApiError(404, "Service not found");

  const start = new Date(startAt);
  assertValidSlot(service, start);
  const end = new Date(start.getTime() + service.durationMinutes * MS_MIN);

  // Time the business marked as busy (admin)
  if ((await findBusyBlocks(service._id, start, end)).length > 0) {
    throw new ApiError(409, "We are not available at this time. Please choose another slot.", undefined, "SLOT_BUSY");
  }

  // Conflict checks: any active booking that overlaps [start, end)
  const overlap = { isActive: true, startAt: { $lt: end }, endAt: { $gt: start } };
  if (await Appointment.exists({ ...overlap, service: service._id })) {
    throw new ApiError(409, "This time slot is no longer available. Please choose another one.");
  }
  if (await Appointment.exists({ ...overlap, user: req.user._id })) {
    throw new ApiError(409, "You already have a booking that overlaps with this time.");
  }

  let appointment;
  try {
    appointment = await Appointment.create({
      user: req.user._id,
      service: service._id,
      startAt: start,
      endAt: end,
      notes,
      price: service.price,
    });
  } catch (error) {
    // Unique partial index caught a simultaneous booking of the same slot.
    if (error.code === 11000) throw new ApiError(409, "This time slot is no longer available. Please choose another one.");
    throw error;
  }

  await Service.updateOne({ _id: service._id }, { $inc: { bookingsCount: 1 } });
  await appointment.populate("service");
  created(res, { appointment }, "Appointment booked successfully");
});

export const listMyAppointments = asyncHandler(async (req, res) => {
  await sweepExpired({ user: req.user._id });

  const { when, status } = req.validatedQuery;
  const filter = { user: req.user._id };
  if (when === "upcoming") filter.isActive = true;
  if (when === "past") filter.isActive = false;
  if (status) filter.status = status;

  const items = await Appointment.find(filter)
    .populate("service")
    .sort({ startAt: when === "upcoming" ? 1 : -1 });

  ok(res, { items, total: items.length });
});

export const getMyAppointment = asyncHandler(async (req, res) => {
  await sweepExpired({ user: req.user._id });
  const appointment = await Appointment.findOne({ _id: req.params.id, user: req.user._id }).populate("service");
  if (!appointment) throw new ApiError(404, "Appointment not found");
  ok(res, { appointment });
});

export const cancelAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOne({ _id: req.params.id, user: req.user._id });
  if (!appointment) throw new ApiError(404, "Appointment not found");
  if (appointment.status !== "pending") {
    throw new ApiError(400, `Only pending appointments can be cancelled (this one is ${appointment.status})`);
  }

  await cancelAppointmentRecord(appointment); // also refunds a paid booking
  await appointment.populate("service");
  ok(res, { appointment }, appointment.paymentStatus === "refunded" ? "Appointment cancelled and payment refunded" : "Appointment cancelled");
});
