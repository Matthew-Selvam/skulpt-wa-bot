// models/Order.js - Order model
import mongoose from "mongoose";
import crypto from "crypto";

const OrderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: { type: Array, required: true },
  total: { type: Number, required: true },
  customization: { type: String },
  // Optional reference image the customer sent for the engraving/design.
  // Stored inline: Meta's media URLs expire, so the bytes have to be kept
  // somewhere, and trophy-order volumes are far below the 16MB document cap.
  referenceImage: {
    data: { type: Buffer },
    contentType: { type: String },
    receivedAt: { type: Date },
  },
  status: {
    type: String,
    enum: ["pending", "paid", "cancelled"],
    default: "pending",
  },
  orderRef: {
    type: String,
    unique: true,
    // Was Date.now() alone, which collides for two orders created in the same
    // millisecond — and because the index is unique, the second insert fails
    // outright rather than degrading. The random suffix makes that vanishingly
    // unlikely while keeping the timestamp prefix sortable and readable.
    default: () => `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
  },
  groupId: { type: String }, // Store group ID for group orders
  // Populated when a real delivery provider (Porter) dispatches the order
  deliveryId: { type: String, default: null },
  trackingUrl: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

// History lookups are always "this customer's most recent orders"
OrderSchema.index({ userId: 1, createdAt: -1 });

export const Order = mongoose.model("Order", OrderSchema);
