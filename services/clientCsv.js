// services/clientCsv.js - CSV import/export for the client list.
//
// Hand-rolled rather than pulling in a CSV library: the format here is small
// and fixed, but it still has to handle the cases that break naive splitting —
// quoted fields containing commas, escaped quotes, and CRLF line endings.
import { Client } from "../models/Client.js";
import { sanitizePhone } from "./outreachService.js";

const COLUMNS = ["name", "phone", "email", "notes", "active", "events"];

/** Quote a field only when it needs it. */
function esc(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Events serialize into one cell as `name@YYYY-MM-DD|name@YYYY-MM-DD`. */
function encodeEvents(events = []) {
  return events
    .map((e) => `${e.name}@${new Date(e.date).toISOString().slice(0, 10)}`)
    .join("|");
}

function decodeEvents(cell) {
  if (!cell) return [];
  return cell
    .split("|")
    .map((chunk) => {
      const at = chunk.lastIndexOf("@");
      if (at === -1) return null;
      const name = chunk.slice(0, at).trim();
      const date = new Date(chunk.slice(at + 1).trim());
      if (!name || isNaN(date.getTime())) return null;
      return { name, date };
    })
    .filter(Boolean);
}

export async function exportClientsCsv() {
  const clients = await Client.find().sort({ name: 1 });
  const lines = [COLUMNS.join(",")];
  for (const c of clients) {
    lines.push(
      [
        esc(c.name),
        esc(c.phone),
        esc(c.email),
        esc(c.notes),
        esc(c.active ? "yes" : "no"),
        esc(encodeEvents(c.events)),
      ].join(",")
    );
  }
  return lines.join("\n");
}

/**
 * Parse CSV text into rows of cells, honouring quoted fields.
 * Returns string[][] including the header row.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const src = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }

  // Trailing field/row (file may not end with a newline)
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * Import clients from CSV text.
 * Existing phones are updated rather than duplicated. Returns a per-row report
 * so a partial import tells the admin exactly which rows failed and why.
 */
export async function importClientsCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { added: 0, updated: 0, skipped: 0, errors: ["Empty file"] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  if (idx("name") === -1 || idx("phone") === -1) {
    return { added: 0, updated: 0, skipped: 0, errors: ["CSV must have 'name' and 'phone' columns"] };
  }

  let added = 0, updated = 0, skipped = 0;
  const errors = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const lineNo = r + 1;
    const get = (col) => (idx(col) === -1 ? "" : (cells[idx(col)] ?? "").trim());

    const name = get("name");
    const phone = sanitizePhone(get("phone"));

    if (!name || !phone) {
      skipped++;
      errors.push(`Line ${lineNo}: missing name or phone`);
      continue;
    }
    if (phone.length < 10) {
      skipped++;
      errors.push(`Line ${lineNo}: phone "${get("phone")}" looks too short`);
      continue;
    }

    const activeCell = get("active").toLowerCase();
    const active = activeCell === "" ? true : !["no", "false", "0"].includes(activeCell);
    const events = decodeEvents(get("events"));

    try {
      const existing = await Client.findOne({ phone });
      if (existing) {
        existing.name = name;
        if (get("email")) existing.email = get("email");
        if (get("notes")) existing.notes = get("notes");
        existing.active = active;
        // Add only events that aren't already recorded (same name + day)
        for (const e of events) {
          const dup = existing.events.some(
            (x) =>
              x.name === e.name &&
              new Date(x.date).toISOString().slice(0, 10) ===
                e.date.toISOString().slice(0, 10)
          );
          if (!dup) existing.events.push(e);
        }
        await existing.save();
        updated++;
      } else {
        await Client.create({
          name,
          phone,
          email: get("email"),
          notes: get("notes"),
          active,
          source: "admin",
          events,
        });
        added++;
      }
    } catch (err) {
      skipped++;
      errors.push(`Line ${lineNo}: ${err.message}`);
    }
  }

  return { added, updated, skipped, errors };
}
