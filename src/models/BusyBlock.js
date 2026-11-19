import mongoose from "mongoose";
import { jsonOptions } from "../utils/modelOptions.js";

// Time the business is NOT available (holiday, staff leave, maintenance...). Created by an admin.
// service = null  -> blocks every service; otherwise only that service.
const busyBlockSchema = new mongoose.Schema(
  {
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", default: null },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 120, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, toJSON: jsonOptions }
);

busyBlockSchema.index({ startAt: 1, endAt: 1 });

export default mongoose.model("BusyBlock", busyBlockSchema);
