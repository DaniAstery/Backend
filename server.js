const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://dani:dani@localhost:27017/AsteyaDB?authSource=admin", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected successfully"))
.catch((err) => {
  console.error("❌ Database connection failed:", err.message);
  process.exit(1);
});

// ✅ Define schema directly here
const orderSchema = new mongoose.Schema({
  customer: {
    id: {
      type: String,
      default: function () {
        return "ORD-" + Date.now();
      },
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
  },
  shipping: { type: String },
  payment: { type: String },
  advance: { type: Number, default: 0 },
  items: [
    {
      name: String,
      price: Number,
      quantity: Number,
    },
  ],
  total: { type: Number, required: true },
  status: { type: String, default: "Pending" },
  date: { type: Date, default: Date.now },
});

const Order = mongoose.model("Order", orderSchema);

// ✅ Test route
app.get("/", (req, res) => {
  res.send("✅ API is running...");
});

// ✅ GET all orders
app.get("/api/orders", async (req, res) => {
  try {
    console.log("📦 GET /api/orders called");
    const orders = await Order.find({});
    res.json(orders);
    console.log("✅ Orders fetched:", orders);
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// GET all orders (optionally filter by status)
app.get("/api/orders/status", async (req, res) => {
  try {
    const { status } = req.query; // e.g., /api/orders?status=Pending
    const filter = status ? { status } : {}; // if status is provided, filter by it
    const orders = await Order.find(filter).sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// using app
app.get("/api/orders/id/:id", async (req, res) => {
  try {
    const order = await Order.findOne({ "customer.id": req.params.id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    console.error("Error fetching order by customer.id:", error);
    res.status(500).json({ message: "Server error" });
  }
});




// ✅ POST (Create new order)
app.post("/api/orders", async (req, res) => {
  console.log("📦 Incoming order:", req.body); // <-- debugging

  try {
    const newOrder = new Order(req.body);
    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(400).json({ message: error.message });
  }
});



// ✅ DELETE (Remove order by ID)
app.delete("/api/orders/:id", async (req, res) => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(req.params.id);
    if (!deletedOrder) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "✅ Order deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting order:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ PUT (Update order by ID)
app.put("/api/orders/:id", async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
    res.json(updatedOrder);
  } catch (error) {
    console.error("❌ Error updating order:", error);
    res.status(400).json({ message: error.message });
  }
});

// ✅ Start server
const PORT = 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
