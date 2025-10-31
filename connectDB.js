const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(
      "mongodb+srv://dani:sumilukimile@asteryacluster.zblomdw.mongodb.net/AsteryaDB?retryWrites=true&w=majority"
    );
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
