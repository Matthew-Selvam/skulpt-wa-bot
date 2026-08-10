// utils/deliveryTracker.js - Mock delivery tracking utility

/**
 * Mock Porter delivery updates
 * Sends delivery status updates to user.
 *
 * The sender is injected rather than imported so this works from any entry
 * point (Cloud API webhook, whatsapp-web.js) without binding to one transport —
 * importing whatsappUtils here created a circular dependency through
 * services/messageHandler.js.
 *
 * @param {string} userId - Recipient
 * @param {(userId: string, text: string) => Promise<any>} send - Transport
 * @param {string} [prefix] - Optional per-message prefix (e.g. group @mention)
 */
export function mockDeliveryUpdates(userId, send, prefix = "") {
  const updates = [
    "📦 Order packed at warehouse.",
    "🚚 Assigned to Porter delivery partner.",
    "🛵 Rider picked up the package.",
    "📍 Rider is near your location.",
    "✅ Order delivered successfully!",
  ];

  let i = 0;
  const interval = setInterval(async () => {
    if (i < updates.length) {
      try {
        const message = `${prefix}${updates[i]}`;
        await send(userId, message);
        console.log(`📦 Delivery update sent: ${message}`);
        i++;
      } catch (error) {
        console.error("❌ Error sending delivery update:", error);
        clearInterval(interval);
      }
    } else {
      clearInterval(interval);
      console.log("✅ All delivery updates sent");
    }
  }, 10000); // every 10s for demo

  // Don't keep the process alive just for pending demo updates
  interval.unref?.();
  return interval;
}
