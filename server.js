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
  currency:{type:String},
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
  paymentStatus: { type: String, default: "Pending" }



});

const Order = mongoose.model("Order", orderSchema);

// ✅ Test route
app.get("/", (req, res) => {
  res.send("✅ API is running...");
});

// ✅ GET all orders
app.get("/api/orders", async (req, res) => {
  try {
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


const multer = require("multer");
const path = require("path");

// Storage settings
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/proofs");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
  }
});

const upload = multer({ storage });


app.post("/api/confirm-checkout", upload.single("paymentProof"), async (req, res) => {
    try {
        console.log("📦 Raw req.body:", req.body);

        // ⛔ If req.body.order does NOT exist → frontend not sending correctly
        if (!req.body.order) {
            console.log("❌ req.body.order is missing");
            return res.status(400).json({ error: "Order data missing" });
        }

        // ✅ Parse the JSON string into an object
        const orderData = JSON.parse(req.body.order);

        console.log("📦 Parsed order:", orderData);

        // ✅ Save file URL
        let fileUrl = null;
        if (req.file) {
            fileUrl = `/uploads/proofs/${req.file.filename}`;
        }

        // Create order object to save
        orderData.paymentProof = fileUrl;

        // Save to DB
        const newOrder = new Order(orderData);
        await newOrder.save();

        res.json({ success: true, orderId: newOrder._id });

    } catch (err) {
        console.error("❌ Error creating order:", err);
        res.status(500).json({ error: "Server error" });
    }
});





// ✅ PUT (Update order status)from pending to completed to deleted

// Update order status by customer.id
app.put("/api/orders/:id", async (req, res) => {
  try {
    console.log("🔄 Updating order status for customer.id:", req.params.id);
  
    const order = await Order.findOne({ "customer.id": req.params.id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Logic to toggle status
    if (order.status === "Pending Payment Invoice") {
      order.status = "Completed";
    } else if (order.status === "Completed") {
      order.status = "Deleted";
    }

    await order.save();

    res.json({ message: `Order updated to ${order.status}`, order });
  } catch (error) {
    console.error("❌ Error updating order:", error);
    res.status(400).json({ message: error.message });
  }
});



app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  // SIMPLE VERSION — replace with database later
  const ADMIN_USER = "admin";
  const ADMIN_PASS = "1234";

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({
      success: true,
      token: "ADMIN-ACCESS-GRANTED",
    });
   
  }

  return res.json({
    success: false,
    message: "Invalid admin credentials"
  });
});













// ✅ Start server
const PORT = 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
