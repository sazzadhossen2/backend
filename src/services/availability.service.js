import Appointment from "../models/Appointment.js";
import BusyBlock from "../models/BusyBlock.js";
import { config } from "../config/config.js";
import ApiError from "../utils/ApiError.js";

const { open, close, slotMinutes, tzOffsetMinutes, maxAdvanceDays } = config.business;

const toMinutes = (hm) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};
const OPEN = toMinutes(open);
const CLOSE = toMinutes(close);
const MS_MIN = 60000;
const pad = (n) => String(n).padStart(2, "0");

// Business-local calendar date (y/m/d) -> UTC instant for "minutes since local midnight".
const localToUtc = ({ y, m, d }, minutes) => new Date(Date.UTC(y, m - 1, d, 0, minutes) - tzOffsetMinutes * MS_MIN);

const partsOf = (date) => {
  const local = new Date(date.getTime() + tzOffsetMinutes * MS_MIN);
  return {
    y: local.getUTCFullYear(),
    m: local.getUTCMonth() + 1,
    d: local.getUTCDate(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
    clean: local.getUTCSeconds() === 0 && local.getUTCMilliseconds() === 0,
  };
};
const dayNumber = ({ y, m, d }) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);

export const parseDateParam = (dateStr) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) throw new ApiError(400, "Date must be in YYYY-MM-DD format");
  const [y, m, d] = dateStr.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new ApiError(400, "Invalid date");
  }
  return { y, m, d };
};

const assertBookableDate = (parts) => {
  const diff = dayNumber(parts) - dayNumber(partsOf(new Date()));
  if (diff < 0) throw new ApiError(400, "You cannot book a date in the past");
  if (diff > maxAdvanceDays) throw new ApiError(400, `Bookings can be made up to ${maxAdvanceDays} days in advance`);
};

const generateSlots = (service, parts) => {
  const slots = [];
  for (let start = OPEN; start + service.durationMinutes <= CLOSE; start += slotMinutes) {
    const startAt = localToUtc(parts, start);
    slots.push({
      time: `${pad(Math.floor(start / 60))}:${pad(start % 60)}`,
      startAt,
      endAt: new Date(startAt.getTime() + service.durationMinutes * MS_MIN),
    });
  }
  return slots;
};

// Blocks (holiday, maintenance...) that overlap [start, end) for this service (or for every service).
export const findBusyBlocks = (serviceId, start, end) =>
  BusyBlock.find({ startAt: { $lt: end }, endAt: { $gt: start }, $or: [{ service: null }, { service: serviceId }] }).lean();

// Returns every slot of the day with an `available` flag and, when unavailable, the `reason`.
export const getAvailability = async (service, dateStr) => {
  const parts = parseDateParam(dateStr);
  assertBookableDate(parts);

  const slots = generateSlots(service, parts);
  if (slots.length === 0) return [];

  const first = slots[0].startAt;
  const last = slots[slots.length - 1].endAt;
  const [booked, blocks] = await Promise.all([
    Appointment.find({ service: service._id, isActive: true, startAt: { $lt: last }, endAt: { $gt: first } }).select("startAt endAt").lean(),
    findBusyBlocks(service._id, first, last),
  ]);

  const now = Date.now();
  return slots.map((s) => {
    const past = s.startAt.getTime() <= now;
    const busy = blocks.some((b) => b.startAt < s.endAt && b.endAt > s.startAt);
    const taken = booked.some((b) => b.startAt < s.endAt && b.endAt > s.startAt);
    return {
      time: s.time,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      available: !past && !busy && !taken,
      reason: past ? "past" : busy ? "busy" : taken ? "booked" : null,
    };
  });
};

// Converts a business-local date + "HH:mm" range into UTC instants (used by the admin "busy time" form).
export const businessRange = (dateStr, fromHM, toHM) => {
  const parts = parseDateParam(dateStr);
  const from = toMinutes(fromHM);
  const to = toMinutes(toHM);
  if (!(to > from)) throw new ApiError(400, "End time must be after start time");
  return { startAt: localToUtc(parts, from), endAt: localToUtc(parts, to) };
};

// Throws if `startAt` is not a valid, bookable slot start for this service.
export const assertValidSlot = (service, startAt) => {
  const p = partsOf(startAt);
  assertBookableDate(p);
  const onGrid = p.clean && p.minutes >= OPEN && (p.minutes - OPEN) % slotMinutes === 0;
  if (!onGrid || p.minutes + service.durationMinutes > CLOSE) {
    throw new ApiError(400, "Selected time is outside the available time slots");
  }
  if (startAt.getTime() <= Date.now()) throw new ApiError(400, "Selected time has already passed");
};

export const businessHours = { open, close, slotMinutes };
