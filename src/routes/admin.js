import { Router } from "express";
import { validate, validateObjectId } from "../middlewares/validate.js";
import * as v from "../utils/validators.js";
import * as admin from "../controllers/admin.controller.js";

// Mounted behind protect + restrictTo("admin") in routes/api.js
const router = Router();
router.param("id", validateObjectId);

router.get("/stats", validate(v.adminStatsQuery, "query"), admin.getStats);
router.get("/reviews", validate(v.adminReviewsQuery, "query"), admin.listReviews);

router.get("/appointments", validate(v.adminAppointmentsQuery, "query"), admin.listAppointments);
router.patch("/appointments/:id/status", validate(v.adminStatusSchema), admin.updateAppointmentStatus);

router.get("/busy", admin.listBusy);
router.post("/busy", validate(v.busyCreateSchema), admin.createBusy);
router.delete("/busy/:id", admin.deleteBusy);

router.get("/services", admin.listAllServices);
router.post("/services", validate(v.serviceBodySchema), admin.createService);
router.put("/services/:id", validate(v.serviceUpdateSchema), admin.updateService);

export default router;
