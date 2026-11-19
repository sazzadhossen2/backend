// Pure demo data (no database access) so it can be reused and unit-tested.
const img = (seed) => `https://picsum.photos/seed/${seed}/800/600`;
const MS_MIN = 60000;

export const services = [
  { name: "Classic Haircut & Styling", category: "Salon", price: 500, durationMinutes: 45, rating: 4.7, bookingsCount: 120, isFeatured: true, image: img("haircut-styling"), description: "A precise cut and style by an experienced stylist. Includes wash, blow-dry and finishing." },
  { name: "Bridal Makeup", category: "Salon", price: 8000, durationMinutes: 180, rating: 4.9, bookingsCount: 40, image: img("bridal-makeup"), description: "Complete bridal makeover with premium products, hair styling and draping assistance." },
  { name: "Full Body Massage", category: "Spa & Wellness", price: 2500, durationMinutes: 60, rating: 4.9, bookingsCount: 210, isFeatured: true, image: img("body-massage"), description: "Relaxing 60-minute massage that relieves muscle tension and stress using aromatic oils." },
  { name: "Facial Glow Treatment", category: "Spa & Wellness", price: 1800, durationMinutes: 60, rating: 4.6, bookingsCount: 95, image: img("facial-glow"), description: "Deep cleansing facial with exfoliation, mask and moisturising for fresh, glowing skin." },
  { name: "Home Deep Cleaning", category: "Home Services", price: 4500, durationMinutes: 180, rating: 4.8, bookingsCount: 175, isFeatured: true, image: img("home-cleaning"), description: "Professional team deep-cleans kitchen, bathrooms, floors and living areas with safe products." },
  { name: "AC Servicing", category: "Home Services", price: 1200, durationMinutes: 60, rating: 4.5, bookingsCount: 150, image: img("ac-servicing"), description: "Full split/window AC service: filter cleaning, gas check, coil wash and performance test." },
  { name: "Plumbing Repair", category: "Home Services", price: 700, durationMinutes: 45, rating: 4.4, bookingsCount: 88, image: img("plumbing-repair"), description: "Fix leaks, taps, drains and fittings. Visit charge included; parts billed separately." },
  { name: "Personal Training Session", category: "Fitness", price: 1000, durationMinutes: 60, rating: 4.8, bookingsCount: 70, isFeatured: true, image: img("personal-training"), description: "One-on-one session with a certified trainer tailored to your goals and fitness level." },
  { name: "Yoga Class", category: "Fitness", price: 600, durationMinutes: 60, rating: 4.7, bookingsCount: 110, image: img("yoga-class"), description: "Beginner-friendly yoga flow focusing on flexibility, breathing and mindfulness." },
  { name: "Pet Grooming", category: "Pet Care", price: 1500, durationMinutes: 90, rating: 4.6, bookingsCount: 52, image: img("pet-grooming"), description: "Bath, haircut, nail trimming and ear cleaning for dogs and cats by gentle groomers." },
  { name: "Car Wash & Polish", category: "Automotive", price: 900, durationMinutes: 60, rating: 4.3, bookingsCount: 64, image: img("car-wash"), description: "Exterior foam wash, interior vacuum and wax polish to leave your car spotless." },
  { name: "Laptop Repair & Checkup", category: "Tech Support", price: 800, durationMinutes: 45, rating: 4.5, bookingsCount: 58, image: img("laptop-repair"), description: "Diagnosis, cleaning, software fixes and hardware health check for laptops." },
];

export const users = [
  { name: "Admin", email: "admin@kiculagbe.com", password: "Admin@12345", role: "admin", isEmailVerified: true },
  { name: "Demo User", email: "demo@kiculagbe.com", password: "Demo@12345", role: "user", phone: "+8801700000000", isEmailVerified: true },
  { name: "Sara Ahmed", email: "sara@kiculagbe.com", password: "Sara@12345", role: "user", phone: "+8801800000000", isEmailVerified: true },
];

// Bookings relative to "today" (day: 0 = today, 1 = tomorrow, -2 = two days ago). Times are business-local.
// They cover every status, and Sara's bookings make some slots show as "booked" for other users.
export const demoAppointments = [
  // Demo User: upcoming
  { user: "demo@kiculagbe.com", service: "Full Body Massage", day: 1, hour: 11, minute: 0, status: "pending", notes: "Please call before arriving" },
  { user: "demo@kiculagbe.com", service: "Personal Training Session", day: 2, hour: 9, minute: 0, status: "confirmed", notes: "Focus on core and stretching" },
  { user: "demo@kiculagbe.com", service: "Classic Haircut & Styling", day: 3, hour: 15, minute: 0, status: "pending", notes: "" },
  // Demo User: previous
  { user: "demo@kiculagbe.com", service: "Home Deep Cleaning", day: -5, hour: 10, minute: 0, status: "completed", notes: "2-bedroom apartment" },
  { user: "demo@kiculagbe.com", service: "Yoga Class", day: -2, hour: 17, minute: 0, status: "completed", notes: "" },
  { user: "demo@kiculagbe.com", service: "Facial Glow Treatment", day: -1, hour: 13, minute: 0, status: "cancelled", notes: "Had to reschedule" },
  // Older months (so the admin dashboard shows monthly statistics). `review` creates a customer review.
  { user: "demo@kiculagbe.com", service: "Full Body Massage", day: -34, hour: 11, minute: 0, status: "completed", notes: "", paid: true, review: { rating: 5, comment: "Super relaxing, will book again." } },
  { user: "sara@kiculagbe.com", service: "Classic Haircut & Styling", day: -36, hour: 15, minute: 0, status: "completed", notes: "", paid: true, review: { rating: 4, comment: "Great cut, a little wait at the start." } },
  { user: "sara@kiculagbe.com", service: "AC Servicing", day: -41, hour: 10, minute: 0, status: "completed", notes: "", review: { rating: 5, comment: "Quick and professional." } },
  { user: "demo@kiculagbe.com", service: "Yoga Class", day: -45, hour: 17, minute: 0, status: "completed", notes: "", review: { rating: 4, comment: "Nice beginner session." } },
  { user: "sara@kiculagbe.com", service: "Facial Glow Treatment", day: -39, hour: 13, minute: 0, status: "cancelled", notes: "Denied: fully booked", adminNote: "We were fully booked at that time." },
  { user: "demo@kiculagbe.com", service: "Home Deep Cleaning", day: -68, hour: 9, minute: 0, status: "completed", notes: "", review: { rating: 5, comment: "Spotless kitchen!" } },
  { user: "sara@kiculagbe.com", service: "Personal Training Session", day: -72, hour: 18, minute: 0, status: "completed", notes: "", review: { rating: 3, comment: "Good trainer, session felt short." } },
  // Sara: occupy slots so the booking screen shows unavailable times
  { user: "sara@kiculagbe.com", service: "Full Body Massage", day: 1, hour: 14, minute: 0, status: "confirmed", notes: "" },
  { user: "sara@kiculagbe.com", service: "Yoga Class", day: 1, hour: 10, minute: 0, status: "pending", notes: "" },
];

// Returns a function (dayOffset, hour, minute) -> Date (UTC instant) for the business time zone.
export const makeClock = (tzOffsetMinutes, now = new Date()) => {
  const local = new Date(now.getTime() + tzOffsetMinutes * MS_MIN);
  const base = { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate() };
  return (dayOffset, hour, minute = 0) =>
    new Date(Date.UTC(base.y, base.m, base.d + dayOffset, hour, minute) - tzOffsetMinutes * MS_MIN);
};

// Converts the definitions above into appointment field objects (user/service resolved by the caller).
export const buildAppointments = (serviceByName, tzOffsetMinutes, now = new Date()) => {
  const at = makeClock(tzOffsetMinutes, now);
  return demoAppointments.map((a) => {
    const service = serviceByName[a.service];
    const startAt = at(a.day, a.hour, a.minute);
    return {
      userEmail: a.user,
      service,
      startAt,
      endAt: new Date(startAt.getTime() + service.durationMinutes * MS_MIN),
      status: a.status,
      notes: a.notes,
      adminNote: a.adminNote || "",
      price: service.price,
      paymentStatus: a.paid ? "paid" : "unpaid",
      paymentIntentId: a.paid ? `pi_demo_${Math.abs(a.day)}_${a.hour}` : "",
      paidAt: a.paid ? startAt : undefined,
      createdAt: new Date(startAt.getTime() - 3 * 24 * 60 * MS_MIN),
      review: a.review ? { ...a.review, createdAt: new Date(startAt.getTime() + service.durationMinutes * MS_MIN + 2 * 60 * MS_MIN) } : undefined,
      cancelledAt: a.status === "cancelled" ? new Date(startAt.getTime() - 24 * 60 * MS_MIN) : undefined,
    };
  });
};
