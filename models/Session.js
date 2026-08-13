// models/Session.js - Persistent conversation-state store
//
// Was a process-local Map, so every restart/redeploy silently dropped every
// in-progress order. `key` is the same identifier already used as the Map
// key: the chat id for a DM, `${chatId}_${userId}` inside a group.
import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  step: { type: String, default: "welcome" },
  cart: { type: Array, default: [] },
  customization: { type: String, default: "" },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  // Reference image received mid-order, held until checkout attaches it to the
  // Order. base64 rather than Buffer so it survives the plain-object round trip
  // through getSession/saveSession.
  pendingImage: {
    data: { type: String, default: null },
    contentType: { type: String, default: null },
  },
  isGroup: { type: Boolean, default: false },
  groupId: { type: String, default: null },
  userId: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
});

// Sliding 24h expiry from the last activity, so abandoned conversations
// clean themselves up instead of accumulating forever.
SessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const Session = mongoose.model("Session", SessionSchema);
