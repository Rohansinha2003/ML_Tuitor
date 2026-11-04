// server/src/app.ts
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit2 from "express-rate-limit";

// server/src/config/env.ts
import dotenv from "dotenv";
import { z } from "zod";
dotenv.config({ path: [".env", "server/.env"] });
var defaultAccessSecret = "deepnova_default_jwt_access_secret_32_bytes_long_min";
var defaultRefreshSecret = "deepnova_default_jwt_refresh_secret_32_bytes_long_min";
var vercelHost = process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL;
var defaultOrigin = (vercelHost ? `https://${vercelHost}` : void 0) || (process.env.NODE_ENV === "production" ? "https://ml-tuitor.vercel.app" : "http://localhost:5173");
var defaultCookieSecure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";
var schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1).optional().or(z.literal("")),
  CLIENT_ORIGIN: z.preprocess((value) => value || void 0, z.string().url().default(defaultOrigin)).transform((value) => value.replace(/\/+$/, "")),
  JWT_ACCESS_SECRET: z.string().min(32).default(() => {
    return process.env.JWT_ACCESS_SECRET || defaultAccessSecret;
  }),
  JWT_REFRESH_SECRET: z.string().min(32).default(() => {
    return process.env.JWT_REFRESH_SECRET || defaultRefreshSecret;
  }),
  COOKIE_SECURE: z.enum(["true", "false"]).default(defaultCookieSecure ? "true" : "false").transform((value) => value === "true"),
  EMAIL_FROM: z.string().email().optional().or(z.literal("")),
  SMTP_HOST: z.string().optional().or(z.literal("")),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional().or(z.literal("")),
  SMTP_PASSWORD: z.string().optional().or(z.literal("")),
  GOOGLE_CLIENT_ID: z.string().optional().or(z.literal("")),
  GOOGLE_CLIENT_SECRET: z.string().optional().or(z.literal("")),
  GOOGLE_CALLBACK_URL: z.string().url().optional().or(z.literal(""))
});
var parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
  throw new Error(`Invalid backend environment configuration:
${issues}`);
}
if (parsed.data.NODE_ENV === "production" && (parsed.data.JWT_ACCESS_SECRET === defaultAccessSecret || parsed.data.JWT_REFRESH_SECRET === defaultRefreshSecret)) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set to unique values in production");
}
if (parsed.data.NODE_ENV === "production" && !parsed.data.COOKIE_SECURE) {
  console.warn("\u26A0\uFE0F COOKIE_SECURE is false in production environment");
}
var googleCallbackUrl = parsed.data.GOOGLE_CALLBACK_URL || `${parsed.data.CLIENT_ORIGIN}/api/auth/google/callback`;
if (parsed.data.NODE_ENV === "production" && parsed.data.GOOGLE_CLIENT_ID && /localhost|127\.0\.0\.1/.test(googleCallbackUrl)) {
  console.warn("GOOGLE_CALLBACK_URL points at localhost in production; Google sign-in will fail for deployed users");
}
var env = {
  ...parsed.data,
  GOOGLE_CALLBACK_URL: googleCallbackUrl,
  emailConfigured: Boolean(parsed.data.SMTP_HOST && parsed.data.SMTP_USER && parsed.data.SMTP_PASSWORD && parsed.data.EMAIL_FROM),
  googleConfigured: Boolean(parsed.data.GOOGLE_CLIENT_ID && parsed.data.GOOGLE_CLIENT_SECRET)
};

// server/src/database.ts
import mongoose from "mongoose";
var connection = null;
var lastFailure = null;
mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false);
function classifyFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/authentication failed|bad auth/i.test(message)) return "authentication";
  if (/whitelist|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|querySrv|Server selection timed out|ReplicaSetNoPrimary|Could not connect/i.test(message)) return "network";
  return "unknown";
}
async function connectDatabase(uri) {
  if (!uri) {
    lastFailure = "not-configured";
    throw new Error("MONGODB_URI is not configured");
  }
  if (mongoose.connection.readyState === 1) return;
  connection ??= mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8e3,
    connectTimeoutMS: 8e3,
    maxPoolSize: 10
  }).then(() => {
    lastFailure = null;
  }).catch((error) => {
    lastFailure = classifyFailure(error);
    throw new Error(`MongoDB connection failed (${lastFailure})`, { cause: error });
  }).finally(() => {
    connection = null;
  });
  await connection;
}
function databaseStatus() {
  const connected = mongoose.connection.readyState === 1;
  return { database: connected ? "connected" : "disconnected", ...!connected && lastFailure ? { databaseIssue: lastFailure } : {} };
}

// server/src/middleware/errorHandler.ts
import { ZodError } from "zod";
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
  status;
};
var errorHandler = (error, _request, response, next) => {
  void next;
  if (error instanceof ZodError) {
    response.status(400).json({ error: "Invalid request", details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) });
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11e3) {
    response.status(409).json({ error: "A record with those details already exists" });
    return;
  }
  console.error("Unhandled API error", error instanceof Error ? error.message : "Unknown error");
  response.status(500).json({ error: "An unexpected server error occurred" });
};

// server/src/middleware/origin.ts
var trustedOrigins = /* @__PURE__ */ new Set(
  [
    env.CLIENT_ORIGIN,
    "https://ml-tuitor.vercel.app",
    ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).map((host) => `https://${host}`)
  ]
);
function isTrustedOrigin(origin) {
  if (trustedOrigins.has(origin)) return true;
  return env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}
function isSameOrigin(request, origin) {
  try {
    return new URL(origin).host === request.get("host");
  } catch {
    return false;
  }
}
var requireClientOrigin = (request, _response, next) => {
  const origin = request.get("origin");
  if (!origin || !(isTrustedOrigin(origin) || isSameOrigin(request, origin))) {
    next(new HttpError(403, "Request origin is not allowed"));
    return;
  }
  next();
};

// server/src/routes/auth.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt3 from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

// server/src/models/Session.ts
import { Schema, model } from "mongoose";
var sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  refreshTokenHash: { type: String, required: true, select: false },
  previousRefreshTokenHash: { type: String, select: false, default: void 0 },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  rotatedAt: { type: Date, default: null }
}, { timestamps: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
var Session = model("Session", sessionSchema);

// server/src/models/User.ts
import { Schema as Schema2, model as model2 } from "mongoose";
var userSchema = new Schema2({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  passwordHash: { type: String, required: false, select: false, default: void 0 },
  googleId: { type: String, unique: true, sparse: true, select: false, default: void 0 },
  authProvider: { type: String, enum: ["password", "google"], default: "password" },
  avatarUrl: { type: String, default: null, maxlength: 2048 },
  emailVerified: { type: Boolean, default: false },
  verificationTokenHash: { type: String, select: false, default: void 0 },
  verificationExpiresAt: { type: Date, select: false, default: void 0 },
  resetTokenHash: { type: String, select: false, default: void 0 },
  resetExpiresAt: { type: Date, select: false, default: void 0 },
  passwordChangedAt: { type: Date, default: null },
  activityDays: { type: [String], select: false, default: void 0 }
}, { timestamps: true });
userSchema.index({ email: 1 }, { unique: true });
var User = model2("User", userSchema);

// server/src/middleware/authenticate.ts
import jwt from "jsonwebtoken";
var authenticate = async (request, _response, next) => {
  const [scheme, token] = (request.get("authorization") ?? "").split(" ");
  if (scheme !== "Bearer" || !token) {
    next(new HttpError(401, "Authentication required"));
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (payload.type !== "access" || typeof payload.sub !== "string" || typeof payload.sid !== "string") throw new Error("Invalid access token");
    const session = await Session.exists({ _id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { $gt: /* @__PURE__ */ new Date() } });
    if (!session) throw new Error("Session revoked");
    request.auth = { userId: payload.sub, sessionId: payload.sid };
    next();
  } catch {
    next(new HttpError(401, "Session expired; sign in again"));
  }
};

// server/src/middleware/validate.ts
function validateBody(schema2) {
  return (request, _response, next) => {
    const result = schema2.safeParse(request.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    request.body = result.data;
    next();
  };
}

// server/src/validators/schemas.ts
import { z as z2 } from "zod";
var password = z2.string().min(12).max(128).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes");
var email = z2.string().trim().email().max(254).transform((value) => value.toLowerCase());
var lessonSlug = z2.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/);
var activityDay = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var signupSchema = z2.object({
  name: z2.string().trim().min(1).max(100),
  email,
  password,
  confirmPassword: z2.string()
}).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
var loginSchema = z2.object({ email, password: z2.string().min(1).max(128) });
var forgotPasswordSchema = z2.object({ email });
var resendVerificationSchema = z2.object({ email });
var resetPasswordSchema = z2.object({ token: z2.string().min(32).max(256), password, confirmPassword: z2.string() }).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
var verifyEmailSchema = z2.object({ token: z2.string().min(32).max(256) });
var changePasswordSchema = z2.object({ currentPassword: z2.string().min(1).max(128), password, confirmPassword: z2.string() }).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
var progressSchema = z2.object({
  isCompleted: z2.boolean().optional(),
  lastSection: z2.string().trim().max(160).nullable().optional(),
  day: activityDay.optional()
});
var noteSchema = z2.object({ content: z2.string().max(2e4) });
var quizAttemptSchema = z2.object({ lessonSlug, selectedIndex: z2.number().int().nonnegative() });
var accessedSchema = z2.object({ day: activityDay.optional() });
var importProgressSchema = z2.object({
  completed: z2.array(lessonSlug).max(500).default([]),
  bookmarks: z2.array(lessonSlug).max(500).default([]),
  notes: z2.record(lessonSlug, z2.string().max(2e4)).default({}),
  activity: z2.array(activityDay).max(3660).default([]),
  lastLesson: lessonSlug.optional()
});
var listQuerySchema = z2.object({ page: z2.coerce.number().int().min(1).default(1), limit: z2.coerce.number().int().min(1).max(100).default(20) });
function parseSlug(value) {
  return lessonSlug.parse(value);
}

// server/src/utils/tokens.ts
import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt2 from "jsonwebtoken";
var hashToken = (token) => createHash("sha256").update(token).digest("hex");
var createOpaqueToken = () => randomBytes(32).toString("base64url");
function createAccessToken(userId, sessionId) {
  return jwt2.sign({ type: "access", sid: sessionId }, env.JWT_ACCESS_SECRET, { subject: userId, expiresIn: "10m" });
}
function createRefreshToken(userId, sessionId) {
  return jwt2.sign({ type: "refresh", sid: sessionId }, env.JWT_REFRESH_SECRET, { subject: userId, expiresIn: "30d", jwtid: randomUUID() });
}

// server/src/utils/email.ts
import nodemailer from "nodemailer";
var transporter = env.emailConfigured ? nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  requireTLS: env.SMTP_PORT !== 465,
  connectionTimeout: 8e3,
  greetingTimeout: 8e3,
  socketTimeout: 8e3,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
}) : null;
async function sendAccountEmail(to, subject, text, html) {
  if (!transporter || !env.EMAIL_FROM) throw new Error("Email delivery is not configured");
  await transporter.sendMail({
    from: `"DeepNova Studio" <${env.EMAIL_FROM}>`,
    to,
    subject,
    text,
    ...html ? { html } : {}
  });
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function baseEmailTemplate({
  headline,
  subhead,
  contentHtml,
  buttonText,
  buttonUrl
}) {
  const homeUrl = env.CLIENT_ORIGIN;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline.replace(/<[^>]*>/g, "")}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f6f1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #192a25;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f6f6f1; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #fffefa; border: 1px solid #dfe3dc; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(25, 42, 37, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 36px 24px; border-bottom: 1px solid #dfe3dc; background-color: #fcfcf9;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; width: 28px; height: 28px; background-color: #1c6149; border-radius: 7px; color: #ffffff; text-align: center; line-height: 28px; font-weight: bold; font-size: 15px;">D</span>
                    <span style="font-size: 18px; font-weight: 700; color: #192a25; margin-left: 8px; letter-spacing: -0.2px;">deep<span style="color: #1c6149;">nova</span></span>
                  </td>
                  <td align="right">
                    <span style="font-size: 10px; font-family: monospace; color: #97a099; letter-spacing: 1px;">FIELD NOTES 01</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 36px 28px;">
              <h1 style="font-size: 24px; font-weight: 600; color: #192a25; margin: 0 0 10px; line-height: 1.3;">${headline}</h1>
              ${subhead ? `<p style="font-size: 14px; color: #68736c; margin: 0 0 24px; line-height: 1.6;">${subhead}</p>` : ""}
              
              <div style="font-size: 14px; color: #192a25; line-height: 1.7; margin-bottom: 28px;">
                ${contentHtml}
              </div>

              ${buttonText && buttonUrl ? `
              <div style="text-align: center; margin: 32px 0 28px;">
                <a href="${buttonUrl}" style="display: inline-block; background-color: #1c6149; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px 28px; border-radius: 6px; box-shadow: 0 2px 8px rgba(28, 97, 73, 0.25);">
                  ${buttonText} &rarr;
                </a>
              </div>
              ` : ""}

              <!-- Home Page Navigation Box -->
              <div style="background-color: #f6f6f1; border: 1px solid #dfe3dc; border-radius: 8px; padding: 18px 20px; margin-top: 32px;">
                <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #1c6149;">DeepNova Links</p>
                <p style="margin: 0; font-size: 13px; color: #68736c; line-height: 1.6;">
                  Visit your home page anytime:<br>
                  <a href="${homeUrl}" style="color: #1c6149; font-weight: 600; word-break: break-all;">${homeUrl}</a>
                </p>
                <div style="margin-top: 10px; font-size: 12px; color: #97a099;">
                  <a href="${homeUrl}/curriculum" style="color: #68736c; text-decoration: none; margin-right: 14px;">Curriculum &rarr;</a>
                  <a href="${homeUrl}/playground" style="color: #68736c; text-decoration: none;">Interactive Labs &rarr;</a>
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 32px; border-top: 1px solid #dfe3dc; background-color: #fcfcf9; text-align: center;">
              <p style="font-size: 11px; color: #97a099; margin: 0 0 6px; font-family: monospace;">
                DEEPNOVA STUDIO &middot; LEARN BY UNDERSTANDING
              </p>
              <p style="font-size: 11px; color: #97a099; margin: 0;">
                Made for the long way in. You received this email because an account was registered with this address.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
async function sendWelcomeVerificationEmail(to, name, token) {
  const verifyUrl = `${env.CLIENT_ORIGIN}/verify-email?token=${encodeURIComponent(token)}`;
  const homeUrl = env.CLIENT_ORIGIN;
  const subject = `Welcome to DeepNova \u2014 Confirm your account`;
  const text = `Welcome to DeepNova, ${name}!

Thank you for creating your account. Please confirm your email address by opening this verification link (valid for 24 hours):
${verifyUrl}

You can explore DeepNova anytime from our home page:
${homeUrl}

Curriculum: ${homeUrl}/curriculum
Playground: ${homeUrl}/playground

\u2014
DeepNova Studio
Built for curious minds.`;
  const html = baseEmailTemplate({
    headline: `Welcome to DeepNova, ${escapeHtml(name)}!`,
    subhead: "Your account has been created. Please confirm your email to activate your learning workspace.",
    contentHtml: `
      <p style="margin: 0 0 14px;">
        We're thrilled to have you here. DeepNova is built to help you understand machine learning from first principles\u2014no black boxes, just clear mathematical derivations and real-time visual labs.
      </p>
      <p style="margin: 0;">
        Click the button below to confirm your email and activate your account. This link will remain valid for 24 hours.
      </p>
    `,
    buttonText: "Confirm Email & Enter Studio",
    buttonUrl: verifyUrl
  });
  await sendAccountEmail(to, subject, text, html);
}
async function sendWelcomeEmail(to, name) {
  const homeUrl = env.CLIENT_ORIGIN;
  const subject = `Welcome to DeepNova \u2014 You're all set!`;
  const text = `Welcome to DeepNova, ${name}!

Your account has been confirmed and is ready to use.

Start exploring machine learning from first principles on our home page:
${homeUrl}

Quick links:
\u2022 Home Page: ${homeUrl}
\u2022 Studio Overview: ${homeUrl}/overview
\u2022 Curriculum: ${homeUrl}/curriculum
\u2022 Interactive Playground: ${homeUrl}/playground

\u2014
DeepNova Studio
Built for curious minds.`;
  const html = baseEmailTemplate({
    headline: `Welcome aboard, ${escapeHtml(name)}!`,
    subhead: "Your account is confirmed and your personal learning workspace is active.",
    contentHtml: `
      <p style="margin: 0 0 14px;">
        Your DeepNova account is all set. You now have access to every lesson and interactive lab, with bookmarks, notes, and quiz progress synced to your account.
      </p>
      <p style="margin: 0;">
        Ready to dive in? Launch the studio from our home page or explore our interactive playgrounds.
      </p>
    `,
    buttonText: "Open DeepNova Home Page",
    buttonUrl: homeUrl
  });
  await sendAccountEmail(to, subject, text, html);
}
async function sendPasswordResetEmail(to, token) {
  const resetUrl = `${env.CLIENT_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your DeepNova password";
  const text = `We received a request to reset your DeepNova password.

Open this link within 30 minutes to choose a new password:
${resetUrl}

If you did not request this, you can safely ignore this email.

\u2014
DeepNova Studio`;
  const html = baseEmailTemplate({
    headline: "Reset your password.",
    subhead: "We received a request to update your DeepNova account password.",
    contentHtml: `
      <p style="margin: 0 0 14px;">
        Use the button below to choose a new password. This link is single-use and expires in 30 minutes.
      </p>
      <p style="margin: 0;">
        If you did not request a password reset, you can safely ignore this email.
      </p>
    `,
    buttonText: "Choose New Password",
    buttonUrl: resetUrl
  });
  await sendAccountEmail(to, subject, text, html);
}

// server/src/routes/auth.ts
var authRouter = Router();
var refreshCookieName = "deepnova_refresh";
var thirtyDaysMs = 30 * 24 * 60 * 60 * 1e3;
var rotationGraceMs = 30 * 1e3;
var limiterDefaults = { standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many attempts. Please wait a while and try again." }, skip: () => env.NODE_ENV === "test" };
var loginLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1e3, limit: 10, skipSuccessfulRequests: true });
var signupLimiter = rateLimit({ ...limiterDefaults, windowMs: 60 * 60 * 1e3, limit: 10 });
var resetLimiter = rateLimit({ ...limiterDefaults, windowMs: 60 * 60 * 1e3, limit: 5 });
var googleStateCookieName = "deepnova_google_state";
var googleClient = env.googleConfigured ? new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL) : null;
function cookieOptions() {
  return { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "strict", path: "/api/auth" };
}
function safeUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null, emailVerified: user.emailVerified, hasPassword: Boolean(user.passwordHash), createdAt: user.createdAt };
}
async function issueSession(userId, response) {
  const session = await Session.create({ userId, refreshTokenHash: "pending", expiresAt: new Date(Date.now() + thirtyDaysMs) });
  const refreshToken = createRefreshToken(userId, session.id);
  session.refreshTokenHash = hashToken(refreshToken);
  await session.save();
  response.cookie(refreshCookieName, refreshToken, { ...cookieOptions(), maxAge: thirtyDaysMs });
  return createAccessToken(userId, session.id);
}
function clearRefreshCookie(response) {
  response.clearCookie(refreshCookieName, cookieOptions());
}
function safeReturnTo(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
function verifyRefreshToken(token) {
  const payload = jwt3.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof payload === "string" || payload.type !== "refresh" || typeof payload.sub !== "string" || typeof payload.sid !== "string") {
    throw new HttpError(401, "Session expired; sign in again");
  }
  return payload;
}
authRouter.post("/signup", signupLimiter, validateBody(signupSchema), async (request, response) => {
  const { name, email: email2, password: password2 } = request.body;
  if (await User.exists({ email: email2 })) throw new HttpError(409, "An account with this email already exists. Sign in instead.");
  const verificationToken = env.emailConfigured ? createOpaqueToken() : void 0;
  const user = await User.create({
    name,
    email: email2,
    passwordHash: await bcrypt.hash(password2, 12),
    emailVerified: !env.emailConfigured,
    ...verificationToken ? { verificationTokenHash: hashToken(verificationToken), verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3) } : {}
  });
  if (verificationToken) {
    try {
      await sendWelcomeVerificationEmail(email2, name, verificationToken);
    } catch {
      await User.deleteOne({ _id: user._id });
      throw new HttpError(503, "Email verification is temporarily unavailable. Please try again later.");
    }
    response.status(201).json({ data: { user: safeUser(user), requiresEmailVerification: true } });
    return;
  }
  const accessToken = await issueSession(user.id, response);
  response.status(201).json({ data: { user: safeUser(user), accessToken, requiresEmailVerification: false } });
});
authRouter.post("/verify-email", validateBody(verifyEmailSchema), async (request, response) => {
  const { token } = request.body;
  const user = await User.findOneAndUpdate(
    { verificationTokenHash: hashToken(token), verificationExpiresAt: { $gt: /* @__PURE__ */ new Date() } },
    { $set: { emailVerified: true }, $unset: { verificationTokenHash: 1, verificationExpiresAt: 1 } },
    { new: true }
  );
  if (!user) throw new HttpError(400, "Verification link is invalid or expired");
  if (env.emailConfigured) {
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (error) {
      console.warn("Welcome confirmation email delivery failed:", error instanceof Error ? error.message : "Unknown error");
    }
  }
  response.json({ data: { user: safeUser(user) } });
});
authRouter.post("/login", loginLimiter, validateBody(loginSchema), async (request, response) => {
  const { email: email2, password: password2 } = request.body;
  const user = await User.findOne({ email: email2 }).select("+passwordHash");
  if (!user?.passwordHash || !await bcrypt.compare(password2, user.passwordHash)) throw new HttpError(401, "Email or password is incorrect");
  if (env.emailConfigured && !user.emailVerified) throw new HttpError(403, "Verify your email before signing in");
  const accessToken = await issueSession(user.id, response);
  response.json({ data: { user: safeUser(user), accessToken } });
});
function redirectToLoginError(response, code) {
  response.redirect(`${env.CLIENT_ORIGIN}/login?error=${code}`);
}
async function resolveGoogleUser(profile) {
  const email2 = profile.email.toLowerCase();
  const avatarUrl = profile.picture ?? null;
  const fields = "+passwordHash +googleId";
  const known = await User.findOne({ googleId: profile.sub }).select(fields);
  if (known) {
    if (avatarUrl && known.avatarUrl !== avatarUrl) {
      known.avatarUrl = avatarUrl;
      await known.save();
    }
    return { user: known, isNewUser: false };
  }
  const existing = await User.findOne({ email: email2 }).select(fields);
  if (existing) {
    if (existing.googleId) return null;
    if (!existing.emailVerified) {
      existing.passwordHash = void 0;
      await Session.updateMany({ userId: existing._id, revokedAt: null }, { $set: { revokedAt: /* @__PURE__ */ new Date() } });
    }
    existing.googleId = profile.sub;
    existing.emailVerified = true;
    existing.verificationTokenHash = void 0;
    existing.verificationExpiresAt = void 0;
    existing.avatarUrl = existing.avatarUrl ?? avatarUrl;
    await existing.save();
    return { user: existing, isNewUser: false };
  }
  try {
    const user = await User.create({ name: profile.name?.trim().slice(0, 100) || email2.split("@")[0], email: email2, googleId: profile.sub, authProvider: "google", emailVerified: true, avatarUrl });
    return { user, isNewUser: true };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11e3) {
      const winner = await User.findOne({ googleId: profile.sub }).select(fields);
      if (winner) return { user: winner, isNewUser: false };
    }
    throw error;
  }
}
authRouter.get("/google", (request, response) => {
  if (!googleClient) {
    redirectToLoginError(response, "google_unavailable");
    return;
  }
  const state = createOpaqueToken();
  const returnTo = safeReturnTo(request.query.returnTo);
  response.cookie(googleStateCookieName, `${state}.${Buffer.from(returnTo).toString("base64url")}`, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    maxAge: 10 * 60 * 1e3,
    path: "/api/auth/google"
  });
  response.redirect(googleClient.generateAuthUrl({ scope: ["openid", "email", "profile"], state, prompt: "select_account" }));
});
authRouter.get("/google/callback", async (request, response) => {
  if (!googleClient) {
    redirectToLoginError(response, "google_unavailable");
    return;
  }
  const storedState = request.cookies?.[googleStateCookieName];
  const [expectedState, encodedReturnTo] = typeof storedState === "string" ? storedState.split(".") : [];
  const returnTo = safeReturnTo(encodedReturnTo ? Buffer.from(encodedReturnTo, "base64url").toString("utf8") : "/overview");
  response.clearCookie(googleStateCookieName, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", path: "/api/auth/google" });
  if (!expectedState || request.query.state !== expectedState) {
    redirectToLoginError(response, "google_state");
    return;
  }
  if (request.query.error) {
    redirectToLoginError(response, request.query.error === "access_denied" ? "google_denied" : "google_failed");
    return;
  }
  if (typeof request.query.code !== "string") {
    redirectToLoginError(response, "google_failed");
    return;
  }
  let profile;
  try {
    const { tokens } = await googleClient.getToken(request.query.code);
    if (!tokens.id_token) throw new Error("Google returned no ID token");
    const ticket = await googleClient.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
    profile = ticket.getPayload();
  } catch (error) {
    console.error("Google token exchange failed:", error instanceof Error ? error.message : "Unknown error");
    redirectToLoginError(response, "google_failed");
    return;
  }
  if (!profile?.sub || !profile.email || profile.email_verified !== true) {
    redirectToLoginError(response, "google_unverified");
    return;
  }
  const resolved = await resolveGoogleUser({ sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture });
  if (!resolved) {
    redirectToLoginError(response, "google_conflict");
    return;
  }
  if (resolved.isNewUser && env.emailConfigured) {
    try {
      await sendWelcomeEmail(resolved.user.email, resolved.user.name);
    } catch (error) {
      console.warn("Welcome email delivery failed for Google user:", error instanceof Error ? error.message : "Unknown error");
    }
  }
  await issueSession(resolved.user.id, response);
  response.redirect(`${env.CLIENT_ORIGIN}${returnTo}`);
});
authRouter.post("/refresh", requireClientOrigin, async (request, response) => {
  const token = request.cookies?.[refreshCookieName];
  if (typeof token !== "string") throw new HttpError(401, "Session expired; sign in again");
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearRefreshCookie(response);
    throw new HttpError(401, "Session expired; sign in again");
  }
  const oldHash = hashToken(token);
  const replacement = createRefreshToken(payload.sub, payload.sid);
  const result = await Session.updateOne(
    { _id: payload.sid, userId: payload.sub, refreshTokenHash: oldHash, revokedAt: null, expiresAt: { $gt: /* @__PURE__ */ new Date() } },
    { $set: { refreshTokenHash: hashToken(replacement), previousRefreshTokenHash: oldHash, rotatedAt: /* @__PURE__ */ new Date() } }
  );
  if (result.modifiedCount !== 1) {
    const recentlyRotated = await Session.exists({ _id: payload.sid, userId: payload.sub, previousRefreshTokenHash: oldHash, rotatedAt: { $gte: new Date(Date.now() - rotationGraceMs) }, revokedAt: null, expiresAt: { $gt: /* @__PURE__ */ new Date() } });
    if (recentlyRotated) {
      response.json({ data: { accessToken: createAccessToken(payload.sub, payload.sid) } });
      return;
    }
    await Session.updateOne({ _id: payload.sid, userId: payload.sub, revokedAt: null }, { $set: { revokedAt: /* @__PURE__ */ new Date() } });
    clearRefreshCookie(response);
    throw new HttpError(401, "Session expired; sign in again");
  }
  response.cookie(refreshCookieName, replacement, { ...cookieOptions(), maxAge: thirtyDaysMs });
  response.json({ data: { accessToken: createAccessToken(payload.sub, payload.sid) } });
});
authRouter.post("/logout", requireClientOrigin, async (request, response) => {
  const token = request.cookies?.[refreshCookieName];
  if (typeof token === "string") {
    try {
      const payload = verifyRefreshToken(token);
      await Session.updateOne({ _id: payload.sid, userId: payload.sub, refreshTokenHash: hashToken(token), revokedAt: null }, { $set: { revokedAt: /* @__PURE__ */ new Date() } });
    } catch {
    }
  }
  clearRefreshCookie(response);
  response.json({ data: { loggedOut: true } });
});
authRouter.get("/me", authenticate, async (request, response) => {
  const user = await User.findById(request.auth.userId).select("+passwordHash");
  if (!user) throw new HttpError(401, "Account no longer exists");
  response.json({ data: { user: safeUser(user) } });
});
authRouter.post("/resend-verification", resetLimiter, validateBody(resendVerificationSchema), async (request, response) => {
  const { email: email2 } = request.body;
  if (!env.emailConfigured) throw new HttpError(503, "Email delivery is not configured on the server");
  const user = await User.findOne({ email: email2, emailVerified: false });
  if (user) {
    const token = createOpaqueToken();
    await User.updateOne({ _id: user._id }, { $set: { verificationTokenHash: hashToken(token), verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3) } });
    try {
      await sendWelcomeVerificationEmail(email2, user.name, token);
    } catch (error) {
      console.error("Verification email delivery failed", error instanceof Error ? error.message : "Unknown error");
      throw new HttpError(503, "Email delivery is temporarily unavailable. Please try again later.");
    }
  }
  response.json({ data: { message: "If that account still needs verifying, a new link is on its way." } });
});
authRouter.post("/forgot-password", resetLimiter, validateBody(forgotPasswordSchema), async (request, response) => {
  const { email: email2 } = request.body;
  if (!env.emailConfigured) throw new HttpError(503, "Password reset email is not configured on the server");
  const user = await User.findOne({ email: email2 }).select("+resetTokenHash +resetExpiresAt");
  if (user) {
    const token = createOpaqueToken();
    user.resetTokenHash = hashToken(token);
    user.resetExpiresAt = new Date(Date.now() + 30 * 60 * 1e3);
    await user.save();
    try {
      await sendPasswordResetEmail(email2, token);
    } catch (error) {
      user.resetTokenHash = void 0;
      user.resetExpiresAt = void 0;
      await user.save();
      console.error("Password reset email delivery failed", error instanceof Error ? error.message : "Unknown error");
      throw new HttpError(503, "Password reset email delivery is temporarily unavailable. Please try again later.");
    }
  }
  response.json({ data: { message: "If an account exists for that email, password reset instructions will be sent." } });
});
authRouter.post("/reset-password", resetLimiter, validateBody(resetPasswordSchema), async (request, response) => {
  const { token, password: password2 } = request.body;
  const user = await User.findOneAndUpdate(
    { resetTokenHash: hashToken(token), resetExpiresAt: { $gt: /* @__PURE__ */ new Date() } },
    // Opening the emailed link proves ownership of the address, so it also verifies it.
    { $set: { passwordHash: await bcrypt.hash(password2, 12), passwordChangedAt: /* @__PURE__ */ new Date(), emailVerified: true }, $unset: { resetTokenHash: 1, resetExpiresAt: 1, verificationTokenHash: 1, verificationExpiresAt: 1 } },
    { new: true }
  );
  if (!user) throw new HttpError(400, "Reset link is invalid or expired");
  await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: /* @__PURE__ */ new Date() } });
  response.json({ data: { message: "Password reset. You can now sign in with your new password." } });
});
authRouter.patch("/change-password", authenticate, validateBody(changePasswordSchema), async (request, response) => {
  const { currentPassword, password: password2 } = request.body;
  const user = await User.findById(request.auth.userId).select("+passwordHash");
  if (!user?.passwordHash || !await bcrypt.compare(currentPassword, user.passwordHash)) throw new HttpError(400, "Current password is incorrect");
  user.passwordHash = await bcrypt.hash(password2, 12);
  user.passwordChangedAt = /* @__PURE__ */ new Date();
  await user.save();
  await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: /* @__PURE__ */ new Date() } });
  clearRefreshCookie(response);
  response.json({ data: { message: "Password changed. Sign in again on your devices." } });
});

// server/src/routes/progress.ts
import { Router as Router2 } from "express";
import { Types } from "mongoose";

// server/src/models/LessonNote.ts
import { Schema as Schema3, model as model3 } from "mongoose";
var lessonNoteSchema = new Schema3({
  userId: { type: Schema3.Types.ObjectId, ref: "User", required: true },
  lessonSlug: { type: String, required: true, trim: true, maxlength: 120 },
  content: { type: String, required: true, maxlength: 2e4 }
}, { timestamps: true });
lessonNoteSchema.index({ userId: 1, lessonSlug: 1 }, { unique: true });
var LessonNote = model3("LessonNote", lessonNoteSchema);

// server/src/models/Bookmark.ts
import { Schema as Schema4, model as model4 } from "mongoose";
var bookmarkSchema = new Schema4({
  userId: { type: Schema4.Types.ObjectId, ref: "User", required: true },
  lessonSlug: { type: String, required: true, trim: true, maxlength: 120 }
}, { timestamps: { createdAt: true, updatedAt: false } });
bookmarkSchema.index({ userId: 1, lessonSlug: 1 }, { unique: true });
var Bookmark = model4("Bookmark", bookmarkSchema);

// server/src/models/LessonProgress.ts
import { Schema as Schema5, model as model5 } from "mongoose";
var lessonProgressSchema = new Schema5({
  userId: { type: Schema5.Types.ObjectId, ref: "User", required: true },
  lessonSlug: { type: String, required: true, trim: true, maxlength: 120 },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  lastAccessedAt: { type: Date, default: Date.now },
  lastSection: { type: String, default: null, maxlength: 160 }
}, { timestamps: true });
lessonProgressSchema.index({ userId: 1, lessonSlug: 1 }, { unique: true });
lessonProgressSchema.index({ userId: 1, lastAccessedAt: -1 });
var LessonProgress = model5("LessonProgress", lessonProgressSchema);

// server/src/models/QuizAttempt.ts
import { Schema as Schema6, model as model6 } from "mongoose";
var quizAttemptSchema2 = new Schema6({
  userId: { type: Schema6.Types.ObjectId, ref: "User", required: true },
  lessonSlug: { type: String, required: true, trim: true, maxlength: 120 },
  score: { type: Number, required: true, min: 0, validate: Number.isInteger },
  totalQuestions: { type: Number, required: true, min: 1, validate: Number.isInteger },
  attemptedAt: { type: Date, required: true, default: Date.now }
}, { timestamps: true });
quizAttemptSchema2.pre("validate", function() {
  if (this.score > this.totalQuestions) this.invalidate("score", "Score cannot exceed total questions");
});
quizAttemptSchema2.index({ userId: 1, lessonSlug: 1, attemptedAt: -1 });
var QuizAttempt = model6("QuizAttempt", quizAttemptSchema2);

// src/content/appliedLessons.ts
var py = String.raw;
var supervisedLessons = [
  {
    slug: "logistic-regression",
    title: "Logistic regression: predicting a probability",
    description: "Squash a linear score into a probability, then decide what to do with it. The most useful classifier to understand first.",
    module: "Supervised learning",
    difficulty: "Beginner",
    estimatedMinutes: 16,
    prerequisites: ["linear-regression"],
    objectives: ["Turn a linear score into a probability with the sigmoid.", "Calculate log loss by hand and explain why it punishes confident errors.", "Separate the model\u2019s probability from the threshold used to act on it."],
    analogy: "Imagine a judge scoring evidence. Each clue adds or subtracts points, and the total can be any number. To be useful, the judge converts that total into a statement like \u201CI am 88% sure.\u201D Logistic regression is that conversion: a running score, then a dial that maps any score into a value between 0 and 1.",
    intro: "Linear regression can predict 1.7 or \u22120.4, which makes no sense as a chance of passing an exam. Logistic regression keeps the same weighted sum but feeds it through the sigmoid function, which always returns a value between 0 and 1. Despite the name, it is a classification method. It is fast, easy to inspect, and a strong baseline: if a complex model cannot beat it, the complexity has not earned its place.",
    sections: [
      { title: "From score to probability", kicker: "THE SIGMOID", body: "First compute a score z = wx + b, also called a logit. The sigmoid \u03C3(z) = 1 / (1 + e\u207B\u1DBB) maps it into (0, 1). At z = 0 the output is exactly 0.5. Large positive scores approach 1 and large negative scores approach 0. The curve is steepest near zero, so examples near the boundary are the most sensitive to small changes in the score.", example: "Let w = 1.5 and b = \u22124. For x = 2, z = 1.5(2) \u2212 4 = \u22121 and \u03C3(\u22121) \u2248 0.269. For x = 4, z = 1.5(4) \u2212 4 = 2 and \u03C3(2) \u2248 0.881. The same one-step formula produces a low probability for the first student and a high probability for the second." },
      { title: "Why not mean squared error?", kicker: "LOG LOSS", body: "Classification is trained with log loss, also called binary cross-entropy. For one example, the loss is \u2212ln(p) when the true label is 1 and \u2212ln(1 \u2212 p) when the true label is 0. A confident correct answer costs almost nothing, and a confident wrong answer costs a lot. Combined with the sigmoid, this loss is convex in the weights, so gradient descent has no bad local minima to get stuck in.", example: "Suppose p = 0.881. If the true label is 1, the loss is \u2212ln(0.881) \u2248 0.127. If the true label is 0, the loss is \u2212ln(1 \u2212 0.881) = \u2212ln(0.119) \u2248 2.13. The confident mistake costs about seventeen times more than the correct answer earns.", points: ["Loss near 0 means a confident, correct prediction.", "A prediction of 0.5 costs ln 2 \u2248 0.693 whichever label is true, a useful \u201Cknows nothing\u201D reference for balanced classes.", "Regularization is usually on by default; scikit-learn\u2019s `C` is the inverse of its strength."] },
      { title: "Reading the weights", kicker: "ODDS AND LOG-ODDS", body: "The score z is the log of the odds: z = ln(p / (1 \u2212 p)). So increasing x by one unit adds w to the log-odds, which multiplies the odds by e\u02B7. With w = 1.5, each extra unit multiplies the odds by about 4.48. It does not add a fixed amount to the probability: the same step changes probability a lot near 0.5 and very little near 0 or 1.", points: ["A positive weight pushes toward class 1; a negative weight pushes toward class 0.", "Compare weights only after putting features on comparable scales.", "Correlated features can share or swap weight, so a coefficient is not a causal effect."] },
      { title: "Probability first, decision second", kicker: "THE THRESHOLD", body: "The model outputs a probability. Turning that into an action is a separate choice. The 0.5 default is only sensible when both kinds of mistake cost the same and classes are balanced. For cancer screening you might flag anything above 0.1, and for an expensive manual review you might require 0.9. Because the boundary sits where z = 0, one feature gives one cut point, x = \u2212b / w, and several features give a flat hyperplane. If the real boundary is curved, add features or use another model.", kind: "math", example: "With w = 1.5 and b = \u22124, the 0.5 boundary is x = 4 / 1.5 \u2248 2.67. Raising the threshold to 0.9 requires z = ln(0.9 / 0.1) \u2248 2.2, so x \u2248 (2.2 + 4) / 1.5 \u2248 4.13." }
    ],
    formula: "p = \\sigma(wx+b) = \\frac{1}{1+e^{-(wx+b)}} \\qquad L = -\\big[y\\ln p + (1-y)\\ln(1-p)\\big]",
    formulaExplanation: "The first expression converts a linear score into a probability. The second is the log loss for one example: when y = 1 only the \u2212ln p term remains, and when y = 0 only \u2212ln(1 \u2212 p) remains. Training averages L across examples and minimizes it.",
    code: py`import numpy as np
from sklearn.linear_model import LogisticRegression

# Hours studied and whether each student passed (1) or not (0)
hours = np.array([[0.5], [1.0], [1.5], [2.0], [2.5], [3.0], [3.5], [4.0], [4.5], [5.0]])
passed = np.array([0, 0, 0, 0, 1, 0, 1, 1, 1, 1])

model = LogisticRegression().fit(hours, passed)
print(f"weight={model.coef_[0][0]:.2f}, bias={model.intercept_[0]:.2f}")

# predict_proba returns [P(class 0), P(class 1)] for each row
for h in (1.0, 2.5, 4.5):
    probability = model.predict_proba([[h]])[0][1]
    print(f"{h} hours -> P(pass)={probability:.2f}, label={int(probability >= 0.5)}")

# The decision boundary is where the score is zero
boundary = -model.intercept_[0] / model.coef_[0][0]
print(f"decision boundary at {boundary:.2f} hours")`,
    codeOutput: "weight=1.22, bias=-3.37\n1.0 hours -> P(pass)=0.11, label=0\n2.5 hours -> P(pass)=0.42, label=0\n4.5 hours -> P(pass)=0.89, label=1\ndecision boundary at 2.75 hours",
    codeExplanation: "`predict_proba` returns one column per class, so `[0][1]` means first row, probability of class 1. The boundary formula \u2212b / w comes from setting the score to zero. The fitted weight is smaller than the hand example\u2019s because scikit-learn applies L2 regularization by default, which shrinks weights. Pass a larger `C` to weaken it. Use `predict_proba` and your own threshold when the costs of errors differ.",
    practice: [
      { prompt: "With w = 2 and b = \u22126, what is the probability at x = 3, and at x = 4?", answer: "0.5 at x = 3 and about 0.881 at x = 4.", solution: "At x = 3, z = 2(3) \u2212 6 = 0 and \u03C3(0) = 0.5, so x = 3 is on the boundary. At x = 4, z = 2(4) \u2212 6 = 2 and \u03C3(2) = 1 / (1 + e\u207B\xB2) \u2248 0.881." },
      { prompt: "A model predicts p = 0.9. Calculate log loss if the true label is 1, then if it is 0.", answer: "About 0.105 for label 1 and about 2.303 for label 0.", solution: "For y = 1, loss = \u2212ln(0.9) \u2248 0.105. For y = 0, loss = \u2212ln(1 \u2212 0.9) = \u2212ln(0.1) \u2248 2.303. The wrong-but-confident case costs about 22 times more." },
      { prompt: "A feature has weight 0.7. How does a one-unit increase change the odds? Does it add a fixed amount to the probability?", answer: "It multiplies the odds by about 2.01; it does not add a fixed probability.", solution: "The score is the log-odds, so adding 0.7 multiplies the odds by e^0.7 \u2248 2.01. Going from odds 1:1 to about 2:1 moves probability from 0.5 to about 0.67, while going from odds 9:1 to about 18:1 only moves it from 0.9 to about 0.95." }
    ],
    quiz: { question: "Why does logistic regression use a sigmoid on its linear score?", options: ["To make training slower and more careful", "To map any real-valued score to a value between 0 and 1", "To remove the need for labels"], answer: 1, explanation: "B is correct: a weighted sum can be any real number, and the sigmoid maps it into (0, 1) so it can be read as a probability. A is wrong because the sigmoid is about output range, not speed. C is wrong because logistic regression is supervised and needs labels to compute log loss." },
    takeaways: ["Logistic regression is a linear score passed through a sigmoid to produce a probability.", "Log loss punishes confident mistakes far more than it rewards confident correct answers.", "The probability and the decision threshold are separate choices, and the threshold should reflect error costs."],
    interview: { question: "Why is logistic regression called \u201Cregression\u201D if it does classification?", answer: "It regresses the log-odds of the positive class as a linear function of the features, so the model itself predicts a continuous quantity. It only becomes a classifier when you apply a threshold to the resulting probability." },
    related: ["linear-regression", "evaluation-metrics", "gradient-descent"],
    miniProject: { title: "Build a calibrated screening model", objective: "Train a logistic regression and pick a threshold from stated costs instead of accepting 0.5.", tasks: ["Load the breast cancer dataset with `sklearn.datasets.load_breast_cancer` and split off a test set.", "Fit a pipeline of `StandardScaler` and `LogisticRegression` on the training data.", "On validation data, compute precision and recall at thresholds 0.1, 0.3, 0.5, 0.7, and 0.9.", "Choose a threshold assuming a missed case costs ten times a false alarm, then report once on the test set."], extension: "Plot a calibration curve with `CalibrationDisplay` and describe where the predicted probabilities can and cannot be trusted." }
  },
  {
    slug: "decision-trees-and-ensembles",
    title: "Decision trees, random forests, and boosting",
    description: "A tree asks a series of yes/no questions. Combine hundreds of them and you get some of the best models for tabular data.",
    module: "Supervised learning",
    difficulty: "Intermediate",
    estimatedMinutes: 18,
    prerequisites: ["supervised-vs-unsupervised", "train-validation-test"],
    objectives: ["Calculate Gini impurity and the gain of a split by hand.", "Explain why a single deep tree overfits.", "Contrast bagging and boosting and choose one for a tabular problem."],
    analogy: "A single tree is one doctor following a flowchart: easy to follow, but a flowchart built from a few past patients can be oddly specific. A random forest asks hundreds of doctors who each trained on different patients and take a vote. Boosting works like a team passing a case along, where each specialist focuses on what the previous ones got wrong.",
    intro: "A decision tree predicts by asking one question at a time, such as \u201Cis income above 40,000?\u201D, and following the answer to a leaf. Trees need no feature scaling, handle mixed feature types, and capture interactions automatically. Alone they are unstable and easily overfit. Ensembles fix that by combining many trees, and on tabular data they remain a first choice that deep learning often fails to beat.",
    sections: [
      { title: "How a split is chosen", kicker: "GINI IMPURITY", body: "At each node the algorithm tries candidate questions and keeps the one that makes the resulting groups most pure. Gini impurity measures how mixed a group is: 1 minus the sum of squared class shares. A pure group has Gini 0, and a 50/50 binary group has Gini 0.5. The value of a split is the parent\u2019s impurity minus the size-weighted impurity of its children.", example: "A node has 6 positive and 4 negative examples: Gini = 1 \u2212 0.6\xB2 \u2212 0.4\xB2 = 0.48. A split produces a left child with 4 positive and 1 negative (Gini = 1 \u2212 0.8\xB2 \u2212 0.2\xB2 = 0.32) and a right child with 2 positive and 3 negative (Gini = 1 \u2212 0.4\xB2 \u2212 0.6\xB2 = 0.48). Weighted impurity = 0.5(0.32) + 0.5(0.48) = 0.40. The gain is 0.48 \u2212 0.40 = 0.08." },
      { title: "Why one deep tree overfits", kicker: "HIGH VARIANCE", body: "Left unconstrained, a tree keeps splitting until every leaf is pure, memorizing noise along the way. It is also unstable: a small change in the data can change the first split and therefore everything below it. Limit `max_depth` and `min_samples_leaf` to regularize, and use cross-validation to choose them. A shallow tree is easy to explain, which can matter more than a few points of accuracy.", points: ["Trees are invariant to monotonic feature scaling, so standardization changes nothing.", "Boundaries are axis-aligned, so a diagonal boundary needs many small steps.", "Trees cannot extrapolate: a regression tree never predicts outside the range of its training targets."] },
      { title: "Bagging: many independent trees", kicker: "RANDOM FORESTS", body: "A random forest trains each tree on a bootstrap sample (rows drawn with replacement) and considers only a random subset of features at each split. The randomness makes trees disagree, and averaging predictions from models that make different mistakes cancels much of their variance without much added bias. Adding more trees does not cause overfitting; it just stops helping eventually. Forests work well with little tuning, which makes them a strong default.", points: ["Each tree is grown deep; averaging handles the variance.", "Rows left out of a bootstrap sample give an \u201Cout-of-bag\u201D estimate of performance.", "Trees train independently, so training parallelizes easily."] },
      { title: "Boosting: trees that correct each other", kicker: "GRADIENT BOOSTING", body: "Boosting builds shallow trees one after another. Each new tree fits the errors (specifically, the negative gradient of the loss) of the ensemble so far, and its contribution is shrunk by a learning rate. Bagging mainly reduces variance; boosting mainly reduces bias. Boosting often reaches the highest accuracy on tabular data, but more trees can overfit, so tune the learning rate and use early stopping on a validation set. XGBoost, LightGBM, and CatBoost are the common implementations.", kind: "math", example: "Suppose the true value is 10 and the first tree predicts 7, leaving a residual of 3. With learning rate 0.1, a second tree that predicts that residual exactly moves the ensemble to 7 + 0.1(3) = 7.3. Many small corrections generalize better than one large one." }
    ],
    formula: "\\text{Gini} = 1-\\sum_{k} p_k^2 \\qquad F_{m}(x) = F_{m-1}(x) + \\eta\\, h_m(x)",
    formulaExplanation: "p\u2096 is the share of class k in a node, so a pure node scores 0. The second expression is the boosting update: the current ensemble F\u2098\u208B\u2081 gains a new tree h\u2098, shrunk by the learning rate \u03B7. A random forest instead averages independently trained trees.",
    code: py`from sklearn.datasets import make_moons
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.tree import DecisionTreeClassifier

features, labels = make_moons(n_samples=400, noise=0.3, random_state=7)

candidates = {
    "single tree, unlimited": DecisionTreeClassifier(random_state=7),
    "single tree, depth 3": DecisionTreeClassifier(max_depth=3, random_state=7),
    "random forest": RandomForestClassifier(n_estimators=200, random_state=7),
    "gradient boosting": GradientBoostingClassifier(random_state=7),
}

# Five-fold cross-validation scores each model on data it did not fit
for name, model in candidates.items():
    scores = cross_val_score(model, features, labels, cv=5)
    print(f"{name}: {scores.mean():.3f} +/- {scores.std():.3f}")`,
    codeOutput: "single tree, unlimited: 0.870 +/- 0.023\nsingle tree, depth 3: 0.905 +/- 0.039\nrandom forest: 0.915 +/- 0.022\ngradient boosting: 0.905 +/- 0.034",
    codeExplanation: "The unlimited tree memorizes its training folds and scores lowest. Limiting depth helps. The forest scores highest here and with lower spread across folds, which shows its stability. The gaps are close to the fold-to-fold variation, so do not conclude that forests always beat boosting: on this small, simple dataset boosting has little left to correct, and it usually needs tuning to show its advantage.",
    practice: [
      { prompt: "A node holds 8 positive and 2 negative examples. What is its Gini impurity?", answer: "0.32.", solution: "The shares are 0.8 and 0.2. Gini = 1 \u2212 0.8\xB2 \u2212 0.2\xB2 = 1 \u2212 0.64 \u2212 0.04 = 0.32." },
      { prompt: "A parent with 10 examples has Gini 0.5. A split gives 4 examples with Gini 0 and 6 examples with Gini 0.444. What is the gain?", answer: "About 0.233.", solution: "Weighted child impurity = (4/10)(0) + (6/10)(0.444) \u2248 0.267. The gain is 0.5 \u2212 0.267 \u2248 0.233." },
      { prompt: "Your training accuracy is 99% and validation accuracy is 78% on a boosted model. Name two changes you would try.", answer: "Lower the learning rate with early stopping, and use shallower trees or fewer trees.", solution: "The gap signals overfitting. Reduce the learning rate and let early stopping choose the tree count, limit tree depth, or subsample rows and features per tree. Also check for leakage and duplicates across splits before blaming complexity." }
    ],
    quiz: { question: "What is the main difference between bagging and boosting?", options: ["Bagging trains trees independently and averages them; boosting trains them in sequence to correct earlier errors", "Bagging only works on images; boosting only works on text", "Bagging uses one tree; boosting uses many"], answer: 0, explanation: "A is correct. Bagging, as in random forests, mainly reduces variance by averaging independent trees. Boosting mainly reduces bias by fitting each tree to the remaining errors. B is wrong because both are mostly used on tabular data. C is wrong because both use many trees." },
    takeaways: ["Trees split to reduce impurity, need no scaling, and overfit easily when left unconstrained.", "Random forests average many decorrelated trees and work well with little tuning.", "Boosting fits trees in sequence and often leads on tabular data, but needs a validation set to control it."],
    interview: { question: "When would you pick gradient boosting over a neural network?", answer: "For most tabular problems with heterogeneous features and modest data, where boosted trees are usually accurate, quick to train, and tolerant of unscaled inputs. I would reach for neural networks with images, audio, or text, or when I need to learn representations from raw data at large scale." },
    related: ["overfitting-underfitting", "feature-engineering-and-pipelines", "evaluation-metrics"],
    miniProject: { title: "Tree, forest, or boosting?", objective: "Compare the three approaches on a real tabular dataset with a fair evaluation.", tasks: ["Load `sklearn.datasets.fetch_california_housing` and hold out a test set.", "Cross-validate a depth-limited tree, a random forest, and `HistGradientBoostingRegressor` using RMSE.", "Plot permutation importance for your best model.", "Report the test score once and write three sentences on what you would explain to a stakeholder."], extension: "Add early stopping to the boosted model and chart validation loss against the number of trees." }
  },
  {
    slug: "feature-engineering-and-pipelines",
    title: "Feature engineering and leak-proof pipelines",
    description: "Real data has gaps, categories, and awkward scales. Pipelines make your preparation repeatable and keep test data out of it.",
    module: "Supervised learning",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    prerequisites: ["train-validation-test", "linear-regression"],
    objectives: ["Choose encodings for numeric, categorical, and date features.", "Handle missing values without leaking test information.", "Package preparation and model into one object that fits, predicts, and deploys together."],
    analogy: "Think of a restaurant kitchen. Ingredients arrive in different states: some muddy, some frozen, some missing. A good kitchen has a written prep routine, applied identically every night. If a chef tastes tomorrow\u2019s delivery before writing tonight\u2019s recipe, the recipe is not a fair test. A pipeline is the written routine, and the rule against tasting ahead is what prevents leakage.",
    intro: "Models see numbers, not spreadsheets. Feature engineering turns raw columns into inputs that make the pattern easier to learn, and it often changes results more than swapping algorithms. The risk is that preparation steps also learn from data: an imputer learns a median and a scaler learns a mean. If those steps see validation or test rows, your evaluation is contaminated. Pipelines solve this by treating preparation as part of the model.",
    sections: [
      { title: "Numbers: scale and shape", kicker: "NUMERIC FEATURES", body: "Distance-based models and gradient-trained models are sensitive to scale, so standardize them: subtract the training mean and divide by the training standard deviation. Trees do not care. Skewed values such as income often behave better after a log transform. Ratios and differences can express what a model struggles to construct alone, such as debt divided by income.", example: "If training ages have mean 40 and standard deviation 10, a 55-year-old becomes (55 \u2212 40) / 10 = 1.5. A test row must use those same training values, never its own mean." },
      { title: "Categories: encode with care", kicker: "CATEGORICAL FEATURES", body: "One-hot encoding creates a 0/1 column per category. It is safe and simple, but it grows with the number of categories. Do not assign 1, 2, 3 to unordered categories, because that invents an ordering a linear model will take literally. Target encoding replaces a category with its average target, which handles many categories but leaks badly unless it is computed out-of-fold.", points: ['Set `handle_unknown="ignore"` so a new category in production does not crash prediction.', "Group rare categories together so they do not become noisy columns.", "Dates hide useful parts: day of week, month, and time since an event."] },
      { title: "Missing values are information", kicker: "IMPUTATION", body: "Most models cannot accept gaps, so fill them with a median or most-frequent value learned from training data. First ask why a value is missing, because the reason can predict the target: a blank \u201Clast purchase date\u201D may mean a brand-new customer. Add a missing-indicator column to keep that signal. Dropping rows is simple, but it shrinks your data and can bias it when missingness is not random.", points: ["Random gaps: simple imputation is usually fine.", "Gaps related to the target: keep an indicator column.", "Fit the imputer inside the training fold, never on the full dataset."] },
      { title: "Why pipelines prevent leakage", kicker: "ONE OBJECT, ONE BOUNDARY", body: "A pipeline chains preparation and model into a single estimator. Calling `fit` learns every step from training rows only, and `predict` applies them unchanged. `cross_val_score` then refits the entire chain inside each fold, which is exactly what manual preprocessing tends to get wrong. A `ColumnTransformer` routes different columns to different steps. Save the fitted pipeline, and your deployed model cannot drift out of sync with its preprocessing.", kind: "math", example: "A common mistake: scale all rows, then cross-validate. Each fold\u2019s validation rows have already influenced the mean and standard deviation. The effect on scaling is often small, but the same mistake with feature selection on wide data can turn pure noise into impressive-looking scores." }
    ],
    formula: "x_{\\text{scaled}} = \\frac{x - \\mu_{\\text{train}}}{\\sigma_{\\text{train}}}",
    formulaExplanation: "The mean \u03BC and standard deviation \u03C3 come only from training rows and are reused unchanged for validation, test, and production data. Using anything else lets future information shape the model.",
    code: py`import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# A small synthetic table with missing values in both kinds of column
rng = np.random.default_rng(7)
n = 200
tenure = rng.integers(1, 60, n).astype(float)
plan = rng.choice(["basic", "plus", "pro"], n).astype(object)
churned = (tenure + rng.normal(0, 8, n) < 18).astype(int)
tenure[::20] = np.nan
plan[::25] = np.nan
table = pd.DataFrame({"tenure_months": tenure, "plan": plan})

numeric = Pipeline([
    ("impute", SimpleImputer(strategy="median")),
    ("scale", StandardScaler()),
])
categorical = Pipeline([
    ("impute", SimpleImputer(strategy="most_frequent")),
    ("encode", OneHotEncoder(handle_unknown="ignore")),
])
prepare = ColumnTransformer([
    ("numeric", numeric, ["tenure_months"]),
    ("categorical", categorical, ["plan"]),
])
model = Pipeline([("prepare", prepare), ("classify", LogisticRegression())])

# Every fold refits the imputers, scaler, and encoder on its own training rows
scores = cross_val_score(model, table, churned, cv=5)
print(f"cross-validated accuracy: {scores.mean():.2f}")

model.fit(table, churned)
print("columns after preparation:", model.named_steps["prepare"].get_feature_names_out().tolist())
new_customer = pd.DataFrame({"tenure_months": [3.0], "plan": ["enterprise"]})
print(f"unseen plan, P(churn)={model.predict_proba(new_customer)[0][1]:.2f}")`,
    codeOutput: "cross-validated accuracy: 0.89\ncolumns after preparation: ['numeric__tenure_months', 'categorical__plan_basic', 'categorical__plan_plus', 'categorical__plan_pro']\nunseen plan, P(churn)=0.93",
    codeExplanation: 'Each column type gets its own preparation path, and all of it lives inside `model`. Passing the whole pipeline to `cross_val_score` means no fold ever sees statistics from its validation rows. The final lines show the production benefit: the plan \u201Centerprise\u201D never appeared in training, and `handle_unknown="ignore"` encodes it as all zeros instead of raising an error. Save this single `model` object and you deploy preprocessing and weights together.',
    practice: [
      { prompt: "Training ages have mean 40 and standard deviation 10. A test row has age 25. What is its scaled value?", answer: "\u22121.5.", solution: "(25 \u2212 40) / 10 = \u22121.5. Use the training mean and standard deviation, even if the test set\u2019s own statistics differ." },
      { prompt: "A \u201Ccolor\u201D column has values red, green, and blue. Why is encoding them as 1, 2, 3 risky for linear regression?", answer: "It invents an order and equal spacing that do not exist.", solution: "A linear model gives this column one weight, so it must treat blue as exactly three times red and green as exactly between them. One-hot encoding gives each color its own weight. Tree models tolerate integer codes better, because they can split at any point, but the codes still carry no real meaning." },
      { prompt: "You select the 20 best features using all rows, then cross-validate. Scores look great. What went wrong, and how do you fix it?", answer: "Feature selection saw the validation rows. Put it inside the pipeline.", solution: "Selecting by correlation with the target over every row uses validation labels. With many columns, some noise columns will correlate by chance, and scores become inflated. Add `SelectKBest` as a pipeline step so selection is redone within each training fold." }
    ],
    quiz: { question: "What is the main reason to put a scaler inside a pipeline before cross-validating?", options: ["It makes the model train faster", "The scaler is refit on each fold\u2019s training rows, so validation rows do not influence it", "Pipelines remove the need for a test set"], answer: 1, explanation: "B is correct: the pipeline keeps learned preprocessing inside the training boundary of each fold. A is not the purpose. C is wrong because you still need an untouched test set for a final estimate after model selection." },
    takeaways: ["Good features often improve results more than a fancier algorithm.", "Imputers, scalers, encoders, and selectors learn from data, so they belong inside the training boundary.", "A pipeline makes the same preparation run in training, cross-validation, and production."],
    interview: { question: "What is target leakage and how have you seen it happen?", answer: "It occurs when a feature contains information that would not be available at prediction time, usually because it is recorded after the outcome. A \u201Ctreatment given\u201D column in a disease model is the classic case. It produces excellent offline scores and fails in production. I look for suspiciously strong features and check when each one is recorded." },
    related: ["train-validation-test", "decision-trees-and-ensembles", "serving-models"],
    miniProject: { title: "Rebuild a messy notebook as one pipeline", objective: "Turn ad-hoc preprocessing on a public dataset into a single leak-proof, deployable object.", tasks: ['Load the Titanic data with `fetch_openml("titanic", version=1)`, dropping columns that leak the outcome such as `boat` and `body`.', "Build a `ColumnTransformer` with separate numeric and categorical paths.", "Compare logistic regression and a random forest using cross-validation over the whole pipeline.", "Save the best pipeline with `joblib`, reload it, and predict on a hand-written row."], extension: "Add a missing-indicator with `SimpleImputer(add_indicator=True)` and test whether it improves the score." }
  }
];
var visionLessons = [
  {
    slug: "image-data-and-augmentation",
    title: "Image data: tensors, normalization, and augmentation",
    description: "What a picture looks like to a model, and how to create useful training variety without collecting more photos.",
    module: "Computer vision",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    prerequisites: ["convolutional-neural-networks"],
    objectives: ["Read an image tensor\u2019s shape and data type.", "Normalize a pixel by hand using channel statistics.", "Choose augmentations that keep the label true."],
    analogy: "If you only ever saw a coffee mug from the front in bright light, you might not recognize it from the side at dusk. Children see objects from countless angles, so they learn what stays the same. Augmentation shows a model the same object in varied conditions, which teaches it which changes do not matter.",
    intro: "To a model, an image is a grid of numbers. Before any architecture matters, you need those numbers in the shape and range the model expects, and you need enough variety that the model learns the object instead of the background. Vision bugs are often data bugs: swapped channels, wrong normalization, or augmentations that quietly change the correct answer.",
    sections: [
      { title: "An image is a tensor", kicker: "SHAPE AND RANGE", body: "A color image has height, width, and three channels. PyTorch uses (channels, height, width), and a batch adds a leading dimension: (batch, channels, height, width). Many image libraries and TensorFlow default to channels last instead, and OpenCV loads colors as BGR rather than RGB. Raw pixels are usually 8-bit integers from 0 to 255, and models train on floats.", example: "A batch of 8 RGB images at 224 \xD7 224 has shape (8, 3, 224, 224), which is 8 \xD7 3 \xD7 224 \xD7 224 = 1,204,224 values. Doubling the side length to 448 quadruples that count, and with it the memory and compute that convolutions need." },
      { title: "Normalize the way training did", kicker: "CHANNEL STATISTICS", body: "Pixel values are divided by 255, then each channel has its mean subtracted and is divided by its standard deviation. A pretrained model expects the statistics it was trained with. For ImageNet those are the widely used means [0.485, 0.456, 0.406] and standard deviations [0.229, 0.224, 0.225]. Skipping or changing this step usually does not raise an error; accuracy just quietly drops.", example: "A red-channel pixel of 128 becomes 128 / 255 \u2248 0.502, then (0.502 \u2212 0.485) / 0.229 \u2248 0.074. A pixel of 255 becomes (1.0 \u2212 0.485) / 0.229 \u2248 2.25." },
      { title: "Augment without changing the answer", kicker: "LABEL-PRESERVING VARIETY", body: "Augmentation randomly transforms training images so the model sees fresh versions each epoch. It works as regularization by encoding what should not matter. The key question is whether the transformation keeps the label true. Flipping a cat is still a cat, but flipping a \u201C6\u201D can look like a different digit, and flipping a chest X-ray swaps the side the heart appears on, which can be clinically meaningful.", points: ["Geometric: flips, small rotations, random crops.", "Photometric: brightness, contrast, color jitter.", "Mixing: Cutout, MixUp, and CutMix, which also change the label or hide regions.", "For detection and segmentation, transform the boxes or masks too."] },
      { title: "Keep evaluation honest", kicker: "DATA SPLITS FOR IMAGES", body: "Apply random augmentation only to training data. Validation and test images get only deterministic steps, such as a resize, center crop, and normalization. Split before augmenting, and split by source: photos from one patient, camera, or video must stay on one side, because near-duplicates across splits inflate scores. Also look at your images after preprocessing. Plotting one batch finds channel and normalization bugs in seconds.", kind: "math", points: ["Train: random augmentations plus normalization.", "Validation and test: deterministic resize plus the same normalization.", "Group splits: keep frames from one video or scans from one patient together."] }
    ],
    formula: "x_{\\text{norm}} = \\frac{x/255 - \\mu_c}{\\sigma_c}",
    formulaExplanation: "x is a raw pixel from 0 to 255, and \u03BC_c and \u03C3_c are the mean and standard deviation of its channel c, computed on the training set or inherited from the pretrained model. The same values are applied to every image, in every split.",
    code: py`import torch

torch.manual_seed(7)

# A fake batch: 8 RGB images of 32x32 pixels with values from 0 to 255
images = torch.randint(0, 256, (8, 3, 32, 32), dtype=torch.uint8)
print("raw:", images.shape, images.dtype)

# Scale to 0-1, then normalize each channel
scaled = images.float() / 255
mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
normalized = (scaled - mean) / std
print("normalized:", normalized.shape, normalized.dtype)

# One pixel value worked through the red channel
pixel = torch.tensor(128 / 255)
print("128 in the red channel becomes", round(((pixel - 0.485) / 0.229).item(), 4))

# Horizontal flip reverses the width dimension and keeps the shape
flipped = torch.flip(normalized, dims=[3])
print("flip keeps shape:", flipped.shape == normalized.shape)
print("first row matches reversed:", torch.equal(flipped[0, 0, 0], normalized[0, 0, 0].flip(0)))`,
    codeOutput: "raw: torch.Size([8, 3, 32, 32]) torch.uint8\nnormalized: torch.Size([8, 3, 32, 32]) torch.float32\n128 in the red channel becomes 0.0741\nflip keeps shape: True\nfirst row matches reversed: True",
    codeExplanation: "The `view(1, 3, 1, 1)` reshape lets one mean per channel broadcast across the batch, height, and width dimensions. Converting to float before dividing matters, because integer arithmetic would lose the fractions. The flip works on dimension 3, the width, because the layout is (batch, channels, height, width). In a real project, use `torchvision.transforms.v2` or Albumentations rather than writing these by hand.",
    practice: [
      { prompt: "What is the shape of a batch of 16 grayscale images of 28 \xD7 28 in PyTorch, and how many values does it contain?", answer: "Shape (16, 1, 28, 28), containing 12,544 values.", solution: "Grayscale has one channel. The total is 16 \xD7 1 \xD7 28 \xD7 28 = 12,544 values. The channel dimension stays even at size 1, because convolution layers expect it." },
      { prompt: "Normalize a pixel value of 51 using mean 0.5 and standard deviation 0.25.", answer: "\u22121.2.", solution: "51 / 255 = 0.2. Then (0.2 \u2212 0.5) / 0.25 = \u22121.2." },
      { prompt: "You are classifying handwritten digits. Which of these are safe: small rotation, horizontal flip, slight blur?", answer: "Small rotation and slight blur are safe; a horizontal flip is not.", solution: "A slight rotation or blur leaves a digit recognizable as the same digit. A horizontal flip can turn a digit into a shape that is not a valid digit, or make it resemble a different one, so it does not preserve the label." }
    ],
    quiz: { question: "Which pairing of data handling is correct?", options: ["Random augmentation on train, deterministic preprocessing on validation and test", "Random augmentation on all splits for fairness", "Normalization on train only"], answer: 0, explanation: "A is correct: random variety regularizes training, while evaluation needs stable, repeatable inputs. B makes the metric noisy and no longer reflects the real inputs. C is wrong because the model expects the same normalization at every stage." },
    takeaways: ["PyTorch images use (batch, channels, height, width), and channel order bugs fail silently.", "Normalize with the statistics the model was trained on, in every split.", "An augmentation is only valid if it keeps the label true."],
    interview: { question: "Your model scores 98% on validation and 70% in production. What do you check in the image pipeline?", answer: "I would check for a train-serving mismatch first: resizing method, normalization values, and RGB versus BGR. Then I would check for leakage from near-duplicates across splits and whether production images differ in camera, lighting, or subject. Plotting the actual tensors reaching the model is usually the quickest way to find the cause." },
    related: ["convolutional-neural-networks", "transfer-learning", "monitoring-and-drift"],
    miniProject: { title: "Measure what augmentation buys you", objective: "Quantify the effect of augmentation on a small dataset.", tasks: ["Take a subset of 1,000 CIFAR-10 images using `torchvision.datasets.CIFAR10`.", "Train a small CNN with normalization only and record validation accuracy per epoch.", "Retrain with random crops and horizontal flips, keeping the same seed and validation set.", "Compare the curves and the train/validation gap for both runs."], extension: "Add CutMix, and explain why its training accuracy looks worse even when validation accuracy improves." }
  },
  {
    slug: "transfer-learning",
    title: "Transfer learning: standing on a pretrained model",
    description: "Reuse features learned on millions of images and get good results with hundreds of your own.",
    module: "Computer vision",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    prerequisites: ["image-data-and-augmentation", "optimizers"],
    objectives: ["Explain why features learned on one task transfer to another.", "Freeze a backbone, replace the head, and count trainable parameters.", "Run a two-stage fine-tuning schedule and pick learning rates."],
    analogy: "Someone who already plays piano can learn the organ far faster than a beginner, because they keep the reading and finger skills and only learn the pedals and stops. A pretrained network already knows how to see edges and textures. You keep those skills and teach it only what is specific to your task.",
    intro: "Training a large vision model from scratch takes huge datasets. Transfer learning starts from a model trained on another task, usually ImageNet, and adapts it. Early layers learn general features such as edges and textures, while later layers become task-specific. By reusing the general part and retraining the end, you can get strong results with far less data, compute, and time. This is the default starting point for most applied vision work.",
    sections: [
      { title: "Backbone and head", kicker: "TWO PARTS OF A MODEL", body: "A classifier divides into a backbone, which turns an image into a feature vector, and a head, which turns those features into class scores. For transfer learning, you discard the original head and attach one sized for your classes. The head has very few parameters compared with the backbone, so it can be trained from a small dataset without much risk of overfitting.", example: "ResNet-50 outputs a 2,048-dimensional feature vector and has about 25.6 million parameters in total. A new linear head for 3 classes has 2048 \xD7 3 + 3 = 6,147 parameters, which is roughly 0.02% of the whole model." },
      { title: "Stage 1: train only the head", kicker: "FREEZE THE BACKBONE", body: "Set `requires_grad = False` on backbone parameters so training leaves them untouched, and train the head for a few epochs. Do this first because the new head starts random and produces large, meaningless gradients, which would damage good pretrained weights. Batch normalization needs special care: its running statistics update in training mode even when its parameters are frozen, so keep frozen BatchNorm layers in `eval()` mode.", points: ["Pass only trainable parameters to the optimizer.", "A higher rate, such as 1e-3, is fine for a fresh head.", "If this stage alone reaches your target, you can stop here."] },
      { title: "Stage 2: fine-tune with care", kicker: "UNFREEZE GRADUALLY", body: "Next, unfreeze some or all of the backbone and continue with a much lower learning rate, such as 1e-5 for the backbone and 1e-4 for the head. Unfreeze the last blocks first, since they are the most task-specific. Discriminative learning rates, where earlier layers move less, let the model adapt without losing what it already learned. Watch validation loss closely; a small dataset can now overfit.", kind: "math", points: ["Too high a rate here can destroy pretrained features quickly.", "Rebuild or update the optimizer after changing what is trainable.", "Use the normalization the pretrained weights expect."] },
      { title: "How much to retrain", kicker: "A DECISION GUIDE", body: "The right approach depends on how much data you have and how similar it is to the source task. With little data and a similar domain, train the head only. With more data, fine-tune more layers. With a very different domain, such as medical scans or satellite images, the high-level features transfer less, so fine-tune deeper or look for a pretrained model from a closer domain. Check the license of pretrained weights before shipping them commercially.", example: "With 300 photos of 3 plant diseases: freeze the backbone and train the head, then evaluate. With 30,000 satellite images: fine-tune most of the network, because the domain differs and you have the data to support it." }
    ],
    formula: "\\theta_{\\text{backbone}} \\leftarrow \\theta_{\\text{backbone}} - \\eta_{b}\\nabla L \\qquad \\theta_{\\text{head}} \\leftarrow \\theta_{\\text{head}} - \\eta_{h}\\nabla L \\qquad \\eta_{b} \\ll \\eta_{h}",
    formulaExplanation: "During fine-tuning, both parts learn from the same loss, but the backbone uses a much smaller learning rate. In stage one, \u03B7_b is effectively zero because the backbone is frozen.",
    code: py`import torch
from torch import nn

torch.manual_seed(7)

# Stand-in for a pretrained backbone, so this runs without downloading weights
backbone = nn.Sequential(
    nn.Conv2d(3, 16, kernel_size=3, padding=1),
    nn.ReLU(),
    nn.AdaptiveAvgPool2d(1),
    nn.Flatten(),
)
head = nn.Linear(16, 3)  # new classifier for our 3 classes

def count(parameters):
    return sum(p.numel() for p in parameters if p.requires_grad)

# Stage 1: freeze the backbone and train only the head
for parameter in backbone.parameters():
    parameter.requires_grad = False
print("trainable while frozen:", count(backbone.parameters()) + count(head.parameters()))

optimizer = torch.optim.Adam(head.parameters(), lr=1e-3)
images = torch.randn(4, 3, 32, 32)
targets = torch.tensor([0, 1, 2, 1])
before = backbone[0].weight.clone()

logits = head(backbone(images))
loss = nn.functional.cross_entropy(logits, targets)
optimizer.zero_grad()
loss.backward()
optimizer.step()
print("logits shape:", logits.shape)
print("backbone unchanged:", torch.equal(before, backbone[0].weight))

# Stage 2: unfreeze and fine-tune, using a smaller rate for pretrained layers
for parameter in backbone.parameters():
    parameter.requires_grad = True
optimizer = torch.optim.Adam([
    {"params": backbone.parameters(), "lr": 1e-5},
    {"params": head.parameters(), "lr": 1e-4},
])
print("trainable after unfreezing:", count(backbone.parameters()) + count(head.parameters()))`,
    codeOutput: "trainable while frozen: 51\nlogits shape: torch.Size([4, 3])\nbackbone unchanged: True\ntrainable after unfreezing: 499",
    codeExplanation: 'The head has 16 \xD7 3 + 3 = 51 parameters, and the convolution has 3 \xD7 16 \xD7 9 + 16 = 448. So 51 are trainable while frozen and 499 after unfreezing. The `torch.equal` check proves the frozen backbone did not move during a real training step. To use a real backbone, load `torchvision.models.resnet50(weights="DEFAULT")` and replace `model.fc`; the freezing logic is the same.',
    practice: [
      { prompt: "A backbone outputs 512 features and you need 10 classes. How many parameters does a linear head have?", answer: "5,130.", solution: "Weights: 512 \xD7 10 = 5,120. Biases: 10. The total is 5,130." },
      { prompt: "You unfreeze the whole model and keep the head\u2019s learning rate of 1e-3 for everything. Validation accuracy collapses. Why, and what do you change?", answer: "The rate is too high for pretrained weights. Use a much lower backbone rate.", solution: "Good weights sit in a useful region, and large steps knock them out of it. Lower the backbone rate to around 1e-5, use a separate parameter group for the head, and consider unfreezing only the last block first." },
      { prompt: "You have 200 labeled X-rays and an ImageNet model. Which plan do you start with, and why?", answer: "Freeze the backbone, train the head, and evaluate before fine-tuning anything.", solution: "With so few examples, training the full model would overfit quickly. Start with the head and strong evaluation by patient. If results fall short, unfreeze only the last block with a low rate, and search for weights pretrained on medical images, since the domain differs a lot from ImageNet." }
    ],
    quiz: { question: "Why is the head usually trained before fine-tuning the backbone?", options: ["The head starts random, and its large early gradients could damage the pretrained weights", "Backbones cannot be trained at all", "It makes the images higher resolution"], answer: 0, explanation: "A is correct: stabilizing the head first keeps early gradients from disrupting useful pretrained features. B is false, since backbones are often fine-tuned. C is unrelated to training order." },
    takeaways: ["Early layers learn general visual features that transfer well across tasks.", "Train the new head first, then fine-tune with a much smaller learning rate.", "How much to unfreeze depends on your data size and how close your domain is to the source."],
    interview: { question: "When would transfer learning fail or hurt?", answer: "When the source and target domains differ too much, the features may not help, which is called negative transfer. It is also weak when the input modality differs, such as multispectral channels the model has never seen. I would compare against a smaller model trained from scratch and evaluate with properly grouped splits." },
    related: ["image-data-and-augmentation", "optimizers", "object-detection-and-segmentation"],
    miniProject: { title: "Classify flowers with very little data", objective: "Compare training from scratch against transfer learning on a small dataset.", tasks: ["Use `torchvision.datasets.Flowers102` and keep its small official training split.", "Train a small CNN from scratch as a baseline.", "Train a `resnet18` head only, then fine-tune the last block with a lower rate.", "Compare accuracy, training time, and the number of trainable parameters."], extension: "Visualize misclassified images and try Grad-CAM to see what the model looked at." }
  },
  {
    slug: "object-detection-and-segmentation",
    title: "Object detection and segmentation",
    description: "Go beyond naming an image: find where things are and outline them, pixel by pixel.",
    module: "Computer vision",
    difficulty: "Intermediate",
    estimatedMinutes: 17,
    prerequisites: ["convolutional-neural-networks", "evaluation-metrics"],
    objectives: ["Calculate IoU by hand and explain how it defines a correct detection.", "Implement non-maximum suppression.", "Choose between classification, detection, and segmentation, and read mAP and Dice."],
    analogy: "Classification answers \u201Cis there a dog in this photo?\u201D Detection draws a rectangle around each dog. Semantic segmentation colors in every dog pixel, and instance segmentation colors each dog in a different shade. Each step costs more labeling effort, so use the simplest one that answers your question.",
    intro: "Many real tasks need location: a robot picking parts, a car avoiding pedestrians, or a radiologist measuring a tumor. Detection predicts a class and a box for each object, and segmentation predicts a class for every pixel. Both build on the convolutional backbones you already know, adding specialized heads, losses, and metrics. Their labels are also far more expensive to collect, so choosing the right task saves a lot of money.",
    sections: [
      { title: "Choose the right task", kicker: "THREE LEVELS OF DETAIL", body: "Classification outputs one or more labels per image. Detection outputs a box, class, and confidence for each object. Semantic segmentation outputs a class per pixel and does not separate two touching objects of the same class. Instance segmentation separates them, and panoptic segmentation combines both views. Labeling costs rise quickly, from a few seconds per image to minutes.", points: ["Counting separate items: detection or instance segmentation.", "Measuring area or shape: segmentation.", "Knowing only whether something appears: classification is enough."] },
      { title: "IoU decides what counts as correct", kicker: "INTERSECTION OVER UNION", body: "To grade a predicted box, compare it with the true box using Intersection over Union: the overlapping area divided by the combined area. An IoU of 1 is a perfect match and 0 means no overlap. A detection counts as a true positive when its class is right and its IoU clears a threshold, commonly 0.5.", example: "Box A is (0, 0, 4, 4) and box B is (2, 2, 6, 6). The overlap is 2 \xD7 2 = 4. Each box has area 16, so the union is 16 + 16 \u2212 4 = 28, and IoU = 4 / 28 \u2248 0.143. Shifting B to (1, 1, 5, 5) gives an overlap of 9 and a union of 23, for an IoU of about 0.391." },
      { title: "From many guesses to one per object", kicker: "DETECTOR DESIGNS AND NMS", body: "Two-stage detectors such as Faster R-CNN first propose regions, then classify them, which tends to be accurate. One-stage detectors such as YOLO predict directly over a grid, which is fast. Both typically produce many overlapping boxes per object. Non-maximum suppression (NMS) cleans these up: keep the highest-scoring box, remove boxes overlapping it above a threshold, and repeat. Transformer-based detectors such as DETR predict a set of objects directly and do not need NMS.", example: "Take three boxes with scores 0.90, 0.75, and 0.80, where the first two overlap heavily. NMS keeps the 0.90 box, removes the 0.75 box as a duplicate, and keeps the distant 0.80 box." },
      { title: "Metrics and segmentation", kicker: "MAP AND DICE", body: "Detection is graded with mean average precision (mAP): the area under the precision-recall curve per class, then averaged across classes. COCO-style mAP also averages over IoU thresholds from 0.5 to 0.95, rewarding precise localization. Segmentation commonly uses Dice or pixel IoU rather than pixel accuracy, because a small object can be missed entirely while pixel accuracy stays high. U-Net\u2019s encoder-decoder design with skip connections, which recover fine detail, remains a standard starting point.", kind: "math", example: "If an object covers 4 pixels, a model predicts 3 pixels, and 2 of them are correct, then Dice = 2 \xD7 2 / (4 + 3) \u2248 0.571. On a 100-pixel image, a model that predicts all background gets 96% pixel accuracy on the same object, but a Dice of 0." }
    ],
    formula: "\\text{IoU}=\\frac{|A\\cap B|}{|A\\cup B|} \\qquad \\text{Dice}=\\frac{2|A\\cap B|}{|A|+|B|}",
    formulaExplanation: "A and B are the predicted and true regions. Both scores run from 0 to 1. Dice gives more weight to the overlap, so it reads higher than IoU on the same prediction, unless the match is perfect or there is no overlap at all.",
    code: py`def iou(a, b):
    # Boxes are (x1, y1, x2, y2)
    width = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    height = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    overlap = width * height
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    return overlap / (area_a + area_b - overlap)

def non_max_suppression(boxes, scores, threshold=0.5):
    order = sorted(range(len(boxes)), key=lambda i: scores[i], reverse=True)
    keep = []
    while order:
        best = order.pop(0)
        keep.append(best)
        order = [i for i in order if iou(boxes[best], boxes[i]) < threshold]
    return keep

print("IoU:", round(iou((0, 0, 4, 4), (2, 2, 6, 6)), 3))
print("IoU:", round(iou((0, 0, 4, 4), (1, 1, 5, 5)), 3))

boxes = [(10, 10, 50, 50), (12, 12, 52, 52), (100, 100, 140, 140)]
scores = [0.90, 0.75, 0.80]
print("kept box indexes:", non_max_suppression(boxes, scores))

def dice(true_pixels, predicted_pixels):
    overlap = len(true_pixels & predicted_pixels)
    return 2 * overlap / (len(true_pixels) + len(predicted_pixels))

truth = {(0, 0), (0, 1), (1, 0), (1, 1)}
prediction = {(0, 1), (1, 1), (1, 2)}
print("Dice:", round(dice(truth, prediction), 3))`,
    codeOutput: "IoU: 0.143\nIoU: 0.391\nkept box indexes: [0, 2]\nDice: 0.571",
    codeExplanation: "The `max(0, \u2026)` guards handle boxes that do not touch, where the overlap would otherwise come out as a negative width. In the NMS loop, box 1 is dropped because it overlaps box 0 heavily, while box 2 survives because it is elsewhere in the image. Note that the returned order follows the scores: 0.90, then 0.80. In real work, use `torchvision.ops.nms`, and run NMS per class so a person and a bicycle in the same spot do not cancel each other.",
    practice: [
      { prompt: "Calculate IoU for boxes (0, 0, 2, 2) and (1, 0, 3, 2).", answer: "1/3, or about 0.333.", solution: "The overlap runs x from 1 to 2 and y from 0 to 2, so its area is 1 \xD7 2 = 2. Each box has area 4, so the union is 4 + 4 \u2212 2 = 6. IoU = 2 / 6 \u2248 0.333." },
      { prompt: "You lower the NMS threshold from 0.7 to 0.3. What happens in a crowded scene?", answer: "More boxes are removed, and real neighboring objects may be lost.", solution: "A lower threshold treats smaller overlaps as duplicates. In a crowd, two different people can overlap by 0.4, so a valid detection is suppressed, which lowers recall. Soft-NMS, which reduces scores instead of deleting boxes, can help here." },
      { prompt: "A warehouse wants to count boxes on shelves, and they often touch. Which task do you choose?", answer: "Detection, or instance segmentation when the objects overlap heavily.", solution: "Semantic segmentation merges touching objects of the same class, so it cannot count them. Detection gives a separate result per object at lower labeling cost, so start there. Move to instance segmentation if heavy overlap defeats boxes." }
    ],
    quiz: { question: "Why can pixel accuracy be misleading for segmentation?", options: ["It only works on grayscale images", "A rare small object can be missed while accuracy stays high because background dominates", "It is impossible to compute"], answer: 1, explanation: "B is correct: when background fills most of the image, predicting all background scores well while missing the object entirely. Dice and IoU focus on overlap with the object. A and C are false." },
    takeaways: ["Choose the simplest task that answers the question, because labels get expensive quickly.", "IoU defines whether a detection is correct, and NMS removes duplicate boxes.", "Use mAP for detection and Dice or IoU for segmentation, not pixel accuracy."],
    interview: { question: "What is the difference between one-stage and two-stage detectors?", answer: "Two-stage detectors first propose candidate regions, then classify and refine them, and they often lead on accuracy. One-stage detectors predict classes and boxes in a single pass, which is usually faster. The gap has narrowed a lot, so I would choose using measured accuracy and latency on the target hardware." },
    related: ["convolutional-neural-networks", "transfer-learning", "evaluation-metrics"],
    miniProject: { title: "Fine-tune a detector", objective: "Adapt a pretrained detector to a small custom dataset and measure it properly.", tasks: ["Label about 100 images, or use the Penn-Fudan pedestrian dataset.", "Load `torchvision.models.detection.fasterrcnn_resnet50_fpn` with pretrained weights and replace its box predictor.", "Train with horizontal flips, transforming the boxes along with the images.", "Report mAP at IoU 0.5 and at 0.5:0.95 using `torchmetrics`, and inspect the worst predictions."], extension: "Vary the score threshold and NMS threshold, then plot how precision and recall respond." }
  }
];
var languageLessons = [
  {
    slug: "tokenization-and-embeddings",
    title: "Tokens and embeddings: turning text into numbers",
    description: "Language models never see words. They see token ids and learned vectors where meaning becomes geometry.",
    module: "Language & LLMs",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    prerequisites: ["neural-networks"],
    objectives: ["Tokenize text and handle unknown words and padding.", "Explain why subword tokenizers replaced whole-word vocabularies.", "Calculate cosine similarity and explain what embeddings do and do not capture."],
    analogy: "Imagine a map where cities with similar climates sit close together. The coordinates mean nothing on their own, but distance is meaningful. Embeddings are a map for tokens with hundreds of dimensions, built so that tokens used in similar contexts end up nearby.",
    intro: "A neural network needs numbers, so text must become numbers first. Tokenization splits text into pieces and assigns each an integer id. An embedding layer then maps each id to a vector of learned values, and those vectors are what the model actually processes. These early choices decide what a model can represent, what it costs, and some surprising failures, such as why models can miscount letters in a word.",
    sections: [
      { title: "Tokenization splits text into ids", kicker: "FROM STRINGS TO INTEGERS", body: "A simple tokenizer splits on whitespace and looks words up in a vocabulary. Reserved ids handle special cases: <pad> fills short sequences so batches line up, and <unk> stands in for anything not in the vocabulary. An attention mask tells the model which positions are real and which are padding. The vocabulary must be built from training data and then frozen.", example: "With the vocabulary {<pad>: 0, <unk>: 1, the: 2, cat: 3, sat: 4, dog: 5, a: 6, ran: 7}, the text \u201Cthe cat ran fast\u201D encodes to [2, 3, 7, 1, 0] at length 5. \u201Cfast\u201D is unknown, so it becomes 1, and the final 0 is padding." },
      { title: "Subword tokenizers", kicker: "WHY MODERN MODELS SPLIT WORDS", body: "Whole-word vocabularies grow huge and still fail on new words, typos, and rare names. Byte-Pair Encoding (BPE) instead starts from characters and repeatedly merges the most frequent adjacent pair, so common words stay whole and rare words split into pieces. The model always has some representation for any input, with no unknown tokens. This also explains why token counts differ from word counts, and why models cost and limit by tokens.", points: ["A rough rule for English text: 1 token is about \xBE of a word, or about 4 characters.", "Models see tokens, not letters, so character-level tasks such as counting letters are harder than they appear.", "A model and its tokenizer are a pair, so never swap one without the other."] },
      { title: "Embeddings: meaning as geometry", kicker: "LEARNED VECTORS", body: "An embedding layer is a lookup table with one learned vector per token id. Training moves vectors so that tokens appearing in similar contexts end up close together, an idea known as the distributional hypothesis. A one-hot vector treats every pair of words as equally different; an embedding of a few hundred dimensions can capture degrees of similarity. Classic word embeddings give one vector per word, so \u201Cbank\u201D gets the same vector for rivers and money, while transformer outputs depend on context.", example: "A vocabulary of 50,000 tokens with 768-dimensional embeddings has a table of 50,000 \xD7 768 = 38.4 million parameters." },
      { title: "Measuring similarity", kicker: "COSINE SIMILARITY", body: "Cosine similarity compares the direction of two vectors, ignoring length: dot product divided by the product of their norms. It runs from \u22121 to 1, with higher meaning more similar. Sentence and document embeddings use the same idea and power semantic search, clustering, and recommendation. Be careful, though: embeddings absorb patterns from their training text, including social biases, and similarity is not the same as truth. \u201CThe drug works\u201D and \u201Cthe drug does not work\u201D can sit very close together.", kind: "math", example: "For cat = [0.9, 0.8, 0.1] and dog = [0.8, 0.9, 0.2], the dot product is 1.46 and the norms are about 1.208 and 1.220, so cosine \u2248 0.990. For ran = [0.1, 0.2, 0.9], cat versus ran gives about 0.303." }
    ],
    formula: "\\cos(a,b)=\\frac{a\\cdot b}{\\lVert a\\rVert\\,\\lVert b\\rVert}",
    formulaExplanation: "a \xB7 b sums the element-wise products, and the norms divide out each vector\u2019s length, leaving only the angle between them. 1 means the same direction, 0 means perpendicular, and \u22121 means opposite.",
    code: py`import numpy as np

# Build a tiny vocabulary with reserved ids for padding and unknown words
texts = ["the cat sat", "the dog sat", "a dog ran"]
vocabulary = {"<pad>": 0, "<unk>": 1}
for text in texts:
    for word in text.split():
        vocabulary.setdefault(word, len(vocabulary))
print("vocabulary size:", len(vocabulary))

def encode(text, length=5):
    ids = [vocabulary.get(word, vocabulary["<unk>"]) for word in text.split()]
    return (ids + [0] * length)[:length]

print("encoded:", encode("the cat ran fast"))

# Hand-made 3-D vectors standing in for learned embeddings
embeddings = {
    "cat": np.array([0.9, 0.8, 0.1]),
    "dog": np.array([0.8, 0.9, 0.2]),
    "ran": np.array([0.1, 0.2, 0.9]),
}

def cosine(a, b):
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))

print("cat vs dog:", round(cosine(embeddings["cat"], embeddings["dog"]), 3))
print("cat vs ran:", round(cosine(embeddings["cat"], embeddings["ran"]), 3))`,
    codeOutput: "vocabulary size: 8\nencoded: [2, 3, 7, 1, 0]\ncat vs dog: 0.99\ncat vs ran: 0.303",
    codeExplanation: "`setdefault` assigns the next free id only to new words, so ids stay stable. `encode` first pads and then cuts to a fixed length, which is what lets sequences form a rectangular batch. These vectors are written by hand to make the calculation clear. In a real model, `nn.Embedding(vocab_size, dim)` starts them at random and training moves them.",
    practice: [
      { prompt: "Using the lesson\u2019s vocabulary, encode \u201Ca cat flew\u201D at length 4.", answer: "[6, 3, 1, 0].", solution: "\u201Ca\u201D is 6, \u201Ccat\u201D is 3, and \u201Cflew\u201D is not in the vocabulary, so it becomes <unk> = 1. Padding fills the last position with 0." },
      { prompt: "Calculate the cosine similarity of [1, 0] and [1, 1].", answer: "About 0.707.", solution: "The dot product is 1. The norms are 1 and \u221A2. So cosine = 1 / \u221A2 \u2248 0.707, which corresponds to a 45\xB0 angle." },
      { prompt: "How many parameters does an embedding table have for 30,000 tokens at 512 dimensions, and how would doubling the vocabulary change it?", answer: "15.36 million, and doubling the vocabulary doubles it.", solution: "30,000 \xD7 512 = 15,360,000. The table is one row per token, so it grows linearly with vocabulary size and with the embedding dimension." }
    ],
    quiz: { question: "Why do modern language models use subword tokens instead of whole words?", options: ["Subwords look more scientific", "They handle rare and unseen words by splitting them into known pieces", "They remove the need for embeddings"], answer: 1, explanation: "B is correct: any word can be built from smaller known pieces, which avoids unknown tokens and keeps the vocabulary manageable. A is not a technical reason. C is wrong because every token still maps to an embedding." },
    takeaways: ["Tokenizers convert text to ids, and a model must be used with its own tokenizer.", "Embeddings are learned vectors in which similar usage leads to nearby positions.", "Cosine similarity measures closeness in direction, not truth."],
    interview: { question: "How are static word embeddings different from contextual embeddings?", answer: "Static embeddings such as word2vec assign one vector per word type, so \u201Cbank\u201D is the same in every sentence. Contextual embeddings, from models like BERT, compute a vector for each occurrence from its surrounding text, so the two senses of \u201Cbank\u201D get different vectors." },
    related: ["recurrent-neural-networks", "attention-mechanism", "how-llms-generate-text"],
    miniProject: { title: "Build a semantic search over your notes", objective: "See embeddings work end to end on your own text.", tasks: ["Collect about 50 short notes or paragraphs.", "Compute embeddings with `sentence-transformers` using the `all-MiniLM-L6-v2` model.", "For a query, return the top 3 notes by cosine similarity.", "Compare with exact keyword search on 10 queries and record where each one wins."], extension: "Plot the embeddings in 2-D with PCA and see which notes cluster together." }
  },
  {
    slug: "how-llms-generate-text",
    title: "How LLMs generate text",
    description: "A language model predicts one token at a time. Sampling, temperature, and context windows explain most of its behavior.",
    module: "Language & LLMs",
    difficulty: "Intermediate",
    estimatedMinutes: 17,
    prerequisites: ["transformers", "tokenization-and-embeddings"],
    objectives: ["Describe the generation loop and context window.", "Apply temperature to logits by hand, and explain top-k and top-p sampling.", "Explain why models make things up and how training shapes behavior."],
    analogy: "Imagine an extremely well-read autocomplete. It has read an enormous library and, given your sentence so far, it estimates what comes next. It writes one piece, reads everything again including that piece, and continues. It is not looking anything up. It is predicting what plausible text looks like.",
    intro: "An LLM is a transformer trained to predict the next token. Everything else, including chat, code, and translation, emerges from repeating that one step. This view explains a lot of practical behavior: why settings like temperature change the output, why long conversations can lose earlier context, and why a model can state something false with complete confidence.",
    sections: [
      { title: "The generation loop", kicker: "ONE TOKEN AT A TIME", body: "Tokenize the prompt and pass it through the model, which outputs a logit for every token in the vocabulary. Convert these to a probability distribution, pick one token, append it, and repeat until a stop token or a length limit. Production systems cache attention keys and values from earlier tokens, so each step only computes the new one. The context window limits how many tokens the model can consider at once, covering both the prompt and the response.", points: ["Input and output tokens both count toward the context window.", "Anything outside the window is not seen, unless it is summarized or retrieved back in.", "Cost and latency usually scale with token counts."] },
      { title: "Temperature and sampling", kicker: "CONTROLLING RANDOMNESS", body: "Greedy decoding always takes the top token, which tends to be repetitive. Sampling draws from the distribution instead. Temperature divides the logits first: below 1 sharpens the distribution and above 1 flattens it. Top-k keeps only the k most likely tokens, and top-p (nucleus sampling) keeps the smallest set whose probabilities sum to at least p. Lower settings suit extraction and factual tasks, and higher ones suit brainstorming.", example: "For logits [2, 1, 0], temperature 1 gives probabilities [0.665, 0.245, 0.090]. Temperature 0.5 doubles the logits to [4, 2, 0], giving [0.867, 0.117, 0.016]. Temperature 2 halves them to [1, 0.5, 0], giving [0.506, 0.307, 0.186]. The order never changes; only the confidence does." },
      { title: "How models are trained", kicker: "PRETRAINING AND ALIGNMENT", body: "Pretraining fits next-token prediction on large text collections, using cross-entropy loss. The result continues text but does not reliably follow instructions. A second phase shapes behavior: supervised fine-tuning on instruction examples, then preference-based methods in which humans or models rank responses, such as RLHF and Constitutional AI. Fine-tuning a pretrained model for a narrow domain is often more practical than training from scratch, and much of a model\u2019s value comes from this second stage.", points: ["A knowledge cutoff exists because training data stops at some date.", "System prompts are ordinary input the model is trained to prioritize, not hard rules.", "Prompting well means giving clear context, examples, and an output format."] },
      { title: "Why models make things up", kicker: "LIMITS TO DESIGN AROUND", body: "A model is trained to produce plausible continuations, and it has no built-in check against reality. So it can produce a confident, fluent, and false statement, including invented citations. This is called hallucination, and well-written text is no evidence against it. Reduce the risk by providing sources through retrieval, asking the model to cite them, validating structured output, and evaluating on a test set for your task. Treat text from users or retrieved documents as untrusted, because prompt injection can try to override your instructions.", kind: "math", points: ["Use retrieval for facts and tools for arithmetic or current data.", "Build an evaluation set and rerun it whenever the prompt or model changes.", "Keep a person in the loop for high-stakes decisions."] }
    ],
    formula: "P(t_i)=\\frac{\\exp(z_i/T)}{\\sum_j \\exp(z_j/T)}",
    formulaExplanation: "z\u1D62 is the logit for token i, and T is the temperature. T = 1 is the plain softmax. As T approaches 0, the probability concentrates on the top token, which is greedy decoding. As T grows, the distribution approaches uniform.",
    code: py`import numpy as np

logits = np.array([2.0, 1.0, 0.0])
words = ["blue", "cloudy", "green"]

def softmax(values):
    exponentials = np.exp(values - values.max())
    return exponentials / exponentials.sum()

# Temperature divides the logits before softmax
for temperature in (0.5, 1.0, 2.0):
    probabilities = softmax(logits / temperature)
    print(temperature, probabilities.round(3).tolist())

def sample_next(logits, temperature, top_k, rng):
    scaled = logits / temperature
    keep = np.argsort(scaled)[-top_k:]       # the k highest-scoring tokens
    probabilities = softmax(scaled[keep])
    return keep[rng.choice(len(keep), p=probabilities)]

rng = np.random.default_rng(7)
draws = [words[sample_next(logits, 1.0, 2, rng)] for _ in range(1000)]
print("top-2 draws:", {word: draws.count(word) for word in words})`,
    codeOutput: "0.5 [0.867, 0.117, 0.016]\n1.0 [0.665, 0.245, 0.09]\n2.0 [0.506, 0.307, 0.186]\ntop-2 draws: {'blue': 721, 'cloudy': 279, 'green': 0}",
    codeExplanation: "Subtracting the maximum before `np.exp` is a standard trick that avoids overflow. The output confirms the hand calculation. Top-k with k = 2 makes \u201Cgreen\u201D impossible, and \u201Cblue\u201D appears about 73% of the time, since 0.665 / (0.665 + 0.245) \u2248 0.731. This is how a sampler works in a real model, except that the logits come from a transformer and cover tens of thousands of tokens.",
    practice: [
      { prompt: "Logits are [1, 0] and temperature is 1. What is the probability of the first token? What happens at temperature 0.5?", answer: "About 0.731 at temperature 1, and about 0.881 at temperature 0.5.", solution: "At T = 1: e\xB9 / (e\xB9 + e\u2070) = 2.718 / 3.718 \u2248 0.731. At T = 0.5, the logits become [2, 0], so e\xB2 / (e\xB2 + 1) = 7.389 / 8.389 \u2248 0.881." },
      { prompt: "Probabilities are [0.5, 0.3, 0.15, 0.05]. Which tokens does top-p with p = 0.75 keep?", answer: "The first two tokens.", solution: "Accumulate in order: 0.5, then 0.8. The total reaches at least 0.75 after two tokens, so the top two are kept and their probabilities are renormalized to 0.625 and 0.375." },
      { prompt: "A model has a 200,000-token context window. A prompt uses 195,000 tokens and you request up to 10,000 in the output. What happens?", answer: "The request does not fit, because the input and output share the window.", solution: "195,000 + 10,000 = 205,000, which exceeds 200,000. Depending on the API, it returns an error or stops early. Shorten the input, for example by retrieving only relevant passages or summarizing history, or reduce the output limit." }
    ],
    quiz: { question: "What does lowering the temperature do?", options: ["Changes which token has the highest logit", "Concentrates probability on the most likely tokens, making output more predictable", "Makes the model look up facts"], answer: 1, explanation: "B is correct: dividing logits by a small T widens the gaps between them, so softmax concentrates on the top tokens. A is wrong because scaling keeps the order. C is wrong because temperature only changes sampling and has no effect on the model\u2019s knowledge." },
    takeaways: ["LLMs generate by repeatedly predicting a distribution over the next token and sampling from it.", "Temperature, top-k, and top-p control randomness, not knowledge.", "Fluent text is not evidence of truth, so ground important answers in sources and evaluate them."],
    interview: { question: "How would you reduce hallucinations in an LLM application?", answer: "Combine retrieval so the model answers from supplied sources, instructions to cite those sources and to say when it does not know, lower temperature for factual tasks, and verification steps such as schema checks and citation validation. Then measure with an evaluation set of real questions, because without one you cannot tell if a change helped." },
    related: ["transformers", "tokenization-and-embeddings", "retrieval-augmented-generation"],
    miniProject: { title: "Build a character-level text generator", objective: "Implement the generation loop yourself, with no libraries hiding it.", tasks: ["Train a small character-level model in PyTorch on a text file of your choice.", "Write a `generate` function with greedy decoding, temperature, and top-k.", "Generate the same prompt at temperatures 0.2, 0.8, and 1.5, and compare the results.", "Measure how the output changes as you limit the context window."], extension: "Add top-p sampling, and test whether caching earlier computation makes your loop faster." }
  },
  {
    slug: "retrieval-augmented-generation",
    title: "Retrieval-augmented generation (RAG)",
    description: "Give a language model the right documents at answer time. Most RAG quality is decided before the model is ever called.",
    module: "Language & LLMs",
    difficulty: "Advanced",
    estimatedMinutes: 19,
    prerequisites: ["how-llms-generate-text", "tokenization-and-embeddings"],
    objectives: ["Trace the RAG pipeline from chunking to a cited answer.", "Calculate reciprocal rank fusion and explain hybrid search.", "Evaluate retrieval and generation separately."],
    analogy: "A closed-book exam tests what you memorized, and an open-book exam lets you look things up. RAG turns a language model\u2019s exam into an open-book one. It still needs to find the right page and read it correctly, and most failures come from finding the wrong page.",
    intro: "A model does not know your private documents or recent events. Retrieval-augmented generation fetches relevant text at question time and places it in the prompt, so the model answers from evidence. It is often a better first step than fine-tuning when the issue is missing knowledge: documents can be updated without retraining, and answers can cite sources. Quality depends mostly on retrieval, since a model cannot use a passage that was never retrieved.",
    sections: [
      { title: "Indexing: chunking is a design choice", kicker: "BEFORE ANY QUESTION ARRIVES", body: "Split documents into chunks, embed each one, and store the vectors with metadata such as source and date. Chunk size is a real trade-off: small chunks match precisely but lose context, and large chunks keep context but dilute the match and use more of the context window. Split on structure such as headings and paragraphs, and overlap chunks slightly so an idea is not cut in half. Filter by metadata when you can, so a query about 2026 policy does not retrieve the 2019 version.", points: ["Common starting point: a few hundred tokens with roughly 10\u201320% overlap.", "Tables and code usually need their own handling.", "Re-embed everything if you change the embedding model."] },
      { title: "Retrieval: dense, sparse, or both", kicker: "HYBRID SEARCH", body: "Dense retrieval compares embeddings and finds matches in meaning even when the words differ. Sparse retrieval such as BM25 matches exact terms, and so excels with product codes, names, and acronyms that embeddings can blur. Hybrid search runs both and merges the results. Reciprocal Rank Fusion merges rankings using positions alone, which conveniently avoids comparing incompatible score scales.", example: "Rank fusion with k = 60: rankings [a, b, c] and [c, a, d]. Document a scores 1/61 + 1/62 \u2248 0.03252. Document c scores 1/63 + 1/61 \u2248 0.03227. Document b gets only 1/62 \u2248 0.01613, and document d gets only 1/63 \u2248 0.01587. Appearing in both lists beats a single high rank." },
      { title: "Rerank, then generate", kicker: "FROM CANDIDATES TO AN ANSWER", body: "A cross-encoder reranker reads the query and each candidate together, which is more accurate but too slow for the whole corpus. So retrieve generously, perhaps 25\u201350 candidates, then rerank down to a few. Build a prompt that separates instructions from sources, requires citations, and tells the model to say so when the sources do not contain the answer. Retrieved text is untrusted input: a document can contain instructions meant to hijack the model, so never let it trigger sensitive actions without checks.", points: ["Retrieve broadly for recall, then rerank for precision.", "Check that citations point to real, retrieved chunks.", "Respect access controls during retrieval, so users see only permitted documents."] },
      { title: "Evaluate each stage separately", kicker: "FIND THE BROKEN STEP", body: "When an answer is wrong, the cause is usually either that the right chunk was not retrieved or that the model misused it. Measure these separately. Retrieval uses recall@k and MRR against a labeled question set. Generation uses faithfulness, which asks whether claims are supported by the sources, and answer relevance. Build the test set from real user questions, including ones with no answer in your documents, and rerun it after every change.", kind: "math", example: "If 40 of 50 test questions have their correct chunk in the top 5, recall@5 = 0.80. No prompt can fix the other 10 questions, so improve retrieval first." }
    ],
    formula: "\\text{RRF}(d)=\\sum_{r\\in R}\\frac{1}{k+\\text{rank}_r(d)}",
    formulaExplanation: "For each ranking r that contains document d, add 1 divided by k plus its position. k, commonly 60, dampens the advantage of the very top ranks. Documents ranked well by several retrievers rise to the top.",
    code: py`from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

chunks = [
    "Refunds are available within 30 days of purchase with a receipt.",
    "Standard shipping takes 3 to 5 business days within the country.",
    "Gift cards never expire and cannot be exchanged for cash.",
    "Refund requests after 30 days are reviewed by the support team.",
]

# Index: fit the vectorizer on the documents, not on the questions
vectorizer = TfidfVectorizer(stop_words="english")
index = vectorizer.fit_transform(chunks)

def retrieve(question, k=2):
    scores = cosine_similarity(vectorizer.transform([question]), index)[0]
    best = scores.argsort()[::-1][:k]
    return [(int(i), round(float(scores[i]), 3)) for i in best]

question = "How many days do I have to get a refund?"
results = retrieve(question)
print("retrieved:", results)

# Reciprocal rank fusion merges two rankings without comparing their scores
def reciprocal_rank_fusion(rankings, k=60):
    totals = {}
    for ranking in rankings:
        for rank, doc in enumerate(ranking, start=1):
            totals[doc] = totals.get(doc, 0) + 1 / (k + rank)
    return sorted(totals.items(), key=lambda item: item[1], reverse=True)

fused = reciprocal_rank_fusion([["a", "b", "c"], ["c", "a", "d"]])
print("fused:", [(doc, round(score, 5)) for doc, score in fused])

context = "\n".join(f"[{i}] {chunks[i]}" for i, _ in results)
prompt = f"Answer using only the sources. Cite them.\n{context}\nQuestion: {question}"
print(prompt.splitlines()[0])`,
    codeOutput: "retrieved: [(3, 0.483), (0, 0.153)]\nfused: [('a', 0.03252), ('c', 0.03227), ('b', 0.01613), ('d', 0.01587)]\nAnswer using only the sources. Cite them.",
    codeExplanation: "Look closely at the retrieval: chunk 0 is the best answer, but it ranks below chunk 3. The query says \u201Crefund\u201D and chunk 0 says \u201CRefunds\u201D, so TF-IDF does not count them as the same term. Chunk 3 matches \u201Crefund\u201D exactly. This is the core weakness of lexical search and why dense embeddings, stemming, and hybrid search exist. Printing retrieval results is the single most useful RAG debugging habit. This example stops at building the prompt, which you would send to an LLM.",
    practice: [
      { prompt: "With k = 60, a document ranks 1st in one list and 4th in another. What is its RRF score?", answer: "About 0.0320.", solution: "1/(60 + 1) + 1/(60 + 4) = 1/61 + 1/64 \u2248 0.01639 + 0.01563 \u2248 0.0320." },
      { prompt: "Users search for error code \u201CERR_4417\u201D and the system returns unrelated results. What do you change?", answer: "Add sparse keyword search, making the system hybrid.", solution: "Embeddings tend to blur rare identifiers, so an exact code has little semantic meaning for them. BM25 gives rare exact matches high weight. Merge the two result lists with RRF so semantic questions keep working." },
      { prompt: "Your recall@5 is 0.95 but answers are often wrong. Where do you look next?", answer: "At generation: the prompt, context ordering, and faithfulness.", solution: "The right chunks are usually present, so retrieval is not the main issue. Inspect whether the model ignores sources, whether too much irrelevant context drowns them, or whether chunks lack needed context. Reranking to fewer chunks and stricter instructions often help. Measure faithfulness to confirm it." }
    ],
    quiz: { question: "An answer is wrong. What should you check first?", options: ["Switch to a larger model immediately", "Whether the correct passage was actually retrieved", "Raise the temperature"], answer: 1, explanation: "B is correct: if the right text never reached the model, no model or prompt can reliably fix it. So check retrieval before changing generation. A is expensive and may not help, and C adds randomness rather than evidence." },
    takeaways: ["RAG gives a model evidence at answer time, and documents update without retraining.", "Hybrid search with reranking covers both meaning and exact terms.", "Evaluate retrieval and generation separately, using real questions."],
    interview: { question: "When would you use RAG instead of fine-tuning?", answer: "RAG suits knowledge that changes or must be cited, since you can update documents without retraining. Fine-tuning suits changing behavior, such as style, format, or a specialized task. They combine well: retrieve for facts, and fine-tune for how the answer is produced. I would normally try RAG first because it is cheaper to change and easier to audit." },
    related: ["how-llms-generate-text", "tokenization-and-embeddings", "evaluation-metrics"],
    miniProject: { title: "Ship a cited question-answering tool", objective: "Build a small RAG system and measure it honestly.", tasks: ["Collect 20 or more documents you know well, such as course notes or product docs.", "Chunk them, then build dense and BM25 indexes, merged with RRF.", "Write 25 test questions with their expected source chunks, including 5 with no answer.", "Measure recall@5, then generate answers with citations and check their faithfulness by hand."], extension: "Add a cross-encoder reranker and report whether it improves your metrics enough to justify its latency." }
  }
];
var productionLessons = [
  {
    slug: "serving-models",
    title: "Serving models: from notebook to reliable service",
    description: "A model is only useful if something can call it. Package it, guard its inputs, and measure the tail of your latency.",
    module: "Production AI",
    difficulty: "Advanced",
    estimatedMinutes: 16,
    prerequisites: ["feature-engineering-and-pipelines"],
    objectives: ["Choose batch, online, or streaming serving from a product need.", "Package a model with its preprocessing and version, and validate inputs.", "Read latency percentiles and pick a safe rollout strategy."],
    analogy: "A recipe that works once in your kitchen does not make a restaurant. A restaurant needs consistent ingredients, a way to reject bad orders, a target time per dish, and a way to try a new dish on a few tables before changing the whole menu.",
    intro: "A notebook can show that a model works, but production asks different questions. What happens with malformed input? How slow is the slowest request? Which version answered this user? How do you roll back? Serving is mostly ordinary software engineering applied to an artifact that can fail silently, because a bad model returns a confident wrong answer instead of an error.",
    sections: [
      { title: "Batch, online, or streaming", kicker: "CHOOSE THE SIMPLEST THAT WORKS", body: "Batch prediction runs on a schedule and stores results, which is cheap and simple, and it works when predictions can be slightly stale, such as nightly recommendations. Online serving answers each request within milliseconds, for cases like fraud checks at payment time. Streaming reacts to events as they arrive. Batch is often underrated: if predictions for all users can be computed overnight, you avoid running a low-latency service.", points: ["Batch: scores everything in advance, and new users have no prediction yet.", "Online: fresh but requires low latency and high availability.", "Streaming: responds to events, but needs more infrastructure."] },
      { title: "Package the whole pipeline", kicker: "REPRODUCIBLE ARTIFACTS", body: "Save preprocessing and model together with a version, the training data reference, metrics, and dependency versions. Mismatch between training and serving preprocessing, known as training-serving skew, is one of the most common production bugs. Pickle-based formats such as joblib can run arbitrary code when loaded, so only load artifacts you trust. ONNX and safetensors are safer and more portable alternatives for sharing and serving.", points: ["Record the model version in every prediction\u2019s logs.", "Pin dependency versions; a library upgrade can break a saved pickle.", "Put models in a registry so a rollback is one step."] },
      { title: "Latency means percentiles", kicker: "MEASURE THE TAIL", body: "Averages hide the requests users complain about. The p95 is the value that 95% of requests finish under. Tail latency matters more than you might expect: a page that makes 10 calls will often be held back by its slowest call. Reduce latency through smaller models, quantization, caching repeated requests, and batching on GPUs, which raises throughput but adds a little wait for each request.", example: "For 20 latencies whose mean is 55.1 ms, the p50 is 29 ms, but one request took 480 ms and the p95 is 109.5 ms. The mean describes almost nobody\u2019s actual experience here. Report p50, p95, and p99 against a target, such as \u201Cp95 under 100 ms\u201D." },
      { title: "Roll out without betting everything", kicker: "SAFE DEPLOYMENT", body: "A shadow deployment sends a copy of live traffic to the new model and logs its answers without showing them, which tests it with no user risk. A canary gives it a small share of real traffic, such as 5%, and then gradually more if metrics hold. An A/B test measures the business effect with a statistically sound comparison. Always keep a one-step rollback and a fallback, such as the previous model or a simple rule, for when the model is unavailable.", kind: "math", points: ["Shadow: checks stability and agreement with no user impact.", "Canary: limits the blast radius with real traffic.", "A/B: measures whether the model actually improves the product."] }
    ],
    formula: "p_{95} = \\min\\{t : P(\\text{latency} \\le t) \\ge 0.95\\}",
    formulaExplanation: "The p95 is the smallest time such that at least 95% of requests finish within it. Software often interpolates between neighboring samples, as NumPy does in the example below, so results from different tools can differ slightly.",
    code: py`import io
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

# Train and save the whole pipeline, so preprocessing ships with the model
X = np.array([[1.0, 200.0], [2.0, 150.0], [8.0, 40.0], [9.0, 30.0]])
y = np.array([0, 0, 1, 1])
pipeline = make_pipeline(StandardScaler(), LogisticRegression()).fit(X, y)

artifact = io.BytesIO()
joblib.dump({"model": pipeline, "version": "2026-11-01"}, artifact)
artifact.seek(0)
loaded = joblib.load(artifact)

def predict(payload):
    # Validate at the boundary: reject bad input instead of guessing
    visits, spend = payload.get("visits"), payload.get("spend")
    if not isinstance(visits, (int, float)) or not isinstance(spend, (int, float)):
        return {"error": "visits and spend must be numbers"}
    if visits < 0 or spend < 0:
        return {"error": "visits and spend cannot be negative"}
    probability = loaded["model"].predict_proba([[visits, spend]])[0][1]
    return {"probability": round(float(probability), 2), "model_version": loaded["version"]}

print(predict({"visits": 8, "spend": 35}))
print(predict({"visits": "many", "spend": 35}))
print(predict({"visits": -1, "spend": 35}))

# Report tail latency: a good average can hide very slow requests
latencies_ms = np.array([18, 20, 21, 22, 22, 23, 24, 25, 26, 28, 30, 31, 33, 35, 38, 40, 44, 52, 90, 480])
print("mean:", latencies_ms.mean(), "p50:", np.percentile(latencies_ms, 50), "p95:", round(np.percentile(latencies_ms, 95), 1))`,
    codeOutput: "{'probability': 0.79, 'model_version': '2026-11-01'}\n{'error': 'visits and spend must be numbers'}\n{'error': 'visits and spend cannot be negative'}\nmean: 55.1 p50: 29.0 p95: 109.5",
    codeExplanation: "Saving a dictionary keeps the model and its version together, so each response can report which model produced it. `predict` rejects bad input with a clear message, because a model handed garbage still returns a number. In a real service this function would sit behind a framework such as FastAPI, with validation through Pydantic. The `BytesIO` buffer stands in for a file so that the example leaves nothing on disk.",
    practice: [
      { prompt: "A page calls 5 services, and each is independently slow 5% of the time. How often does a page load hit at least one slow call?", answer: "About 22.6% of the time.", solution: "The chance that all five are fast is 0.95\u2075 \u2248 0.774, so the chance of at least one being slow is 1 \u2212 0.774 \u2248 0.226. This is why tail latency matters." },
      { prompt: "A retailer refreshes product recommendations once a day and they are read on page load. Which serving pattern fits?", answer: "Batch prediction with stored results.", solution: "Predictions can be computed nightly and looked up in a fast store, so there is no low-latency model service to run. A fallback for new users, such as popular items, is the main addition." },
      { prompt: "Offline accuracy is 92%, but the same model scores far lower in production with no errors in the logs. What do you check first?", answer: "Training-serving skew in the preprocessing.", solution: "Compare the actual feature values reaching the model against training data. Typical causes are different scaling, a default value for a missing feature, changed units, or features computed differently online. Logging inputs and using one shared pipeline both help prevent it." }
    ],
    quiz: { question: "Why report p95 latency rather than only the mean?", options: ["The mean is hard to compute", "The mean can hide slow requests that affect real users", "p95 is always lower than the mean"], answer: 1, explanation: "B is correct: a few very slow requests can be masked by many fast ones, and users feel those slow ones. A is false. C is false as well: p95 is usually higher than the mean, although a few extreme outliers can reverse that, which is itself a reason to look at several percentiles." },
    takeaways: ["Use the simplest serving pattern that meets the need; batch is often enough.", "Ship preprocessing and model together, with a version on every prediction.", "Measure percentiles, and roll out through shadow and canary stages with a rollback ready."],
    interview: { question: "What is training-serving skew and how do you prevent it?", answer: "It is a difference between the data or feature logic used in training and what the model sees in production. I prevent it by sharing one preprocessing pipeline, using a feature store when that is justified, logging serving inputs, and comparing their distributions with the training data." },
    related: ["feature-engineering-and-pipelines", "monitoring-and-drift", "evaluation-metrics"],
    miniProject: { title: "Wrap a model in a real API", objective: "Build a small, honest prediction service.", tasks: ["Train a scikit-learn pipeline and save it with its version.", "Serve it through FastAPI, with a Pydantic schema that validates input.", "Add `/health`, and log the version and latency for every request.", "Run a load test with `locust` or `hey`, and report p50, p95, and p99."], extension: "Package it in Docker and add a shadow route that logs a second model\u2019s predictions without returning them." }
  },
  {
    slug: "monitoring-and-drift",
    title: "Monitoring and drift: keeping models honest",
    description: "A deployed model decays quietly because the world changes. Learn what to watch and when to act.",
    module: "Production AI",
    difficulty: "Advanced",
    estimatedMinutes: 15,
    prerequisites: ["serving-models", "evaluation-metrics"],
    objectives: ["Distinguish data drift, concept drift, and data quality failures.", "Calculate the Population Stability Index by hand.", "Design monitoring and a retraining policy when labels arrive late."],
    analogy: "A weather model trained on past decades can slowly become less accurate as the climate shifts, even though no code has changed. Nothing crashes, and the forecasts look just as confident. You only find out by continuing to compare predictions against what actually happens.",
    intro: "Normal software usually fails loudly. A model usually fails silently: the API returns 200, and the predictions look normal, but they are becoming wrong. Users change, products launch, upstream teams rename columns, and fraudsters adapt. Monitoring means detecting these changes before they turn into bad decisions, and that includes the hard case where true labels arrive weeks later.",
    sections: [
      { title: "What actually changes", kicker: "KINDS OF DRIFT", body: "Data drift (covariate shift) means the input distribution P(x) changes, such as a marketing campaign bringing in younger users. Concept drift means the relationship P(y | x) changes, so the same inputs now lead to different outcomes, as when fraud tactics change or a pandemic alters shopping. Label drift means the outcome rates shift. Data drift does not always harm a model, whereas concept drift generally does. Most real incidents, however, are plain data quality failures.", points: ["Data drift: inputs look different.", "Concept drift: the right answer for the same input has changed.", "Data quality: a pipeline broke, such as a unit change or a column filled with nulls."] },
      { title: "Measure drift with PSI", kicker: "POPULATION STABILITY INDEX", body: "PSI compares how a feature\u2019s values fall across fixed bins now versus in a reference period. The bin edges come from the reference data and stay fixed. A common rule of thumb reads below 0.1 as stable, 0.1\u20130.25 as moderate change, and above 0.25 as a significant shift. These thresholds are conventions rather than laws, so calibrate them on your own history. With very large samples, statistical tests such as Kolmogorov\u2013Smirnov flag trivially small differences, so effect size is often more useful.", example: "Reference shares are [0.25, 0.25, 0.25, 0.25] and current shares are [0.1, 0.2, 0.3, 0.4]. Sum (a \u2212 e) \xD7 ln(a / e): (\u22120.15)(\u22120.916) + (\u22120.05)(\u22120.223) + (0.05)(0.182) + (0.15)(0.470) \u2248 0.137 + 0.011 + 0.009 + 0.071 = 0.228, which is moderate and close to the action threshold." },
      { title: "Layers of monitoring", kicker: "WHAT TO WATCH", body: "Watch several layers, from cheapest to most valuable. Service health covers errors, latency, and traffic. Data quality covers null rates, ranges, and schema. Distribution checks cover input and prediction drift. Model quality compares predictions with true labels. Business metrics show actual impact. When labels arrive late, such as loan defaults after months, prediction drift and data checks act as early warnings, and a sample of human-labeled cases can fill the gap.", points: ["Alert on things someone can act on, or alerts will be ignored.", "Slice metrics by segment, since an average can hide a failing group.", "Beware feedback loops, where the model\u2019s decisions affect which outcomes you see."] },
      { title: "When to retrain", kicker: "A POLICY, NOT A REFLEX", body: "Retraining on a schedule is simple and works when change is gradual. Triggered retraining reacts to monitored drops. Either way, treat each retrained model as a new release: validate it against the current model on recent data, and roll it out gradually. Automatically deploying whatever comes out of training is risky, since it can learn from a broken pipeline. And retraining cannot fix a data outage, so diagnose first.", kind: "math", points: ["Evaluate on the most recent period, using a time-based split.", "Compare with the current model before promoting.", "Keep the previous version ready for rollback."] }
    ],
    formula: "\\text{PSI}=\\sum_{i}(a_i-e_i)\\ln\\frac{a_i}{e_i}",
    formulaExplanation: "e\u1D62 and a\u1D62 are the shares of data in bin i for the reference and current periods. Each term is nonnegative, because (a \u2212 e) and ln(a / e) always share a sign, so PSI is 0 only when the distributions match across bins. A small floor prevents log(0) in empty bins.",
    code: py`import numpy as np

def population_stability_index(expected, actual, bins=10, floor=1e-4):
    # Bin edges come from the reference data and stay fixed
    edges = np.quantile(expected, np.linspace(0, 1, bins + 1))
    edges[0], edges[-1] = -np.inf, np.inf
    expected_share = np.histogram(expected, edges)[0] / len(expected)
    actual_share = np.histogram(actual, edges)[0] / len(actual)
    # A floor stops an empty bin from producing log(0)
    expected_share = np.clip(expected_share, floor, None)
    actual_share = np.clip(actual_share, floor, None)
    return float(np.sum((actual_share - expected_share) * np.log(actual_share / expected_share)))

# The hand calculation from this lesson
hand = (np.array([0.1, 0.2, 0.3, 0.4]) - 0.25) * np.log(np.array([0.1, 0.2, 0.3, 0.4]) / 0.25)
print("hand PSI:", round(float(hand.sum()), 3))

rng = np.random.default_rng(7)
reference = rng.normal(50, 10, 10_000)
print("same distribution:", round(population_stability_index(reference, rng.normal(50, 10, 10_000)), 3))
print("small shift:", round(population_stability_index(reference, rng.normal(52, 10, 10_000)), 3))
print("large shift:", round(population_stability_index(reference, rng.normal(60, 12, 10_000)), 3))`,
    codeOutput: "hand PSI: 0.228\nsame distribution: 0.001\nsmall shift: 0.047\nlarge shift: 0.745",
    codeExplanation: "Quantile edges give each reference bin about the same share of data, and setting the outer edges to infinity catches new values outside the old range. Two samples from the same distribution give a PSI near 0. A 0.2-standard-deviation shift stays under the 0.1 line, so it would pass unnoticed by this rule, and only you can decide whether that is acceptable. A shift of one standard deviation with a wider spread is unmistakable.",
    practice: [
      { prompt: "A bin\u2019s reference share is 0.2 and its current share is 0.4. What is that bin\u2019s PSI contribution?", answer: "About 0.139.", solution: "(0.4 \u2212 0.2) \xD7 ln(0.4 / 0.2) = 0.2 \xD7 ln 2 \u2248 0.2 \xD7 0.693 \u2248 0.139." },
      { prompt: "Input distributions look stable, but fraud losses are climbing fast. What kind of drift is most likely?", answer: "Concept drift.", solution: "The inputs look the same, but their relationship with the outcome has changed, since attackers adapted. Input drift checks would not detect this. Performance on recently confirmed labels and a review of high-value cases would." },
      { prompt: "Overnight, a feature\u2019s average jumps from 170 to 67. What do you suspect first, and what do you do?", answer: "A unit or pipeline change, not real-world drift. Fix the pipeline rather than retraining.", solution: "A sudden step usually means a pipeline issue, such as height changing from centimeters to inches, since 170 cm \u2248 67 in. Retraining would just bake in the bug. Check upstream changes, add range checks, and consider a fallback while it is fixed." }
    ],
    quiz: { question: "True labels arrive 90 days after each prediction. What can you monitor today?", options: ["Nothing until the labels arrive", "Input drift, prediction distribution, and data quality as early signals", "Only server uptime"], answer: 1, explanation: "B is correct: these need no labels and can warn you early, even though they do not directly measure accuracy. A leaves you blind for months. C misses silent model failure, because a service can be up and still be wrong." },
    takeaways: ["Models fail silently, so service health alone is not enough.", "Separate data drift, concept drift, and data quality failures, because each has a different fix.", "Treat retraining as a validated release, not an automatic reflex."],
    interview: { question: "How would you monitor a model when ground-truth labels are delayed?", answer: "I would track data quality, input drift, and prediction drift as leading indicators, sample recent predictions for human labeling, and use proxy outcomes that arrive sooner, such as a late-payment flag for a loan default model. When real labels arrive, I would backfill performance by cohort to confirm whether the early signals were right." },
    related: ["serving-models", "evaluation-metrics", "responsible-ai"],
    miniProject: { title: "Simulate a drifting model", objective: "Watch a model decay and test whether your monitoring would have caught it.", tasks: ["Train a classifier on a synthetic dataset, and treat that as your reference period.", "Generate 12 monthly batches with gradual covariate shift, then introduce concept drift in month 8.", "Plot PSI per feature and true accuracy per month on the same chart.", "Write down when an alert would have fired, and whether each kind of drift was detectable before accuracy dropped."], extension: "Add monthly and triggered retraining, then compare accuracy and the number of retrains for each." }
  },
  {
    slug: "responsible-ai",
    title: "Responsible AI: fairness, documentation, and risk",
    description: "A model can look accurate overall and still fail specific people. Measure it, document it, and decide deliberately.",
    module: "Production AI",
    difficulty: "Advanced",
    estimatedMinutes: 16,
    prerequisites: ["evaluation-metrics"],
    objectives: ["Calculate selection rate, TPR, and FPR per group.", "Explain why common fairness definitions can conflict.", "Write a useful model card and decide when not to automate."],
    analogy: "A bridge is not safe because the average truck crosses it. Engineers document load limits, inspect for specific failure modes, and sometimes close it. Responsible AI brings the same habit to models: state the limits, test where it could fail, and accept that sometimes the right answer is not to build the thing.",
    intro: "A high overall score can hide serious harm to a small group. Data records past decisions, including unfair ones, and removing a sensitive column does not fix that, because other features act as proxies. Responsible AI is not a separate checkbox. It is the same evidence-based discipline as the rest of this course: define the harm you care about, measure it, and make the trade-offs explicit and owned by someone.",
    sections: [
      { title: "Where harm comes from", kicker: "BEFORE THE MODEL", body: "Bias enters long before training. Historical bias means labels encode past decisions: a model trained on who was hired learns who was hired before, not who would do well. Representation bias means some groups have too few examples. Measurement bias means the target is a poor proxy, such as using healthcare spending to stand in for health need, when groups with less access spend less for the same illness. Dropping a sensitive attribute rarely helps, since postcode or name can reveal it.", points: ["Ask what the label actually measures.", "Check who is missing or underrepresented in the data.", "Look for proxies of sensitive attributes among the features."] },
      { title: "Measure by group", kicker: "DISAGGREGATED EVALUATION", body: "Always break metrics down by relevant groups. Selection rate is the share of a group receiving the positive decision. True positive rate (TPR) is the share of truly positive people who are identified. False positive rate (FPR) is the share of truly negative people wrongly flagged. Small groups give noisy estimates, so report the counts and confidence intervals too, not just a percentage.", example: "In the code below, both groups have 80% accuracy. But group A has selection rate 0.6, TPR 0.83, and FPR 0.25, while group B has selection rate 0.3, TPR 0.67, and FPR 0.14. Equal accuracy hides the fact that qualified people in group B are missed more often." },
      { title: "Fairness definitions conflict", kicker: "A CHOICE, NOT A CALCULATION", body: "Demographic parity asks for equal selection rates. Equal opportunity asks for equal TPR. Equalized odds asks for equal TPR and FPR. Predictive parity asks for equal precision. When base rates differ between groups, a model that is not perfect generally cannot satisfy calibration and equal error rates at the same time. So fairness cannot be fully automated. Someone has to choose, based on the context and who bears the cost of each mistake.", kind: "math", points: ["Which mistake harms people most in this decision?", "Is the label itself trustworthy across groups?", "Who was consulted, and who is accountable for the choice?"] },
      { title: "Document and decide", kicker: "MODEL CARDS AND RISK", body: "A model card records intended use, out-of-scope uses, data, group-level metrics, limitations, and contacts. Also think about privacy: models can memorize personal data, and LLM apps can leak what they are given. Think about security too, including prompt injection in LLM systems. For high-stakes areas such as hiring, credit, and health, check applicable regulations, and provide a way for people to appeal to a human. Sometimes the responsible conclusion is not to automate at all.", example: "A useful limitation reads: \u201CTrained on adult patients at three hospitals. Not evaluated on children. Recall drops from 0.91 to 0.74 for scans from older machines.\u201D Someone can act on that. \u201CThe model may have limitations\u201D says nothing." }
    ],
    formula: "\\text{TPR}_g=\\frac{TP_g}{TP_g+FN_g} \\qquad \\text{FPR}_g=\\frac{FP_g}{FP_g+TN_g}",
    formulaExplanation: "The same formulas as in evaluation metrics, but calculated separately for each group g. Equal opportunity compares TPR across groups, and equalized odds compares both TPR and FPR.",
    code: py`import numpy as np

# Labels and decisions for two groups with different base rates
group = np.array(["A"] * 10 + ["B"] * 10)
actual = np.array([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0])
predicted = np.array([1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0])

print("group | selected | TPR | FPR | precision")
for name in ("A", "B"):
    mask = group == name
    y, p = actual[mask], predicted[mask]
    selected = p.mean()
    tpr = p[y == 1].mean()
    fpr = p[y == 0].mean()
    precision = y[p == 1].mean()
    print(name, round(float(selected), 2), round(float(tpr), 2), round(float(fpr), 2), round(float(precision), 2))

overall = (actual == predicted).mean()
print("overall accuracy:", round(float(overall), 2))`,
    codeOutput: "group | selected | TPR | FPR | precision\nA 0.6 0.83 0.25 0.83\nB 0.3 0.67 0.14 0.67\noverall accuracy: 0.8",
    codeExplanation: "Selection rate needs no labels, while TPR and FPR condition on the true label, and precision conditions on the prediction. Group A has a higher base rate (6 of 10 positive) than group B (3 of 10). Equalizing selection rates would force a different kind of error somewhere else. With 10 examples per group, these numbers are for illustrating the calculation: real audits need larger samples and confidence intervals. Libraries such as Fairlearn make this easy to repeat.",
    practice: [
      { prompt: "Group G has TP = 30, FN = 20, FP = 10, TN = 40. Calculate its selection rate, TPR, and FPR.", answer: "Selection rate 0.40, TPR 0.60, FPR 0.20.", solution: "There are 100 people, and 30 + 10 = 40 received the positive decision, so the selection rate is 0.40. TPR = 30 / (30 + 20) = 0.60. FPR = 10 / (10 + 40) = 0.20." },
      { prompt: "A team removes \u201Cgender\u201D from a hiring model and says it is now fair. What is wrong with that reasoning?", answer: "Other features can act as proxies, and the labels may still encode past bias.", solution: "Features such as college, activities, or career gaps can reveal gender, and past hiring decisions used as labels may already be skewed. Removing a column also makes bias harder to measure. Audit outcomes by group, using the attribute for evaluation where lawful." },
      { prompt: "A screening tool has much higher FPR for one group, and a positive result triggers an invasive test. Which metric gap matters most here, and why?", answer: "The FPR gap, because false positives cause the direct harm.", solution: "A false positive sends a healthy person into an invasive procedure, and this burden falls more on one group. Investigate the causes, consider group-aware thresholds where lawful and appropriate, and report the trade-off in terms of recall. Clinicians and affected people should be part of that decision." }
    ],
    quiz: { question: "Two groups have identical overall accuracy. What can you conclude?", options: ["The model treats both groups fairly", "Very little: their false positive and false negative rates may differ a lot", "The data must be perfectly balanced"], answer: 1, explanation: "B is correct: the same accuracy can come from very different mixes of errors, which is exactly what the code example shows. A is the mistake this lesson warns about. C does not follow from equal accuracy." },
    takeaways: ["Bias enters through labels, representation, and measurement, long before training.", "Always evaluate by group, and report sample sizes along with the rates.", "Fairness definitions can conflict, so the choice must be explicit, documented, and owned by people."],
    interview: { question: "Is removing protected attributes enough to make a model fair?", answer: "No. Other features can act as proxies, and labels may carry historical bias. It can also stop you from measuring the problem. I would evaluate outcomes by group, examine the label and data sources, choose fairness criteria with stakeholders, and document the trade-offs and remaining risks." },
    related: ["evaluation-metrics", "monitoring-and-drift", "train-validation-test"],
    miniProject: { title: "Audit a model and write its card", objective: "Run a group-level audit, then document what you found.", tasks: ["Train a classifier on the Adult Income dataset from OpenML.", "Use Fairlearn\u2019s `MetricFrame` to report selection rate, TPR, and FPR by sex and race, along with counts.", "Try one mitigation, such as group-specific thresholds, and quantify its cost in overall accuracy.", "Write a one-page model card covering intended use, out-of-scope uses, results by group, and limitations."], extension: "Bootstrap confidence intervals for your group metrics, and decide which gaps are large enough to matter." }
  }
];

// src/content/deepLearningLessons.ts
var deepLearningLessons = [
  {
    number: "09",
    slug: "perceptrons",
    title: "The perceptron: a neuron that makes a choice",
    description: "Start with the smallest neural unit: weighted evidence, a bias, and a threshold that turns a score into a class.",
    module: "Deep learning",
    difficulty: "Beginner",
    estimatedMinutes: 16,
    prerequisites: ["neural-networks"],
    objectives: ["Calculate a weighted score and threshold prediction by hand.", "Explain weights, bias, and a perceptron update.", "Recognize why one perceptron cannot solve every pattern."],
    analogy: "Think of a simple entry gate. It checks several signals, gives each signal a different importance, adds a starting offset, then opens only when the total reaches a threshold. The weights are the importance dials; the bias shifts how much evidence is needed.",
    intro: "A perceptron is a simple classifier. It first combines input features into one score, then applies a step rule to choose class 0 or class 1. It is not a tiny biological brain: it is a precise arithmetic rule with parameters that can be adjusted from labeled examples.",
    sections: [
      { title: "From evidence to a score", kicker: "WEIGHTED INPUTS", body: "Each input x\u1D62 describes one property of an example. Its weight w\u1D62 says how strongly that property contributes to the score. The bias b shifts the score even when all inputs are zero. Positive weights push toward class 1; negative weights push away from it.", example: "For x = [2, 1], w = [0.5, \u22120.25], and b = \u22120.5, the score is 2(0.5) + 1(\u22120.25) \u2212 0.5 = 0.25. Because the score is at least zero, this perceptron predicts class 1." },
      { title: "The threshold makes a boundary", kicker: "A SIMPLE DECISION", body: "The step activation converts the score into a hard answer: zero below the threshold and one at or above it. In two dimensions, the equation w\u2081x\u2081 + w\u2082x\u2082 + b = 0 is a straight line. One side is class 0 and the other side class 1. In more dimensions, that line becomes a hyperplane.", points: ["The boundary is determined jointly by weights and bias.", "A hard threshold has no useful derivative almost everywhere, so it cannot be trained with ordinary backpropagation.", "Modern neural networks usually keep a smooth or piecewise-smooth activation during training."] },
      { title: "Learn by correcting mistakes", kicker: "A SMALL UPDATE", body: "For a misclassified labeled example, the classic perceptron rule nudges weights toward the correct answer. With target y and prediction \u0177, update w by \u03B7(y\u2212\u0177)x and b by \u03B7(y\u2212\u0177), where \u03B7 is a positive learning rate. If the example was already correct, the update is zero.", example: "In the example above, the target is 0 but the prediction is 1. At \u03B7 = 0.1, y\u2212\u0177 = \u22121. New weights are [0.5, \u22120.25] + 0.1(\u22121)[2,1] = [0.3, \u22120.35], and the new bias is \u22120.5 \u2212 0.1 = \u22120.6. The score becomes 2(0.3) \u2212 0.35 \u2212 0.6 = \u22120.35, so this example now falls on the class-0 side." },
      { title: "A boundary has limits", kicker: "LINEAR SEPARABILITY", body: "A single perceptron can separate patterns that fit on opposite sides of one straight boundary. It cannot represent XOR: the two diagonal corners belong to class 1 and the other two corners belong to class 0, so no single line separates them. Adding hidden units and nonlinear activations lets a network combine several boundaries.", kind: "math" }
    ],
    formula: "\\hat{y}=\\begin{cases}1 & w^\\top x+b\\ge 0\\\\0 & w^\\top x+b<0\\end{cases} \\qquad w\\leftarrow w+\\eta(y-\\hat{y})x",
    formulaExplanation: "The first expression turns the weighted score into a class. The second changes the weights only when the current prediction differs from the known target. \u03B7 (eta) controls the update size.",
    code: 'import torch\n\n# One labeled example with two input features\nx = torch.tensor([2.0, 1.0])\ntarget = torch.tensor(0.0)\nweights = torch.tensor([0.5, -0.25])\nbias = torch.tensor(-0.5)\nlearning_rate = 0.1\n\n# Score the example and apply the hard threshold\nscore = torch.dot(weights, x) + bias\nprediction = (score >= 0).float()\n\n# Move the boundary only in the direction that corrects this example\nerror = target - prediction\nweights = weights + learning_rate * error * x\nbias = bias + learning_rate * error\nnew_score = torch.dot(weights, x) + bias\nprint(f"score={score.item():.2f}, prediction={prediction.item():.0f}")\nprint(f"updated score={new_score.item():.2f}")',
    codeOutput: "score=0.25, prediction=1\nupdated score=-0.35",
    codeExplanation: "The dot product multiplies each feature by its weight and adds the contributions. The threshold returns a class. `error` is target minus prediction, so a wrong class produces a signed correction. The update changes both the weights and bias, then recomputes the score to check the direction. This is the classic perceptron update, not the gradient of a smooth loss.",
    practice: [
      { prompt: "For x=[1,3], w=[2,\u22121], and b=0.5, calculate the score and class.", answer: "The score is \u22120.5, so the prediction is class 0.", solution: "Compute 1(2) + 3(\u22121) + 0.5 = 2 \u2212 3 + 0.5 = \u22120.5. The score is below zero, so the step rule returns 0." },
      { prompt: "The target is 1, the current prediction is 0, x=[2,\u22121], and \u03B7=0.2. What is the weight change?", answer: "The change is [0.4,\u22120.2].", solution: "The error is y\u2212\u0177 = 1\u22120 = 1. Multiply \u03B7 times the error times x: 0.2(1)[2,\u22121] = [0.4,\u22120.2]. The bias also increases by 0.2." },
      { prompt: "Why can\u2019t a single perceptron learn XOR?", answer: "Its single straight decision boundary cannot separate the alternating corner labels.", solution: "A perceptron assigns one class to each side of one line. In XOR, class 1 occupies opposite corners and class 0 occupies the other opposite corners. Any line that puts one class-1 corner on one side also leaves the other on the wrong side. A network needs multiple boundaries combined nonlinearly." }
    ],
    quiz: { question: "What does the perceptron bias do?", options: ["Changes the number of input features", "Shifts the threshold boundary", "Guarantees the data can be separated"], answer: 1, explanation: "The bias shifts the score and therefore the boundary. It neither changes the feature count nor guarantees that the classes are linearly separable." },
    takeaways: ["A perceptron computes a weighted score, adds a bias, and applies a threshold.", "The classic update nudges a mistaken example toward its known class.", "One perceptron only represents a single linear decision boundary."],
    interview: { question: "What is the difference between a perceptron and a modern artificial neuron?", answer: "The classic perceptron uses a hard threshold and a mistake-driven update. Modern neural-network units usually use differentiable activations and are trained together with gradient-based methods and a loss function." },
    related: ["activation-functions-and-losses", "forward-propagation"],
    miniProject: { title: "Build an AND gate, then challenge it with XOR", objective: "Train or hand-adjust a perceptron that outputs 1 only when both binary inputs are 1.", tasks: ["Write the four truth-table input pairs and targets.", "Choose weights and bias, then calculate all four scores.", "Apply the perceptron update to any mistakes until AND is correct.", "Try the same process for XOR and record why one line cannot solve it."], extension: "Plot the points and draw the learned decision boundary; then sketch how two hidden units could create multiple regions." }
  },
  {
    number: "10",
    slug: "activation-functions-and-losses",
    title: "Activations and losses: shaping learning signals",
    description: "Activations shape what a network can represent; loss functions tell training which prediction errors matter.",
    module: "Deep learning",
    difficulty: "Beginner",
    estimatedMinutes: 20,
    prerequisites: ["perceptrons"],
    objectives: ["Explain why hidden layers need nonlinear activations.", "Compare ReLU, sigmoid, tanh, GELU, and softmax.", "Choose a loss that matches regression or classification."],
    analogy: "A layer first mixes ingredients into a raw score. An activation is like a shaping tool that decides what signal continues. The loss is the tasting score that says how far the finished dish is from the target. If every shaping tool is linear, stacking them still makes only a linear recipe.",
    intro: "A neural layer often produces a pre-activation z = Wx+b. The activation transforms z before it reaches the next layer. A loss compares a model output with the target during training. Activations define useful nonlinear behavior; losses define the learning objective. They solve different problems and should not be confused.",
    sections: [
      { title: "Why add a nonlinear activation?", kicker: "MORE THAN A STACK OF LINES", body: "If every layer only multiplies by a matrix and adds a vector, two layers collapse into one affine transformation. Nonlinear activations break that collapse, allowing networks to form curves, thresholds, and layered feature combinations. ReLU is max(0,z): it passes positive values and zeros negative ones. It is simple and often trains well, though units can become inactive if they remain on the negative side.", points: ["Sigmoid maps a number into (0,1), useful for a binary probability output, but it can saturate and have tiny gradients.", "Tanh maps into (\u22121,1), is centered around zero, and can also saturate.", "Leaky ReLU keeps a small negative slope; GELU smoothly gates values and is common in transformers.", "Softmax turns a vector of class scores into probabilities that sum to one."] },
      { title: "Choose the loss from the target", kicker: "WHAT SHOULD COUNT AS WRONG?", body: "For a numeric target, mean squared error averages squared differences; it penalizes large misses strongly and is measured in squared target units. For binary classification, binary cross-entropy compares a predicted probability with a 0/1 label. For mutually exclusive classes, cross-entropy compares class logits with the correct class index. In PyTorch, `CrossEntropyLoss` expects raw logits, not probabilities, because it applies a stable log-softmax internally.", example: "For logits [2, 0.5, \u22121], class 0 is the strongest score. Softmax gives approximately [0.786, 0.175, 0.039]. If class 0 is correct, cross-entropy is \u2212ln(0.786) \u2248 0.241. If the correct label were class 2, the loss would be \u2212ln(0.039) \u2248 3.24: the model was confidently wrong, so the penalty is larger." },
      { title: "Outputs and hidden layers have different jobs", kicker: "PAIR THE LAST LAYER WITH THE TASK", body: "Hidden layers need nonlinear activations so the model can build useful representations. The output layer depends on the prediction task. Regression often uses a linear output; binary classification commonly produces one logit interpreted with sigmoid; multi-class classification produces one logit per class and uses cross-entropy. Do not add softmax before PyTorch cross-entropy, or probabilities will be treated as if they were logits.", kind: "math" },
      { title: "Gradients connect activation and loss", kicker: "WHY THE PAIR MATTERS", body: "Backpropagation differentiates the loss through the output and hidden activations. A saturated sigmoid can have a derivative near zero, so earlier weights receive a weak learning signal. ReLU has a constant positive-side derivative, but a unit stuck negative also receives zero. Good initialization, architecture, normalization, and the right objective all affect whether a useful signal flows.", points: ["A probability is an interpretation of a logit; it is not always the value to pass into the loss.", "The target encoding must match the loss input shape and meaning.", "Accuracy is a metric for reporting decisions; it is not usually a smooth training loss."] }
    ],
    formula: "\\operatorname{ReLU}(z)=\\max(0,z) \\qquad \\operatorname{softmax}(z_i)=\\frac{e^{z_i}}{\\sum_j e^{z_j}} \\qquad L_{CE}=-\\ln p_{\\text{correct}}",
    formulaExplanation: "ReLU gates each scalar. Softmax converts a vector of logits into probabilities. Cross-entropy is large when the model assigns a small probability to the correct class.",
    code: 'import torch\nimport torch.nn.functional as F\n\n# Compare common activations on the same pre-activation values\nvalues = torch.tensor([-2.0, 0.0, 2.0])\nprint("ReLU:", F.relu(values).tolist())\nprint("sigmoid at zero:", torch.sigmoid(torch.tensor(0.0)).item())\nprint("tanh at zero:", torch.tanh(torch.tensor(0.0)).item())\n\n# Multi-class classification uses raw logits and a class index\nlogits = torch.tensor([[2.0, 0.5, -1.0]])\ntarget = torch.tensor([0])\nprobabilities = torch.softmax(logits, dim=1)\nloss = F.cross_entropy(logits, target)\nprint("probabilities:", [round(p, 3) for p in probabilities[0].tolist()])\nprint("cross-entropy:", round(loss.item(), 3))',
    codeOutput: "ReLU: [0.0, 0.0, 2.0]\nsigmoid at zero: 0.5\ntanh at zero: 0.0\nprobabilities: [0.786, 0.175, 0.039]\ncross-entropy: 0.241",
    codeExplanation: "The first tensor contains pre-activation values. ReLU zeros negatives; sigmoid and tanh apply their smooth mappings. The final block keeps the raw class scores in `logits`, calculates probabilities only for inspection, and passes logits plus the correct class index to cross-entropy. `dim=1` means normalize across the class dimension.",
    practice: [
      { prompt: "Apply ReLU to z=[\u22123,0,2]. Why is this not just another linear layer?", answer: "[0,0,2]; the zeroing rule is nonlinear.", solution: "ReLU(z)=max(0,z) element by element. Negative values and zero become 0, while 2 remains 2. This piecewise rule cannot be represented by one matrix multiplication plus bias over the whole input range, so it adds nonlinear capacity." },
      { prompt: "A three-class model gives probability 0.8 to the correct class. What is its cross-entropy?", answer: "Approximately 0.223.", solution: "For one example, cross-entropy is \u2212ln(p_correct). Therefore \u2212ln(0.8) \u2248 0.223. If the model gave probability 0.1 to the correct class, the loss would be \u2212ln(0.1) \u2248 2.303, a much larger penalty." },
      { prompt: "Why should raw logits usually go into PyTorch CrossEntropyLoss?", answer: "The loss applies log-softmax in a numerically stable way.", solution: "Computing softmax probabilities and then taking logarithms can underflow for extreme scores. `CrossEntropyLoss` combines the operations stably. Passing probabilities would make it treat those values as logits and apply another softmax, which is not the intended objective." }
    ],
    quiz: { question: "Which pair is appropriate for mutually exclusive multi-class classification in PyTorch?", options: ["Raw logits with CrossEntropyLoss", "Softmax probabilities with CrossEntropyLoss", "ReLU outputs with mean squared error in every case"], answer: 0, explanation: "CrossEntropyLoss expects raw logits and integer class targets; it applies log-softmax internally. Passing softmax probabilities applies the transformation twice. The third option is not the standard probabilistic multi-class objective." },
    takeaways: ["Nonlinear activations let layers represent more than one affine map.", "Loss functions encode how prediction errors are penalized.", "PyTorch cross-entropy expects logits and the correct class index."],
    interview: { question: "Why do neural networks use activation functions?", answer: "Without nonlinear activations, composing linear layers still yields a linear function. Nonlinear activations let depth represent nonlinear mappings and intermediate features." },
    related: ["perceptrons", "forward-propagation", "backpropagation"],
    miniProject: { title: "Compare activation and loss choices", objective: "Build a tiny classifier and inspect how logits, probabilities, and losses differ.", tasks: ["Evaluate ReLU, sigmoid, tanh, and GELU on values from \u22124 to 4.", "For fixed three-class logits, calculate softmax probabilities.", "Compute cross-entropy for a correct class and for a confidently wrong class.", "Write down which output transform belongs in the model and which belongs only in display code."], extension: "Change the logits to make the model more confident and observe how cross-entropy responds." }
  },
  {
    number: "11",
    slug: "forward-propagation",
    title: "Forward propagation: inputs become predictions",
    description: "Follow one example through a network, layer by layer, and calculate every intermediate value before training.",
    module: "Deep learning",
    difficulty: "Beginner",
    estimatedMinutes: 18,
    prerequisites: ["perceptrons", "activation-functions-and-losses"],
    objectives: ["Trace tensor shapes through a small network.", "Calculate hidden activations and an output by hand.", "Separate forward computation from parameter learning."],
    analogy: "A factory passes an item through stations. Each station transforms the measurements and hands its result to the next one. The forward pass is the route through those stations; it does not change the station settings.",
    intro: "Forward propagation is the computation a neural network performs to turn inputs into outputs. Each layer reads the previous layer\u2019s activations, multiplies by its weights, adds a bias, and may apply an activation. The parameters stay fixed during this pass. Training changes them later using a loss and gradients.",
    sections: [
      { title: "Track shapes as well as numbers", kicker: "TENSORS ARE ARRAYS WITH SHAPE", body: "A tensor is a multi-dimensional array. A tabular batch often has shape [batch, features]. A linear layer maps [batch, in_features] to [batch, out_features]. Keeping the batch dimension, even for one example, helps the same code work for many examples. A shape mismatch often means a feature dimension was placed in the wrong position.", points: ["The weight matrix of `Linear(in,out)` has shape [out,in].", "Matrix multiplication combines every input feature with each output unit\u2019s weights.", "Bias is added once for each output unit and broadcasts across the batch."] },
      { title: "Calculate one hidden layer", kicker: "WEIGHTED SUM THEN ACTIVATION", body: "Use x=[1,2], W\u2081=[[1,\u22121],[0.5,1]], and b\u2081=[0,1]. The first hidden score is 1(1)+2(\u22121)+0=\u22121. The second is 1(0.5)+2(1)+1=3.5. ReLU changes [\u22121,3.5] into [0,3.5]. This vector is the hidden representation passed forward.", example: "Now choose output weights W\u2082=[[2,\u22121]] and bias b\u2082=0.5. The output score is 2(0)+(\u22121)(3.5)+0.5=\u22123.0. If this is regression, \u22123 is the numeric prediction. A later loss compares it with the target; the forward pass alone does not improve the weights." },
      { title: "Loss is evaluated after prediction", kicker: "PREDICTION IS NOT YET LEARNING", body: "Suppose the target is 1.5 and the network predicted \u22123.0. The squared error for this example is (\u22123\u22121.5)\xB2=20.25. That number tells us how wrong the current parameters are according to this objective. A backward pass will calculate how each weight contributed to the loss so an optimizer can change them.", kind: "math" },
      { title: "Batching changes shape, not the idea", kicker: "ONE EXAMPLE OR MANY", body: "For a batch of B examples, the same matrix operation runs for all rows together. If x has shape [B,2], the hidden layer produces [B,2] and the output produces [B,1]. This vectorized computation is faster on modern hardware and is why PyTorch examples often keep a leading batch dimension.", example: "If B=32, `Linear(2,2)` maps [32,2] to [32,2]. A following `Linear(2,1)` maps [32,2] to [32,1]. The parameter shapes do not change when the batch gets larger." }
    ],
    formula: "z^{(l)}=W^{(l)}a^{(l-1)}+b^{(l)} \\qquad a^{(l)}=\\phi(z^{(l)})",
    formulaExplanation: "At layer l, z is the weighted score, a is the activation sent to the next layer, and \u03C6 is the activation function. The first activation a\u207D\u2070\u207E is the input.",
    code: 'import torch\nfrom torch import nn\nimport torch.nn.functional as F\n\n# One example, kept as a batch of one: [batch, features]\nx = torch.tensor([[1.0, 2.0]])\nfirst = nn.Linear(2, 2)\nlast = nn.Linear(2, 1)\n\n# Set known parameters so the arithmetic matches the lesson\nwith torch.no_grad():\n    first.weight.copy_(torch.tensor([[1.0, -1.0], [0.5, 1.0]]))\n    first.bias.copy_(torch.tensor([0.0, 1.0]))\n    last.weight.copy_(torch.tensor([[2.0, -1.0]]))\n    last.bias.copy_(torch.tensor([0.5]))\n\n# Compute hidden representation, prediction, and squared error\nhidden = F.relu(first(x))\nprediction = last(hidden)\ntarget = torch.tensor([[1.5]])\nloss = F.mse_loss(prediction, target)\nprint("hidden:", hidden.tolist())\nprint("prediction:", prediction.item())\nprint("squared error:", loss.item())',
    codeOutput: "hidden: [[0.0, 3.5]]\nprediction: -3.0\nsquared error: 20.25",
    codeExplanation: "`nn.Linear(2, 2)` creates two output units from two input features; `nn.Linear(2, 1)` creates one output. We overwrite random initialization so the values match the hand calculation. `F.relu` applies the hidden activation. The last layer returns a raw regression value, and mean squared error compares it with a target. No optimizer is called, so no parameters are updated.",
    practice: [
      { prompt: "A batch has 12 examples and 5 features. What shape enters `nn.Linear(5, 3)` and what shape comes out?", answer: "Input [12,5], output [12,3].", solution: "`Linear(in_features=5, out_features=3)` expects the final input dimension to be 5. It transforms each of the 12 rows into 3 scores, preserving the leading batch dimension." },
      { prompt: "For hidden scores [\u22122, 4] and ReLU, what activation vector is passed onward?", answer: "[0,4].", solution: "ReLU applies max(0,z) independently to each value: max(0,\u22122)=0 and max(0,4)=4." },
      { prompt: "A model produces prediction 7 and target 5. What is its single-example squared error?", answer: "4.", solution: "Subtract target from prediction: 7\u22125=2. Square the difference: 2\xB2=4. For a batch, MSE averages the squared differences across examples and output elements." }
    ],
    quiz: { question: "Does a forward pass update a network\u2019s weights?", options: ["Yes, every matrix multiply changes weights", "No, it computes outputs using the current weights", "Only the final layer changes"], answer: 1, explanation: "A forward pass computes intermediate activations and a prediction using current parameters. Learning happens only when gradients are computed and an optimizer applies updates." },
    takeaways: ["Forward propagation is an ordered set of tensor operations.", "Track both the values and the shapes at each layer.", "A loss measures the prediction; it does not itself update parameters."],
    interview: { question: "What is a forward pass?", answer: "It is the computation from input through the network layers to produce an output. During training, the loss is then computed from that output and the target." },
    related: ["activation-functions-and-losses", "backpropagation"],
    miniProject: { title: "Trace a two-layer network", objective: "Make a network\u2019s arithmetic observable rather than treating it as a black box.", tasks: ["Use the fixed weights from this lesson and reproduce every matrix multiplication by hand.", "Change one weight and predict which hidden score changes.", "Run the PyTorch code and compare shapes and values.", "Add a second input row and confirm the batch dimension doubles."], extension: "Replace ReLU with tanh and explain why the hidden values and output change." }
  },
  {
    number: "12",
    slug: "backpropagation",
    title: "Backpropagation: assigning credit for error",
    description: "Use the chain rule to trace how each parameter contributed to a prediction error, then verify the update with PyTorch autograd.",
    module: "Deep learning",
    difficulty: "Intermediate",
    estimatedMinutes: 22,
    prerequisites: ["forward-propagation", "gradient-descent"],
    objectives: ["Calculate a derivative through a tiny model by hand.", "Explain why gradients flow backward through layers.", "Use PyTorch autograd and update a parameter safely."],
    analogy: "A finished product misses its target. Backpropagation is like tracing the assembly line backward to estimate how much each adjustable station contributed to the final miss. The chain rule multiplies those local effects along each route.",
    intro: "Backpropagation is an efficient way to calculate derivatives of a network\u2019s loss with respect to every parameter. It does not decide the update size; an optimizer does that. It starts at the loss and applies the chain rule backward through operations saved during the forward pass. \u201CBackward\u201D describes derivative computation, not data moving backward during prediction.",
    sections: [
      { title: "Start with one weight", kicker: "A COMPLETE NUMERICAL EXAMPLE", body: "Let the prediction be \u0177=wx, with x=2, weight w=1, and target y=4. The prediction is 2 and the squared loss is L=(\u0177\u2212y)\xB2=(2\u22124)\xB2=4. The loss changes with prediction at dL/d\u0177=2(\u0177\u2212y)=\u22124. The prediction changes with weight at d\u0177/dw=x=2. By the chain rule, dL/dw=(dL/d\u0177)(d\u0177/dw)=\u22124(2)=\u22128.", example: "With learning rate 0.1, gradient descent changes w to 1\u22120.1(\u22128)=1.8. The new prediction is 3.6 and the loss is (3.6\u22124)\xB2=0.16. The update moved the prediction closer to the target because the gradient was negative." },
      { title: "The chain rule repeats through layers", kicker: "LOCAL DERIVATIVES MULTIPLY", body: "For a deeper network, each operation has a local derivative. The derivative of the loss with respect to an early weight is the product of the derivatives along every path from that weight to the loss, summed across paths. Backpropagation reuses intermediate results instead of recomputing every parameter\u2019s effect from scratch. This is why it scales to millions of parameters.", points: ["The forward pass stores values needed to calculate local derivatives.", "The backward pass accumulates gradients for each operation and parameter.", "The optimizer reads those gradients and changes parameters afterward."] },
      { title: "Autograd records operations", kicker: "LET THE FRAMEWORK APPLY THE CHAIN RULE", body: "In PyTorch, a tensor with `requires_grad=True` participates in a computation graph. Calling `loss.backward()` computes derivatives and stores them in each leaf parameter\u2019s `.grad`. Gradients accumulate by default, so training loops normally clear them before the next backward pass. Updates should happen without tracking a new gradient graph.", kind: "math" },
      { title: "What gradients can and cannot tell you", kicker: "INTERPRET WITH CARE", body: "A gradient is a local sensitivity at the current parameters. It tells which infinitesimal parameter change would most reduce the current loss, not whether the model is fair, causal, or globally optimal. Saturated activations and long products of derivatives can make gradients tiny or huge; normalization, initialization, residual connections, and clipping address different parts of those problems.", example: "In the tiny example, dL/dw=\u22128 means a small increase in w locally reduces the loss. It does not mean every increase is good forever: once w passes the best value 2, the derivative changes sign." }
    ],
    formula: "\\frac{\\partial L}{\\partial w}=\\frac{\\partial L}{\\partial \\hat{y}}\\frac{\\partial \\hat{y}}{\\partial w}=2(wx-y)x",
    formulaExplanation: "For L=(wx\u2212y)\xB2, differentiate the outer square first, then multiply by how the prediction changes with w. This is the chain rule in a one-weight network.",
    code: 'import torch\n\n# One learnable scalar and one training example\nweight = torch.tensor(1.0, requires_grad=True)\nfeature = torch.tensor(2.0)\ntarget = torch.tensor(4.0)\nlearning_rate = 0.1\n\n# Forward pass: prediction=2, squared loss=4\nprediction = weight * feature\nloss = (prediction - target) ** 2\n\n# Backward pass computes d(loss)/d(weight)\nloss.backward()\nprint("prediction:", prediction.item())\nprint("loss:", loss.item())\nprint("gradient:", weight.grad.item())\n\n# Update parameters without recording the update in the graph\nwith torch.no_grad():\n    weight -= learning_rate * weight.grad\n\n# Clear this gradient before another backward pass\nweight.grad = None\nnew_loss = (weight * feature - target) ** 2\nprint("updated weight:", round(weight.item(), 4))\nprint("new loss:", round(new_loss.item(), 4))',
    codeOutput: "prediction: 2.0\nloss: 4.0\ngradient: -8.0\nupdated weight: 1.8\nnew loss: 0.16",
    codeExplanation: "`requires_grad=True` marks the weight for differentiation. The forward operations build a graph. `loss.backward()` applies the chain rule and stores \u22128 in `weight.grad`. The `no_grad` block applies the explicit gradient-descent update without adding that mutation to the graph. Clearing `.grad` matters because PyTorch adds new gradients to existing ones. The last two prints round to four decimals because 32-bit floats would otherwise show rounding noise such as 1.7999999523.",
    practice: [
      { prompt: "For prediction \u0177=wx, x=3, w=2, and target 8, find the prediction, squared loss, and dL/dw.", answer: "Prediction 6, loss 4, gradient \u221212.", solution: "\u0177=wx=2(3)=6. L=(6\u22128)\xB2=4. The derivative is dL/dw=2(wx\u2212y)x=2(6\u22128)(3)=\u221212." },
      { prompt: "Why does PyTorch training code call `optimizer.zero_grad()` before `loss.backward()`?", answer: "PyTorch accumulates gradients, so clearing prevents gradients from earlier batches being added accidentally.", solution: "The `.grad` field is an accumulator. If it is not cleared, the next call to backward adds the new batch gradient to the previous batch\u2019s value. Standard independent mini-batch updates require clearing before each backward pass." },
      { prompt: "The gradient is +0.5 and learning rate is 0.2. What update does gradient descent apply?", answer: "It changes the parameter by \u22120.1.", solution: "The update is \u2212\u03B7g = \u22120.2(0.5)=\u22120.1. The positive gradient points toward locally increasing loss, so subtracting it moves the parameter downward." }
    ],
    quiz: { question: "What is backpropagation\u2019s main job?", options: ["Choose a learning rate", "Compute loss derivatives for parameters using the chain rule", "Shuffle the training data"], answer: 1, explanation: "Backpropagation efficiently computes gradients. The optimizer uses them to update parameters; the learning rate is an optimizer setting. Shuffling data is a separate training-data operation." },
    takeaways: ["Backpropagation applies the chain rule from loss back to parameters.", "Autograd computes gradients; an optimizer applies updates.", "PyTorch gradients accumulate until cleared."],
    interview: { question: "What is the difference between backpropagation and gradient descent?", answer: "Backpropagation computes derivatives of the loss with respect to parameters. Gradient descent uses those derivatives to update the parameters in a direction intended to reduce loss." },
    related: ["forward-propagation", "optimizers"],
    miniProject: { title: "Train one parameter by hand and by autograd", objective: "Confirm that a hand-derived gradient agrees with PyTorch.", tasks: ["Change x, target, and initial weight in the scalar example.", "Derive the gradient on paper before running the code.", "Compare the manual derivative with `weight.grad`.", "Repeat updates and make a small table of weight and loss after each step."], extension: "Extend the scalar model to two weights and verify each partial derivative separately." }
  },
  {
    number: "13",
    slug: "optimizers",
    title: "Optimizers: choosing how parameters move",
    description: "Gradient descent supplies a direction; optimizers shape the size, memory, and adaptivity of each training step.",
    module: "Deep learning",
    difficulty: "Intermediate",
    estimatedMinutes: 20,
    prerequisites: ["backpropagation"],
    objectives: ["Distinguish a gradient from an optimizer update.", "Explain SGD, momentum, RMSprop, and Adam intuitively.", "Choose a learning rate and diagnose common training curves."],
    analogy: "All optimizers are ways of hiking toward a lower valley. Plain SGD takes the current slope. Momentum remembers recent direction like a rolling ball. Adaptive methods adjust each parameter\u2019s step based on recent gradient sizes, like giving each trail its own step scale.",
    intro: "An optimizer updates parameters after backpropagation computes gradients. The optimizer is not the loss and does not know the task goal; it only uses gradients and its own state. The learning rate is still important: Adam cannot rescue a wildly wrong scale or a broken objective.",
    sections: [
      { title: "SGD and momentum", kicker: "CURRENT SLOPE VS. RECENT HISTORY", body: "Stochastic gradient descent uses an estimated gradient from one example or a mini-batch. It is simple and can generalize well, but noisy gradients make the path zig-zag. Momentum keeps a moving velocity: v\u209C=\u03B2v\u209C\u208B\u2081+g\u209C, then moves by \u2212\u03B7v\u209C. Repeatedly consistent gradients build speed; alternating noise partly cancels.", example: "If two consecutive gradients are both +2 and \u03B2=0.9, the momentum values are v\u2081=2 and v\u2082=0.9(2)+2=3.8. The second step is larger than the current gradient alone because the direction has been consistent." },
      { title: "RMSprop and Adam", kicker: "ADAPT EACH PARAMETER\u2019S SCALE", body: "RMSprop tracks a moving average of squared gradients and divides by its square root, reducing step size for parameters with consistently large gradients. Adam combines this idea with a moving average of the gradient itself and bias corrections early in training. It is a strong default for many deep-learning tasks, but not a universal winner.", points: ["SGD: update with the current gradient.", "Momentum SGD: smooth the path using a velocity.", "RMSprop: normalize by recent squared-gradient size.", "Adam: combine momentum-like first moments and adaptive second moments."] },
      { title: "The learning rate is still the main dial", kicker: "READ THE CURVE", body: "If training loss barely changes, the learning rate may be too small, gradients may be tiny, or the model/data pipeline may be wrong. If loss explodes or oscillates, the rate may be too large. Compare validation loss too: optimizer progress on training data does not guarantee generalization.", kind: "math" },
      { title: "A stable training step", kicker: "PRACTICAL PYTORCH ORDER", body: "A normal mini-batch iteration clears old gradients, computes predictions, calculates the loss, calls backward, and steps the optimizer. Some models also clip gradients to limit extreme values. Weight decay adds a regularizing preference for smaller parameters; its exact interaction with adaptive optimizers depends on the optimizer implementation.", points: ["Set a seed when you need a repeatable teaching demo.", "Log training and validation metrics separately.", "Change one training setting at a time so you can interpret the result."] }
    ],
    formula: "v_t=\\beta v_{t-1}+g_t \\qquad w_{t+1}=w_t-\\eta v_t",
    formulaExplanation: "g\u209C is the current gradient, \u03B2 controls how much momentum is retained, and \u03B7 (eta) is the learning rate. Adam adds a second moving average of squared gradients and bias correction.",
    code: 'import torch\n\n# Compare common optimizers on the same one-dimensional bowl\noptimizers = {\n    "SGD": lambda parameter: torch.optim.SGD([parameter], lr=0.1),\n    "Momentum": lambda parameter: torch.optim.SGD(\n        [parameter], lr=0.1, momentum=0.9\n    ),\n    "RMSprop": lambda parameter: torch.optim.RMSprop([parameter], lr=0.05),\n    "Adam": lambda parameter: torch.optim.Adam([parameter], lr=0.1),\n}\n\nfor name, make_optimizer in optimizers.items():\n    weight = torch.nn.Parameter(torch.tensor(-2.0))\n    optimizer = make_optimizer(weight)\n\n    for _ in range(80):\n        optimizer.zero_grad()\n        loss = (weight - 3.0) ** 2  # minimum is at weight=3\n        loss.backward()\n        optimizer.step()\n\n    print(f"{name}: weight={weight.item():.3f}")',
    codeOutput: "SGD: weight=3.000\nMomentum: weight=2.946\nRMSprop: weight=2.843\nAdam: weight=2.944",
    codeExplanation: "Each optimizer receives a fresh scalar parameter initialized to \u22122 and sees the same differentiable loss. The loop uses the standard clear, compute, backward, step order. Their paths and convergence speeds differ because their state and step rules differ. The target minimum is 3; on a real model, compare validation results as well as training loss.",
    practice: [
      { prompt: "Two consecutive gradients point in nearly the same direction. Which optimizer idea can build speed in that direction?", answer: "Momentum.", solution: "Momentum accumulates a moving average of recent gradients. Consistent directions reinforce one another; changing directions partially cancel." },
      { prompt: "Training loss oscillates and sometimes grows sharply after each update. What is one setting to inspect first?", answer: "The learning rate may be too large.", solution: "A large step can jump over a low-loss region and land where the slope points back. Inspect the loss scale and try a smaller learning rate. Also check for invalid inputs, exploding gradients, and loss mistakes." },
      { prompt: "Does Adam remove the need to choose a learning rate?", answer: "No.", solution: "Adam adapts step sizes using gradient history, but the global learning rate still scales those steps. It must be chosen and monitored; an extreme value can still cause slow or unstable training." }
    ],
    quiz: { question: "What does momentum add to a gradient update?", options: ["Memory of recent gradient direction", "New labels for the dataset", "A guarantee of the global minimum"], answer: 0, explanation: "Momentum maintains a moving direction from recent gradients. It does not add labels or guarantee global optimality." },
    takeaways: ["Gradients describe local loss change; optimizers decide how to use them.", "Momentum smooths updates, RMSprop scales by recent gradient magnitudes, and Adam combines both ideas.", "Learning rate and validation behavior still need attention."],
    interview: { question: "Why might Adam be chosen over plain SGD, and what is the caveat?", answer: "Adam adapts parameter-wise step sizes and often converges quickly with little initial tuning. It is not always best for final generalization, and its learning rate, weight decay, and validation behavior still require care." },
    related: ["backpropagation", "convolutional-neural-networks"],
    miniProject: { title: "Compare optimizer paths", objective: "See how update rules approach the same minimum at different speeds.", tasks: ["Run the scalar example and log loss every five updates.", "Plot each optimizer\u2019s loss history on the same axes.", "Repeat with a learning rate ten times larger and observe instability.", "Write which optimizer reached the useful region fastest and whether that mattered on validation data."], extension: "Add gradient clipping to a two-parameter toy objective and compare with unclipped training." }
  },
  {
    number: "14",
    slug: "convolutional-neural-networks",
    title: "CNNs: learning local patterns in images",
    description: "Convolutions reuse small filters across an image so a network can detect edges and patterns wherever they appear.",
    module: "Deep learning",
    difficulty: "Intermediate",
    estimatedMinutes: 22,
    prerequisites: ["forward-propagation", "activation-functions-and-losses"],
    objectives: ["Explain a kernel, feature map, stride, and padding.", "Calculate a tiny convolution by hand.", "Read image tensor shapes in PyTorch."],
    analogy: "Imagine sliding the same small stencil across a large picture. Each position asks the same question, such as \u201Cis there a vertical edge here?\u201D Reusing the stencil means the network can recognize a pattern in different parts of the image without learning a separate detector for every location.",
    intro: "A convolutional neural network (CNN) is designed for grid-like data such as images. A convolution applies learned small filters locally and shares each filter across positions. Early layers can respond to simple local patterns; later layers combine them into larger patterns. The filter values are learned from examples, not hand-picked in a trained CNN.",
    sections: [
      { title: "Pixels are arranged in tensors", kicker: "CHANNELS, HEIGHT, WIDTH", body: "A grayscale image has one channel; an RGB image has three. A PyTorch image batch is usually shaped [batch, channels, height, width]. Pixel values are often scaled to a convenient range. Keeping the channel dimension explicit helps the convolution know what it receives.", example: "A batch of 32 color images, each 64\xD764 pixels, has shape [32,3,64,64]. A `Conv2d(3,16,3)` layer accepts 3 channels and produces 16 learned feature maps." },
      { title: "A filter builds a feature map", kicker: "SLIDE, MULTIPLY, SUM", body: "At one location, multiply each filter value by the matching image value and add the results (plus an optional bias). Slide the filter across the image and repeat. PyTorch calls this operation convolution, though its standard implementation is technically cross-correlation: it does not flip the kernel. Because the filter weights are learned, that distinction does not limit what the layer can learn.", example: "For image patch [[1,2],[4,5]] and kernel [[1,0],[0,\u22121]], the output is 1(1)+2(0)+4(0)+5(\u22121)=\u22124. Sliding that kernel over a 3\xD73 image produces a 2\xD72 feature map when stride is 1 and no padding is used." },
      { title: "Stride, padding, and pooling", kicker: "CONTROL SPATIAL SIZE", body: "Stride is how many pixels the filter moves each step. Padding adds a border, often zeros, so edge pixels are used more symmetrically or output size is preserved. Pooling summarizes a local neighborhood, commonly by taking its maximum; it reduces spatial size but discards exact location detail. Modern architectures may use strided convolutions instead of pooling.", points: ["With no padding, kernel 2, and stride 1, a 3\xD73 input produces a 2\xD72 output.", "More output channels mean more learned filters, not more image color channels.", "ReLU or another activation is commonly applied after a convolution."] },
      { title: "A CNN is more than convolution", kicker: "FEATURES TO DECISIONS", body: "A basic image classifier stacks convolutions and activations, reduces spatial size, then maps features to class logits. Cross-entropy can train those logits against labels. Data augmentation can make training examples vary in realistic ways, but transformations must preserve the label and match the intended use.", kind: "math" }
    ],
    formula: "H_{out}=\\left\\lfloor\\frac{H+2P-K}{S}\\right\\rfloor+1",
    formulaExplanation: "H is input height, K kernel size, P padding on each side, and S stride. Width follows the same formula. For H=3, K=2, P=0, S=1, output height is 2.",
    code: 'import torch\nfrom torch import nn\n\n# One grayscale 3x3 image: [batch, channels, height, width]\nimage = torch.tensor([[[[1.0, 2.0, 3.0],\n                        [4.0, 5.0, 6.0],\n                        [7.0, 8.0, 9.0]]]])\n\n# One 2x2 filter, no bias, stride 1, no padding\nconv = nn.Conv2d(1, 1, kernel_size=2, bias=False)\nwith torch.no_grad():\n    conv.weight.copy_(torch.tensor([[[[1.0, 0.0],\n                                      [0.0, -1.0]]]]))\n\nfeature_map = conv(image)\nprint("output shape:", tuple(feature_map.shape))\nprint("feature map:", feature_map[0, 0].tolist())',
    codeOutput: "output shape: (1, 1, 2, 2)\nfeature map: [[-4.0, -4.0], [-4.0, -4.0]]",
    codeExplanation: "The input includes batch and channel dimensions, even though there is only one image and one channel. `Conv2d` expects weights shaped [out_channels, in_channels, kernel_height, kernel_width], so the copied kernel is wrapped in two additional dimensions. The 2\xD72 kernel visits four positions; with stride 1 and no padding, the output is 2\xD72.",
    practice: [
      { prompt: "What is the output shape of a 3\xD73 image with a 2\xD72 kernel, stride 1, and no padding?", answer: "2\xD72.", solution: "Use floor((H+2P\u2212K)/S)+1 = floor((3+0\u22122)/1)+1 = 2. Apply the same calculation to width." },
      { prompt: "An image batch has shape [8,3,32,32]. What do the first two numbers mean?", answer: "Eight images, each with three color channels.", solution: "The conventional PyTorch image order is [batch, channels, height, width]. Therefore 8 is batch size and 3 is the RGB channel count." },
      { prompt: "Why can a shared filter recognize an edge at different image locations?", answer: "The same learned weights are applied at every spatial position.", solution: "The filter slides across the grid. It asks the same local question everywhere, so the learned edge response is not tied to a single absolute coordinate." }
    ],
    quiz: { question: "What does a convolutional filter share across an image?", options: ["The same learned kernel weights at different spatial positions", "The same class label for every pixel", "The input image height"], answer: 0, explanation: "Weight sharing applies one learned filter at many positions. It lets the network detect a local pattern wherever it appears." },
    takeaways: ["Convolution applies small learned filters locally and reuses them across space.", "Stride and padding control output dimensions.", "CNNs build larger visual features by composing local feature maps."],
    interview: { question: "Why are CNNs often effective for images?", answer: "They exploit local spatial structure and share filters across locations, reducing parameters compared with fully connected layers on raw pixels while learning reusable visual features." },
    related: ["optimizers", "recurrent-neural-networks", "transformers"],
    miniProject: { title: "Inspect a tiny image filter", objective: "See how a local pattern detector responds as it slides over an image.", tasks: ["Run the fixed 3\xD73 image and 2\xD72 edge-like kernel.", "Change one kernel value and predict which output positions change.", "Increase stride to 2 and calculate the resulting shape.", "Build a small `Conv2d \u2192 ReLU \u2192 MaxPool2d` stack and print every tensor shape."], extension: "Train a small CNN on a labeled image dataset and compare validation accuracy with a fully connected baseline." }
  },
  {
    number: "15",
    slug: "recurrent-neural-networks",
    title: "RNNs and LSTMs: carrying context through a sequence",
    description: "Sequence models reuse a hidden state from one time step to the next; gated variants learn what to remember and forget.",
    module: "Deep learning",
    difficulty: "Intermediate",
    estimatedMinutes: 23,
    prerequisites: ["forward-propagation", "backpropagation"],
    objectives: ["Trace a recurrent hidden-state update.", "Distinguish RNN, LSTM, and GRU at a high level.", "Understand sequence tensor shapes and vanishing gradients."],
    analogy: "Reading a sentence means carrying a small notebook of useful context as each word arrives. An RNN updates that notebook every step. An LSTM adds gates that decide what to write, keep, and erase, rather than forcing every detail to remain equally important.",
    intro: "Sequential data has an order: words, sensor readings, or daily measurements. A recurrent neural network (RNN) applies the same learned update at each time step and passes a hidden state forward. This shares parameters across time and lets the current output depend on earlier inputs. It does not automatically remember everything; long sequences can make training difficult.",
    sections: [
      { title: "One state update at a time", kicker: "INPUT PLUS MEMORY", body: "At time t, a simple RNN combines the current input x\u209C with the previous hidden state h\u209C\u208B\u2081, applies a nonlinearity, and produces h\u209C. The same weights are reused for every t. A prediction can be made from each state or from the final state, depending on the task.", example: "For h\u209C=tanh(x\u209C+0.5h\u209C\u208B\u2081), start with h\u2080=0 and inputs x\u2081=1, x\u2082=2. Then h\u2081=tanh(1)\u22480.762. Next h\u2082=tanh(2+0.5\xD70.762)=tanh(2.381)\u22480.983. The second step includes both the new input and a summary of the first." },
      { title: "Why simple recurrence forgets", kicker: "GRADIENTS TRAVEL THROUGH TIME", body: "Training an RNN unfolds the repeated computation across time steps. Backpropagation through time applies the chain rule across those steps. Repeated multiplication by derivatives smaller than one can make early gradients vanish; repeated factors larger than one can make them explode. Then early inputs receive weak or unstable learning signals.", points: ["Gradient clipping can limit extreme gradients.", "Shorter sequences or careful initialization may help in some tasks.", "LSTM and GRU gates provide paths that can preserve useful information longer."] },
      { title: "LSTM and GRU gates", kicker: "LEARNED MEMORY CONTROL", body: "An LSTM keeps a cell state and uses input, forget, and output gates to regulate writing, retaining, and exposing information. A GRU uses a simpler combination of update and reset gates. Gates are learned functions of the current input and prior state; they are not hand-coded \u201Cunderstanding.\u201D These models can help with longer dependencies but are sequential across time and can be slower to parallelize than attention.", kind: "math" },
      { title: "Shapes and sequence tasks", kicker: "BATCH, TIME, FEATURES", body: "With `batch_first=True`, PyTorch recurrent layers take [batch, sequence_length, input_size]. They return an output for each time step and a final hidden state. For next-step forecasting, split data in time order; random splitting can let future patterns leak into training. For text, padding and masks are needed when sequence lengths differ.", example: "A batch of 16 sequences, each 5 time steps long with 1 input feature, has shape [16,5,1]. An RNN with hidden size 4 returns per-step outputs [16,5,4]." }
    ],
    formula: "h_t=\\tanh(W_xx_t+W_hh_{t-1}+b)",
    formulaExplanation: "x\u209C is the current input, h\u209C\u208B\u2081 is the previous hidden state, and the same weights W\u2093 and W\u2095 are reused at every time step.",
    code: 'import torch\nfrom torch import nn\n\n# A batch of one sequence: [batch, time, input_features]\nsequence = torch.tensor([[[1.0], [0.0], [1.0], [1.0], [0.0]]])\n\n# Compare a basic RNN with an LSTM using the same input shape\nrnn = nn.RNN(input_size=1, hidden_size=4, batch_first=True)\nlstm = nn.LSTM(input_size=1, hidden_size=4, batch_first=True)\n\nrnn_outputs, rnn_last_state = rnn(sequence)\nlstm_outputs, (lstm_last_hidden, lstm_last_cell) = lstm(sequence)\nprint("RNN outputs:", tuple(rnn_outputs.shape))\nprint("RNN final state:", tuple(rnn_last_state.shape))\nprint("LSTM outputs:", tuple(lstm_outputs.shape))\nprint("LSTM cell state:", tuple(lstm_last_cell.shape))',
    codeOutput: "RNN outputs: (1, 5, 4)\nRNN final state: (1, 1, 4)\nLSTM outputs: (1, 5, 4)\nLSTM cell state: (1, 1, 4)",
    codeExplanation: "`batch_first=True` means batch then time then feature. Each layer returns a hidden output for all five time steps. The basic RNN final state is [layers, batch, hidden]. The LSTM returns both a hidden state and a cell state with the same [layers, batch, hidden] shape. These modules have random initial weights and are not trained by this shape demonstration.",
    practice: [
      { prompt: "For h\u209C=tanh(x\u209C+0.5h\u209C\u208B\u2081), h\u2080=0, and x\u2081=1, estimate h\u2081.", answer: "Approximately 0.762.", solution: "Substitute h\u2080=0: h\u2081=tanh(1+0)=tanh(1)\u22480.7616." },
      { prompt: "With `batch_first=True`, what does shape [16,5,1] mean?", answer: "16 sequences, 5 time steps each, 1 feature per step.", solution: "The axis order is [batch, time, features]. The first dimension counts separate sequences, not time steps." },
      { prompt: "Why can a plain RNN struggle to learn a dependency far back in a long sequence?", answer: "Repeated chain-rule multiplication can make gradients vanish or explode.", solution: "Backpropagation through time multiplies local derivatives along the recurrent path. If many factors have magnitude below one, the product can become tiny; if above one, it can grow rapidly. LSTM/GRU gates and gradient clipping address related difficulties." }
    ],
    quiz: { question: "What is passed from one RNN time step to the next?", options: ["A hidden state that summarizes prior computation", "A new copy of the model weights for every word", "The final class label only"], answer: 0, explanation: "The hidden state carries information forward while the same recurrent weights are reused at each time step." },
    takeaways: ["RNNs reuse weights and pass a hidden state through ordered inputs.", "LSTM/GRU gates learn how to update and preserve state.", "Sequence order affects data splitting and tensor interpretation."],
    interview: { question: "Why might you choose an LSTM over a simple RNN?", answer: "LSTM gates and a cell state provide a mechanism for retaining useful information across longer intervals and can reduce vanishing-gradient problems, though they remain sequential and are not always the best choice." },
    related: ["convolutional-neural-networks", "attention-mechanism"],
    miniProject: { title: "Forecast the next value in a sequence", objective: "Train a small recurrent model to predict the next step from earlier values.", tasks: ["Generate a deterministic sine-wave sequence and create sliding input/target windows.", "Split windows by time before training.", "Train an RNN and an LSTM with a small regression head.", "Plot predictions against the held-out future segment."], extension: "Compare forecasting error after changing the lookback window; keep the test period untouched." }
  },
  {
    number: "16",
    slug: "attention-mechanism",
    title: "Attention: deciding which context matters",
    description: "Attention lets each token retrieve a weighted mixture of information from other tokens instead of compressing everything into one state.",
    module: "Deep learning",
    difficulty: "Intermediate",
    estimatedMinutes: 22,
    prerequisites: ["recurrent-neural-networks", "forward-propagation"],
    objectives: ["Explain query, key, and value with a retrieval analogy.", "Calculate a two-token scaled dot-product attention example.", "Explain why multi-head attention uses several learned views."],
    analogy: "Imagine searching a library. Your query describes what you need, each book\u2019s key describes what it contains, and its value is the information you can retrieve. Attention compares a query with keys, turns the matches into weights, and blends the corresponding values.",
    intro: "Attention is a data-dependent way to combine information. Each position creates a query, key, and value vector. Similarity between a query and keys gives scores; softmax turns them into weights; the weighted values form a context vector. Unlike a plain RNN, self-attention can connect distant positions directly, though its full score matrix grows quadratically with sequence length.",
    sections: [
      { title: "Query, key, and value", kicker: "A RETRIEVAL ANALOGY", body: "A query asks what information is useful now. Keys describe what each available position can match. Values carry the content to mix. In self-attention, all three are learned projections of the same token representations. The roles are different even though the source is the same.", points: ["Query\u2013key similarity decides relevance.", "Softmax converts scores into nonnegative weights that sum to one.", "The output is a weighted sum of value vectors."] },
      { title: "Work a two-token example", kicker: "SCORES BECOME WEIGHTS", body: "Use scalar queries Q=[1,0], keys K=[1,2], and values V=[10,20]. With key dimension d\u2096=1, the scale is \u221A1=1. The first query scores keys [1,2], whose softmax is approximately [0.269,0.731]. Its output is 0.269(10)+0.731(20)\u224817.31. The second query scores [0,0], so weights are [0.5,0.5] and output is 15.", example: "Scaling by 1/\u221Ad\u2096 keeps dot products from growing too large as vector dimension increases. Without scaling, softmax can become extremely peaked, which may give weak gradients." },
      { title: "Many heads, several learned views", kicker: "PARALLEL RELATIONSHIPS", body: "Multi-head attention performs several attention calculations with separate learned projections. One head may focus on nearby syntax; another may connect repeated names. These are possibilities, not guaranteed human-readable roles. Head outputs are concatenated and projected back into the model dimension.", kind: "math" },
      { title: "Masks control what can be seen", kicker: "PADDING AND CAUSAL RULES", body: "A padding mask prevents attention to fake positions inserted to make sequences the same length. A causal mask prevents a position from using later tokens during next-token training. Encoder-style models often let a token attend both directions; decoder-style language models use causal attention so training matches generation.", points: ["Attention weights describe routing inside a model, not an explanation by themselves.", "Self-attention needs position information because dot products alone do not encode order.", "Attention over length n produces n\xD7n pairwise scores per head."] }
    ],
    formula: "\\operatorname{Attention}(Q,K,V)=\\operatorname{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V",
    formulaExplanation: "Q contains queries, K keys, V values, and d\u2096 is the key-vector width. The matrix before V contains one attention distribution per query position.",
    code: 'import math\nimport torch\n\n# Two query positions, two keys, and one value per key\nqueries = torch.tensor([[1.0], [0.0]])\nkeys = torch.tensor([[1.0], [2.0]])\nvalues = torch.tensor([[10.0], [20.0]])\n\n# Score each query against each key, then normalize over keys\nkey_width = keys.shape[-1]\nscores = queries @ keys.T / math.sqrt(key_width)\nweights = torch.softmax(scores, dim=-1)\ncontext = weights @ values\nprint("attention weights:", [[round(w, 3) for w in row] for row in weights.tolist()])\nprint("context:", [round(c, 2) for c in context.squeeze(-1).tolist()])',
    codeOutput: "attention weights: [[0.269, 0.731], [0.5, 0.5]]\ncontext: [17.31, 15.0]",
    codeExplanation: "`queries @ keys.T` creates one score per query-key pair. The scaling uses the last dimension of keys. Softmax runs across keys (`dim=-1`), so each row sums to one. Multiplying by values forms a weighted context for each query. Real models learn vector-valued Q/K/V projections and use multiple heads.",
    practice: [
      { prompt: "For scores [0,0], what weights does softmax assign?", answer: "[0.5,0.5].", solution: "The exponentials are both e\u2070=1. Their sum is 2, so each normalized weight is 1/2." },
      { prompt: "With weights [0.25,0.75] and values [4,12], calculate the context.", answer: "10.", solution: "Take the weighted sum: 0.25(4)+0.75(12)=1+9=10." },
      { prompt: "Why does a decoder use a causal mask during next-token training?", answer: "So a position cannot use future tokens that would be unavailable when generating.", solution: "At inference, the model only has the prefix already generated. If training allowed a token to attend to later target tokens, it could exploit information unavailable at inference. The causal mask makes the training information flow match generation." }
    ],
    quiz: { question: "In attention, what determines how strongly one value contributes to an output?", options: ["The query\u2013key scores after softmax", "The value\u2019s position in memory only", "A fixed equal average in every case"], answer: 0, explanation: "Each query scores keys, softmax creates weights, and those weights determine the mixture of values. Attention is input-dependent, not necessarily uniform." },
    takeaways: ["Queries find relevant keys; their weights mix the corresponding values.", "Scaling and masking affect stable, valid information flow.", "Multi-head attention learns several parallel projections of relationships."],
    interview: { question: "Why divide attention scores by the square root of key dimension?", answer: "Dot-product magnitudes tend to grow with dimension. Scaling helps prevent softmax from becoming overly saturated, which can weaken gradients." },
    related: ["recurrent-neural-networks", "transformers"],
    miniProject: { title: "Build and inspect a tiny attention layer", objective: "Calculate attention weights and context vectors for a short sequence.", tasks: ["Create three 2-D query, key, and value vectors.", "Compute scaled scores and softmax weights by hand for one query.", "Run the PyTorch matrix operations and compare the result.", "Add a causal mask and describe which score entries are blocked."], extension: "Use `nn.MultiheadAttention` and compare output shapes for one head versus multiple heads." }
  },
  {
    number: "17",
    slug: "transformers",
    title: "Transformers: building a language model from attention",
    description: "Combine token and position embeddings, attention, feed-forward layers, residual paths, and normalization into a stack that predicts tokens.",
    module: "Deep learning",
    difficulty: "Intermediate",
    estimatedMinutes: 26,
    prerequisites: ["attention-mechanism", "activation-functions-and-losses"],
    objectives: ["Name the main parts of a transformer block.", "Explain why token order needs positional information.", "Trace a prompt through a small causal transformer to next-token logits."],
    analogy: "A transformer is a team of reading passes over a page. Each token first gathers relevant context from other allowed tokens; then a small private workshop refines its representation. Residual paths let each pass add a correction instead of replacing everything, and normalization keeps the numerical stream manageable.",
    intro: "A transformer is a neural-network architecture built around attention. A language model starts with token IDs, turns them into vectors, adds position information, and repeatedly applies transformer blocks. A causal decoder masks future positions and produces logits for the next token at each position. It predicts distributions over tokens; it does not retrieve truth from a database or guarantee factual answers.",
    sections: [
      { title: "Tokens need content and position", kicker: "EMBEDDINGS + ORDER", body: "A tokenizer maps text into discrete token IDs. An embedding table maps each ID to a learned vector. Self-attention by itself does not know whether one token came before another, so the model also needs positional information. Learned position embeddings and sinusoidal encodings are two approaches; modern architectures may use relative or rotary position schemes.", example: "The same token vector for \u201Cdog\u201D can mean different things in \u201Cdog bites person\u201D and \u201Cperson bites dog.\u201D Position information lets the network distinguish those orders before predicting." },
      { title: "Inside a transformer block", kicker: "ATTEND, ADD, NORMALIZE, TRANSFORM", body: "A common block has multi-head self-attention, a residual connection, normalization, a position-wise feed-forward network, and another residual/normalization step. The feed-forward layer expands and projects each token representation independently; attention is where positions mix information. Exact ordering varies: pre-norm and post-norm blocks are both used.", points: ["Residual: add a block\u2019s input to its transformed output.", "Layer normalization normalizes features within a token representation.", "The feed-forward network applies learned transformations to each position.", "Stacking blocks lets later layers use representations built by earlier layers."] },
      { title: "Causal language modeling", kicker: "PREDICT THE NEXT TOKEN", body: "During training, input tokens are shifted so the model predicts the next token at every position. A causal mask blocks access to future positions. Cross-entropy compares each position\u2019s logits with its next-token target. During generation, the model samples or selects a token and appends it to the context before predicting again.", example: "Given \u201CThe sky is\u201D, a model produces a probability distribution for the next token. It might assign probability to \u201Cblue,\u201D \u201Cclear,\u201D or many other continuations. The highest-probability token is not automatically the only reasonable continuation." },
      { title: "Encoder, decoder, and encoder\u2013decoder", kicker: "ARCHITECTURE FOLLOWS THE TASK", body: "Encoder-only transformers can use bidirectional context and are often used for representations or classification. Decoder-only transformers use causal masks and generate continuations. Encoder\u2013decoder models encode an input sequence and let a decoder attend to it while producing an output sequence, which fits tasks such as translation. These are common patterns, not rigid limits on every model.", kind: "math" },
      { title: "Limits and practical choices", kicker: "A MODEL IS NOT A GUARANTEE", body: "Attention compute and memory grow roughly with the square of sequence length in standard full attention. Long prompts are therefore costly. Language models can produce fluent errors, inherit data biases, and be sensitive to tokenization and prompt context. Evaluation, retrieval, tools, and human review can improve workflows but do not make every answer reliable.", points: ["Token count is not the same as word count.", "A next-token probability is not a calibrated measure of truth.", "Model size and fluent output do not replace task-specific evaluation."] }
    ],
    formula: "X_0=E_{token}(tokens)+E_{position}(positions) \\qquad p(x_{t+1}|x_{\\le t})=\\operatorname{softmax}(W_{out}h_t)",
    formulaExplanation: "Token and position embeddings form the first representation. After causal transformer blocks, hidden state h\u209C is projected to vocabulary logits and softmax gives next-token probabilities.",
    code: 'import torch\nfrom torch import nn\n\n# Token IDs for one short, already-tokenized sequence\ntokens = torch.tensor([[1, 5, 3, 2]])\nbatch_size, length = tokens.shape\nvocabulary_size = 20\nmodel_width = 8\n\n# Add learned token vectors and learned position vectors\ntoken_embedding = nn.Embedding(vocabulary_size, model_width)\nposition_embedding = nn.Embedding(16, model_width)\npositions = torch.arange(length).unsqueeze(0)\nx = token_embedding(tokens) + position_embedding(positions)\n\n# A causal transformer stack: True entries block attention to future tokens\nblock = nn.TransformerEncoderLayer(\n    d_model=model_width, nhead=2, dim_feedforward=16, batch_first=True\n)\ntransformer = nn.TransformerEncoder(block, num_layers=2)\ncausal_mask = torch.triu(\n    torch.ones(length, length, dtype=torch.bool), diagonal=1\n)\nhidden = transformer(x, mask=causal_mask)\nnext_token_logits = nn.Linear(model_width, vocabulary_size)(hidden)\nprint("hidden:", tuple(hidden.shape))\nprint("next-token logits:", tuple(next_token_logits.shape))',
    codeOutput: "hidden: (1, 4, 8)\nnext-token logits: (1, 4, 20)",
    codeExplanation: "The embedding tables turn token IDs and position indices into vectors, then add them. `batch_first=True` keeps tensors in [batch, sequence, features] order. The upper-triangular Boolean mask marks future positions as unavailable. Two encoder layers with that causal mask form a small decoder-like stack. The final linear layer maps each position to one logit per vocabulary item. This demonstrates forward shapes only; it is not trained and is not a production language model.",
    practice: [
      { prompt: "Why add position information if attention already compares every token with every other token?", answer: "Without position information, the model has no signal for token order.", solution: "Self-attention compares vector content. If the input representations do not encode position, permuting tokens also permutes the outputs without telling the model which token was first. Position signals let it learn order-sensitive patterns." },
      { prompt: "A causal mask is applied to a sequence of length 4. Which positions may token index 2 attend to?", answer: "Indices 0, 1, and 2, but not 3.", solution: "Causal attention allows the current position and earlier context but blocks future positions. With zero-based indexing, token 2 cannot see token 3." },
      { prompt: "What shape do logits have for batch 2, length 5, vocabulary size 100?", answer: "[2,5,100].", solution: "There is one vocabulary score vector at each sequence position for each batch item, so the dimensions are [batch, sequence length, vocabulary]." }
    ],
    quiz: { question: "What does a causal mask enforce in a decoder language model?", options: ["A token cannot attend to later tokens", "Every token must have equal probability", "The embedding dimension shrinks at every layer"], answer: 0, explanation: "The mask blocks future positions so next-token training uses only information available at generation time." },
    takeaways: ["Transformers combine content and position representations in repeated blocks.", "Causal masks make decoder training consistent with left-to-right generation.", "Language-model logits are next-token scores, not guarantees of truth."],
    interview: { question: "What are the main components of a transformer block?", answer: "A common block contains multi-head self-attention, a feed-forward network, residual connections, and normalization. Exact ordering and positional method vary by architecture." },
    related: ["attention-mechanism", "activation-functions-and-losses"],
    miniProject: { title: "Trace a tiny next-token transformer", objective: "Follow token IDs to vocabulary logits and identify where causal information flow is enforced.", tasks: ["Run the shape example and label each tensor dimension.", "Inspect the causal mask for sequence length 4.", "Calculate cross-entropy against a next-token target at each position.", "Change the mask to bidirectional and explain why that no longer simulates autoregressive generation."], extension: "Train a tiny decoder-only model on a short public-domain character corpus and compare its validation loss with a unigram baseline." }
  }
];

// src/content/lessonExtras.ts
var crashCourse = { title: "Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course", note: "Google\u2019s free introduction, with short exercises." };
var d2l = (title, path, note) => ({ title, url: `https://d2l.ai/${path}`, note });
var sklearn = (title, path, note) => ({ title, url: `https://scikit-learn.org/stable/${path}`, note });
var arxiv = (title, id, note) => ({ title, url: `https://arxiv.org/abs/${id}`, note });
var lessonExtras = {
  "what-is-machine-learning": {
    commonMistakes: [
      { mistake: "Reaching for ML when a simple rule would do.", fix: "If you can write the rule and it stays stable, write it. It is cheaper to run, easier to test, and simpler to explain. Use ML when the rules are too many or keep changing." },
      { mistake: "Judging a model by how it does on its training examples.", fix: "A model can memorize what it has seen. Always evaluate on examples held back from training." },
      { mistake: "Treating a prediction as a fact.", fix: "Outputs are estimates shaped by the training data. Decide what happens when the model is wrong before you rely on it." }
    ],
    furtherReading: [crashCourse, { title: "Rules of Machine Learning", url: "https://developers.google.com/machine-learning/guides/rules-of-ml", note: "Practical advice, starting with whether you need ML at all." }]
  },
  "supervised-vs-unsupervised": {
    commonMistakes: [
      { mistake: "Naming clusters and treating the names as discovered truth.", fix: "Cluster ids are arbitrary. Inspect the members, test stability across runs, and check whether the groups help a real decision." },
      { mistake: "Clustering without scaling features.", fix: "Distance-based methods let large-range features dominate. Standardize first unless the raw scale is meaningful." },
      { mistake: "Assuming supervised is always better because it has labels.", fix: "Labels can be expensive, noisy, or biased. Check how the labels were produced before trusting what they teach." }
    ],
    furtherReading: [sklearn("Supervised learning guide", "supervised_learning.html", "A map of supervised methods with examples."), sklearn("Unsupervised learning guide", "unsupervised_learning.html", "Clustering, decomposition, and density estimation.")]
  },
  "train-validation-test": {
    commonMistakes: [
      { mistake: "Checking the test score repeatedly while tuning.", fix: "Each look makes the estimate more optimistic. Tune on validation data, and open the test set once." },
      { mistake: "Fitting preprocessing before splitting.", fix: "Split first, then fit scalers and imputers inside a pipeline so they only see training rows." },
      { mistake: "Random splits on grouped or time-ordered data.", fix: "Keep one person\u2019s records on one side using `GroupKFold`, and use `TimeSeriesSplit` when predicting the future." }
    ],
    furtherReading: [sklearn("Cross-validation", "modules/cross_validation.html", "Splitters for groups, time series, and stratification."), sklearn("Common pitfalls and recommended practices", "common_pitfalls.html", "Worked examples of leakage and how to avoid it.")]
  },
  "linear-regression": {
    commonMistakes: [
      { mistake: "Reading coefficients as causal effects.", fix: "A coefficient describes association given the other features. Causal claims need a design that supports them." },
      { mistake: "Comparing coefficients across unscaled features.", fix: "A weight depends on its feature\u2019s units. Standardize features before comparing their sizes." },
      { mistake: "Trusting a high R\xB2 without looking at residuals.", fix: "Plot residuals against predictions. A curve or a fan shape means the model is missing structure, whatever the score says." }
    ],
    furtherReading: [sklearn("Linear models", "modules/linear_model.html", "Ordinary least squares, Ridge, Lasso, and logistic regression."), crashCourse]
  },
  "logistic-regression": {
    commonMistakes: [
      { mistake: "Treating predicted probabilities as calibrated by default.", fix: "Regularization and imbalance can distort probabilities. Check with a calibration curve before acting on the exact values." },
      { mistake: "Accepting the 0.5 threshold automatically.", fix: "Choose the threshold on validation data, based on what each kind of mistake costs." },
      { mistake: "Forgetting that the regularization default affects your weights.", fix: "scikit-learn applies L2 by default. Scale features and tune `C`, especially when you plan to interpret the coefficients." }
    ],
    furtherReading: [sklearn("Logistic regression in scikit-learn", "modules/linear_model.html#logistic-regression", "Solvers, penalties, and multiclass options."), sklearn("Probability calibration", "modules/calibration.html", "How to check and correct predicted probabilities.")]
  },
  "decision-trees-and-ensembles": {
    commonMistakes: [
      { mistake: "Letting a single tree grow without limits.", fix: "Set `max_depth` or `min_samples_leaf` and tune them with cross-validation." },
      { mistake: "Trusting impurity-based feature importance.", fix: "It favors high-cardinality features and is computed on training data. Prefer permutation importance on held-out data." },
      { mistake: "Expecting trees to extrapolate.", fix: "Tree predictions stay within the range of training targets. For trending data, add features that capture the trend or use a linear component." }
    ],
    furtherReading: [sklearn("Decision trees", "modules/tree.html", "How they work, with practical tips."), sklearn("Ensemble methods", "modules/ensemble.html", "Random forests, gradient boosting, and histogram-based boosting."), { title: "Introduction to Boosted Trees", url: "https://xgboost.readthedocs.io/en/stable/tutorials/model.html", note: "A clear derivation of the boosting objective." }]
  },
  "feature-engineering-and-pipelines": {
    commonMistakes: [
      { mistake: "Preprocessing the whole dataset, then cross-validating.", fix: "Put every learned step in a `Pipeline` and pass that to `cross_val_score`." },
      { mistake: "Using a feature that is not available at prediction time.", fix: "For every column, ask when it is recorded. Anything recorded after the outcome is leakage." },
      { mistake: "Letting a new category crash production.", fix: 'Use `OneHotEncoder(handle_unknown="ignore")` and test with an unseen value.' }
    ],
    furtherReading: [sklearn("Pipelines and composite estimators", "modules/compose.html", "Pipeline and ColumnTransformer in depth."), sklearn("Preprocessing data", "modules/preprocessing.html", "Scaling, encoding, and transformations.")]
  },
  "gradient-descent": {
    commonMistakes: [
      { mistake: "Blaming the model when the learning rate is the problem.", fix: "Plot the loss. If it rises or oscillates, lower the rate before changing anything else." },
      { mistake: "Skipping feature scaling.", fix: "Very different feature scales create a long, narrow loss surface that converges slowly. Standardize inputs first." },
      { mistake: "Assuming lower training loss means a better model.", fix: "Track validation loss too. Training loss can keep falling while the model gets worse on new data." }
    ],
    furtherReading: [d2l("Optimization Algorithms", "chapter_optimization/index.html", "From gradient descent to modern optimizers, with code."), { title: "Deep Learning, Chapter 8", url: "https://www.deeplearningbook.org/contents/optimization.html", note: "A rigorous treatment from Goodfellow, Bengio, and Courville." }]
  },
  "overfitting-underfitting": {
    commonMistakes: [
      { mistake: "Adding regularization before checking for leakage or duplicates.", fix: "Duplicates across splits and leakage distort the gap. Audit the data first." },
      { mistake: "Reading a small validation set as precise.", fix: "With few examples, a score moves a lot by chance. Use cross-validation or report uncertainty." },
      { mistake: "Calling it overfitting when both errors are high.", fix: "High training and validation error is underfitting. Use more capacity or better features rather than more regularization." }
    ],
    furtherReading: [sklearn("Validation curves and learning curves", "modules/learning_curve.html", "How to plot the diagnostics from this lesson."), crashCourse]
  },
  "evaluation-metrics": {
    commonMistakes: [
      { mistake: "Reporting accuracy on imbalanced data.", fix: "Show the confusion matrix, with precision and recall for the class you care about." },
      { mistake: "Choosing the threshold on the test set.", fix: "Choose it on validation data, then report once on the test set." },
      { mistake: "Optimizing a metric the business does not care about.", fix: "Agree on the costs of each error first, then pick the metric that reflects them." }
    ],
    furtherReading: [sklearn("Metrics and scoring", "modules/model_evaluation.html", "Every common metric, and how to choose one."), { title: "ML Glossary", url: "https://developers.google.com/machine-learning/glossary", note: "Short, precise definitions of the terms in this lesson." }]
  },
  "neural-networks": {
    commonMistakes: [
      { mistake: "Starting with a large network.", fix: "First overfit a tiny batch with a small network. If that fails, you have a bug, and more layers will only hide it." },
      { mistake: "Applying softmax or sigmoid before a loss that expects logits.", fix: "`CrossEntropyLoss` and `BCEWithLogitsLoss` take raw logits. Applying an activation first quietly hurts training." },
      { mistake: "Forgetting `optimizer.zero_grad()`.", fix: "PyTorch accumulates gradients, so clear them at each step or they mix across batches." }
    ],
    furtherReading: [{ title: "Neural Networks and Deep Learning", url: "http://neuralnetworksanddeeplearning.com/", note: "A free book by Michael Nielsen that builds intuition step by step." }, d2l("Dive into Deep Learning", "", "A free, interactive textbook with runnable code.")]
  },
  "perceptrons": {
    commonMistakes: [
      { mistake: "Expecting a single perceptron to solve XOR.", fix: "It only draws one straight boundary. XOR needs a hidden layer or a feature that makes the data separable." },
      { mistake: "Forgetting the bias term.", fix: "Without a bias, the boundary must pass through the origin, which many problems do not allow." },
      { mistake: "Running the perceptron rule on data that is not separable.", fix: "The classic rule never settles in that case. Use a soft output with a differentiable loss instead." }
    ],
    furtherReading: [sklearn("Perceptron in scikit-learn", "modules/linear_model.html#perceptron", "A practical implementation to experiment with."), { title: "Deep Learning, Chapter 6", url: "https://www.deeplearningbook.org/contents/mlp.html", note: "Covers why XOR needs hidden layers." }]
  },
  "activation-functions-and-losses": {
    commonMistakes: [
      { mistake: "Using sigmoid in all hidden layers of a deep network.", fix: "Saturation shrinks gradients. Use ReLU or GELU in hidden layers." },
      { mistake: "Using MSE for classification.", fix: "Cross-entropy gives stronger gradients for confident mistakes and matches a probabilistic output." },
      { mistake: "Passing probabilities to a loss that expects logits.", fix: "Read the loss documentation. Applying softmax twice compresses outputs and slows learning." }
    ],
    furtherReading: [{ title: "PyTorch loss functions", url: "https://pytorch.org/docs/stable/nn.html#loss-functions", note: "Exact inputs each loss expects." }, d2l("Multilayer perceptrons", "chapter_multilayer-perceptrons/index.html", "Activations and losses in working code.")]
  },
  "forward-propagation": {
    commonMistakes: [
      { mistake: "Ignoring tensor shapes until an error appears.", fix: "Write the expected shape of each layer as a comment, and print them on the first batch." },
      { mistake: "Silent broadcasting between mismatched shapes.", fix: "A target of shape (n) against predictions of shape (n, 1) can broadcast to (n, n). Check that they match before computing a loss." },
      { mistake: "Leaving a model in training mode for inference.", fix: "Call `model.eval()` and use `torch.no_grad()` so dropout and BatchNorm behave correctly." }
    ],
    furtherReading: [d2l("Forward and backward propagation", "chapter_multilayer-perceptrons/backprop.html", "A computational-graph view of the pass."), { title: "torch.nn documentation", url: "https://pytorch.org/docs/stable/nn.html", note: "Reference for layers and their expected shapes." }]
  },
  "backpropagation": {
    commonMistakes: [
      { mistake: "Believing backward() updates the weights.", fix: "It only computes gradients. The update happens in `optimizer.step()`." },
      { mistake: "Breaking the graph by accident.", fix: "Calling `.item()`, `.detach()`, or converting to NumPy mid-computation stops gradients from flowing." },
      { mistake: "Ignoring exploding or vanishing gradients.", fix: "Log gradient norms. Use residual connections, normalization, and gradient clipping when needed." }
    ],
    furtherReading: [{ title: "Automatic differentiation with torch.autograd", url: "https://pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html", note: "The official PyTorch tutorial." }, { title: "Neural Networks and Deep Learning, Chapter 2", url: "http://neuralnetworksanddeeplearning.com/chap2.html", note: "A careful, intuitive derivation." }]
  },
  "optimizers": {
    commonMistakes: [
      { mistake: "Comparing optimizers with one shared learning rate.", fix: "Each needs its own rate. Run a short sweep for each before comparing." },
      { mistake: "Combining L2 with Adam and expecting true weight decay.", fix: "Use AdamW, which decouples weight decay from the adaptive update." },
      { mistake: "Never reducing the learning rate.", fix: "A schedule, such as cosine decay, often improves the final result." }
    ],
    furtherReading: [arxiv("Adam: A Method for Stochastic Optimization", "1412.6980", "The original paper."), { title: "torch.optim documentation", url: "https://pytorch.org/docs/stable/optim.html", note: "Optimizers and learning-rate schedulers." }]
  },
  "convolutional-neural-networks": {
    commonMistakes: [
      { mistake: "Getting the flattened size wrong before a linear layer.", fix: "Use `nn.AdaptiveAvgPool2d(1)`, so the size no longer depends on the input resolution." },
      { mistake: "Training from scratch on a small dataset.", fix: "Start with a pretrained backbone. See the transfer learning lesson." },
      { mistake: "Assuming CNNs handle rotation and scale automatically.", fix: "Convolution is translation-equivariant only. Use augmentation to teach other kinds of invariance." }
    ],
    furtherReading: [d2l("Convolutional neural networks", "chapter_convolutional-neural-networks/index.html", "Convolution, padding, and pooling with code."), arxiv("Deep Residual Learning for Image Recognition", "1512.03385", "The ResNet paper.")]
  },
  "recurrent-neural-networks": {
    commonMistakes: [
      { mistake: "Confusing `batch_first` shapes.", fix: "PyTorch RNNs default to (sequence, batch, features). Set `batch_first=True` when your data is arranged that way." },
      { mistake: "Skipping gradient clipping.", fix: "Recurrent gradients can explode. Use `clip_grad_norm_` before the optimizer step." },
      { mistake: "Including padding in the loss.", fix: "Pack sequences or mask padded positions so they do not count." }
    ],
    furtherReading: [d2l("Long short-term memory", "chapter_recurrent-modern/lstm.html", "LSTM gates, with implementations."), { title: "Understanding LSTM Networks", url: "https://colah.github.io/posts/2015-08-Understanding-LSTMs/", note: "A widely loved visual explanation." }]
  },
  "attention-mechanism": {
    commonMistakes: [
      { mistake: "Reading attention weights as a full explanation.", fix: "They show where the model mixed information, not why it made a decision. Validate any interpretation." },
      { mistake: "Forgetting padding masks.", fix: "Without a mask, tokens attend to padding, which degrades results and can change with batch composition." },
      { mistake: "Using the wrong causal mask direction.", fix: "A token must not see future tokens during training. Test this with a small example." }
    ],
    furtherReading: [arxiv("Neural Machine Translation by Jointly Learning to Align and Translate", "1409.0473", "The paper that popularized attention."), d2l("Attention mechanisms and transformers", "chapter_attention-mechanisms-and-transformers/index.html", "From queries and keys to transformers.")]
  },
  "transformers": {
    commonMistakes: [
      { mistake: "Forgetting positional information.", fix: "Attention alone ignores order. Add positional embeddings or encodings." },
      { mistake: "Training a large transformer from scratch.", fix: "For most tasks, start from a pretrained model and fine-tune it." },
      { mistake: "Skipping learning-rate warmup.", fix: "Transformers often benefit from warmup, so that early large gradients do not destabilize training." }
    ],
    furtherReading: [arxiv("Attention Is All You Need", "1706.03762", "The original transformer paper."), { title: "The Illustrated Transformer", url: "https://jalammar.github.io/illustrated-transformer/", note: "A popular visual walkthrough." }]
  },
  "image-data-and-augmentation": {
    commonMistakes: [
      { mistake: "Mixing up RGB and BGR, or channel order.", fix: "OpenCV loads BGR, and some tools put channels last. Plot a tensor just before it enters the model." },
      { mistake: "Augmenting validation data randomly.", fix: "Use only deterministic resizing and normalization for evaluation." },
      { mistake: "Using augmentations that change the label.", fix: "Ask whether a person would give the transformed image the same label. For detection, transform the boxes too." }
    ],
    furtherReading: [d2l("Image augmentation", "chapter_computer-vision/image-augmentation.html", "Effects of each augmentation, with code."), { title: "torchvision transforms", url: "https://pytorch.org/vision/stable/transforms.html", note: "The standard augmentation toolkit in PyTorch." }]
  },
  "transfer-learning": {
    commonMistakes: [
      { mistake: "Fine-tuning with a high learning rate.", fix: "Use something like 1e-5 for pretrained layers and a higher rate for the new head." },
      { mistake: "Using the wrong preprocessing for the weights.", fix: "Apply the resize and normalization the pretrained weights expect; torchvision publishes them with each set of weights." },
      { mistake: "Forgetting BatchNorm statistics while frozen.", fix: "Running statistics still update in training mode, so set frozen BatchNorm layers to `eval()`." }
    ],
    furtherReading: [{ title: "Transfer learning for computer vision", url: "https://pytorch.org/tutorials/beginner/transfer_learning_tutorial.html", note: "The official PyTorch tutorial." }, d2l("Fine-tuning", "chapter_computer-vision/fine-tuning.html", "A worked example with discriminative learning rates.")]
  },
  "object-detection-and-segmentation": {
    commonMistakes: [
      { mistake: "Comparing mAP values computed differently.", fix: "mAP at IoU 0.5 is far easier than COCO\u2019s 0.5:0.95. Always state the definition." },
      { mistake: "Flipping images without flipping boxes or masks.", fix: "Use a library that transforms them together, and draw a few samples to check." },
      { mistake: "Running NMS across all classes at once.", fix: "Run it per class, so that overlapping objects of different classes both survive." }
    ],
    furtherReading: [arxiv("Faster R-CNN", "1506.01497", "A foundational two-stage detector."), arxiv("U-Net", "1505.04597", "The classic segmentation architecture."), d2l("Object detection and bounding boxes", "chapter_computer-vision/bounding-box.html", "A practical introduction, with code.")]
  },
  "tokenization-and-embeddings": {
    commonMistakes: [
      { mistake: "Using a tokenizer that does not match the model.", fix: "Load both from the same checkpoint. A mismatch does not raise an error; results are simply garbage." },
      { mistake: "Estimating cost from word counts.", fix: "Billing and limits use tokens, so count them with the model\u2019s own tokenizer." },
      { mistake: "Comparing embeddings from different models.", fix: "Vectors from different models live in unrelated spaces, so changing models means re-embedding everything." }
    ],
    furtherReading: [{ title: "Hugging Face LLM Course: Tokenizers", url: "https://huggingface.co/learn/llm-course/chapter6/1", note: "How BPE and other algorithms work, with code." }, arxiv("Neural Machine Translation of Rare Words with Subword Units", "1508.07909", "The paper that brought BPE to neural models."), arxiv("Efficient Estimation of Word Representations", "1301.3781", "The word2vec paper.")]
  },
  "how-llms-generate-text": {
    commonMistakes: [
      { mistake: "Treating low temperature as a truth setting.", fix: "It only makes output more predictable. A confident error stays an error; use sources and evaluations." },
      { mistake: "Treating a fluent answer as a correct one.", fix: "Build an evaluation set for your task, and verify citations and numbers." },
      { mistake: "Treating retrieved or user content as trusted.", fix: "It can contain instructions. Separate it from your instructions and limit what the model can do with it." }
    ],
    furtherReading: [arxiv("The Curious Case of Neural Text Degeneration", "1904.09751", "The paper that introduced nucleus (top-p) sampling."), { title: "Generation strategies", url: "https://huggingface.co/docs/transformers/main/en/generation_strategies", note: "Practical decoding options in Hugging Face Transformers." }, arxiv("Language Models are Few-Shot Learners", "2005.14165", "The GPT-3 paper.")]
  },
  "retrieval-augmented-generation": {
    commonMistakes: [
      { mistake: "Tuning the prompt before checking retrieval.", fix: "Log retrieved chunks and measure recall@k first. A prompt cannot fix a missing passage." },
      { mistake: "Using one fixed chunk size for every document type.", fix: "Split on structure, and handle tables and code separately." },
      { mistake: "Forgetting access control.", fix: "Filter by user permission during retrieval, so private documents never reach the prompt." }
    ],
    furtherReading: [arxiv("Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", "2005.11401", "The original RAG paper."), { title: "Ragas documentation", url: "https://docs.ragas.io/", note: "Tools for measuring faithfulness and retrieval quality." }]
  },
  "serving-models": {
    commonMistakes: [
      { mistake: "Loading pickle files from untrusted sources.", fix: "Pickle can run arbitrary code on load. Only load artifacts you produced, or use a safer format such as ONNX or safetensors." },
      { mistake: "Re-implementing preprocessing in the service.", fix: "Ship one pipeline with the model, so training and serving cannot drift apart." },
      { mistake: "Reporting only average latency.", fix: "Track p50, p95, and p99 under realistic load." }
    ],
    furtherReading: [{ title: "FastAPI documentation", url: "https://fastapi.tiangolo.com/", note: "A popular Python framework with built-in validation." }, { title: "ONNX Runtime documentation", url: "https://onnxruntime.ai/docs/", note: "Portable, optimized model inference." }, { title: "Rules of Machine Learning", url: "https://developers.google.com/machine-learning/guides/rules-of-ml", note: "Hard-won production lessons." }]
  },
  "monitoring-and-drift": {
    commonMistakes: [
      { mistake: "Monitoring only service health.", fix: "A model can be up and wrong. Add data, prediction, and outcome checks." },
      { mistake: "Retraining as the first response to any alert.", fix: "Diagnose first. Retraining on a broken pipeline teaches the model the bug." },
      { mistake: "Alerting on every statistically significant change.", fix: "Large samples flag trivial differences. Use effect sizes tied to an action." }
    ],
    furtherReading: [{ title: "Monitoring Distributed Systems", url: "https://sre.google/sre-book/monitoring-distributed-systems/", note: "Google\u2019s SRE chapter on what to alert on." }, { title: "Rules of Machine Learning", url: "https://developers.google.com/machine-learning/guides/rules-of-ml", note: "Includes guidance on monitoring and training-serving skew." }]
  },
  "responsible-ai": {
    commonMistakes: [
      { mistake: "Only reporting overall metrics.", fix: "Break results down by relevant groups, with counts and confidence intervals." },
      { mistake: "Assuming that removing a sensitive column removes bias.", fix: "Audit outcomes by group, and look for proxy features and biased labels." },
      { mistake: "Leaving the fairness choice implicit.", fix: "Write down which criteria you chose, why, who decided, and what the trade-offs are." }
    ],
    furtherReading: [arxiv("Model Cards for Model Reporting", "1810.03993", "The paper behind model documentation."), { title: "Fairness and Machine Learning", url: "https://fairmlbook.org/", note: "A free book on the limits and opportunities of fair ML." }, { title: "NIST AI Risk Management Framework", url: "https://www.nist.gov/itl/ai-risk-management-framework", note: "A widely used framework for managing AI risk." }]
  }
};

// src/content/lessons.ts
var lessonDrafts = [
  {
    number: "01",
    slug: "what-is-machine-learning",
    title: "What is machine learning?",
    description: "A machine learns patterns from examples, then uses those patterns to make a useful guess about something it has not seen before.",
    module: "ML foundations",
    difficulty: "Beginner",
    estimatedMinutes: 9,
    prerequisites: [],
    objectives: ["Distinguish a rule-based program from a learned model.", "Name the role of examples, patterns, and predictions.", "Explain why a model must be checked on new examples."],
    analogy: "Imagine helping a friend learn to spot ripe peaches. You show several peaches, point out color and firmness, and tell them which ones were ripe. They build a sense of the pattern. You do not give them a rule for every peach that could ever grow. A model learns from examples in a similar, much narrower mathematical sense.",
    intro: "Machine learning (ML) is a way to build a program whose behavior is adjusted using data. A person still chooses the task, the examples, the model family, and the measure of success. A learning algorithm uses those choices to adjust model parameters so predictions fit the examples better. We then check whether the learned pattern works on new examples. \u201CLearns\u201D here means parameter adjustment, not awareness or human-like understanding.",
    sections: [
      { title: "Why learn from data?", kicker: "THE PROBLEM IT SOLVES", body: "Some tasks have too many cases, changing inputs, or subtle clues for a person to list useful rules by hand. A spam filter based on one phrase breaks when spammers change the wording. A photo rule based on one pixel pattern breaks when a cat turns sideways. ML offers a way to fit patterns from examples instead. It is useful when examples exist and the pattern repeats often enough to help with future cases.", points: ["An example is one observed case; a collection of cases is a dataset.", "A feature is an input description, such as words in an email.", "A label is the answer we want to predict, such as spam or not spam.", "The fitted model stores adjustable parameters; inference uses them to make a prediction."] },
      { title: "A learning loop", kicker: "STEP BY STEP", body: "Start by defining what a useful answer means. Gather representative examples and, when the task is supervised, their correct labels. Choose a model and a loss that penalizes the mistakes you care about. Training changes the model parameters to reduce that loss on training examples. A separate evaluation checks whether the pattern carries to examples withheld from training. Only after those checks do we decide whether the model is useful enough for a real workflow.", example: "Suppose examples with 1, 2, and 3 practice hours have scores 50, 60, and 70. A simple fitted line is \u0177 = 10x + 40. At x = 4 it predicts 80. If a new student actually scores 75, the prediction error (actual \u2212 predicted) is 75 \u2212 80 = \u22125 points. That held-out miss tells us more about generalization than another training example would." },
      { title: "A tiny numerical example", kicker: "FROM INPUT TO ERROR", body: "Let x be study hours and y be a score. If the current model is \u0177 = 10x + 40, then at x = 2 it predicts 10 \xD7 2 + 40 = 60. If the observed score is 58, the residual is y \u2212 \u0177 = 58 \u2212 60 = \u22122. A negative residual means the prediction was two points too high. A training objective combines many such errors into one number the learning procedure can try to reduce.", example: "One prediction is not enough to judge a model. If it predicts 60 for one learner and is off by 2, that may be chance. We need many representative examples, a stated error measure, and an evaluation set that did not guide fitting." },
      { title: "What ML does not promise", kicker: "A NECESSARY CAVEAT", body: "A model does not understand a task the way a person does, and it cannot repair a poor problem definition on its own. Its output depends on its training data, target labels, chosen loss, and assumptions. If examples under-represent a group, labels encode past unfairness, or the world changes, predictions can be unreliable. A strong average score alone does not establish fairness, safety, or usefulness for every person.", points: ["A correlation learned from examples is not automatically a cause.", "Predictions are uncertain estimates, not guaranteed facts.", "People remain responsible for deciding where and how an output is used."] }
    ],
    formula: "\\hat{y} = f_{\\theta}(x)",
    formulaExplanation: "x is the input, f is the chosen model family, \u03B8 (theta) is the set of learned parameters, and \u0177 (y-hat) is the prediction. Training searches for \u03B8; inference holds \u03B8 fixed and computes an answer for a new x.",
    code: 'from sklearn.feature_extraction.text import CountVectorizer\nfrom sklearn.naive_bayes import MultinomialNB\n\n# Small labeled examples: message text and the answer we know\nemails = [\n    "win a cash prize",\n    "claim your free prize",\n    "team meeting at noon",\n    "project notes for meeting",\n    "free prize claim now",\n    "schedule the team meeting",\n]\nlabels = ["spam", "spam", "not spam", "not spam", "spam", "not spam"]\n\n# Turn words into numeric counts, learning vocabulary from training text\nvectorizer = CountVectorizer()\nemail_counts = vectorizer.fit_transform(emails)\n\n# Fit a simple classifier using the word counts and known labels\nmodel = MultinomialNB()\nmodel.fit(email_counts, labels)\n\n# Use the already-fitted steps to label a new message\nnew_email = ["free prize now"]\nnew_counts = vectorizer.transform(new_email)\nprediction = model.predict(new_counts)[0]\nprint(f"Prediction: {prediction}")',
    codeOutput: "Prediction: spam",
    codeExplanation: "Each text and label is a training pair. `CountVectorizer` builds a vocabulary from the training messages and converts each message into word counts. `MultinomialNB.fit` learns how those counts relate to the labels. At prediction time we call `transform`, not `fit_transform`, so the new email cannot change the vocabulary. This tiny dataset is only a teaching example; it is far too small for a real spam filter.",
    practice: [
      { prompt: "A developer writes a fixed rule: if a message contains \u201Cfree money,\u201D flag it. Is that machine learning?", answer: "No; that is a hand-written rule.", solution: "The developer explicitly chose the condition and its result. No parameters were fit from examples. It could be one part of an ML system, but the rule itself is conventional programming. A learned spam classifier would adjust its internal parameters from labeled messages and use many clues, not just this one phrase." },
      { prompt: "A model predicts 80 points for a learner who scores 75. What is the residual, and what does its sign mean?", answer: "The residual is \u22125 points; the model overpredicted.", solution: "Use residual = actual \u2212 predicted. Substitute 75 \u2212 80 = \u22125. Because the result is negative, the prediction is above the observed score by five points. The sign is useful because it preserves the direction of the error." },
      { prompt: "For house-price prediction, name one input, the target, and a fair way to test the model.", answer: "Floor area can be an input, sale price the target, and a held-out set of later sales a test set.", solution: "Floor area is a feature available to the model. The price is the label we want it to predict. Keep some representative sales out of fitting and model selection, then measure errors on them once. If the intended use is future listings, a time-based split may be more realistic than a random one." }
    ],
    quiz: { question: "What makes a program a machine-learning system?", options: ["It has many lines of code", "It uses examples to fit a model that makes predictions", "It always uses a neural network"], answer: 1, explanation: "B is correct: a learning procedure adjusts a model using examples. A is wrong because code size says nothing about how behavior is chosen. C is wrong because linear regression, decision trees, and many other non-neural methods are also machine learning." },
    takeaways: ["ML learns patterns from examples instead of relying only on hand-written rules.", "A trained model makes predictions on inputs it has not necessarily seen.", "Testing on held-out data checks generalization, not human-like understanding."],
    interview: { question: "How would you explain machine learning to a non-technical person?", answer: "It is a way to make software infer useful patterns from examples. We give it examples with relevant feedback, let a learning algorithm adjust a model, and evaluate the result on new cases before trusting it." },
    related: ["supervised-vs-unsupervised", "train-validation-test"]
  },
  {
    number: "02",
    slug: "supervised-vs-unsupervised",
    title: "Supervised vs. unsupervised learning",
    description: "The difference is whether your examples come with answers. That one distinction changes the question your model can answer.",
    module: "ML foundations",
    difficulty: "Beginner",
    estimatedMinutes: 11,
    prerequisites: ["what-is-machine-learning"],
    objectives: ["Identify features and labels in a dataset.", "Contrast supervised prediction with unsupervised structure-finding.", "Choose a learning setup for a real task."],
    analogy: "Imagine sorting a pile of fruit. With supervision, a teacher has already put \u201Capple,\u201D \u201Cpear,\u201D and \u201Corange\u201D labels on examples, and you practice predicting those labels. Without supervision, there are no name cards; you group fruit that looks similar, then someone has to decide whether those groups are useful. The difference is the information available, not whether a human is present while the computer runs.",
    intro: "A learning setup describes what information is available during training and what question we want to answer. In supervised learning, each example includes an input and a target answer. In unsupervised learning, examples have inputs but no supplied target; the method searches for structure such as groups or lower-dimensional representations. Neither setup is automatically better: the task and the quality of its labels decide what is appropriate.",
    sections: [
      { title: "The answer key: supervised learning", kicker: "FEATURES + LABELS", body: "Each row has inputs (features) and a target (label). A model learns a mapping from features to targets. Predicting a number is regression; choosing a category is classification. The label is the teaching signal: during training, the algorithm compares its guess with that known answer and adjusts parameters to reduce a loss.", points: ["A house\u2019s floor area and age can be features; its sale price is a numeric target.", "An email\u2019s word counts can be features; \u201Cspam\u201D is a class label.", "Labels cost time or expertise to collect, and noisy labels can teach the wrong pattern."] },
      { title: "Finding structure: unsupervised learning", kicker: "INPUTS WITHOUT LABELS", body: "The examples have features but no target answer telling the algorithm what to predict. Clustering assigns similar examples to groups according to a chosen distance or probability model. Dimensionality reduction makes a compact representation of many measurements. The algorithm can organize data, but it cannot tell us whether the grouping is valuable for a person\u2019s actual goal.", example: "Suppose four shoppers have weekly visit/spend measurements (1, 2), (1, 3), (8, 8), and (9, 8). A two-cluster method can group the first pair and the second pair. The IDs \u201Ccluster 0\u201D and \u201Ccluster 1\u201D have no built-in meaning; inspect the shoppers and the intended use before naming those groups." },
      { title: "Choose by the question", kicker: "WHEN TO USE WHICH", body: "If the goal is to predict an outcome and reliable historical answers exist, supervised learning is a natural starting point. If the goal is to explore similarities without known answers, unsupervised methods can help generate hypotheses. If labels are scarce but raw inputs are plentiful, semi-supervised or self-supervised methods may use both, but those are different training designs with their own assumptions.", kind: "math", points: ["Classification: predict a category, such as \u201Cspam.\u201D", "Regression: predict a number, such as a price.", "Clustering: group inputs without a provided target."] }
    ],
    formula: "\\text{supervised: } (x_i, y_i) \\qquad \\text{unsupervised: } x_i",
    formulaExplanation: "For supervised learning, example i contains features x\u1D62 and a known target y\u1D62. For unsupervised learning, only x\u1D62 is supplied. The missing y is not secretly inferred as a correct label; the method solves a different, structure-finding task.",
    code: 'import numpy as np\nfrom sklearn.cluster import KMeans\nfrom sklearn.linear_model import LinearRegression\n\n# Supervised data: each home has a size and a known sale price\nhouse_sizes = np.array([[500], [750], [1000], [1250]])\nprices_thousands = np.array([200, 300, 400, 500])\nprice_model = LinearRegression().fit(house_sizes, prices_thousands)\nnew_home = price_model.predict([[1500]])[0]\nprint("1500 sq ft price ($1000s):", round(float(new_home), 1))\n\n# Unsupervised data: each row has visits per week and spend ($10s)\nshopper_features = np.array([[1, 2], [1, 3], [8, 8], [9, 8]])\nclusters = KMeans(n_clusters=2, n_init=10, random_state=7)\ncluster_ids = clusters.fit_predict(shopper_features)\nprint("shoppers per cluster:", np.bincount(cluster_ids))',
    codeOutput: "1500 sq ft price ($1000s): 600.0\nshoppers per cluster: [2 2]",
    codeExplanation: "The regression call receives both features and known prices, so it can learn a feature-to-target mapping. The K-means call receives only shopper measurements. `fit_predict` returns arbitrary group IDs; the count shows the partition size, not that the clusters are correct customer types. In a real workflow, scale features when their units or ranges differ and evaluate whether the groups help answer a human question.",
    practice: [
      { prompt: "You have photos each labeled \u201Ccat\u201D or \u201Cdog.\u201D Which setup fits, and what are x and y?", answer: "Supervised classification: x is the photo and y is its cat/dog label.", solution: "The goal is to predict a category. Each training pair is (photo, known category). The known category supplies feedback so the classifier can compare its guess with the answer. If the labels were removed and the task became \u201Cfind visually similar photos,\u201D that would instead be an unsupervised exploration problem." },
      { prompt: "A bank wants to explore spending patterns without existing customer categories. What might help, and what can it not tell the bank by itself?", answer: "Clustering can propose groups, but it cannot decide whether they are meaningful or fair.", solution: "Give each customer a feature vector such as visit frequency and average spend, then fit a clustering method. Inspect cluster summaries and stability. A cluster number is only an identifier: the algorithm does not know whether a group means \u201Cloyal,\u201D \u201Cat risk,\u201D or \u201Cprofitable,\u201D nor whether acting on it is appropriate." },
      { prompt: "A clustering output uses IDs 0 and 1. If rerunning the method swaps those IDs but keeps the same memberships, did the discovered groups change?", answer: "No. The numeric IDs are arbitrary; the member sets are what matter.", solution: "Cluster labels are nominal names, not ordered values. There is no mathematical reason that group 0 is smaller, better, or earlier than group 1. Compare which examples are together, not the literal integer assigned to each cluster." }
    ],
    quiz: { question: "What is the key difference between supervised and unsupervised learning?", options: ["One uses more data", "Supervised examples include known target answers", "Unsupervised learning cannot use Python"], answer: 1, explanation: "B is correct: supervised training sees known targets y along with inputs x. A is wrong because dataset size does not define the learning setup; either method can use many examples. C is wrong because Python is commonly used for both. The useful distinction is whether a target answer is provided, not the tool or amount of data." },
    takeaways: ["Supervised learning uses examples paired with targets.", "Unsupervised learning searches for structure without target labels.", "Clusters are hypotheses about structure, not guaranteed truths."],
    interview: { question: "Can clustering be used when the final goal is prediction?", answer: "Sometimes as an exploratory tool or as a feature-generation step, but clusters alone do not provide supervised target labels. Validate that they help the downstream task using a proper split." },
    related: ["what-is-machine-learning", "linear-regression"]
  },
  {
    number: "03",
    slug: "linear-regression",
    title: "Linear regression, from line to prediction",
    description: "Learn how a straight line turns a measurement into a prediction, and what \u201Cbest fit\u201D actually means.",
    module: "Supervised learning",
    difficulty: "Beginner",
    estimatedMinutes: 14,
    prerequisites: ["supervised-vs-unsupervised"],
    objectives: ["Interpret slope and intercept.", "Calculate a prediction and residual.", "Explain least squares and a key limitation."],
    analogy: "Imagine placing a ruler through a scatter of points on graph paper. The ruler will not touch every point. You slide and tilt it to make the typical vertical miss small. The ruler is the model; its tilt and height are parameters the training method chooses.",
    intro: "Linear regression is a supervised method for predicting a number. With one input feature, it predicts using a straight line. With several features, it adds a weighted contribution from each one. The method is useful as a transparent baseline: we can calculate what it predicts and inspect where it misses. \u201CLinear\u201D describes how the prediction depends on the model weights, not necessarily that every relationship in the world is a straight line.",
    sections: [
      { title: "A line with a job", kicker: "SLOPE + INTERCEPT", body: "For a one-feature model, the slope w tells how much the prediction changes when x increases by one unit. The intercept b is the prediction at x = 0. In a multi-feature model, each weight describes the model\u2019s change for a one-unit feature change when other inputs are held fixed. That is a conditional association, not proof that changing the feature causes the outcome to change.", example: "If a fitted study-score line is \u0177 = 5x + 40, then 4 practice hours predict 5 \xD7 4 + 40 = 60 points. At 5 hours it predicts 65, so the model\u2019s predicted change is 5 points. That coefficient does not prove an extra hour causes five more points; other factors may differ between students." },
      { title: "Misses become a score", kicker: "RESIDUALS + LEAST SQUARES", body: "A residual is the observed target minus the prediction: e\u1D62 = y\u1D62 \u2212 \u0177\u1D62. Least squares chooses weights to minimize the sum of squared residuals. Squaring makes negative and positive misses nonnegative so they cannot cancel, and it gives large misses more influence. Mean squared error divides by the number of examples to make the scale easier to compare across datasets of different sizes.", points: ["A positive residual means the prediction was too low; a negative one means it was too high.", "MSE is measured in squared target units, so RMSE (its square root) returns to the target units.", "Outliers can strongly pull a least-squares line because their residuals are squared."] },
      { title: "Work a best-fit line by hand", kicker: "A SMALL NUMERICAL DERIVATION", body: "Take four observations: x = [0, 1, 2, 3] and y = [1, 3, 4, 6]. The means are x\u0304 = 1.5 and \u0233 = 3.5. The sum of paired deviations is 8; the sum of squared x deviations is 5. Therefore w = 8/5 = 1.6 and b = \u0233 \u2212 w x\u0304 = 3.5 \u2212 1.6(1.5) = 1.1. This gives predictions [1.1, 2.7, 4.3, 5.9]. The residuals are [\u22120.1, 0.3, \u22120.3, 0.1]; their squared errors sum to 0.20, so MSE = 0.20/4 = 0.05.", example: "For x = 4, the fitted line predicts 1.6(4) + 1.1 = 7.5. This is one unit beyond the largest observed x (3), so it is a small extrapolation; farther away, the straight-line assumption would need stronger justification." },
      { title: "A useful baseline, not a law of nature", kicker: "ASSUMPTIONS TO CHECK", body: "A straight-line relationship should be a reasonable summary over the range where you use the model. Residuals should not show a clear curve or changing spread. Rows that belong to the same person or time series may not be independent. Extrapolation is risky because a line continues forever even when the real process cannot.", kind: "math", points: ["Plot residuals against predictions and important features.", "Check influential outliers and whether units/scales make sense.", "Compare with a simple baseline and validation performance."] }
    ],
    formula: "\\hat{y} = wx + b \\qquad J(w,b) = \\frac{1}{n}\\sum_{i=1}^{n}(y_i - (wx_i+b))^2",
    formulaExplanation: "For each example i, predict \u0177\u1D62 = wx\u1D62 + b and compute residual y\u1D62 \u2212 \u0177\u1D62. J is the average of the squared residuals. In the hand calculation above, w = 1.6, b = 1.1, squared-error sum = 0.20, and J = MSE = 0.05.",
    code: 'import numpy as np\nfrom sklearn.linear_model import LinearRegression\nfrom sklearn.metrics import mean_squared_error\n\n# Four measured examples: one feature per row, one numeric target per row\nX = np.array([[0], [1], [2], [3]])\ny = np.array([1, 3, 4, 6])\n\n# fit learns slope and intercept by least squares\nmodel = LinearRegression().fit(X, y)\n\n# Predict at x=4; this is just beyond the observed feature range\nprediction = model.predict([[4]])[0]\ntraining_mse = mean_squared_error(y, model.predict(X))\nprint(f"slope={model.coef_[0]:.1f}, intercept={model.intercept_:.1f}")\nprint(f"prediction at x=4: {prediction:.1f}")\nprint(f"training MSE: {training_mse:.2f}")',
    codeOutput: "slope=1.6, intercept=1.1\nprediction at x=4: 7.5\ntraining MSE: 0.05",
    codeExplanation: "Each row of `X` is one example and each column is one feature, so even one feature is written as a 2-D array. `fit` estimates the least-squares line. The training MSE is reported only to check the arithmetic; it is not an unbiased estimate of future performance because these are the same examples used to fit the line. The x=4 prediction also extrapolates beyond the observed x values.",
    practice: [
      { prompt: "For \u0177 = 3x + 7, calculate the prediction at x = 4 and explain the slope.", answer: "The prediction is 19. The model predicts a 3-unit increase in y for each 1-unit increase in x.", solution: "Substitute x = 4: \u0177 = 3(4) + 7 = 12 + 7 = 19. The coefficient on x is 3, so comparing x with x+1 changes the prediction by 3: [3(x+1)+7] \u2212 [3x+7] = 3. This is the model\u2019s predicted change, not necessarily a causal effect." },
      { prompt: "A house sold for $320,000 and the model predicted $300,000. What is the residual, and did the model over- or underpredict?", answer: "The residual is +$20,000; the model underpredicted.", solution: "Residual = actual \u2212 predicted = 320,000 \u2212 300,000 = +20,000. A positive residual means the true value is higher than the prediction, so the line was $20,000 too low." },
      { prompt: "For the hand-fit line, residuals are \u22120.1, 0.3, \u22120.3, 0.1. Calculate MSE and explain why the signs do not cancel.", answer: "MSE = 0.05.", solution: "Square each residual: 0.01, 0.09, 0.09, 0.01. Their sum is 0.20; divide by four examples to get MSE = 0.05. Squaring removes the signs, so underpredictions and overpredictions cannot cancel. The errors are now in squared target units." }
    ],
    quiz: { question: "What does the slope mean in a one-feature linear model?", options: ["The average training error", "The predicted change in y for a one-unit increase in x", "The number of training examples"], answer: 1, explanation: "B is correct: increasing x by one changes the line\u2019s prediction by w units. A describes an error metric, not a coefficient. C is the sample size n, which is not the slope. Also remember that the coefficient describes a fitted association; it does not by itself prove that changing x causes y to change." },
    takeaways: ["Linear regression predicts a number by adding weighted feature contributions.", "Least squares minimizes squared residuals.", "Check fit assumptions and avoid ungrounded extrapolation."],
    interview: { question: "What does the coefficient in linear regression tell you?", answer: "Holding other modeled features fixed, it gives the model\u2019s predicted change in the target for a one-unit change in that feature. Interpretation depends on scaling, feature relationships, and assumptions; it is not by itself a causal claim." },
    related: ["gradient-descent", "train-validation-test"]
  },
  {
    number: "04",
    slug: "train-validation-test",
    title: "Train, validation, and test data",
    description: "Three data splits, three different jobs. Get this boundary right before trusting a score.",
    module: "ML foundations",
    difficulty: "Beginner",
    estimatedMinutes: 12,
    prerequisites: ["what-is-machine-learning"],
    objectives: ["Describe the purpose of each split.", "Recognize test-set leakage.", "Choose a split strategy that reflects deployment."],
    analogy: "Think of preparing for an exam. The training set is your practice workbook. The validation set is a mock exam you can use to choose a study strategy. The test set is the sealed final exam: you open it once after decisions are done. If you keep looking at the final and changing your plan, it stops being an independent test.",
    intro: "A model\u2019s score on training examples mostly tells us how well it fit examples it already saw. We want to estimate performance on future examples, so we reserve data for distinct jobs. Training data fits parameters; validation data guides choices; test data is a final check after choices are frozen. These are roles in an information boundary, not three special file formats.",
    sections: [
      { title: "Three jobs, three boundaries", kicker: "THE DIVISION OF LABOR", body: "Training data fits model parameters. Validation data compares choices such as model family, feature set, threshold, or regularization strength. Test data estimates final performance after those choices are finished. If data is plentiful, a 70/15/15 split is one possible starting point, not a rule; cross-validation can make better use of small datasets.", points: ["Do not tune model choices by repeatedly checking test scores.", "Fit imputation, scaling, and feature selection on training data only.", "Keep related examples together when they are not independent."] },
      { title: "Match the split to reality", kicker: "THE RIGHT SPLIT DEPENDS ON THE TASK", body: "Random splitting can work when examples are independent and future cases resemble the same population. If one person contributes multiple records, split by person so a person\u2019s near-duplicate records cannot appear on both sides. For forecasting, split by time: train on earlier periods and evaluate on later ones.", example: "With 1,000 independent labeled examples, one simple split might use 700 for training, 150 for validation, and 150 for testing. The training portion learns parameters; validation compares candidate settings; the final 150 are consulted once. For future demand, however, a chronological 700/150/150 division is more honest than shuffling dates." },
      { title: "Preprocessing can leak too", kicker: "A SUBTLE TRAP", body: "Suppose we calculate a feature\u2019s mean and standard deviation using all 1,000 rows, then split. The held-out rows influenced the values used to transform training data. The leak may look harmless, but it gives the training procedure information it would not have at deployment. Put learned transformations inside a pipeline so each training fold fits them independently.", kind: "math", points: ["Safe order: split first, then fit preprocessing on training data.", "For cross-validation, every fold needs its own fitted preprocessing.", "A pipeline helps keep the transform and estimator inside the same boundary."] },
      { title: "When validation is small", kicker: "CROSS-VALIDATION", body: "A single validation set can be noisy when the dataset is small. In k-fold cross-validation, divide training data into k parts, train on k\u22121 parts, and validate on the remaining part; rotate the held-out fold and average the results. Use those results for model selection, then evaluate once on the still-untouched test set. The folds must respect groups or time when ordinary random folds would leak structure.", example: "With five folds, each example is used for validation once and training four times. This gives a more stable comparison than relying on one small validation slice, though it costs roughly five fits per candidate model." }
    ],
    formula: "\\text{fit on train} \\rightarrow \\text{choose on validation} \\rightarrow \\text{report once on test}",
    formulaExplanation: "Information should flow left to right. Validation feedback may influence the chosen model; test feedback should not. After looking at the test score, do not tune and then report that same score as if it were untouched.",
    code: 'from sklearn.linear_model import LogisticRegression\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.pipeline import make_pipeline\nfrom sklearn.preprocessing import StandardScaler\n\n# Make a small deterministic binary dataset for this example\nX = [[value] for value in range(20)]\ny = [int(value >= 10) for value in range(20)]\n\n# Hold out 20% for the final test before making model choices\nX_train_valid, X_test, y_train_valid, y_test = train_test_split(\n    X, y, test_size=0.2, stratify=y, random_state=7\n)\n\n# Split the remaining data: 60% train, 20% validation overall\nX_train, X_valid, y_train, y_valid = train_test_split(\n    X_train_valid, y_train_valid, test_size=0.25,\n    stratify=y_train_valid, random_state=7\n)\n\n# The scaler is fit inside the pipeline using X_train only\nmodel = make_pipeline(StandardScaler(), LogisticRegression())\nmodel.fit(X_train, y_train)\nprint("split sizes:", len(X_train), len(X_valid), len(X_test))\nprint(f"validation accuracy: {model.score(X_valid, y_valid):.2f}")\n\n# After choices are frozen, report the test score once\nprint(f"test accuracy: {model.score(X_test, y_test):.2f}")',
    codeOutput: "split sizes: 12 4 4\nvalidation accuracy: 1.00\ntest accuracy: 1.00",
    codeExplanation: "The first split reserves test rows. The second split creates validation data from the remaining rows. `stratify` preserves class proportions in these small splits. The pipeline fits `StandardScaler` during `model.fit`, so its statistics come only from `X_train`; it then transforms validation/test rows using those same training statistics. This tiny ordered dataset is intentionally easy, so its perfect score is a split illustration, not evidence that logistic regression always performs perfectly.",
    practice: [
      { prompt: "You try 40 model variants and choose the one with the best test score. What went wrong, and what should you do instead?", answer: "The test set became part of model selection, so the score is optimistic. Choose with validation/cross-validation and keep a fresh test set for the final estimate.", solution: "Each test score contains random noise. If you compare 40 variants and select the maximum, you are likely selecting a model that got lucky on those test examples. The test results have influenced your choice, even if you never passed them to `.fit`. Use validation data or cross-validation to compare settings. Keep a separate test set untouched until the decisions are frozen; if it has already guided choices, collect a fresh final evaluation set if possible." },
      { prompt: "A forecasting dataset has 12 months. Why can a random split give an unrealistic evaluation?", answer: "It can train on later months and validate on earlier months, leaking future patterns into the simulated past.", solution: "The deployment question is \u201Cuse the past to predict the future.\u201D A random split breaks that direction: records from December could train a model evaluated on March. Use an ordered split such as months 1\u20138 for training, 9\u201310 for validation, and 11\u201312 for testing. With seasonal data, make sure the held-out period represents the future horizon you care about." },
      { prompt: "A scaler is fit before splitting. Explain the leak and the safer alternative.", answer: "The held-out rows influence the scaler statistics. Split first and fit the scaler inside a pipeline on training data.", solution: "A standard scaler stores a mean and standard deviation. If those are computed using all rows, test-feature values affected the transformation used during fitting. Split the raw data first. Put `StandardScaler` in a scikit-learn pipeline and fit that pipeline on training data; during validation and testing, the already-fitted scaler only transforms the rows." }
    ],
    quiz: { question: "What is the main role of a validation set?", options: ["Fit the model weights", "Choose between modeling decisions without touching the final test set", "Increase the number of labels"], answer: 1, explanation: "B is correct: validation performance helps choose model settings. A is the training set\u2019s role for ordinary fitting. C confuses evaluation with data collection; holding examples out does not create labels. The test set is reserved for a final estimate after choices stop changing." },
    takeaways: ["Training fits; validation guides choices; test estimates final generalization.", "The split must reflect the independence and time structure of the task.", "Preprocessing learned from data belongs inside the training pipeline."],
    interview: { question: "What is data leakage?", answer: "Leakage is information available during training or selection that would not legitimately be available at prediction time. It can come from features, splitting, or preprocessing and creates overly optimistic evaluation." },
    related: ["overfitting-underfitting", "evaluation-metrics"]
  },
  {
    number: "05",
    slug: "gradient-descent",
    title: "Gradient descent: learning one step at a time",
    description: "A small, repeated move in the direction that makes error smaller. That is the core idea behind a surprising amount of ML.",
    module: "Optimization",
    difficulty: "Beginner",
    estimatedMinutes: 13,
    prerequisites: ["linear-regression"],
    objectives: ["Read a gradient as a direction of change.", "Apply one parameter update by hand.", "Explain the role and risk of learning rate."],
    analogy: "Imagine standing on a smooth hill in thick fog. You cannot see the valley, but you can feel which way the ground rises. Take a small step downhill, check the slope again, and repeat. The parameter is your position, the loss is your height, and the learning rate is your step length. A bad map or a step that is too large can still lead you astray.",
    intro: "A model has parameters such as weights and biases. Training often means choosing those parameters to make a loss function small. Gradient descent uses derivatives of the loss to decide how to change each parameter. It is iterative: evaluate the local slope, update, then evaluate again. This gives a practical way to optimize models whose best parameters cannot be written down directly, but it does not guarantee a global optimum for every loss surface.",
    sections: [
      { title: "The gradient points uphill", kicker: "FOLLOW THE SLOPE", body: "For one parameter w, the derivative J\u2032(w) estimates how the loss changes for a tiny increase in w. A positive derivative means the loss rises as w increases locally, so subtracting the derivative moves w down. For many parameters, the gradient collects all partial derivatives. The negative gradient is the direction of steepest local decrease when distance is measured with the ordinary Euclidean metric.", example: "Let J(w) = (w \u2212 3)\xB2. Its derivative is J\u2032(w) = 2(w \u2212 3). Start at w\u2080 = 0, so J\u2032(0) = \u22126. With learning rate \u03B1 = 0.1, w\u2081 = 0 \u2212 0.1(\u22126) = 0.6. The target minimum is w = 3, so this step moves toward it. The loss falls from J(0)=9 to J(0.6)=5.76." },
      { title: "Walk several steps", kicker: "FOLLOW THE NUMBERS", body: "The update rule is w\u209C\u208A\u2081 = w\u209C \u2212 \u03B1J\u2032(w\u209C). At w\u2081 = 0.6, the gradient is 2(0.6\u22123)=\u22124.8, so w\u2082 = 0.6\u22120.1(\u22124.8)=1.08 and J(w\u2082)=3.6864. Next, the gradient is \u22123.84, so w\u2083 = 1.08+0.384=1.464 and J(w\u2083)=2.3593. The steps get shorter in effect as the slope flattens near the minimum.", example: "For this particular quadratic, the update simplifies to w\u209C\u208A\u2081 = 0.8w\u209C + 0.6. Starting from 0 gives w\u2081=0.6, w\u2082=1.08, w\u2083=1.464. Each update shrinks the remaining distance to 3 by a factor of 0.8." },
      { title: "Learning rate: how big is a step?", kicker: "A SMALL NUMBER WITH BIG CONSEQUENCES", body: "A tiny learning rate makes stable but very small progress. A large rate can cross the valley; if the slope is steep on the other side, the next step may send the parameter farther away. For J(w)=(w\u22123)\xB2, \u03B1=0.1 converges because the distance-to-minimum factor is 1\u22122\u03B1=0.8. At \u03B1=1, the iterate jumps from 0 to 6 and back to 0 forever. At \u03B1=1.1, that factor is \u22121.2, so the distance grows and the loss diverges.", points: ["Batch gradient descent uses all training examples to estimate each update.", "Stochastic gradient descent uses one example; its updates are noisier but cheap.", "Mini-batches average a subset of examples and work well with vectorized hardware.", "Learning-rate schedules can start larger and reduce the step size later."] },
      { title: "Read the loss curve", kicker: "WHAT TO WATCH", body: "Training loss should usually fall when optimization is behaving well, though stochastic mini-batches can make it noisy. A flat curve may mean a tiny learning rate or a gradient near zero; a rapidly growing or oscillating curve may mean steps are too large. Falling training loss is not proof of generalization. Compare validation performance too: if training improves while validation worsens, the model may be overfitting.", kind: "math", points: ["Check that loss is finite and is measured on the intended target.", "Plot validation loss separately from training loss.", "The gradient is local; a non-convex objective can have saddles and local minima."] }
    ],
    formula: "\\theta_{t+1} = \\theta_t - \\alpha \\nabla J(\\theta_t)",
    formulaExplanation: "\u03B8 is the parameter vector, \u03B1 is the learning rate, and \u2207J(\u03B8) contains the partial derivatives of loss J with respect to each parameter. The minus sign moves opposite the local uphill direction. In one dimension this becomes w\u209C\u208A\u2081 = w\u209C \u2212 \u03B1J\u2032(w\u209C).",
    code: "def loss(weight):\n    # A bowl-shaped objective with its minimum at weight=3\n    return (weight - 3) ** 2\n\ndef gradient(weight):\n    # Derivative of (weight - 3) ** 2\n    return 2 * (weight - 3)\n\nweight = 0.0\nlearning_rate = 0.1\n\nfor step in range(20):\n    # Move a fraction of the way against the local slope\n    weight -= learning_rate * gradient(weight)\n\n    # Print after updates 1, 5, and 20 to see progress\n    if step in (0, 4, 19):\n        print(step + 1, round(weight, 3), round(loss(weight), 3))",
    codeOutput: "1 0.6 5.76\n5 2.017 0.966\n20 2.965 0.001",
    codeExplanation: "`loss` and `gradient` describe the same objective; the derivative must match the loss being minimized. Each loop iteration evaluates the current gradient, subtracts a learning-rate-scaled step, then reports the new loss. The parameter approaches 3 and loss approaches 0. Try changing `learning_rate` to 1.0: this quadratic oscillates between 0 and 6 without reducing loss. A real model computes gradients over many parameters using automatic differentiation, but the update idea is the same.",
    practice: [
      { prompt: "If J\u2032(w)=+4 and the learning rate is 0.05, what is the parameter change?", answer: "The update changes w by \u22120.2.", solution: "The gradient-descent update is w_new = w \u2212 \u03B1J\u2032(w). The change is \u2212\u03B1J\u2032(w) = \u22120.05(4) = \u22120.2. Since the local slope is positive, moving to a smaller w is locally downhill." },
      { prompt: "Starting at w = 0 with J(w) = (w \u2212 3)\xB2 and learning rate 0.1, calculate two updates and both new losses.", answer: "w\u2081=0.6 with loss 5.76; w\u2082=1.08 with loss 3.6864.", solution: "First, J\u2032(w)=2(w\u22123). At w\u2080=0, gradient=\u22126, so w\u2081=0\u22120.1(\u22126)=0.6 and J(w\u2081)=(0.6\u22123)\xB2=5.76. At w\u2081=0.6, gradient=\u22124.8, so w\u2082=0.6\u22120.1(\u22124.8)=1.08. Then J(w\u2082)=(1.08\u22123)\xB2=(\u22121.92)\xB2=3.6864. Both updates move toward 3 and lower the loss." },
      { prompt: "For the same quadratic, why does learning rate 1.0 fail to converge from w=0?", answer: "It jumps from 0 to 6 and back to 0, so it oscillates with loss 9.", solution: "At w=0, gradient=\u22126, so w\u2081=0\u22121(\u22126)=6. At w=6, gradient=+6, so w\u2082=6\u22121(6)=0. These two values repeat. The distance from the minimum is unchanged and the loss remains (0\u22123)\xB2=9. The step is too large for this curvature." }
    ],
    quiz: { question: "Why does gradient descent subtract the gradient?", options: ["The gradient points in the direction of steepest local increase", "Subtraction makes the dataset smaller", "The gradient is always a negative number"], answer: 0, explanation: "A is correct: for a differentiable loss, the gradient points toward the steepest local increase, so its negative is the steepest local decrease direction. B is unrelated to optimization. C is false: gradients can be positive, negative, or zero; the subtraction works with all three signs." },
    takeaways: ["The gradient describes local loss change with respect to parameters.", "Gradient descent updates parameters opposite that gradient.", "Learning rate controls step size and can make training too slow or unstable."],
    interview: { question: "What happens if the learning rate is too high or too low?", answer: "Too low can make optimization painfully slow. Too high can cause overshooting, oscillation, or divergence. Inspecting training curves and tuning the rate are practical first steps." },
    related: ["linear-regression", "neural-networks"]
  },
  {
    number: "06",
    slug: "overfitting-underfitting",
    title: "Overfitting and underfitting",
    description: "A model can memorize the practice questions or fail to learn the subject. Generalization is the skill in between.",
    module: "Model quality",
    difficulty: "Beginner",
    estimatedMinutes: 10,
    prerequisites: ["train-validation-test"],
    objectives: ["Distinguish underfit from overfit behavior.", "Interpret learning curves and generalization gaps.", "Choose regularization or validation strategies from evidence."],
    analogy: "A student who memorizes the exact practice sheet struggles with a new exam. A student who studies too little struggles on both practice and exam questions. A good model learns the subject\u2019s repeatable pattern rather than either memorizing or giving up.",
    intro: "The goal is generalization: useful predictions for new examples from the deployment situation. Underfitting means the model is too limited to capture important structure. Overfitting means it has learned details that look good on training data but do not repeat. The same model can underfit one task and overfit another, so diagnose with a representative split and more than one score.",
    sections: [
      { title: "Read the learning curves", kicker: "HIGH ERROR EVERYWHERE", body: "Underfitting often shows high training and validation error with a small gap. Overfitting often shows very low training error and a much worse validation error. Plot scores as model complexity or training time changes. The best setting is usually near the lowest validation error, not the lowest training error.", example: "In the runnable tree example, depth 1 scores 0.83 on training and 0.88 on validation: it is relatively simple and misses structure. Depth 3 scores 0.90 and 0.94. Depth 12 scores 1.00 and 0.88: it memorizes training examples without improving held-out performance." },
      { title: "Control complexity deliberately", kicker: "A GAP OPENS UP", body: "Regularization adds a preference for simpler parameters or structures. A decision tree can limit depth or leaf size. Linear models can penalize large weights with Ridge or Lasso. Neural networks can use weight decay, dropout, data augmentation, or early stopping. Each method trades some flexibility for a better chance of generalizing.", points: ["Compare training and validation performance with the same split.", "Tune hyperparameters using validation or cross-validation.", "Keep the final test set untouched until choices are frozen.", "More data helps only when it represents the cases you will face."] },
      { title: "Diagnose before treating", kicker: "CHECK THE EVIDENCE", body: "A train/validation gap can also come from leakage, duplicates across splits, distribution shift, noisy labels, or a validation set that is too small. A model change cannot repair a target defined incorrectly. Check the data pipeline, examples, and error slices before automatically adding regularization.", kind: "math", points: ["Leakage can make validation look falsely easy.", "Distribution shift can make a good training fit fail in production.", "Error analysis by subgroup can reveal failures hidden by an average."] }
    ],
    formula: "\\text{generalization gap} = \\text{validation error} - \\text{training error}",
    formulaExplanation: "A large positive gap can signal overfitting, but only when the split and metrics are meaningful for the task. A small gap with both errors high is more consistent with underfitting.",
    code: 'from sklearn.datasets import make_moons\nfrom sklearn.metrics import accuracy_score\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.tree import DecisionTreeClassifier\n\n# Create deterministic, curved binary data for a self-contained demo\nfeatures, labels = make_moons(n_samples=240, noise=0.28, random_state=7)\n\n# Reserve a final test set; use only train/validation to compare depths\nX_train_valid, X_test, y_train_valid, y_test = train_test_split(\n    features, labels, test_size=0.2, stratify=labels, random_state=7\n)\nX_train, X_valid, y_train, y_valid = train_test_split(\n    X_train_valid, y_train_valid, test_size=0.25,\n    stratify=y_train_valid, random_state=7\n)\n\nprint("split sizes:", len(X_train), len(X_valid), len(X_test))\nprint("depth | train accuracy | validation accuracy")\nfor depth in (1, 3, 12, None):\n    model = DecisionTreeClassifier(max_depth=depth, random_state=7)\n    model.fit(X_train, y_train)\n    train_score = accuracy_score(y_train, model.predict(X_train))\n    valid_score = accuracy_score(y_valid, model.predict(X_valid))\n    print(depth, round(train_score, 2), round(valid_score, 2))',
    codeOutput: "split sizes: 144 48 48\ndepth | train accuracy | validation accuracy\n1 0.83 0.88\n3 0.9 0.94\n12 1.0 0.88\nNone 1.0 0.88",
    codeExplanation: "The code creates one reproducible dataset and makes stratified train, validation, and test partitions. It compares tree depths using training and validation accuracy; the separate test set is deliberately not inspected during model selection. Depth 12 fits every training point but falls back to 0.88 validation accuracy, while depth 3 validates better. That gap is evidence of overfitting on this sample, not proof that depth 3 is universally best.",
    practice: [
      { prompt: "A model has training error 0.20 and validation error 0.75. What is the generalization gap?", answer: "0.55.", solution: "Subtract training error from validation error: 0.75 \u2212 0.20 = 0.55. The large positive gap is a warning that training-specific details may not transfer." },
      { prompt: "Depth 1 gives train/validation accuracy 0.83/0.88, depth 3 gives 0.90/0.94, and depth 12 gives 1.00/0.88. Which would you choose and why?", answer: "Depth 3 for this validation split, because it has the strongest held-out accuracy.", solution: "Depth 12 has the best training score but ties the weaker validation result, which is a classic overfit signal. Depth 3 improves validation accuracy to 0.94. Freeze this choice before evaluating the untouched test set; do not treat one validation split as universal proof." },
      { prompt: "Name two ways to reduce overfitting and one data problem that can look like overfitting.", answer: "Simplify/regularize or add representative data; duplicates or leakage can distort the gap.", solution: "Model-side options include limiting tree depth, adding weight decay, dropout, or early stopping. Data-side checks include duplicate examples across splits, target leakage, and a validation distribution that differs from deployment. Diagnose both before selecting a remedy." }
    ],
    quiz: { question: "Which pattern is most consistent with overfitting?", options: ["High train error and high validation error", "Low train error with substantially higher validation error", "Low error on every new example forever"], answer: 1, explanation: "The train/validation gap suggests the model fits training-specific details that do not transfer as well." },
    takeaways: ["Underfitting means the model misses important patterns.", "Overfitting means training performance does not carry over well.", "Diagnose splits and distributions before changing model complexity."],
    interview: { question: "How can you detect overfitting?", answer: "Compare training and validation performance with a sound split and inspect learning curves. A large gap where training is much better is a warning signal, but also check leakage, duplicates, label noise, and distribution mismatch before concluding that model complexity is the cause." },
    related: ["train-validation-test", "evaluation-metrics"],
    miniProject: { title: "Find the useful tree depth", objective: "Use validation evidence to choose a decision-tree complexity without touching the final test set.", tasks: ["Run the deterministic moons example and record train/validation accuracy for each depth.", "Plot depth against both scores.", "Choose a depth using validation accuracy and explain the generalization gap.", "Evaluate the chosen depth on the untouched test set only after the choice is frozen."], extension: "Repeat with a different noise level and explain why the best depth can change." }
  },
  {
    number: "07",
    slug: "evaluation-metrics",
    title: "Evaluation metrics: what does \u201Cgood\u201D mean?",
    description: "A score only makes sense when it reflects the mistake you care about. Start with the question, then choose the metric.",
    module: "Model quality",
    difficulty: "Beginner",
    estimatedMinutes: 13,
    prerequisites: ["train-validation-test"],
    objectives: ["Calculate accuracy, precision, recall, specificity, and F1 from counts.", "Choose thresholds and curves that match an error cost.", "Compare classification and regression metrics without overtrusting one score."],
    analogy: "A smoke alarm should catch fires, but a system that rings all day is not useful either. A hospital screening tool, spam filter, and fraud detector can prefer different trade-offs. The \u201Cbest\u201D metric depends on which mistake costs more and what happens after an alert.",
    intro: "An evaluation metric compresses model behavior into a number, but every compression hides detail. Start with the decision and the costs of false positives and false negatives. Then inspect a confusion matrix, select useful metrics, and evaluate on data that did not guide model fitting or threshold selection.",
    sections: [
      { title: "Count the kinds of mistakes", kicker: "THE CONFUSION MATRIX", body: "For binary classification, true positives are positive cases correctly flagged; false positives are negative cases incorrectly flagged. False negatives miss positive cases. True negatives correctly reject negatives. From these four counts, accuracy asks about all decisions, recall asks about all actual positives, and specificity asks about all actual negatives.", example: "Suppose a fraud model sees 1,000 transactions: TP=8, FN=2, FP=30, TN=960. Accuracy=(8+960)/1000=0.968. Recall=8/(8+2)=0.80. Specificity=960/(960+30)=0.97. Precision=8/(8+30)\u22480.21. The model catches most fraud but many alerts are false alarms." },
      { title: "Precision and recall ask different questions", kicker: "WHEN FALSE ALARMS MEET MISSED CASES", body: "Precision asks: of the cases flagged positive, how many were truly positive? Recall asks: of all true positive cases, how many did we find? A decision threshold converts a probability or score into a class. Lowering it usually catches more positives, increasing recall while also creating more false positives.", points: ["Precision = TP / (TP + FP).", "Recall = TP / (TP + FN).", "Specificity = TN / (TN + FP).", "F1 = 2 \xD7 precision \xD7 recall / (precision + recall)."] },
      { title: "Choose a metric from the use case", kicker: "MAKE THE TRADE-OFF EXPLICIT", body: "For a screening tool, missing a serious case may be worse than a follow-up check, so recall may matter. For an expensive intervention, false alarms may be costly, so precision matters. ROC-AUC summarizes ranking across thresholds but can look optimistic with extreme class imbalance; precision-recall curves focus more directly on the positive class. Calibration asks whether predicted probabilities match observed frequencies.", kind: "math", example: "If a model assigns 0.7 probability to 100 similar cases, a calibrated model should see roughly 70 positives among them. Calibration is different from ranking: a model can order cases well while its probabilities are systematically too high." },
      { title: "Regression metrics tell a different story", kicker: "WHEN THE TARGET IS A NUMBER", body: "For regression, MAE averages absolute misses and is easy to read in target units. MSE squares misses and emphasizes large errors. RMSE is the square root of MSE, returning to target units. R\xB2 compares the model with predicting the training target mean; it can be negative on held-out data when the model is worse than that baseline.", points: ["MAE = average |y\u2212\u0177|.", "RMSE = square root of average (y\u2212\u0177)\xB2.", "R\xB2 is useful context, not a guarantee of good decisions or causal validity."] }
    ],
    formula: "\\text{precision}=\\frac{TP}{TP+FP} \\qquad \\text{recall}=\\frac{TP}{TP+FN} \\qquad \\text{specificity}=\\frac{TN}{TN+FP}",
    formulaExplanation: "TP and TN are correct positive and negative decisions; FP and FN are false alarms and missed positives. The denominator changes the question each metric answers.",
    code: 'from sklearn.metrics import (\n    confusion_matrix, precision_score, recall_score, f1_score\n)\n\nactual = [1, 1, 0, 0, 0, 0]\npredicted = [1, 0, 0, 0, 1, 0]\n\nprint(confusion_matrix(actual, predicted))\nprint("precision:", precision_score(actual, predicted))\nprint("recall:", recall_score(actual, predicted))\nprint("F1:", f1_score(actual, predicted))',
    codeOutput: "[[3 1]\n [1 1]]\nprecision: 0.5\nrecall: 0.5\nF1: 0.5",
    codeExplanation: "The positive class is `1`. The model found one of two positives (recall 0.5) and one of its two positive predictions was correct (precision 0.5). Always confirm which class is treated as positive.",
    practice: [
      { prompt: "Using TP=8, FN=2, FP=30, TN=960, calculate accuracy, precision, recall, and specificity.", answer: "Accuracy 0.968, precision \u22480.211, recall 0.8, specificity \u22480.970.", solution: "Accuracy=(8+960)/1000=0.968. Precision=8/(8+30)=8/38\u22480.211. Recall=8/(8+2)=0.8. Specificity=960/(960+30)=960/990\u22480.970." },
      { prompt: "Why is 99% accuracy weak evidence when only 1% of examples are positive?", answer: "A majority-class predictor can reach 99% accuracy while detecting zero positive cases.", solution: "With 1,000 examples and only 10 positives, predicting negative for all 1,000 gives TN=990 and FN=10. Accuracy is 990/1000=0.99, but recall is 0/10=0. Always inspect the confusion matrix and the cost of missed positives." },
      { prompt: "A probability threshold moves from 0.5 to 0.2. What behavior should you expect and what must be re-evaluated?", answer: "Usually more positive predictions, higher recall, and lower precision; re-evaluate the chosen operating point on validation data.", solution: "A lower threshold labels more borderline scores as positive. That tends to reduce FN and increase TP, improving recall, but can increase FP and lower precision. Choose the threshold using validation data and an explicit cost or capacity constraint, then report once on test data." }
    ],
    quiz: { question: "Recall measures which fraction?", options: ["Predicted positives that are correct", "Actual positives that the model found", "All predictions that are correct"], answer: 1, explanation: "B is correct: recall divides TP by all actual positives (TP+FN), so it measures how many positives were found. A is precision. C is accuracy. The right metric depends on the downstream cost of each mistake." },
    takeaways: ["Metrics encode priorities; no single score describes every failure.", "Accuracy can hide poor performance on a rare class.", "Precision and recall focus on different error costs."],
    interview: { question: "When might you prefer recall over precision?", answer: "When missing a true positive is more costly than investigating a false alarm, such as an early screening stage. The decision threshold and follow-up capacity still matter." },
    related: ["overfitting-underfitting", "train-validation-test"],
    miniProject: { title: "Choose a threshold for fraud review", objective: "Compare metrics at multiple thresholds and justify an operating point instead of defaulting to accuracy.", tasks: ["Create a validation set with rare fraud labels and model probabilities.", "Calculate confusion-matrix counts at thresholds 0.2, 0.5, and 0.8.", "Compare precision, recall, specificity, and the number of alerts.", "Choose a threshold from review capacity and false-negative cost, then evaluate once on test data."], extension: "Plot a precision-recall curve and calibrate probabilities before using them as risk estimates." }
  },
  {
    number: "08",
    slug: "neural-networks",
    title: "Neural networks: layers of learned features",
    description: "A network is a composition of simple functions. Its power comes from learning useful intermediate representations.",
    module: "Deep learning",
    difficulty: "Beginner",
    estimatedMinutes: 15,
    prerequisites: ["linear-regression", "gradient-descent"],
    objectives: ["Calculate a multi-layer forward pass and loss by hand.", "Explain how backpropagation assigns gradients to parameters.", "Build and train a deterministic PyTorch binary classifier."],
    analogy: "A workshop passes a part through several stations. Early stations detect simple properties, later stations combine them, and the final station makes a decision. Training compares the final decision with the target, then sends a correction signal backward so every station can adjust its settings.",
    intro: "A neural network is a composition of parameterized functions. Each layer combines inputs with weights and biases, then an activation reshapes the result. A forward pass produces a prediction; a loss measures its error; backpropagation computes how each parameter contributed; and an optimizer updates those parameters. The network is not learning during the forward pass alone.",
    sections: [
      { title: "A neuron is a small calculation", kicker: "WEIGHTS + BIAS + ACTIVATION", body: "A unit multiplies inputs by weights, adds a bias, and applies an activation. ReLU returns zero for negative values and keeps positive ones. The weights determine which input patterns matter to the unit.", example: "With inputs x=[2,1], weights w=[0.5,\u22121], and bias b=0.25, the pre-activation is z=2(0.5)+1(\u22121)+0.25=0.25. ReLU leaves a=0.25. If the target is 1 and the model predicts 0.25 with squared loss (a\u2212y)\xB2, the loss is (0.25\u22121)\xB2=0.5625." },
      { title: "A tiny network by hand", kicker: "FORWARD PASS + LOSS", body: "Use input x=[1,2], hidden weights W\u2081=[[1,\u22121],[0.5,1]], hidden bias b\u2081=[0,1], and ReLU. The hidden scores are [1\u22122, 0.5+2+1]=[\u22121,3.5], so hidden activations are [0,3.5]. Let output weights W\u2082=[2,\u22121] and bias b\u2082=0.5. The prediction is 2(0)\u22121(3.5)+0.5=\u22123. If the regression target is 1.5, MSE is (\u22123\u22121.5)\xB2=20.25.", example: "The forward pass gives a complete path from input to loss. Backpropagation now asks how changing each weight would change 20.25. The answer is calculated with the chain rule through the output layer, ReLU, and hidden layer." },
      { title: "Layers build representations", kicker: "FROM INPUT TO OUTPUT", body: "The first layer sees raw features. Later layers receive transformed activations. Combining layers with nonlinear functions can represent relationships that a single linear map cannot. In an image, early layers may respond to edges; later layers can combine them into textures or parts. The useful representation is learned because it helps reduce the task loss.", points: ["Forward propagation computes a prediction.", "The loss compares prediction and target.", "Backpropagation computes parameter gradients.", "An optimizer updates weights and biases."] },
      { title: "A training step changes the network", kicker: "FORWARD \u2192 LOSS \u2192 BACKWARD \u2192 UPDATE", body: "A complete mini-batch step first clears old gradients, computes predictions, calculates loss, calls backward, and lets the optimizer step. Training repeats this over many batches and epochs. Monitor validation loss separately: a network can keep lowering training loss while becoming less useful on new examples.", kind: "math", points: ["An epoch is one pass through the training data.", "A batch is the examples used for one gradient update.", "An optimizer step changes parameters; backward alone only computes gradients."] }
    ],
    formula: "z^{(l)}=W^{(l)}a^{(l-1)}+b^{(l)} \\qquad a^{(l)}=\\phi(z^{(l)}) \\qquad L=\\frac{1}{n}\\sum_i(\\hat{y}_i-y_i)^2",
    formulaExplanation: "Each layer computes a weighted score z and activation a. The final expression is mean squared error for n examples. Backpropagation differentiates L through every layer so an optimizer can update W and b.",
    code: 'import torch\nfrom torch import nn\n\ntorch.manual_seed(7)\n\n# XOR is not linearly separable, so use a hidden layer\nfeatures = torch.tensor([[0., 0.], [0., 1.], [1., 0.], [1., 1.]])\ntargets = torch.tensor([[0.], [1.], [1.], [0.]])\nnetwork = nn.Sequential(\n    nn.Linear(2, 4),\n    nn.Tanh(),\n    nn.Linear(4, 1),\n)\nloss_fn = nn.BCEWithLogitsLoss()\noptimizer = torch.optim.Adam(network.parameters(), lr=0.05)\n\nfor epoch in range(1000):\n    optimizer.zero_grad()          # discard previous gradients\n    logits = network(features)     # forward propagation\n    loss = loss_fn(logits, targets)\n    loss.backward()                # backpropagation\n    optimizer.step()               # update weights and biases\n\nwith torch.no_grad():\n    probabilities = torch.sigmoid(network(features))\n    predictions = (probabilities >= 0.5).float()\nprint("predictions:", predictions.squeeze(1).tolist())\nprint("final loss:", round(loss.item(), 3))',
    codeOutput: "predictions: [0.0, 1.0, 1.0, 0.0]\nfinal loss: 0.0",
    codeExplanation: "The XOR table has four examples and one binary target per row. `BCEWithLogitsLoss` expects raw logits and applies a stable sigmoid-plus-binary-cross-entropy calculation. The loop demonstrates the complete training order. A fixed seed makes the teaching run repeatable on a compatible PyTorch version, though exact final decimals can vary by hardware and release. The network learns an intermediate representation that a single linear layer cannot provide.",
    practice: [
      { prompt: "For x=[2,1], w=[0.5,\u22121], b=0.25, calculate z and ReLU(z).", answer: "z=0.25 and ReLU(z)=0.25.", solution: "Compute 2(0.5)+1(\u22121)+0.25=1\u22121+0.25=0.25. Because z is positive, ReLU returns z unchanged." },
      { prompt: "In the tiny two-layer example, why is the output MSE 20.25 when the prediction is \u22123 and target is 1.5?", answer: "Because (\u22123\u22121.5)\xB2=(\u22124.5)\xB2=20.25.", solution: "Subtract target from prediction: \u22123\u22121.5=\u22124.5. Squaring removes the sign and gives 20.25. A large error means the current parameters produce a poor prediction under this loss." },
      { prompt: "Why does a training loop call zero_grad, backward, and optimizer.step in that order?", answer: "Clear old gradients, compute new gradients from the current loss, then update parameters.", solution: "PyTorch accumulates gradients, so zero_grad prevents old batches from leaking into the new update. backward applies the chain rule to the current loss. step uses those gradients to change parameters." }
    ],
    quiz: { question: "What is the correct order for one ordinary PyTorch training step?", options: ["Update, forward, clear gradients, backward", "Clear gradients, forward, compute loss, backward, update", "Backward before computing a prediction"], answer: 1, explanation: "B is correct: clear accumulated gradients, run the forward pass, compute loss, backpropagate, and let the optimizer update parameters. The other orders use stale or missing information." },
    takeaways: ["A neuron computes a weighted sum, bias, and activation.", "Layers transform inputs into learned intermediate representations.", "Nonlinear activations let the network model nonlinear relationships."],
    interview: { question: "What happens if a neural network has no nonlinear activation functions?", answer: "A composition of linear layers is still linear, so depth alone does not make the model more expressive than a single linear transformation." },
    related: ["gradient-descent", "evaluation-metrics"],
    miniProject: { title: "Train a tiny XOR network", objective: "Build intuition for why hidden nonlinear layers matter by fitting the four-row XOR dataset.", tasks: ["Print the XOR features and targets.", "Train the provided network and record loss every 100 epochs.", "Inspect predictions before and after training.", "Remove the hidden layer and explain why a single linear output cannot fit XOR."], extension: "Change hidden width from 2 to 8 and compare learning speed and final predictions across several seeds." }
  },
  ...deepLearningLessons,
  ...supervisedLessons,
  ...visionLessons,
  ...languageLessons,
  ...productionLessons
];
var moduleDrafts = [
  { id: "foundations", number: "01", shortTitle: "ML foundations", title: "Start with the shape of the problem", level: "Beginner", estimatedHours: "2\u20133 hours", lessonSlugs: ["what-is-machine-learning", "supervised-vs-unsupervised", "train-validation-test"], description: "Get clear on what a model learns, what its data says, and how to tell whether a result means anything.", outcomes: ["Inputs & targets", "Learning setups", "Data splits"] },
  { id: "supervised", number: "02", shortTitle: "Supervised learning", title: "Make a prediction you can explain", level: "Beginner", estimatedHours: "4\u20136 hours", lessonSlugs: ["linear-regression", "logistic-regression", "decision-trees-and-ensembles", "feature-engineering-and-pipelines"], description: "Build predictive models for numbers and categories, combine trees into ensembles, and prepare messy data without leaking it.", outcomes: ["Regression & classification", "Trees & ensembles", "Leak-proof pipelines"] },
  { id: "optimization", number: "03", shortTitle: "Optimization", title: "How a model learns its parameters", level: "Beginner", estimatedHours: "1\u20132 hours", lessonSlugs: ["gradient-descent"], description: "Use derivatives and loss to understand the repeated updates behind model training.", outcomes: ["Loss functions", "Gradients", "Learning rate"] },
  { id: "model-quality", number: "04", shortTitle: "Model quality", title: "Trust the evidence, not the headline score", level: "Beginner", estimatedHours: "2\u20133 hours", lessonSlugs: ["overfitting-underfitting", "evaluation-metrics"], description: "Diagnose model fit and choose evaluation measures that match the real cost of mistakes.", outcomes: ["Generalization", "Classification metrics", "Error costs"] },
  { id: "deep-learning", number: "05", shortTitle: "Deep learning", title: "From perceptrons to transformers", level: "Intermediate", estimatedHours: "15\u201320 hours", lessonSlugs: ["neural-networks", "perceptrons", "activation-functions-and-losses", "forward-propagation", "backpropagation", "optimizers", "convolutional-neural-networks", "recurrent-neural-networks", "attention-mechanism", "transformers"], description: "Build from a single artificial neuron through training, convolution, recurrent models, attention, and transformer language models.", outcomes: ["Neurons & activations", "Forward/backward passes", "CNNs & RNNs", "Attention & transformers"] },
  { id: "computer-vision", number: "06", shortTitle: "Computer vision", title: "Teach a model to see patterns", level: "Intermediate", estimatedHours: "4\u20136 hours", lessonSlugs: ["image-data-and-augmentation", "transfer-learning", "object-detection-and-segmentation"], description: "Prepare image data, adapt pretrained models to small datasets, and locate objects with detection and segmentation.", outcomes: ["Image tensors", "Transfer learning", "Detection & segmentation"] },
  { id: "language-models", number: "07", shortTitle: "Language & LLMs", title: "From tokens to useful language tools", level: "Intermediate", estimatedHours: "5\u20137 hours", lessonSlugs: ["tokenization-and-embeddings", "how-llms-generate-text", "retrieval-augmented-generation"], description: "Understand text representations and how language models generate, then ground their answers with retrieval.", outcomes: ["Tokens & embeddings", "Sampling", "RAG"] },
  { id: "production", number: "08", shortTitle: "Production AI", title: "Bring models into the real world", level: "Advanced", estimatedHours: "5\u20137 hours", lessonSlugs: ["serving-models", "monitoring-and-drift", "responsible-ai"], description: "Deploy models safely, catch silent failures with monitoring, and audit outcomes for the people they affect.", outcomes: ["Serving", "Monitoring", "Responsible AI"] }
];
var modules = moduleDrafts.map((module) => ({ ...module, lessonCount: module.lessonSlugs.length }));
var lessons = modules.flatMap((module) => module.lessonSlugs).map((slug, index) => {
  const draft = lessonDrafts.find((item) => item.slug === slug);
  if (!draft) throw new Error(`Module references a missing lesson: ${slug}`);
  return { ...draft, ...lessonExtras[slug], number: String(index + 1).padStart(2, "0") };
});

// server/src/catalog.ts
var lessonBySlug = new Map(lessons.map((lesson) => [lesson.slug, lesson]));
var publishedLessonSlugs = new Set(lessonBySlug.keys());
function findPublishedLesson(slug) {
  return lessonBySlug.get(slug);
}
function getPublishedModules() {
  return modules.map((module) => ({
    id: module.id,
    title: module.title,
    shortTitle: module.shortTitle,
    level: module.level,
    lessonSlugs: module.lessonSlugs.filter((slug) => publishedLessonSlugs.has(slug))
  }));
}

// server/src/routes/progress.ts
var progressRouter = Router2();
progressRouter.use(authenticate);
function ignoreDuplicates(error) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11e3) return;
  throw error;
}
function requireLesson(rawSlug) {
  const slug = parseSlug(rawSlug);
  const lesson = findPublishedLesson(slug);
  if (!lesson) throw new HttpError(404, "Published lesson not found");
  return lesson;
}
async function recordActivityDay(userId, day) {
  if (day) await User.updateOne({ _id: userId }, { $addToSet: { activityDays: day } });
}
progressRouter.get("/", async (request, response) => {
  const userId = request.auth.userId;
  const [progress, user] = await Promise.all([
    LessonProgress.find({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ lastAccessedAt: -1 }).lean(),
    User.findById(userId).select("+activityDays").lean()
  ]);
  response.json({ data: { progress, activity: user?.activityDays ?? [] } });
});
progressRouter.post("/import", validateBody(importProgressSchema), async (request, response) => {
  const userId = new Types.ObjectId(request.auth.userId);
  const body = request.body;
  const published = (slug) => publishedLessonSlugs.has(slug);
  const now = /* @__PURE__ */ new Date();
  const completed = [...new Set(body.completed)].filter(published);
  const bookmarks = [...new Set(body.bookmarks)].filter(published);
  const notes = Object.entries(body.notes).filter(([slug, content]) => published(slug) && content.trim());
  await Promise.all([
    completed.length && LessonProgress.bulkWrite(completed.map((lessonSlug2) => ({ updateOne: {
      filter: { userId, lessonSlug: lessonSlug2, isCompleted: { $ne: true } },
      update: { $set: { isCompleted: true, completedAt: now }, $setOnInsert: { lastAccessedAt: now } },
      upsert: true
    } })), { ordered: false }).catch(ignoreDuplicates),
    bookmarks.length && Bookmark.bulkWrite(bookmarks.map((lessonSlug2) => ({ updateOne: {
      filter: { userId, lessonSlug: lessonSlug2 },
      update: { $setOnInsert: { userId, lessonSlug: lessonSlug2 } },
      upsert: true
    } })), { ordered: false }),
    notes.length && LessonNote.bulkWrite(notes.map(([lessonSlug2, content]) => ({ updateOne: {
      filter: { userId, lessonSlug: lessonSlug2 },
      update: { $setOnInsert: { content } },
      upsert: true
    } })), { ordered: false }),
    body.activity.length && User.updateOne({ _id: userId }, { $addToSet: { activityDays: { $each: body.activity } } })
  ]);
  response.json({ data: { imported: true } });
});
progressRouter.get("/dashboard", async (request, response) => {
  const userId = request.auth.userId;
  const [progress, bookmarks, attempts] = await Promise.all([
    LessonProgress.find({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ lastAccessedAt: -1 }).lean(),
    Bookmark.find({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ createdAt: -1 }).lean(),
    QuizAttempt.find({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ attemptedAt: -1 }).limit(100).lean()
  ]);
  const completed = new Set(progress.filter((item) => item.isCompleted).map((item) => item.lessonSlug));
  const accessed = progress.filter((item) => item.lastAccessedAt).sort((first, second) => second.lastAccessedAt.getTime() - first.lastAccessedAt.getTime());
  const continueLesson = accessed.find((item) => !item.isCompleted) ?? accessed[0];
  const courseProgress = getPublishedModules().map((module) => {
    const completedCount = module.lessonSlugs.filter((slug) => completed.has(slug)).length;
    const total = module.lessonSlugs.length;
    return { moduleId: module.id, title: module.title, completed: completedCount, total, percentage: total ? Math.round(completedCount / total * 100) : 0 };
  });
  const latestByLesson = /* @__PURE__ */ new Map();
  const bestByLesson = /* @__PURE__ */ new Map();
  for (const attempt of attempts) {
    if (!latestByLesson.has(attempt.lessonSlug)) latestByLesson.set(attempt.lessonSlug, attempt);
    const currentBest = bestByLesson.get(attempt.lessonSlug);
    if (!currentBest || attempt.score / attempt.totalQuestions > currentBest.score / currentBest.totalQuestions) bestByLesson.set(attempt.lessonSlug, attempt);
  }
  const lessonInfo = (slug) => {
    const lesson = findPublishedLesson(slug);
    return lesson ? { slug, title: lesson.title, module: lesson.module } : null;
  };
  response.json({ data: {
    totalPublishedLessons: publishedLessonSlugs.size,
    completedLessons: completed.size,
    overallProgress: publishedLessonSlugs.size ? Math.round(completed.size / publishedLessonSlugs.size * 100) : 0,
    courseProgress,
    continueLearning: continueLesson ? lessonInfo(continueLesson.lessonSlug) : lessonInfo([...publishedLessonSlugs][0]),
    recentlyAccessed: accessed.slice(0, 6).map((item) => ({ ...lessonInfo(item.lessonSlug), lastAccessedAt: item.lastAccessedAt, isCompleted: item.isCompleted })),
    bookmarks: bookmarks.map((item) => ({ ...lessonInfo(item.lessonSlug), createdAt: item.createdAt })),
    latestQuizAttempts: [...latestByLesson.values()].slice(0, 5),
    bestQuizAttempts: [...bestByLesson.values()].slice(0, 5)
  } });
});
progressRouter.get("/:lessonSlug", async (request, response) => {
  const lesson = requireLesson(request.params.lessonSlug);
  const progress = await LessonProgress.findOne({ userId: request.auth.userId, lessonSlug: lesson.slug }).lean();
  response.json({ data: { progress } });
});
progressRouter.post("/:lessonSlug/accessed", validateBody(accessedSchema), async (request, response) => {
  const lesson = requireLesson(request.params.lessonSlug);
  await recordActivityDay(request.auth.userId, request.body.day);
  const progress = await LessonProgress.findOneAndUpdate(
    { userId: request.auth.userId, lessonSlug: lesson.slug },
    { $set: { lastAccessedAt: /* @__PURE__ */ new Date() }, $setOnInsert: { isCompleted: false, completedAt: null } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  response.json({ data: { progress } });
});
progressRouter.put("/:lessonSlug", validateBody(progressSchema), async (request, response) => {
  const lesson = requireLesson(request.params.lessonSlug);
  const body = request.body;
  await recordActivityDay(request.auth.userId, body.day);
  const existing = await LessonProgress.findOne({ userId: request.auth.userId, lessonSlug: lesson.slug }).lean();
  const update = { lastAccessedAt: /* @__PURE__ */ new Date() };
  if (body.lastSection !== void 0) update.lastSection = body.lastSection;
  if (body.isCompleted !== void 0) {
    update.isCompleted = body.isCompleted;
    update.completedAt = body.isCompleted ? existing?.isCompleted && existing.completedAt ? existing.completedAt : /* @__PURE__ */ new Date() : null;
  }
  const insertDefaults = body.isCompleted === void 0 ? { isCompleted: false, completedAt: null } : {};
  const progress = await LessonProgress.findOneAndUpdate(
    { userId: request.auth.userId, lessonSlug: lesson.slug },
    { $set: update, $setOnInsert: insertDefaults },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  response.json({ data: { progress } });
});

// server/src/routes/bookmarks.ts
import { Router as Router3 } from "express";
var bookmarkRouter = Router3();
bookmarkRouter.use(authenticate);
bookmarkRouter.get("/", async (request, response) => {
  const bookmarks = await Bookmark.find({ userId: request.auth.userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ createdAt: -1 }).lean();
  response.json({ data: { bookmarks } });
});
bookmarkRouter.post("/", async (request, response) => {
  const slug = parseSlug(request.body?.lessonSlug);
  if (!findPublishedLesson(slug)) throw new HttpError(404, "Published lesson not found");
  try {
    const bookmark = await Bookmark.findOneAndUpdate(
      { userId: request.auth.userId, lessonSlug: slug },
      { $setOnInsert: { userId: request.auth.userId, lessonSlug: slug } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    response.status(201).json({ data: { bookmark } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11e3) {
      const bookmark = await Bookmark.findOne({ userId: request.auth.userId, lessonSlug: slug }).lean();
      response.status(200).json({ data: { bookmark } });
      return;
    }
    throw error;
  }
});
bookmarkRouter.delete("/:lessonSlug", async (request, response) => {
  const slug = parseSlug(request.params.lessonSlug);
  if (!findPublishedLesson(slug)) throw new HttpError(404, "Published lesson not found");
  const result = await Bookmark.deleteOne({ userId: request.auth.userId, lessonSlug: slug });
  response.json({ data: { removed: result.deletedCount === 1 } });
});

// server/src/routes/notes.ts
import { Router as Router4 } from "express";
var noteRouter = Router4();
noteRouter.use(authenticate);
noteRouter.get("/:lessonSlug", async (request, response) => {
  const slug = parseSlug(request.params.lessonSlug);
  if (!findPublishedLesson(slug)) throw new HttpError(404, "Published lesson not found");
  const note = await LessonNote.findOne({ userId: request.auth.userId, lessonSlug: slug }).lean();
  response.json({ data: { note } });
});
noteRouter.put("/:lessonSlug", validateBody(noteSchema), async (request, response) => {
  const slug = parseSlug(request.params.lessonSlug);
  if (!findPublishedLesson(slug)) throw new HttpError(404, "Published lesson not found");
  const { content } = request.body;
  if (!content.trim()) {
    await LessonNote.deleteOne({ userId: request.auth.userId, lessonSlug: slug });
    response.json({ data: { note: null, deleted: true } });
    return;
  }
  const note = await LessonNote.findOneAndUpdate(
    { userId: request.auth.userId, lessonSlug: slug },
    { $set: { content }, $setOnInsert: { userId: request.auth.userId, lessonSlug: slug } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  response.json({ data: { note } });
});
noteRouter.delete("/:lessonSlug", async (request, response) => {
  const slug = parseSlug(request.params.lessonSlug);
  if (!findPublishedLesson(slug)) throw new HttpError(404, "Published lesson not found");
  const result = await LessonNote.deleteOne({ userId: request.auth.userId, lessonSlug: slug });
  response.json({ data: { removed: result.deletedCount === 1 } });
});

// server/src/routes/quizzes.ts
import { Router as Router5 } from "express";
import { Types as Types2 } from "mongoose";
var quizRouter = Router5();
quizRouter.use(authenticate);
quizRouter.post("/", validateBody(quizAttemptSchema), async (request, response) => {
  const { lessonSlug: lessonSlug2, selectedIndex } = request.body;
  const lesson = findPublishedLesson(lessonSlug2);
  if (!lesson) throw new HttpError(404, "Published lesson not found");
  if (selectedIndex >= lesson.quiz.options.length) throw new HttpError(400, "Selected answer is outside the quiz options");
  const totalQuestions = 1;
  const score = selectedIndex === lesson.quiz.answer ? 1 : 0;
  const [attempt] = await Promise.all([
    QuizAttempt.create({ userId: request.auth.userId, lessonSlug: lessonSlug2, score, totalQuestions, attemptedAt: /* @__PURE__ */ new Date() }),
    LessonProgress.findOneAndUpdate(
      { userId: request.auth.userId, lessonSlug: lessonSlug2 },
      { $set: { quizScore: score / totalQuestions, lastAccessedAt: /* @__PURE__ */ new Date() }, $setOnInsert: { isCompleted: false, completedAt: null } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    )
  ]);
  response.status(201).json({ data: { attempt } });
});
quizRouter.get("/", async (request, response) => {
  const { page, limit } = listQuerySchema.parse(request.query);
  const userId = request.auth.userId;
  const [attempts, total, best] = await Promise.all([
    QuizAttempt.find({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }).sort({ attemptedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    QuizAttempt.countDocuments({ userId, lessonSlug: { $in: [...publishedLessonSlugs] } }),
    QuizAttempt.aggregate([
      { $match: { userId: new Types2.ObjectId(userId), lessonSlug: { $in: [...publishedLessonSlugs] } } },
      { $addFields: { ratio: { $divide: ["$score", "$totalQuestions"] } } },
      { $sort: { ratio: -1, attemptedAt: -1 } },
      { $group: { _id: "$lessonSlug", attempt: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$attempt" } }
    ])
  ]);
  response.json({ data: { attempts, best, page, limit, total, pages: Math.ceil(total / limit) } });
});
quizRouter.get("/:lessonSlug", async (request, response) => {
  const slug = parseSlug(request.params.lessonSlug);
  if (!findPublishedLesson(slug)) throw new HttpError(404, "Published lesson not found");
  const userId = request.auth.userId;
  const [latest, best, totalAttempts] = await Promise.all([
    QuizAttempt.findOne({ userId, lessonSlug: slug }).sort({ attemptedAt: -1 }).lean(),
    QuizAttempt.findOne({ userId, lessonSlug: slug }).sort({ score: -1, attemptedAt: -1 }).lean(),
    QuizAttempt.countDocuments({ userId, lessonSlug: slug })
  ]);
  response.json({ data: { latest, best, totalAttempts } });
});

// server/src/app.ts
var app = express();
app.disable("x-powered-by");
if (process.env.VERCEL) app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || isTrustedOrigin(origin)),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());
app.get("/api/health", (_request, response) => {
  const database = databaseStatus();
  response.status(database.database === "connected" ? 200 : 503).json({ data: {
    status: database.database === "connected" ? "ok" : "degraded",
    ...database,
    google: env.googleConfigured,
    email: env.emailConfigured
  } });
});
app.use("/api", rateLimit2({ windowMs: 6e4, limit: 180, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many requests. Please slow down and try again shortly." } }));
app.use("/api/auth", authRouter);
app.use("/api/progress", progressRouter);
app.use("/api/bookmarks", bookmarkRouter);
app.use("/api/notes", noteRouter);
app.use("/api/quizzes/attempts", quizRouter);
app.use((_request, response) => response.status(404).json({ error: "API route not found" }));
app.use(errorHandler);

// server/src/serverless.ts
async function handler(req, res) {
  try {
    await connectDatabase(env.MONGODB_URI);
  } catch (error) {
    console.error("MongoDB is unavailable for API request:", error instanceof Error ? error.message : String(error));
    if (!req.url?.startsWith("/api/health")) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Database is unavailable. Please try again later." }));
      return;
    }
  }
  return app(req, res);
}
export {
  app,
  handler as default
};
