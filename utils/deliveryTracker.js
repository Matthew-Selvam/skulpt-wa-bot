// utils/deliveryTracker.js - Mock delivery tracking utility
import { sendTextMessage } from "./whatsappUtils.js";

/**
 * Mock Porter delivery updates
 * Sends delivery status updates to user
 */
export function mockDeliveryUpdates(userId, isGroup = false, authorId = null) {
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
        const message = updates[i];
        await sendTextMessage(userId, message);
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
}
