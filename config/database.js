// config/database.js - Database configuration
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/trophybot";

export async function setupDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Setup sample data
    await setupSampleData();
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

async function setupSampleData() {
  try {
    const { Trophy } = await import("../models/Trophy.js");
    const trophyCount = await Trophy.countDocuments();
    
    if (trophyCount === 0) {
      const sampleTrophies = [
        { name: "🏆 Golden Trophy", price: 1500, image: "golden_trophy.jpg" },
        { name: "🥇 Silver Medal", price: 800, image: "silver_medal.jpg" },
        { name: "🏅 Bronze Medal", price: 500, image: "bronze_medal.jpg" },
        { name: "🎖️ Achievement Award", price: 1200, image: "achievement_award.jpg" },
        { name: "🏆 Championship Cup", price: 2000, image: "championship_cup.jpg" },
        { name: "🥉 Participation Medal", price: 300, image: "participation_medal.jpg" },
      ];

      await Trophy.insertMany(sampleTrophies);
      console.log("✅ Sample trophies added to database");
    }
  } catch (err) {
    console.error("❌ Error setting up sample data:", err);
  }
}
