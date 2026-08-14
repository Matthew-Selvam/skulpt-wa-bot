// services/delivery/index.js - Delivery provider selection.
//
// Two providers:
//   • porter — real dispatch + status polling (needs PORTER_API_KEY)
//   • mock   — the original canned status messages, for local dev
//
// Selection is deliberately fail-safe: without PORTER_API_KEY the mock is used
// no matter what DELIVERY_PROVIDER says, so a half-configured deployment
// degrades to the previous behaviour rather than silently failing to dispatch.
import * as porter from "./porterProvider.js";
import { mockDeliveryUpdates } from "../../utils/deliveryTracker.js";

const REQUESTED = (process.env.DELIVERY_PROVIDER || "auto").toLowerCase();

/** Which provider is actually in use, given configuration. */
export function activeProvider() {
  if (REQUESTED === "mock") return "mock";
  if (REQUESTED === "porter" || REQUESTED === "auto") {
    return porter.isConfigured() ? "porter" : "mock";
  }
  return "mock";
}

/** Human-readable status text sent to the customer. */
const STATUS_TEXT = {
  placed: "📦 Order placed with our delivery partner.",
  assigned: "🚚 Assigned to a Porter delivery partner.",
  picked_up: "🛵 Rider picked up the package.",
  in_transit: "📍 Your order is on its way.",
  delivered: "✅ Order delivered successfully!",
  cancelled: "🚫 Delivery was cancelled.",
  unknown: "ℹ️ Delivery status updated.",
};

export function statusText(status) {
  return STATUS_TEXT[status] || STATUS_TEXT.unknown;
}

/**
 * Terminal states — polling should stop once one is reached.
 */
export const TERMINAL = new Set(["delivered", "cancelled"]);

/**
 * Start delivery for a paid order.
 *
 * With the mock provider this replicates the previous behaviour exactly
 * (timed canned updates). With Porter it creates a real job and begins
 * polling for status changes, sending the customer a message on each change.
 *
 * @param {object}   order
 * @param {function} send   - (to, text) => Promise, the transport
 * @param {object}   opts   - { to, prefix, pickup, drop, onDeliveryCreated }
 */
export async function startDelivery(order, send, opts = {}) {
  const { to, prefix = "", pickup, drop, onDeliveryCreated } = opts;
  const provider = activeProvider();

  if (provider === "mock") {
    mockDeliveryUpdates(to, send, prefix);
    return { provider: "mock", started: true };
  }

  const created = await porter.createDelivery(order, { pickup, drop });
  if (!created.success) {
    console.error("❌ Porter dispatch failed, falling back to status-free flow:", created.error);
    // Don't leave the customer with no acknowledgement at all
    await send(to, `${prefix}📦 Your order is confirmed. We'll share delivery updates shortly.`);
    return { provider: "porter", started: false, error: created.error };
  }

  if (onDeliveryCreated) {
    await onDeliveryCreated({
      deliveryId: created.deliveryId,
      trackingUrl: created.trackingUrl,
    });
  }

  const opening = created.trackingUrl
    ? `${prefix}${statusText("placed")}\n🔗 Track: ${created.trackingUrl}`
    : `${prefix}${statusText("placed")}`;
  await send(to, opening);

  pollDelivery(created.deliveryId, send, { to, prefix });
  return { provider: "porter", started: true, deliveryId: created.deliveryId, trackingUrl: created.trackingUrl };
}

/**
 * Poll a Porter delivery and notify the customer when the status changes.
 * Only transitions are announced, so a slow delivery doesn't spam the chat.
 */
export function pollDelivery(deliveryId, send, { to, prefix = "" } = {}) {
  const intervalMs = Number(process.env.PORTER_POLL_INTERVAL_MS || 120000);
  const maxMs = Number(process.env.PORTER_POLL_MAX_MS || 6 * 60 * 60 * 1000);
  const startedAt = Date.now();
  let lastStatus = null;

  const timer = setInterval(async () => {
    if (Date.now() - startedAt > maxMs) {
      console.warn(`⏱ Stopped polling Porter delivery ${deliveryId} after max duration`);
      clearInterval(timer);
      return;
    }

    const res = await porter.getDeliveryStatus(deliveryId);
    if (!res.success) return; // transient failure — try again next tick

    if (res.status !== lastStatus) {
      lastStatus = res.status;
      try {
        await send(to, `${prefix}${statusText(res.status)}`);
      } catch (err) {
        console.error("⚠️ Failed to send delivery update:", err.message);
      }
    }

    if (TERMINAL.has(res.status)) {
      clearInterval(timer);
    }
  }, intervalMs);

  // Never hold the process open for a pending delivery
  timer.unref?.();
  return timer;
}

export { porter };
