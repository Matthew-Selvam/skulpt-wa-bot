// routes/adminDashboard.js - Admin dashboard (page + JSON API)
//
// GET  /admin                    -> dashboard UI (public/ admin.html)
// GET  /admin/api/stats          -> dashboard counters
// GET  /admin/api/clients        -> list clients with events
// POST /admin/api/clients        -> add client {name, phone, email?, notes?}
// PUT  /admin/api/clients/:id    -> update client {name?, email?, notes?, active?}
// DELETE /admin/api/clients/:id  -> remove client
// POST /admin/api/clients/:id/events             -> add event {name, date, type?}
// DELETE /admin/api/clients/:id/events/:eventId  -> remove event
// POST /admin/api/clients/:id/events/:eventId/remind -> send reminder manually
// POST /admin/api/clients/sync   -> import past-order clients
// POST /admin/api/outreach/run   -> run scheduler now
// GET  /admin/api/outreach       -> scheduler status/config
// POST /admin/api/outreach/toggle -> enable/disable {enabled: boolean}
//
// All /api/* endpoints require:  Authorization: Bearer <ADMIN_PASSWORD>
import express from "express";
import crypto from "crypto";
import path from "path";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Client } from "../models/Client.js";
import WhatsAppBusinessAPI from "../whatsapp-api-client.js";
import {
  isOutreachEnabled,
  setOutreachEnabled,
  runOutreachCheck,
  getLastRunAt,
  syncClientsFromOrders,
  sanitizePhone,
  buildOutreachMessage,
} from "../services/outreachService.js";
import { fullReport } from "../services/analytics.js";
import { exportClientsCsv, importClientsCsv } from "../services/clientCsv.js";
import { recordAudit, recentAudit } from "../services/auditLog.js";
import { listTemplates, selectTemplate } from "../services/outreachTemplates.js";

const router = express.Router();
const whatsappAPI = new WhatsAppBusinessAPI();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// With no password configured the dashboard is disabled outright rather than
// falling back to a shared default — an unset env var must never mean
// "publicly reachable admin panel".
const DASHBOARD_DISABLED = !ADMIN_PASSWORD;

// Tokens are signed with a dedicated secret when provided, otherwise derived
// from the admin password — so rotating the password invalidates old sessions.
const JWT_SECRET =
  process.env.ADMIN_JWT_SECRET ||
  (ADMIN_PASSWORD
    ? crypto.createHash("sha256").update(`trophybot:${ADMIN_PASSWORD}`).digest("hex")
    : "");
const TOKEN_TTL = process.env.ADMIN_SESSION_TTL || "12h";

/** Constant-time password comparison (length-safe). */
function passwordMatches(candidate) {
  const a = Buffer.from(String(candidate ?? ""));
  const b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAuth(req, res, next) {
  if (DASHBOARD_DISABLED) {
    return res
      .status(503)
      .json({ error: "Admin dashboard disabled: ADMIN_PASSWORD is not set" });
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    // Distinguish expiry so the UI can prompt a re-login rather than
    // reporting a generic failure.
    const expired = err.name === "TokenExpiredError";
    return res
      .status(401)
      .json({ error: expired ? "Session expired" : "Unauthorized", expired });
  }
}

export { DASHBOARD_DISABLED, IS_PRODUCTION };

function isBadId(res, id) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "Not found" });
    return true;
  }
  return false;
}

function serializeEvent(e) {
  return {
    id: e._id,
    name: e.name,
    date: e.date,
    type: e.type,
    reminderCount: e.reminder?.count || 0,
    lastSentAt: e.reminder?.lastSentAt || null,
    responded: e.responded,
    needsProducts: e.needsProducts,
    response: e.response,
    responseAt: e.responseAt,
  };
}

function serializeClient(c) {
  return {
    id: c._id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    active: c.active,
    source: c.source,
    lastOrderAt: c.lastOrderAt,
    createdAt: c.createdAt,
    events: [...c.events]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(serializeEvent),
  };
}

// Dashboard page (thin shell — data comes from the API).
// Served only when a password is configured, so an unconfigured deployment
// doesn't advertise the admin panel's existence.
router.get("/", (_req, res) => {
  if (DASHBOARD_DISABLED) {
    return res
      .status(503)
      .send("Admin dashboard disabled: ADMIN_PASSWORD is not set.");
  }
  res.sendFile(path.join(process.cwd(), "public", "admin.html"));
});

// --- Login: exchange the admin password for a short-lived token ---
// Deliberately mounted before requireAuth, and rate limited separately from
// the rest of the API since this is the credential-guessing surface.
const loginAttempts = new Map(); // ip -> { count, first }
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 10);

router.post("/api/login", async (req, res) => {
  if (DASHBOARD_DISABLED) {
    return res
      .status(503)
      .json({ error: "Admin dashboard disabled: ADMIN_PASSWORD is not set" });
  }

  const ip = req.ip || "unknown";
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (record && now - record.first < LOGIN_WINDOW_MS && record.count >= LOGIN_MAX_ATTEMPTS) {
    await recordAudit(
      { action: "admin.login.blocked", targetType: "admin", summary: `Too many failed logins from ${ip}` },
      req
    );
    return res.status(429).json({ error: "Too many failed attempts. Try again later." });
  }

  if (!passwordMatches(req.body?.password)) {
    const next = !record || now - record.first >= LOGIN_WINDOW_MS
      ? { count: 1, first: now }
      : { count: record.count + 1, first: record.first };
    loginAttempts.set(ip, next);
    await recordAudit(
      { action: "admin.login.failed", targetType: "admin", summary: `Failed login from ${ip}` },
      req
    );
    return res.status(401).json({ error: "Incorrect password" });
  }

  loginAttempts.delete(ip);
  const token = jwt.sign({ sub: "admin" }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  await recordAudit(
    { action: "admin.login", targetType: "admin", summary: `Admin signed in from ${ip}` },
    req
  );
  res.json({ token, expiresIn: TOKEN_TTL });
});

// Everything else under /api requires a valid token
router.use("/api", requireAuth);

router.get("/api/stats", async (_req, res) => {
  try {
    const clients = await Client.find();
    const allEvents = clients.flatMap((c) => c.events);
    const now = new Date();
    res.json({
      clients: clients.length,
      activeClients: clients.filter((c) => c.active).length,
      upcomingEvents: allEvents.filter((e) => new Date(e.date) >= now).length,
      pendingReplies: allEvents.filter((e) => !e.responded && (e.reminder?.count || 0) > 0).length,
      needsProducts: allEvents.filter((e) => e.responded && e.needsProducts).length,
      outreachEnabled: isOutreachEnabled(),
      lastRunAt: getLastRunAt(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/clients", async (_req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json(clients.map(serializeClient));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/clients", async (req, res) => {
  try {
    const { name, phone, email = "", notes = "" } = req.body || {};
    if (!name || !phone) return res.status(400).json({ error: "name and phone are required" });
    const clean = sanitizePhone(phone);
    if (clean.length < 10) return res.status(400).json({ error: "Phone number looks too short" });
    const existing = await Client.findOne({ phone: clean });
    if (existing) {
      return res.status(409).json({ error: `Client with phone ${clean} already exists (${existing.name})` });
    }
    const client = await Client.create({ name, phone: clean, email, notes, source: "admin" });
    await recordAudit(
      { action: "client.create", targetType: "client", targetId: String(client._id), summary: `Added client ${name} (${clean})` },
      req
    );
    res.status(201).json(serializeClient(client));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/api/clients/:id", async (req, res) => {
  try {
    if (isBadId(res, req.params.id)) return;
    const { name, email, notes, active } = req.body || {};
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ error: "Not found" });
    const wasActive = client.active;
    if (name !== undefined) client.name = name;
    if (email !== undefined) client.email = email;
    if (notes !== undefined) client.notes = notes;
    if (active !== undefined) client.active = !!active;
    await client.save();

    // Pause/resume is the change most worth being able to trace later
    const summary =
      active !== undefined && wasActive !== client.active
        ? `${client.active ? "Resumed" : "Paused"} outreach for ${client.name}`
        : `Updated client ${client.name}`;
    await recordAudit(
      { action: "client.update", targetType: "client", targetId: String(client._id), summary },
      req
    );
    res.json(serializeClient(client));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/clients/:id", async (req, res) => {
  try {
    if (isBadId(res, req.params.id)) return;
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ error: "Not found" });
    await recordAudit(
      {
        action: "client.delete",
        targetType: "client",
        targetId: String(client._id),
        summary: `Deleted client ${client.name} (${client.phone})`,
        // Keep enough to reconstruct the record if the deletion was a mistake
        metadata: { name: client.name, phone: client.phone, email: client.email, events: client.events?.length || 0 },
      },
      req
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/clients/:id/events", async (req, res) => {
  try {
    if (isBadId(res, req.params.id)) return;
    const { name, date, type = "" } = req.body || {};
    if (!name || !date) return res.status(400).json({ error: "name and date are required" });
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ error: "Not found" });
    client.events.push({ name, date: new Date(date), type });
    await client.save();
    res.status(201).json(serializeClient(client));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/clients/:id/events/:eventId", async (req, res) => {
  try {
    if (isBadId(res, req.params.id) || isBadId(res, req.params.eventId)) return;
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ error: "Not found" });
    const event = client.events.id(req.params.eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    event.deleteOne();
    await client.save();
    res.json(serializeClient(client));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/clients/:id/events/:eventId/remind", async (req, res) => {
  try {
    if (isBadId(res, req.params.id) || isBadId(res, req.params.eventId)) return;
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ error: "Not found" });
    const event = client.events.id(req.params.eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    const text = buildOutreachMessage(client, event);
    const result = await whatsappAPI.sendMessage(sanitizePhone(client.phone), text);
    if (result.success) {
      event.reminder = {
        count: (event.reminder?.count || 0) + 1,
        lastSentAt: new Date(),
      };
      await client.save();
      await recordAudit(
        {
          action: "outreach.remind",
          targetType: "event",
          targetId: String(event._id),
          summary: `Manual reminder sent to ${client.name} for ${event.name}`,
          metadata: { clientId: String(client._id), template: selectTemplate(event).id },
        },
        req
      );
      res.json(serializeClient(client));
    } else {
      res.status(500).json({ error: "WhatsApp send failed", detail: result.error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/clients/sync", async (_req, res) => {
  try {
    const added = await syncClientsFromOrders();
    res.json({ added });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/outreach/run", async (_req, res) => {
  try {
    res.json(await runOutreachCheck());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/outreach", (_req, res) => {
  res.json({
    enabled: isOutreachEnabled(),
    lastRunAt: getLastRunAt(),
    remindDaysBefore: Number(process.env.REMINDER_DAYS_BEFORE || 7),
    maxReminders: Number(process.env.MAX_REMINDERS || 2),
    cooldownDays: Number(process.env.REMINDER_COOLDOWN_DAYS || 2),
    replyWindowDays: Number(process.env.REPLY_WINDOW_DAYS || 30),
    template: process.env.OUTREACH_TEMPLATE_NAME || null,
    checkIntervalMs: Number(process.env.OUTREACH_CHECK_INTERVAL_MS || 3600000),
  });
});

router.post("/api/outreach/toggle", async (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled (boolean) is required" });
  }
  const value = setOutreachEnabled(enabled);
  await recordAudit(
    {
      action: "outreach.toggle",
      targetType: "outreach",
      summary: `Outreach ${value ? "enabled" : "paused"}`,
    },
    req
  );
  res.json({ enabled: value });
});

// -------------------- ANALYTICS --------------------
router.get("/api/analytics", async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    res.json(await fullReport({ days }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------- CSV IMPORT / EXPORT --------------------
router.get("/api/clients/export", async (req, res) => {
  try {
    const csv = await exportClientsCsv();
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="clients-${stamp}.csv"`);
    await recordAudit(
      { action: "clients.export", targetType: "client", summary: "Exported client list as CSV" },
      req
    );
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accepts raw CSV (text/csv) or JSON { csv: "..." }
router.post(
  "/api/clients/import",
  express.text({ type: "text/csv", limit: "5mb" }),
  async (req, res) => {
    try {
      const csv = typeof req.body === "string" ? req.body : req.body?.csv;
      if (!csv || !csv.trim()) {
        return res.status(400).json({ error: "No CSV content provided" });
      }
      const result = await importClientsCsv(csv);
      await recordAudit(
        {
          action: "clients.import",
          targetType: "client",
          summary: `Imported clients: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped`,
          metadata: result,
        },
        req
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// -------------------- AUDIT LOG --------------------
router.get("/api/audit", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const entries = await recentAudit(limit);
    res.json(
      entries.map((e) => ({
        id: e._id,
        action: e.action,
        actor: e.actor,
        targetType: e.targetType,
        targetId: e.targetId,
        summary: e.summary,
        metadata: e.metadata,
        createdAt: e.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------- TEMPLATES --------------------
router.get("/api/templates", (_req, res) => {
  res.json({ templates: listTemplates() });
});

export default router;
