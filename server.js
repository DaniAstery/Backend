const express = require("express");
const cors = require("cors");
const connectDB = require("./connectDB");
const Order = require("./models/Order");

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({ origin: "http://localhost:5000" }));
app.use(express.json());

// GET /api/orders → fetch all orders (optionally by status)
// GET /api/orders → fetch all orders
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ date: -1 });
    res.json(orders);
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
});



// Start server
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
