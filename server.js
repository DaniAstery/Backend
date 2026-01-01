const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

// Load Models
const BankAccount = require("./models/BankAccount");
const Product = require("./models/Product");

dotenv.config();
const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve Static Folders (Crucial for accessing uploaded images/videos)
app.use("/videos", express.static(path.join(__dirname, "videos")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  });

// ✅ Services
const { sendVerificationCode, verifyCode } = require("./services/emailService");

// ✅ Order Schema (Fixed: Added paymentProof)
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
  currency: { type: String },
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
  paymentStatus: { type: String, default: "Pending" },
  paymentProof: { type: String }, // Added this field to store file path
});

const Order = mongoose.model("Order", orderSchema);

// ✅ Admin Middleware
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ message: "Not an admin" });
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}

// ✅ Admin Login
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }
  const token = jwt.sign({ role: "admin", username }, process.env.JWT_SECRET, { expiresIn: "2h" });
  res.json({ success: true, message: "Login successful", token });
});

// ✅ Products (Consolidated into one route)
app.post("/api/products", verifyAdmin, async (req, res) => {
  try {
    const { name, stoneType, price, currency, stoneSizeMM, caratWeight } = req.body;
    if (!name || !price || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const product = new Product({ name, stoneType, price, currency, stoneSizeMM, caratWeight });
    await product.save();
    res.json({ success: true, message: "Product saved", product });
  } catch (err) {
    console.error("❌ Add product error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Email Verification
app.post("/api/send-code", async (req, res) => {
      try {
        console.log(req.body.cart);
        const { email, currency, cart } = req.body;

        if (!email || !currency || !Array.isArray(cart)) {
          return res.status(400).json({
            success: false,
            message: "Invalid request data"
          });
        }

        await sendVerificationCode(email, currency, cart);

        res.json({
          success: true,
          message: "Verification code sent"
        });
      } catch (err) {
        console.error("Send code error:", err);
        res.status(500).json({
          success: false,
          message: "Failed to send verification code"
        });
      }
});

app.post("/api/verify-code", async (req, res) => {
      try {
        const { email, code } = req.body;

        if (!email || !code) {
          return res.status(400).json({
            success: false,
            message: "Email and code are required"
          });
        }

        const isValid = await verifyCode(email, code);

        if (!isValid) {
          return res.status(400).json({
            success: false,
            message: "Invalid or expired verification code"
          });
        }

        res.json({
          success: true,
          message: "Verification successful"
        });
      } catch (err) {
        console.error("Verify code error:", err);
        res.status(500).json({
          success: false,
          message: "Failed to verify code"
        });
      } 
});
// ✅ Orders Management
app.get("/api/orders", verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find({});
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/orders/id/:id", async (req, res) => {
  try {
    const order = await Order.findOne({ "customer.id": req.params.id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Checkout & File Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/proofs"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"))
});
const upload = multer({ storage });

app.post("/api/confirm-checkout", upload.single("paymentProof"), async (req, res) => {
  try {
    if (!req.body.order) return res.status(400).json({ error: "Order data missing" });
    const orderData = JSON.parse(req.body.order);
    
    if (req.file) {
      orderData.paymentProof = `/uploads/proofs/${req.file.filename}`;
    }

    const newOrder = new Order(orderData);
    await newOrder.save();
    res.json({ success: true, orderId: newOrder._id });
  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Update Status
app.put("/api/orders/:id", verifyAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id.trim());
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "Pending Payment Invoice") {
      order.status = "Completed";
    } else if (order.status === "Completed") {
      await order.deleteOne();
      return res.json({ message: "Order deleted" });
    }

    await order.save();
    res.json({ message: `Status updated`, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.post("/get-account", async (req, res) => {
  try {
    const { paymentType } = req.body;
    const account = await BankAccount.findOne({ paymentType, isActive: true });
    if (!account) return res.status(404).json({ message: "No account found" });
    res.json({ success: true, account });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Start
const PORT = process.env.PORT || 5001;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT}`));