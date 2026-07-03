const mongoose = require("mongoose");
require("dotenv").config();

async function testConnection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected successfully!");
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
  }
}

testConnection();
