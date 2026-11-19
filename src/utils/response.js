// Every successful response uses the same envelope: { success, message, data }
export const ok = (res, data = null, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

export const created = (res, data = null, message = "Created") => ok(res, data, message, 201);
