// services/outreachService.js - Client management & recurring event outreach
//
// Handles:
//  - Admin-only WhatsApp commands (add/list/remove clients & events, sync, outreach control)
//  - The recurring reminder scheduler (sends "do you need trophies?" messages before events)
//  - Client reply classification (yes → lead + order flow, no → logged, unknown → logged)
import { Client } from "../models/Client.js";
import { Order } from "../models/Order.js";
import { Trophy } from "../models/Trophy.js";
import WhatsAppBusinessAPI from "../whatsapp-api-client.js";
import { renderOutreach } from "./outreachTemplates.js";

const whatsappAPI = new WhatsAppBusinessAPI();

// -------------------- CONFIGURATION (env overridable) --------------------
const ADMIN_NUMBER = process.env.ADMIN_NUMBER || "";
const REMINDER_DAYS_BEFORE = Number(process.env.REMINDER_DAYS_BEFORE || 7);
const MAX_REMINDERS = Number(process.env.MAX_REMINDERS || 2);
const REMINDER_COOLDOWN_DAYS = Number(process.env.REMINDER_COOLDOWN_DAYS || 2);
const REPLY_WINDOW_DAYS = Number(process.env.REPLY_WINDOW_DAYS || 30);
// Optional approved Meta template for outreach (required in production to message
// clients outside the 24h customer-service window). Falls back to free-form text.
const OUTREACH_TEMPLATE_NAME = process.env.OUTREACH_TEMPLATE_NAME || "";

// Runtime toggle (can be flipped by admin command or dashboard)
let outreachEnabled = process.env.OUTREACH_ENABLED !== "false";
let lastRunAt = null;

const MS_PER_DAY = 86400000;

// -------------------- PUBLIC STATE --------------------
export function isOutreachEnabled() {
  return outreachEnabled;
}

export function setOutreachEnabled(v) {
  outreachEnabled = !!v;
  return outreachEnabled;
}

export function getLastRunAt() {
  return lastRunAt;
}

// -------------------- HELPERS --------------------
export function sanitizePhone(p) {
  return String(p || "").replace(/\D/g, "");
}

export function isAdminPhone(phone) {
  const a = sanitizePhone(ADMIN_NUMBER);
  const b = sanitizePhone(phone);
  return a.length > 0 && b.length > 0 && (a === b || a.endsWith(b) || b.endsWith(a));
}

export function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parseDateInput(s) {
  // Accepts YYYY-MM-DD or DD-MM-YYYY
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T12:00:00`);
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T12:00:00`);
  return null;
}

async function sendAdmin(message) {
  if (!ADMIN_NUMBER) return;
  try {
    await whatsappAPI.sendMessage(sanitizePhone(ADMIN_NUMBER), message);
  } catch (err) {
    console.error("⚠️ Failed to notify admin:", err.message);
  }
}

// -------------------- MESSAGE BUILDERS --------------------
/**
 * Reminder text for a client/event. Wording is chosen from the template
 * library by event type (birthday, tournament, ...), falling back to the
 * original generic message when nothing matches.
 */
export function buildOutreachMessage(client, event) {
  return renderOutreach(client, event, formatDate(event.date));
}

export async function buildCatalogMessage(header = "") {
  const trophies = await Trophy.find();
  if (!trophies.length) return "⚠️ No trophies found in catalog.";
  let response = header || "🏆 *Available Trophies:*\n\n";
  trophies.forEach((t, i) => {
    response += `${i + 1}. ${t.name} - *₹${t.price}*\n`;
  });
  response +=
    "\n💡 Reply with a *number* to select a trophy, add your customization text, then *checkout* and *pay*!";
  return response;
}

// -------------------- REMINDER SCHEDULER --------------------
// Exported for unit testing — the reminder cadence rules are subtle enough
// (window, max count, spacing, cooldown) to be worth pinning down directly.
export function isEventDue(event, now = Date.now()) {
  if (event.responded) return false;
  const daysUntil = (new Date(event.date).getTime() - now) / MS_PER_DAY;
  if (daysUntil < 0 || daysUntil > REMINDER_DAYS_BEFORE) return false;
  const count = event.reminder?.count || 0;
  if (count >= MAX_REMINDERS) return false;
  // Space reminders out as the event approaches
  const threshold = REMINDER_DAYS_BEFORE - count * REMINDER_COOLDOWN_DAYS;
  if (daysUntil > threshold) return false;
  if (event.reminder?.lastSentAt) {
    const sinceLast = now - new Date(event.reminder.lastSentAt).getTime();
    if (sinceLast < REMINDER_COOLDOWN_DAYS * MS_PER_DAY) return false;
  }
  return true;
}

export async function runOutreachCheck() {
  if (!outreachEnabled) {
    console.log("⏸ Outreach disabled — skipping run");
    return { sent: 0, due: 0, skipped: true };
  }
  let sent = 0;
  let due = 0;
  const clients = await Client.find({ active: true });
  for (const client of clients) {
    for (const event of client.events) {
      if (!isEventDue(event)) continue;
      due++;
      const ok = await sendOutreach(client, event);
      if (ok) {
        event.reminder = {
          count: (event.reminder?.count || 0) + 1,
          lastSentAt: new Date(),
        };
        await client.save();
        sent++;
      }
    }
  }
  lastRunAt = new Date();
  console.log(`📣 Outreach run complete: ${sent}/${due} reminders sent`);
  return { sent, due, skipped: false, lastRunAt };
}

async function sendOutreach(client, event) {
  const text = buildOutreachMessage(client, event);
  try {
    if (OUTREACH_TEMPLATE_NAME) {
      const res = await whatsappAPI.sendTemplateMessage(
        sanitizePhone(client.phone),
        OUTREACH_TEMPLATE_NAME,
        "en_US",
        [
          {
            type: "body",
            parameters: [
              { type: "text", text: client.name },
              { type: "text", text: event.name },
              { type: "text", text: formatDate(event.date) },
            ],
          },
        ]
      );
      if (res.success) return true;
      console.warn(
        "⚠️ Template send failed, falling back to free-form text:",
        JSON.stringify(res.error || {}).slice(0, 200)
      );
    }
    const res = await whatsappAPI.sendMessage(sanitizePhone(client.phone), text);
    return res.success;
  } catch (err) {
    console.error("❌ Outreach send error:", err.message);
    return false;
  }
}

export function startOutreachScheduler(
  intervalMs = Number(process.env.OUTREACH_CHECK_INTERVAL_MS || 3600000)
) {
  const run = async () => {
    try {
      await runOutreachCheck();
    } catch (err) {
      console.error("❌ Outreach scheduler error:", err);
    }
  };
  run(); // initial run at startup
  const timer = setInterval(run, intervalMs);
  if (timer.unref) timer.unref();
  console.log(`📣 Outreach scheduler started (every ${Math.round(intervalMs / 60000)} min)`);
  return timer;
}

// -------------------- CLIENT REPLY HANDLING --------------------
export function classifyResponse(text) {
  const t = String(text || "").trim().toLowerCase();
  if (/^\s*(no|nope|nah|n|not needed|dont need|don't need|no thanks|not required|no thank you)\b/.test(t)) {
    return "negative";
  }
  if (
    /\b(yes|yep|yeah|yup|sure|definitely|absolutely|of course|need|needed|want|required|would like|interested)\b/.test(t)
  ) {
    return "positive";
  }
  return "unknown";
}

/**
 * Detect and handle a reply from a client who received an outreach reminder.
 * Returns { handled, messages[], positive } — handled=false means it wasn't an outreach reply.
 */
export async function handleClientReply(phone, rawText) {
  const p = sanitizePhone(phone);
  if (!p) return { handled: false, messages: [], positive: false };
  const client = await Client.findOne({ phone: p });
  if (!client) return { handled: false, messages: [], positive: false };

  // Most recent event that has had a reminder sent but hasn't been answered yet
  const open = client.events
    .filter((e) => (e.reminder?.count || 0) > 0 && !e.responded)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  if (!open) return { handled: false, messages: [], positive: false };

  const windowMs = REPLY_WINDOW_DAYS * MS_PER_DAY;
  const lastReminder = open.reminder.lastSentAt;
  if (lastReminder && Date.now() - new Date(lastReminder).getTime() > windowMs) {
    return { handled: false, messages: [], positive: false };
  }

  const response = classifyResponse(rawText);
  const messages = [];

  if (response === "positive") {
    open.responded = true;
    open.needsProducts = true;
    open.response = String(rawText).trim();
    open.responseAt = new Date();
    messages.push(
      `🎉 Great news, ${client.name}! I've let the team know you need trophies for *${open.name}* on *${formatDate(open.date)}*.`
    );
    messages.push(await buildCatalogMessage("🛒 In the meantime, take a look at our collection:"));
    await sendAdmin(
      `📢 *New Lead!*\n👤 ${client.name} (${p})\n🎖 Event: ${open.name} on ${formatDate(open.date)}\n💬 "${rawText.trim()}"\n✅ Needs products — follow up!`
    );
  } else if (response === "negative") {
    open.responded = true;
    open.needsProducts = false;
    open.response = String(rawText).trim();
    open.responseAt = new Date();
    messages.push(
      `👍 Thanks for letting us know, ${client.name}! If anything changes before *${open.name}*, just message us anytime.`
    );
    await sendAdmin(
      `📢 ${client.name} (${p}) replied *no* for ${open.name} on ${formatDate(open.date)}.`
    );
  } else {
    open.responded = true;
    open.needsProducts = null;
    open.response = String(rawText).trim();
    open.responseAt = new Date();
    messages.push(
      `👌 Thanks, ${client.name}! I've noted that down. If you need anything for *${open.name}*, reply *browse* anytime to see our trophies.`
    );
    await sendAdmin(
      `📢 ${client.name} (${p}) replied to outreach for ${open.name}: "${rawText.trim()}"`
    );
  }

  await client.save();
  return { handled: true, messages, positive: response === "positive" };
}

// -------------------- AUTO-SYNC FROM PAST ORDERS --------------------
export async function syncClientsFromOrders() {
  const orders = await Order.find();
  const seen = new Set();
  let added = 0;
  for (const o of orders) {
    const p = sanitizePhone(o.userId);
    if (!p || p.length < 10 || seen.has(p)) continue;
    seen.add(p);
    const existing = await Client.findOne({ phone: p });
    if (existing) {
      if (!existing.lastOrderAt || o.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = o.createdAt;
        await existing.save();
      }
    } else {
      await Client.create({
        name: `Client ${p.slice(-4)}`,
        phone: p,
        source: "order",
        lastOrderAt: o.createdAt,
      });
      added++;
    }
  }
  return added;
}

// -------------------- ADMIN COMMANDS (WhatsApp) --------------------
function formatClientDetail(c) {
  let msg =
    `👤 *${c.name}*\n` +
    `📱 ${c.phone}` +
    (c.email ? `\n📧 ${c.email}` : "") +
    (c.notes ? `\n📝 ${c.notes}` : "") +
    `\n🔖 Source: ${c.source} | ${c.active ? "✅ active" : "⏸ paused"}` +
    (c.lastOrderAt ? `\n🕘 Last order: ${formatDate(c.lastOrderAt)}` : "");
  if (c.events.length) {
    msg += "\n\n📅 *Events:*\n";
    [...c.events]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((e, i) => {
        const r = e.reminder?.count || 0;
        const status = e.responded
          ? e.needsProducts
            ? "✅ needs products"
            : "🙅 declined"
          : `${r} reminder${r === 1 ? "" : "s"} sent`;
        msg += `${i + 1}. *${e.name}* — ${formatDate(e.date)} — ${status}\n`;
      });
  } else {
    msg += "\n\n📅 No events yet. Use *add event <phone> <YYYY-MM-DD> <name>*";
  }
  return msg;
}

export async function handleAdminCommand(from, rawText) {
  if (!isAdminPhone(from)) return { handled: false, messages: [] };
  const text = String(rawText || "").trim();
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const rest = text.slice(parts[0].length).trim();
  const messages = [];

  try {
    if (cmd === "clients" || (cmd === "list" && parts[1]?.toLowerCase() === "clients")) {
      const clients = await Client.find().sort({ createdAt: -1 });
      if (!clients.length) {
        messages.push("📭 No clients yet. Use *add client <phone> <name>* or the /admin dashboard.");
      } else {
        let msg = `👥 *Clients (${clients.length})*:\n`;
        clients.forEach((c, i) => {
          const upcoming = c.events.filter((e) => new Date(e.date) >= new Date()).length;
          msg += `${i + 1}. *${c.name}* (${c.phone}) — ${c.events.length} events, ${upcoming} upcoming${c.active ? "" : " ⏸"}\n`;
        });
        msg += "\nType *client <phone>* for details.";
        messages.push(msg);
      }
    } else if (cmd === "client") {
      const c = await Client.findOne({ phone: sanitizePhone(rest) });
      messages.push(c ? formatClientDetail(c) : `❌ No client found for *${rest}*.`);
    } else if (cmd === "add" && parts[1]?.toLowerCase() === "client") {
      const m = rest.match(/^(\+?[\d\s\-]+)\s+(.+)$/);
      if (!m) {
        messages.push("⚠️ Usage: *add client <phone> <name>*\nExample: *add client 919876543210 John Doe*");
      } else {
        const phone = sanitizePhone(m[1]);
        const name = m[2].trim();
        if (phone.length < 10) {
          messages.push("⚠️ Phone number looks too short.");
        } else {
          const existing = await Client.findOne({ phone });
          if (existing) {
            existing.name = name;
            await existing.save();
            messages.push(`✅ Updated existing client to *${name}* (${phone}).`);
          } else {
            await Client.create({ name, phone, source: "admin" });
            messages.push(
              `✅ Added client *${name}* (${phone}).\nTip: add their event with *add event ${phone} <YYYY-MM-DD> <event name>*`
            );
          }
        }
      }
    } else if (cmd === "remove" && parts[1]?.toLowerCase() === "client") {
      const c = await Client.findOneAndDelete({ phone: sanitizePhone(rest) });
      messages.push(c ? `🗑 Removed client *${c.name}* (${c.phone}).` : `❌ No client found for *${rest}*.`);
    } else if (cmd === "pause" || cmd === "resume") {
      const c = await Client.findOne({ phone: sanitizePhone(rest) });
      if (!c) {
        messages.push(`❌ No client found for *${rest}*.`);
      } else {
        c.active = cmd === "resume";
        await c.save();
        messages.push(
          c.active
            ? `▶️ *${c.name}* resumed — will receive reminders again.`
            : `⏸ *${c.name}* paused — no more reminders until resumed.`
        );
      }
    } else if (cmd === "add" && parts[1]?.toLowerCase() === "event") {
      const m = rest.match(
        /^(\+?[\d\s\-]+)\s+(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\s+(.+)$/
      );
      if (!m) {
        messages.push(
          "⚠️ Usage: *add event <phone> <YYYY-MM-DD> <event name>*\nExample: *add event 919876543210 2026-12-15 Annual Awards Night*"
        );
      } else {
        const phone = sanitizePhone(m[1]);
        const date = parseDateInput(m[2].replace(/\//g, "-"));
        const name = m[3].trim();
        const c = await Client.findOne({ phone });
        if (!c) {
          messages.push(`❌ No client found for *${phone}*. Add them first with *add client ${phone} <name>*`);
        } else if (!date || isNaN(date)) {
          messages.push("⚠️ Invalid date. Use *YYYY-MM-DD*.");
        } else {
          c.events.push({ name, date });
          await c.save();
          messages.push(
            `✅ Event added for *${c.name}*:\n🎖 ${name} on ${formatDate(date)}\n\nReminders start ${REMINDER_DAYS_BEFORE} days before the event.`
          );
        }
      }
    } else if (cmd === "events") {
      const c = await Client.findOne({ phone: sanitizePhone(rest) });
      if (!c) {
        messages.push(`❌ No client found for *${rest}*.`);
      } else if (!c.events.length) {
        messages.push(`📅 *${c.name}* has no events yet. Add one with *add event ${c.phone} <YYYY-MM-DD> <event name>*`);
      } else {
        messages.push(formatClientDetail(c));
      }
    } else if (cmd === "remove" && parts[1]?.toLowerCase() === "event") {
      const m = rest.match(/^(\+?[\d\s\-]+)\s+(.+)$/);
      const phone = sanitizePhone(m?.[1] || "");
      const key = (m?.[2] || "").trim().toLowerCase();
      const c = await Client.findOne({ phone });
      if (!c) {
        messages.push("❌ No client found.");
      } else {
        const idx = c.events.findIndex(
          (e, i) => key === String(i + 1) || e.name.toLowerCase() === key
        );
        if (idx === -1) {
          messages.push(`❌ No event matching "${key}".`);
        } else {
          const [removed] = c.events.splice(idx, 1);
          await c.save();
          messages.push(`🗑 Removed event *${removed.name}*.`);
        }
      }
    } else if (cmd === "outreach") {
      const sub = parts[1]?.toLowerCase();
      if (sub === "on") {
        setOutreachEnabled(true);
        messages.push("📣 Outreach scheduler *enabled*.");
      } else if (sub === "off") {
        setOutreachEnabled(false);
        messages.push("⏸ Outreach scheduler *paused*.");
      } else if (sub === "run") {
        const r = await runOutreachCheck();
        messages.push(
          r.skipped
            ? "⏸ Outreach is paused. Enable it with *outreach on* first."
            : `📣 Outreach run complete — sent ${r.sent}/${r.due} reminders.`
        );
      } else if (sub === "status") {
        messages.push(
          `📣 *Outreach status:*\n• Enabled: *${isOutreachEnabled() ? "yes" : "no"}*\n• Remind: ${REMINDER_DAYS_BEFORE} days before event\n• Max reminders: ${MAX_REMINDERS} per event\n• Last run: ${getLastRunAt() ? formatDate(getLastRunAt()) + " " + getLastRunAt().toLocaleTimeString() : "never"}`
        );
      } else {
        messages.push(
          "📣 *Outreach commands:*\n• *outreach on|off* — start/stop scheduler\n• *outreach run* — run now\n• *outreach status* — show settings"
        );
      }
    } else if (cmd === "sync" && parts[1]?.toLowerCase() === "clients") {
      const added = await syncClientsFromOrders();
      messages.push(`🔄 Synced past orders — added ${added} new client${added === 1 ? "" : "s"}.`);
    } else {
      messages.push(
        `🛠 *Admin Commands:*\n` +
          `• *add client <phone> <name>*\n` +
          `• *clients* / *client <phone>*\n` +
          `• *add event <phone> <YYYY-MM-DD> <name>*\n` +
          `• *events <phone>*\n` +
          `• *remove client <phone>* / *remove event <phone> <name>*\n` +
          `• *pause <phone>* / *resume <phone>*\n` +
          `• *outreach on|off|run|status*\n` +
          `• *sync clients*\n\n` +
          `💻 Full management: <your-server>/admin`
      );
    }
  } catch (err) {
    console.error("❌ Admin command error:", err);
    messages.push("⚠️ Sorry, that command failed. Please try again.");
  }

  return { handled: true, messages };
}
