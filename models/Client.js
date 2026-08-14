// models/Client.js - Client & event tracking model for outreach
import mongoose from "mongoose";

const ReminderSchema = new mongoose.Schema(
  {
    count: { type: Number, default: 0 },
    lastSentAt: { type: Date },
  },
  { _id: false }
);

const EventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  type: { type: String, default: "" },
  reminder: { type: ReminderSchema, default: () => ({ count: 0 }) },
  responded: { type: Boolean, default: false },
  needsProducts: { type: Boolean, default: null }, // null = unknown, true/false = yes/no
  response: { type: String, default: "" },
  responseAt: { type: Date },
});

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, // digits only, with country code
  email: { type: String, default: "" },
  notes: { type: String, default: "" },
  active: { type: Boolean, default: true }, // false = paused from recurring reminders
  locale: { type: String, default: null }, // preferred language; null = default
  source: { type: String, enum: ["admin", "order"], default: "admin" },
  lastOrderAt: { type: Date },
  events: { type: [EventSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ClientSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export const Client = mongoose.model("Client", ClientSchema);
