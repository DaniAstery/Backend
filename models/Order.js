const mongoose = require("mongoose");

// ✅ Define the schema
const orderSchema = new mongoose.Schema({
  customer: {
     id: { type: String },
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
    }
  ],
  total: { type: Number, required: true },
  status: { type: String, default: "Pending" },
  date: { type: Date, default: Date.now },
});

// ✅ Create and export the model
const Order = mongoose.model("Order", orderSchema);

// ✅ Export both schema and model
module.exports = { Order, orderSchema };
