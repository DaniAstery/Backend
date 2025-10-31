const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  customer: {
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
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Order", orderSchema);
