import Service from "../models/Service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { askAssistant } from "../services/ai.service.js";

export const chat = asyncHandler(async (req, res) => {
  const { message, history } = req.body;

  const services = await Service.find({ isActive: true }).sort({ bookingsCount: -1 }).limit(60).lean();
  if (services.length === 0) {
    return ok(res, { reply: "There are no services available at the moment. Please check back soon.", suggestions: [], source: "fallback" });
  }

  const { reply, services: matched, source } = await askAssistant({ message, history, services });

  const suggestions = matched.map((s) => ({
    id: String(s._id),
    name: s.name,
    description: s.description,
    category: s.category,
    price: s.price,
    durationMinutes: s.durationMinutes,
    image: s.image,
    rating: s.rating,
    isFeatured: s.isFeatured,
    bookingsCount: s.bookingsCount,
  }));

  ok(res, { reply, suggestions, source });
});
