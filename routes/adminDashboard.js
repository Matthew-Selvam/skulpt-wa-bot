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

const router = express.Router();
const whatsappAPI = new WhatsAppBusinessAPI();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const expected = `Bearer ${ADMIN_PASSWORD}`;
  const valid =
    auth.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (valid) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

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

// Dashboard page (thin shell — data comes from the API)
router.get("/", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "admin.html"));
});

// Everything under /api requires the admin password
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
    if (name !== undefined) client.name = name;
    if (email !== undefined) client.email = email;
    if (notes !== undefined) client.notes = notes;
    if (active !== undefined) client.active = !!active;
    await client.save();
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

router.post("/api/outreach/toggle", (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled (boolean) is required" });
  }
  res.json({ enabled: setOutreachEnabled(enabled) });
});

export default router;
