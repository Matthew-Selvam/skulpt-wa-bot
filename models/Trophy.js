// models/Trophy.js - Trophy model
import mongoose from "mongoose";

const TrophySchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String },
});

export const Trophy = mongoose.model("Trophy", TrophySchema);
