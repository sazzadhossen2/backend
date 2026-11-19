import mongoose from "mongoose";
import { jsonOptions } from "../utils/modelOptions.js";

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    price: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 15, max: 480 },
    image: { type: String, default: "" },
    category: { type: String, required: true, trim: true },
    isFeatured: { type: Boolean, default: false },
    rating: { type: Number, min: 0, max: 5, default: 4.5 },
    reviewsCount: { type: Number, min: 0, default: 0 },
    bookingsCount: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonOptions }
);

serviceSchema.index({ category: 1, price: 1 });
serviceSchema.index({ isFeatured: -1, bookingsCount: -1 });

export default mongoose.model("Service", serviceSchema);
