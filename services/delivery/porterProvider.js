// services/delivery/porterProvider.js - Porter partner API client.
//
// ⚠️ UNVERIFIED ENDPOINT SHAPE
// This was written without access to Porter's API documentation or
// credentials. The endpoint paths, header name, and response field names below
// are best-effort defaults, and every one of them is overridable by env var so
// they can be corrected without touching this file's logic:
//
//   PORTER_API_URL, PORTER_API_KEY, PORTER_AUTH_HEADER,
//   PORTER_CREATE_PATH, PORTER_STATUS_PATH, PORTER_CANCEL_PATH
//
// Before going live: confirm the paths and the response field names in
// `normalizeStatus()` against Porter's actual docs. The integration stays
// inert until PORTER_API_KEY is set (see index.js), so an incorrect guess
// here cannot affect production until you deliberately switch it on.
import fetch from "node-fetch";

const BASE = (process.env.PORTER_API_URL || "https://pfe-apigw.porter.in").replace(/\/$/, "");
const API_KEY = process.env.PORTER_API_KEY || "";
const AUTH_HEADER = process.env.PORTER_AUTH_HEADER || "X-API-KEY";
const CREATE_PATH = process.env.PORTER_CREATE_PATH || "/v1/orders/create";
const STATUS_PATH = process.env.PORTER_STATUS_PATH || "/v1/orders/{id}";
const CANCEL_PATH = process.env.PORTER_CANCEL_PATH || "/v1/orders/{id}/cancel";
const TIMEOUT_MS = Number(process.env.PORTER_TIMEOUT_MS || 15000);

/**
 * Porter's own status vocabulary varies by integration; map whatever comes
 * back onto the small set the bot actually reasons about. Unrecognised values
 * pass through as "unknown" rather than being silently treated as delivered.
 */
const STATUS_MAP = {
  open: "placed",
  accepted: "assigned",
  assigned: "assigned",
  "driver-assigned": "assigned",
  live: "picked_up",
  "pickup-complete": "picked_up",
  picked_up: "picked_up",
  "in-transit": "in_transit",
  in_transit: "in_transit",
  ended: "delivered",
  completed: "delivered",
  delivered: "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
};

export function normalizeStatus(raw) {
  if (!raw) return "unknown";
  return STATUS_MAP[String(raw).toLowerCase().replace(/\s+/g, "-")] || "unknown";
}

async function request(path, { method = "GET", body = null } = {}) {
  if (!API_KEY) {
    return { success: false, error: "PORTER_API_KEY is not configured" };
  }

  const url = BASE + path;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        [AUTH_HEADER]: API_KEY,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

    if (!res.ok) {
      console.error(`❌ Porter ${method} ${path} failed (${res.status})`, data);
      return { success: false, status: res.status, error: data };
    }
    return { success: true, data };
  } catch (err) {
    // An aborted request surfaces as an AbortError; report it as a timeout
    const timedOut = err.name === "AbortError";
    console.error(`❌ Porter ${method} ${path} ${timedOut ? "timed out" : "error"}:`, err.message);
    return { success: false, error: timedOut ? "Porter request timed out" : err.message };
  }
}

/**
 * Create a delivery job for a paid order.
 * @returns {Promise<{success: boolean, deliveryId?: string, trackingUrl?: string, error?: any}>}
 */
export async function createDelivery(order, { pickup, drop }) {
  const res = await request(CREATE_PATH, {
    method: "POST",
    body: {
      request_id: String(order.orderRef || order._id),
      pickup_details: pickup,
      drop_details: drop,
      // Kept minimal and descriptive; Porter surfaces this to the rider
      additional_comments: order.customization
        ? `Trophy order ${order.orderRef || order._id} — ${order.customization}`.slice(0, 200)
        : `Trophy order ${order.orderRef || order._id}`,
    },
  });

  if (!res.success) return res;
  const d = res.data || {};
  return {
    success: true,
    deliveryId: d.order_id || d.id || d.request_id || null,
    trackingUrl: d.tracking_url || d.track_url || null,
    raw: d,
  };
}

/** Current status of a previously created delivery. */
export async function getDeliveryStatus(deliveryId) {
  const res = await request(STATUS_PATH.replace("{id}", encodeURIComponent(deliveryId)));
  if (!res.success) return res;
  const d = res.data || {};
  return {
    success: true,
    status: normalizeStatus(d.status || d.order_status || d.state),
    rawStatus: d.status || d.order_status || d.state || null,
    trackingUrl: d.tracking_url || d.track_url || null,
    eta: d.eta || d.estimated_delivery_time || null,
    raw: d,
  };
}

export async function cancelDelivery(deliveryId, reason = "Order cancelled") {
  const res = await request(CANCEL_PATH.replace("{id}", encodeURIComponent(deliveryId)), {
    method: "POST",
    body: { reason },
  });
  return res.success ? { success: true, raw: res.data } : res;
}

export const isConfigured = () => Boolean(API_KEY);
