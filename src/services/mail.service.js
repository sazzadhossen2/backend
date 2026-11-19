import nodemailer from "nodemailer";
import { config } from "../config/config.js";
import ApiError from "../utils/ApiError.js";

let transporter = null;
const getTransporter = () => {
  if (!config.mail.user || !config.mail.pass) return null;
  transporter ||= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: config.mail.user, pass: config.mail.pass },
  });
  return transporter;
};

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const layout = (title, body) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e3ecee;border-radius:14px">
  <h2 style="color:#1f8a55;margin:0 0 12px">${esc(config.mail.fromName)}</h2>
  <h3 style="margin:0 0 12px;color:#0c1d2e">${esc(title)}</h3>
  ${body}
  <p style="color:#748ba0;font-size:12px;margin-top:24px">If you did not expect this email you can safely ignore it.</p>
</div>`;

/** Sends an email. Without SMTP credentials: logs to the console in development, fails in production. */
export const sendMail = async ({ to, subject, text, html }) => {
  const t = getTransporter();
  if (!t) {
    if (config.isProd) throw new ApiError(503, "Email service is not configured");
    console.warn(`[mail:dev] SMTP not configured. To: ${to} | ${subject}\n${text}`);
    return { skipped: true };
  }
  return t.sendMail({ from: `"${config.mail.fromName}" <${config.mail.user}>`, to, subject, text, html });
};

export const sendOtpEmail = ({ to, name, code, purpose, ttlMinutes }) => {
  const isReset = purpose === "reset";
  const title = isReset ? "Reset your password" : "Verify your email";
  const intro = isReset ? "Use this code to reset your password." : "Use this code to finish creating your account.";
  return sendMail({
    to,
    subject: `${code} is your ${config.mail.fromName} ${isReset ? "password reset" : "verification"} code`,
    text: `Hi ${name || "there"},\n\n${intro}\n\nYour code: ${code}\nIt expires in ${ttlMinutes} minutes. Never share it with anyone.`,
    html: layout(
      title,
      `<p style="color:#0c1d2e">Hi ${esc(name || "there")}, ${esc(intro)}</p>
       <div style="font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;background:#e6f6ee;color:#1f8a55;border-radius:12px;padding:16px;margin:16px 0">${esc(code)}</div>
       <p style="color:#748ba0;font-size:13px">This code expires in ${esc(ttlMinutes)} minutes. Never share it with anyone.</p>`
    ),
  });
};

const STATUS_COPY = {
  confirmed: ["Your booking is confirmed", "Good news! Your booking has been confirmed."],
  cancelled: ["Your booking was not accepted", "Sorry, we could not accept your booking."],
  completed: ["Thanks for visiting us", "Your booking is marked as completed. We would love to hear your feedback: open the app and rate the service."],
};

export const sendBookingStatusEmail = ({ user, appointment, serviceName, status, reason }) => {
  const copy = STATUS_COPY[status];
  if (!copy) return Promise.resolve();
  const when = new Date(appointment.startAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
  const reasonLine = reason ? `\nReason: ${reason}` : "";
  const refundLine = status === "cancelled" && appointment.paymentStatus === "refunded" ? "\nYour payment has been refunded." : "";
  return sendMail({
    to: user.email,
    subject: copy[0],
    text: `Hi ${user.name},\n\n${copy[1]}\n\nService: ${serviceName}\nWhen: ${when}${reasonLine}${refundLine}`,
    html: layout(
      copy[0],
      `<p style="color:#0c1d2e">Hi ${esc(user.name)}, ${esc(copy[1])}</p>
       <p style="color:#0c1d2e"><b>${esc(serviceName)}</b><br/>${esc(when)}</p>
       ${reason ? `<p style="color:#dd4b39">Reason: ${esc(reason)}</p>` : ""}
       ${refundLine ? `<p style="color:#1f8a55">Your payment has been refunded.</p>` : ""}`
    ),
  });
};
