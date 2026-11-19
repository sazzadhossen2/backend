import Appointment from "../models/Appointment.js";
import BusyBlock from "../models/BusyBlock.js";
import Review from "../models/Review.js";
import Service from "../models/Service.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, created } from "../utils/response.js";
import { config } from "../config/config.js";
import { escapeRegex } from "../utils/modelOptions.js";
import { businessRange, parseDateParam } from "../services/availability.service.js";
import { cancelAppointmentRecord, notifyStatus, sweepExpired } from "../services/appointment.service.js";

const MS_MIN = 60000;
const tz = config.business.tzOffsetMinutes;
const pad = (n) => String(n).padStart(2, "0");
const tzString = `${tz < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(tz) / 60))}:${pad(Math.abs(tz) % 60)}`;

// "2026-11" -> [UTC start of that business-local month, UTC start of the next one)
const monthRange = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - tz * MS_MIN),
    end: new Date(Date.UTC(y, m, 1) - tz * MS_MIN),
  };
};
const currentMonth = () => {
  const local = new Date(Date.now() + tz * MS_MIN);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}`;
};
const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

// ---------------------------------------------------------------- bookings (requests)

export const listAppointments = asyncHandler(async (req, res) => {
  await sweepExpired();
  const { status, date, month, search, page, limit } = req.validatedQuery;

  const filter = {};
  if (date) {
    const p = parseDateParam(date);
    const start = new Date(Date.UTC(p.y, p.m - 1, p.d) - tz * MS_MIN);
    filter.startAt = { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * MS_MIN) };
  } else if (month) {
    const { start, end } = monthRange(month);
    filter.startAt = { $gte: start, $lt: end };
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select("_id").limit(100).lean();
    filter.user = { $in: users.map((u) => u._id) };
  }

  const [items, total, grouped] = await Promise.all([
    Appointment.find({ ...filter, ...(status ? { status } : {}) })
      .populate("user", "name email phone")
      .populate("service")
      // open requests: soonest first; history: newest first
      .sort({ startAt: status === "pending" || status === "confirmed" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Appointment.countDocuments({ ...filter, ...(status ? { status } : {}) }),
    Appointment.aggregate([{ $match: filter }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);

  const counts = { pending: 0, confirmed: 0, cancelled: 0, completed: 0 };
  for (const g of grouped) counts[g._id] = g.n;
  ok(res, { items, total, page, limit, counts });
});

// pending -> confirmed | cancelled (denied);  confirmed -> completed | cancelled
const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
};

export const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new ApiError(404, "Appointment not found");

  const { status, reason } = req.body;
  if (!(TRANSITIONS[appointment.status] || []).includes(status)) {
    throw new ApiError(400, `Cannot change status from ${appointment.status} to ${status}`);
  }
  if (status === "completed" && appointment.startAt > new Date()) {
    throw new ApiError(400, "A booking can only be completed after it has started");
  }

  if (status === "cancelled") {
    await cancelAppointmentRecord(appointment, { reason, notify: true });
  } else {
    appointment.status = status;
    await appointment.save();
    notifyStatus(appointment, status); // fire and forget
  }

  await appointment.populate([{ path: "user", select: "name email phone" }, { path: "service" }]);
  ok(res, { appointment }, `Appointment ${status}`);
});

// ---------------------------------------------------------------- monthly statistics

export const getStats = asyncHandler(async (req, res) => {
  await sweepExpired();
  const month = req.validatedQuery.month || currentMonth();
  const { start, end } = monthRange(month);

  const seriesMonths = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)); // selected month + 5 before it
  const seriesStart = monthRange(seriesMonths[0]).start;

  const [byStatus, revenueAgg, reviewAgg, apptSeries, reviewSeries, topServices, totals] = await Promise.all([
    Appointment.aggregate([{ $match: { startAt: { $gte: start, $lt: end } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Appointment.aggregate([
      { $match: { startAt: { $gte: start, $lt: end }, paymentStatus: "paid" } },
      { $group: { _id: null, paid: { $sum: "$price" }, n: { $sum: 1 } } },
    ]),
    Review.aggregate([{ $match: { createdAt: { $gte: start, $lt: end } } }, { $group: { _id: null, n: { $sum: 1 }, avg: { $avg: "$rating" } } }]),
    Appointment.aggregate([
      { $match: { startAt: { $gte: seriesStart, $lt: end } } },
      { $group: { _id: { m: { $dateToString: { format: "%Y-%m", date: "$startAt", timezone: tzString } }, s: "$status" }, n: { $sum: 1 } } },
    ]),
    Review.aggregate([
      { $match: { createdAt: { $gte: seriesStart, $lt: end } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: tzString } }, n: { $sum: 1 }, avg: { $avg: "$rating" } } },
    ]),
    Appointment.aggregate([
      { $match: { startAt: { $gte: start, $lt: end }, status: { $in: ["confirmed", "completed"] } } },
      { $group: { _id: "$service", bookings: { $sum: 1 } } },
      { $sort: { bookings: -1 } },
      { $limit: 5 },
      { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "service" } },
      { $unwind: "$service" },
      { $project: { _id: 0, serviceId: "$_id", name: "$service.name", bookings: 1 } },
    ]),
    Promise.all([User.countDocuments({ role: "user" }), Service.countDocuments({ isActive: true }), Appointment.countDocuments({ status: "pending" })]),
  ]);

  const counts = { pending: 0, confirmed: 0, cancelled: 0, completed: 0 };
  for (const g of byStatus) counts[g._id] = g.n;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const series = seriesMonths.map((m) => {
    const row = { month: m, total: 0, pending: 0, confirmed: 0, cancelled: 0, completed: 0, reviews: 0, avgRating: 0 };
    for (const g of apptSeries) if (g._id.m === m) { row[g._id.s] = g.n; row.total += g.n; }
    const r = reviewSeries.find((x) => x._id === m);
    if (r) { row.reviews = r.n; row.avgRating = Math.round(r.avg * 10) / 10; }
    return row;
  });

  ok(res, {
    month,
    summary: {
      total,
      ...counts,
      reviews: reviewAgg[0]?.n || 0,
      avgRating: reviewAgg[0] ? Math.round(reviewAgg[0].avg * 10) / 10 : 0,
      paidCount: revenueAgg[0]?.n || 0,
      revenue: revenueAgg[0]?.paid || 0, // BDT price of bookings paid online
    },
    series,
    topServices,
    overall: { customers: totals[0], activeServices: totals[1], pendingRequests: totals[2] },
  });
});

export const listReviews = asyncHandler(async (req, res) => {
  const { month, page, limit } = req.validatedQuery;
  const filter = {};
  if (month) {
    const { start, end } = monthRange(month);
    filter.createdAt = { $gte: start, $lt: end };
  }
  const [items, total] = await Promise.all([
    Review.find(filter).populate("user", "name").populate("service", "name").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Review.countDocuments(filter),
  ]);
  ok(res, { items, total, page, limit });
});

// ---------------------------------------------------------------- busy time

export const listBusy = asyncHandler(async (req, res) => {
  // Everything that has not ended yet.
  const items = await BusyBlock.find({ endAt: { $gt: new Date() } }).populate("service", "name").sort({ startAt: 1 });
  ok(res, { items, total: items.length });
});

export const createBusy = asyncHandler(async (req, res) => {
  const { date, from, to, serviceId, reason } = req.body;
  const { startAt, endAt } = businessRange(date, from, to);
  if (endAt <= new Date()) throw new ApiError(400, "That time is already in the past");

  if (serviceId && !(await Service.exists({ _id: serviceId }))) throw new ApiError(404, "Service not found");

  const block = await BusyBlock.create({ service: serviceId || null, startAt, endAt, reason, createdBy: req.user._id });

  // Bookings that already exist inside this window are NOT touched automatically: the admin decides.
  const conflicts = await Appointment.countDocuments({
    isActive: true,
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
    ...(serviceId ? { service: serviceId } : {}),
  });
  await block.populate("service", "name");
  created(res, { busy: block, conflictingBookings: conflicts }, conflicts ? `Marked busy. ${conflicts} existing booking(s) overlap, review them in Requests.` : "Marked as busy");
});

export const deleteBusy = asyncHandler(async (req, res) => {
  const block = await BusyBlock.findByIdAndDelete(req.params.id);
  if (!block) throw new ApiError(404, "Busy time not found");
  ok(res, null, "Busy time removed");
});

// ---------------------------------------------------------------- services management

export const listAllServices = asyncHandler(async (req, res) => {
  const items = await Service.find().sort({ isActive: -1, category: 1, name: 1 });
  ok(res, { items, total: items.length });
});

export const createService = asyncHandler(async (req, res) => {
  if (await Service.exists({ name: new RegExp(`^${escapeRegex(req.body.name)}$`, "i") })) {
    throw new ApiError(409, "A service with this name already exists");
  }
  const service = await Service.create(req.body);
  created(res, { service }, "Service created");
});

export const updateService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw new ApiError(404, "Service not found");
  service.set(req.body);
  await service.save();
  ok(res, { service }, "Service updated");
});
