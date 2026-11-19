import mongoose from "mongoose";
import { config } from "../config/config.js";
import User from "../models/User.js";
import Service from "../models/Service.js";
import Appointment from "../models/Appointment.js";
import Review from "../models/Review.js";
import { refreshServiceRating } from "../controllers/review.controller.js";
import { services, users, buildAppointments } from "./demoData.js";

const run = async () => {
  const fresh = process.argv.includes("--fresh");
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB (${mongoose.connection.name})`);

  if (fresh) {
    await Appointment.deleteMany({});
    await Review.deleteMany({});
    await Service.deleteMany({});
    console.log("Cleared appointments and services");
  }

  // Services: upsert by name so existing bookings keep pointing at valid services.
  await Service.bulkWrite(
    services.map((s) => ({ updateOne: { filter: { name: s.name }, update: { $set: { ...s, isActive: true } }, upsert: true } }))
  );
  console.log(`Services ready: ${services.length}`);

  // Accounts created before email verification existed are trusted: mark them verified so nobody is locked out.
  const legacy = await User.updateMany({ isEmailVerified: { $exists: false } }, { $set: { isEmailVerified: true } });
  if (legacy.modifiedCount) console.log(`Marked ${legacy.modifiedCount} existing account(s) as verified`);

  // Users: created once (passwords are hashed by the model).
  const userByEmail = {};
  for (const account of users) {
    let user = await User.findOne({ email: account.email }).select("+password");
    if (!user) {
      user = await User.create(account);
      console.log(`Created ${account.role}: ${account.email}`);
    } else {
      const passwordMatches = await user.comparePassword(account.password);
      let changed = false;
      if (!passwordMatches) {
        user.password = account.password;
        changed = true;
      }
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        changed = true;
      }
      if (user.role !== account.role) {
        user.role = account.role;
        changed = true;
      }
      if (user.name !== account.name) {
        user.name = account.name;
        changed = true;
      }
      if (account.phone !== undefined && user.phone !== account.phone) {
        user.phone = account.phone;
        changed = true;
      }
      if (changed) {
        await user.save();
        console.log(`Repaired ${account.role}: ${account.email}`);
      }
    }
    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      await user.save();
    }
    userByEmail[account.email] = user;
  }

  // Demo bookings are rebuilt on every run so the dates are always relative to today.
  const allServices = await Service.find({ name: { $in: services.map((s) => s.name) } });
  const serviceByName = Object.fromEntries(allServices.map((s) => [s.name, s]));
  const demoUserIds = ["demo@kiculagbe.com", "sara@kiculagbe.com"].map((e) => userByEmail[e]._id);
  await Appointment.deleteMany({ user: { $in: demoUserIds } });
  await Review.deleteMany({ user: { $in: demoUserIds } });

  const items = buildAppointments(serviceByName, config.business.tzOffsetMinutes);
  for (const item of items) {
    const { userEmail, service, review, ...fields } = item;
    const appointment = await Appointment.create({ ...fields, reviewed: Boolean(review), user: userByEmail[userEmail]._id, service: service._id }); // hook sets isActive
    if (review) await Review.create({ ...review, user: appointment.user, service: service._id, appointment: appointment._id });
  }
  for (const service of allServices) await refreshServiceRating(service._id);
  console.log(`Demo bookings created: ${items.length}`);

  console.log("\nLogin accounts");
  for (const u of users) console.log(`  ${u.role.padEnd(5)} ${u.email}  /  ${u.password}`);

  await mongoose.disconnect();
  console.log("\nDone");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
