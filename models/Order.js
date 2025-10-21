// models/Order.js - Order model
import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: { type: Array, required: true },
  total: { type: Number, required: true },
  customization: { type: String },
  status: { type: String, default: "pending" },
  orderRef: {
    type: String,
    unique: true,
    default: () => Date.now().toString(),
  },
  groupId: { type: String }, // Store group ID for group orders
  createdAt: { type: Date, default: Date.now },
});

export const Order = mongoose.model("Order", OrderSchema);
