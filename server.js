const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { Resend } = require("resend");
const { sendVerificationCode,verifyCode } = require("./services/emailService");
const resend = new Resend(process.env.RESEND_API_KEY); 


// Load Models
const BankAccount = require("./models/BankAccount");
const Product = require("./models/Product");

dotenv.config();

const app = express(); // ✅ app MUST come before app.use()


app.use(cors());

// ✅ Body parser AFTER CORS
app.use(express.json());

// ✅ Serve Static Folders
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
  status: { type: String},
  date: { type: Date, default: Date.now },
  paymentStatus: { type: String, default: "Pending" },
  paymentProof: { type: String }, // Added this field to store file path
});

const Order = mongoose.model("Order", orderSchema, "orders");


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
    const { email, currency, cart } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Send OTP + PDF using emailService.js
    const otp = await sendVerificationCode(email, currency, cart);

    // Return success (you can optionally return the otp for local testing)
    res.json({
      success: true,
      message: "Verification code sent",
      otp // remove this in production for security
    });
  } catch (err) {
    console.error("Send code error:", err);
    res.status(500).json({ success: false, message: err.message });
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

app.post("/api/send-order-confirmation", async (req, res) => {
  try {
    const { customerEmail, customerName } = req.body;

    // Validation
    if (!customerEmail || !customerName) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: customerEmail or customerName.",
      });
    }

    // Use Resend or your email service to send the email
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_SENDER_EMAIL, // Ensure this is a verified domain in Resend
      to: [customerEmail],
      subject: "Order Confirmation",
      text: `Dear ${customerName},\n\nWe have received your order. We will get back to you with the tracking number for your items. Usually, confirmation takes 4-5 days. In the meantime, you can reach our support line via WhatsApp at +251998476704 for updates on the status. A commercial invoice will be in your inbox.\n\nThank you for shopping with us!`,
    });

    if (error) {
      console.error("Resend API Error:", error);
      return res.status(400).json({ success: false, error });
    }

    res.json({
      success: true,
      message: "Order confirmation email sent successfully.",
      data,
    });
  } catch (err) {
    console.error("Send email server error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
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
    console.log("📥 Checkout request body:", req.body);
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


app.put("/api/orders/:id", verifyAdmin, async (req, res) => {
  try {
    const orderId = req.params.id.trim();
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Update only the status and paymentStatus fields
    if (order.paymentStatus === "Pending") {
      order.paymentStatus = "Completed";
      order.status = "Completed"; // Update the status field
    } else if (order.paymentStatus === "Completed") {
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


// Root route - confirms backend is running
app.get("/", (req, res) => {
  res.send("✅ Backend is running 🚀");
});




// ✅ Start
const PORT = process.env.PORT || 5003;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT}`));