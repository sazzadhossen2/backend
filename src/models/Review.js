import mongoose from "mongoose";
import { jsonOptions } from "../utils/modelOptions.js";

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true, index: true },
    // One review per completed appointment.
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true, unique: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true, toJSON: jsonOptions }
);

reviewSchema.index({ createdAt: -1 });

export default mongoose.model("Review", reviewSchema);
