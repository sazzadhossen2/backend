import Service from "../models/Service.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { escapeRegex } from "../utils/modelOptions.js";
import { getAvailability, businessHours } from "../services/availability.service.js";

const SORTS = {
  popular: { isFeatured: -1, bookingsCount: -1, rating: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { rating: -1, bookingsCount: -1 },
  newest: { createdAt: -1 },
};

export const listServices = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { isActive: true };

  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ name: rx }, { description: rx }, { category: rx }];
  }
  if (q.category) filter.category = new RegExp(`^${escapeRegex(q.category)}$`, "i");
  if (q.featured === "true") filter.isFeatured = true;
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {};
    if (q.minPrice !== undefined) filter.price.$gte = q.minPrice;
    if (q.maxPrice !== undefined) filter.price.$lte = q.maxPrice;
  }

  const [items, total] = await Promise.all([
    Service.find(filter)
      .sort(SORTS[q.sort || "popular"])
      .skip((q.page - 1) * q.limit)
      .limit(q.limit),
    Service.countDocuments(filter),
  ]);

  ok(res, { items, total, page: q.page, limit: q.limit });
});

export const listCategories = asyncHandler(async (req, res) => {
  const categories = await Service.distinct("category", { isActive: true });
  ok(res, { categories: categories.sort() });
});

export const getService = asyncHandler(async (req, res) => {
  const service = await Service.findOne({ _id: req.params.id, isActive: true });
  if (!service) throw new ApiError(404, "Service not found");
  ok(res, { service });
});

export const getServiceAvailability = asyncHandler(async (req, res) => {
  const service = await Service.findOne({ _id: req.params.id, isActive: true });
  if (!service) throw new ApiError(404, "Service not found");

  const { date } = req.validatedQuery;
  const slots = await getAvailability(service, date);
  ok(res, { serviceId: service.id, date, durationMinutes: service.durationMinutes, hours: businessHours, slots });
});
