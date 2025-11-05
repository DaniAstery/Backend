const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ MongoDB Connection (Direct — No .env)
const MONGO_URI = "mongodb+srv://dani:sumi@asteryacluster.zblomdw.mongodb.net/";

// 🔧 Replace <username> and <password> above with your actual MongoDB Atlas credentials

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  });

// ✅ Sample Order Schema
const orderSchema = new mongoose.Schema({
  name: String,
  status: String,
  total: Number,
  date: { type: Date, default: Date.now },
});
const Order = mongoose.model("Order", orderSchema);

// ✅ Base test route
app.get("/", (req, res) => {
  res.send("✅ API is runn...");
});

/// ✅ GET All Orders
app.get("/api/orders", async (req, res) => {
  try {
    console.log("📦 GET /api/orders called");
    const orders = await Order.find({});
    const formattedOrders = orders.map((order) => ({
      ...order._doc,
      total: parseFloat(order.total.toString()),
    }));
    res.json(formattedOrders);
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ GET Orders by Status
app.get("/api/orders/status/:status", async (req, res) => {
  try {
    const { status } = req.params;
    const orders = await Order.find({ status });
    const formattedOrders = orders.map((order) => ({
      ...order._doc,
      total: parseFloat(order.total.toString()),
    }));
    res.json(formattedOrders);
  } catch (error) {
    console.error("❌ Error fetching orders by status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ POST Create Order
app.post("/api/orders", async (req, res) => {
  try {
    console.log
    const { name, status, total } = req.body;
    const newOrder = new Order({ name, status, total });
    await newOrder.save();
    res.status(201).json({ message: "✅ Order created successfully", order: newOrder });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ PUT Update Order by ID
app.put("/api/orders/:id", async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "✅ Order updated successfully", order: updatedOrder });
  } catch (error) {
    console.error("❌ Error updating order:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ DELETE Order by ID
app.delete("/api/orders/:id", async (req, res) => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(req.params.id);
    if (!deletedOrder) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "🗑️ Order deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting order:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// ✅ Start server
const PORT = 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
