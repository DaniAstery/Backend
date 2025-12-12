const mongoose = require("mongoose");

const BankAccountSchema = new mongoose.Schema({

  paymentType: { type: String, required: true }, // e.g. "Beneficiary" or "Intermediary"

  // General Bank Info
  bankName: { type: String, required: true },
  branch: { type: String, default: null },
  currency: { type: String, required: true }, // "USD" or "EUR"

  // Account Holder Info
  accountName: { type: String, required: true }, 
  accountNumber: { type: String, required: true },

  // Additional Banking Codes
  swiftCode: { type: String },
  abaNumber: { type: String, default: null },  // only for U.S. banks
  oriretaaAccountNumber: { type: String, default: null }, // intermediary mapping

  // Status
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model("BankAccount", BankAccountSchema);
