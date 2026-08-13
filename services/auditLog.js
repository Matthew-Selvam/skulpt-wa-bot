// services/auditLog.js - Write-side helper for the admin audit trail.
import { AuditLog } from "../models/AuditLog.js";

/**
 * Record an admin action. Never throws: an audit write failing must not break
 * the operation the admin actually asked for — it's logged and swallowed.
 *
 * @param {object} entry
 * @param {string} entry.action     - dotted verb, e.g. "client.delete"
 * @param {string} [entry.targetType]
 * @param {string} [entry.targetId]
 * @param {string} [entry.summary]  - human-readable one-liner
 * @param {object} [entry.metadata]
 * @param {import("express").Request} [req] - for actor/IP
 */
export async function recordAudit(entry, req = null) {
  try {
    await AuditLog.create({
      ...entry,
      actor: entry.actor || req?.admin?.sub || "admin",
      ip: req ? req.ip || req.headers["x-forwarded-for"] || "" : "",
    });
  } catch (err) {
    console.error("⚠️ Failed to write audit log:", err.message);
  }
}

/** Most recent entries, newest first. */
export async function recentAudit(limit = 100) {
  return AuditLog.find().sort({ createdAt: -1 }).limit(limit);
}
