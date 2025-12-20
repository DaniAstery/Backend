const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
 // currency: { type: String, default: "USD" },

 // image: { type: String }, // image URL or filename
 // video: { type: String }, // optional hover video

 // stock: { type: Number, default: 0 },
 // isActive: { type: Boolean, default: true },

 // createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Product", ProductSchema);
