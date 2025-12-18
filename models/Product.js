const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },

  stoneType: { type: String, required: true }, // Red/Orange Fire Opal, Blue/Green Fire Opal

  price: { type: Number, required: true },
  currency: { type: String, required: true },

  stoneSizeMM: { type: String, required: true },
  caratWeight: { type: String, required: true },

  metal: {
    type: String,
    default: "Genuine 925 Sterling Silver"
  },

  stock: {
    type: Number,
    default: 1 // 1 = in stock, 0 = out of stock
  },

  isActive: {
    type: Boolean,
    default: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Product", productSchema);