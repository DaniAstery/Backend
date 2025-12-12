const mongoose = require("mongoose");

const BankAccountSchema = new mongoose.Schema({
  paymentType: { type: String, required: true }, 
  bankName: { type: String, required: true },
  accountName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  currency: { type: String, required: true },
  branch: { type: String },
  swiftCode: { type: String },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model("BankAccount", BankAccountSchema);
