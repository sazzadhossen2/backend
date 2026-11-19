import Appointment from "../models/Appointment.js";
import Review from "../models/Review.js";
import Service from "../models/Service.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, created } from "../utils/response.js";

// Recomputes the service's average rating and review count from its reviews.
export const refreshServiceRating = async (serviceId) => {
  const [stats] = await Review.aggregate([
    { $match: { service: serviceId } },
    { $group: { _id: "$service", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const update = stats ? { rating: Math.round(stats.avg * 10) / 10, reviewsCount: stats.count } : { reviewsCount: 0 };
  await Service.updateOne({ _id: serviceId }, { $set: update });
};

export const createReview = asyncHandler(async (req, res) => {
  const { appointmentId, rating, comment } = req.body;

  const appointment = await Appointment.findOne({ _id: appointmentId, user: req.user._id });
  if (!appointment) throw new ApiError(404, "Appointment not found");
  if (appointment.status !== "completed") throw new ApiError(400, "You can review a service after your booking is completed");

  let review;
  try {
    review = await Review.create({ user: req.user._id, service: appointment.service, appointment: appointment._id, rating, comment });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "You have already reviewed this booking");
    throw error;
  }

  appointment.reviewed = true;
  await appointment.save();
  await refreshServiceRating(appointment.service);
  created(res, { review }, "Thanks for your review!");
});

export const listServiceReviews = asyncHandler(async (req, res) => {
  const { page, limit } = req.validatedQuery;
  const filter = { service: req.params.id };
  const [items, total] = await Promise.all([
    Review.find(filter).populate("user", "name").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Review.countDocuments(filter),
  ]);
  ok(res, { items, total, page, limit });
});
