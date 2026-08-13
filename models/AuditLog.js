// models/AuditLog.js - Record of admin actions.
//
// The dashboard can delete clients, send messages to customers, and toggle
// outreach. Without a trail there's no way to answer "who paused this client"
// or "why did this customer get two reminders".
import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g. "client.delete", "outreach.toggle"
  actor: { type: String, default: "admin" }, // who did it (admin session / "system")
  targetType: { type: String, default: "" }, // "client" | "event" | "outreach" | ...
  targetId: { type: String, default: "" },
  summary: { type: String, default: "" }, // human-readable one-liner
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

// Keep 90 days of history — enough to investigate, bounded so it can't grow
// without limit on a small Atlas tier.
AuditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 }
);

export const AuditLog = mongoose.model("AuditLog", AuditLogSchema);
