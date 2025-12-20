const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const jwt = require("jsonwebtoken");
const BankAccount = require("./models/BankAccount");
const Product = require("./models/Product");
const multer = require("multer");
const path = require("path");
const app = express();

const mongoURI = process.env.MONGO_URI;
const { sendVerificationCode, verifyCode } = require("./services/emailService");

const BACKEND_URL = "https://asterya-production.up.railway.app";

// ✅ Middleware
app.use(cors());
app.use(express.json());

mongoose.connect(mongoURI)
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


});

const Order = mongoose.model("Order", orderSchema);


// Serve videos folder
app.use("/videos", express.static(path.join(__dirname, "videos")));


app.post("${BACKEND_URL}/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { role: "admin", username: username },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );

  res.json({
    success: true,
    message: "Login successful",
    token
  });
});


function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1]; // "Bearer <token>"

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin")
      return res.status(403).json({ message: "Not an admin" });

    req.admin = decoded;
    next();

  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}

// adding items
app.post("${BACKEND_URL}/api/products", verifyAdmin, async (req, res) => {
  try {
    const {
      name,
      stoneType,
      price,
      currency,
      stoneSizeMM,
      caratWeight
    } = req.body;

    if (!name || !price || !currency) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const product = new Product({
      name,
      stoneType,
      price,
      currency,
      stoneSizeMM,
      caratWeight
    });

    await product.save();

    res.json({
      success: true,
      message: "Item saved successfully",
      product
    });

  } catch (err) {
    console.error("❌ Save item error:", err);
    res.status(500).json({ error: "Failed to save item" });
  }
});




// ✅ Test route
app.get("/", (req, res) => {
  res.send("✅ API is running...");
});



// Send email code
app.post("${BACKEND_URL}/api/send-code", async (req, res) => {
  try {
    console.log("send-code request body:", req.body);
    const {email,currency,cart} = req.body;

    if (!email)
      return res.status(400).json({ error: "Email required" });

    await sendVerificationCode(email,currency,cart);

    res.json({ success: true, message: "Verification code sent" });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

// Verify code
app.post("${BACKEND_URL}/api/verify-code", (req, res) => {
  const { email, code } = req.body;

  if (verifyCode(email, code)) {
    return res.json({ success: true, message: "Email Verified!" });
  }

  res.status(400).json({ success: false, message: "Invalid or expired code" });
});



// ✅ GET all orders
app.get("${BACKEND_URL}/api/orders",verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find({});
    res.json(orders);
    console.log("✅ Orders fetched:", orders);
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET orders by status
app.get("${BACKEND_URL}/api/orders/status", verifyAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    if (!status) {
      return res.status(400).json({ message: "Status query is required" });
    }

    const orders = await Order.find({ status: status });

    res.json(orders);
    console.log(`📌 Orders with status '${status}' fetched:`, orders);
  } catch (error) {
    console.error("❌ Error fetching orders by status:", error);
    res.status(500).json({ message: "Server error" });
  }
});



// using app
app.get("${BACKEND_URL}/api/orders/id/:id",async (req, res) => {
  try {
    const order = await Order.findOne({ "customer.id": req.params.id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    console.error("Error fetching order by customer.id:", error);
    res.status(500).json({ message: "Server error" });
  }
});





// Storage settings
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "${BACKEND_URL}/uploads/proofs");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
  }
});

const upload = multer({ storage });


app.post("${BACKEND_URL}/api/confirm-checkout", upload.single("paymentProof"), async (req, res) => {
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

app.put("${BACKEND_URL}/api/orders/:id", verifyAdmin, async (req, res) => {
  try {
    const customerId = req.params.id.trim();

    console.log("Searching for customer.id:", JSON.stringify(customerId));

    const order = await Order.findOne({
      "customer.id": { $eq: customerId }
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
        searched: customerId
      });
    }

    // Toggle status
    if (order.status === "Pending Payment Invoice") {
      order.status = "Completed";
    } else if (order.status === "Completed") {
      order.status = "Deleted";
    }

    await order.save();

    res.json({
      message: `Order updated to ${order.status}`,
      order
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.post("${BACKEND_URL}/get-account", async (req, res) => {
  try {
    const { paymentType } = req.body;

    if (!paymentType) {
      return res.status(400).json({ message: "Payment type required" });
    }

    const account = await BankAccount.findOne({ paymentType, isActive: true });

    if (!account) {
      return res.status(404).json({ message: "No account found" });
    }

    res.json({ success: true, account });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});




// ✅ Start server
const PORT = 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
