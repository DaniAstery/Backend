const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit-table");
const fs = require("fs");
const path = require("path");
const BankAccount = require("../models/BankAccount");

const otpStore = {}; // temporary OTP storage

// -------------------------
// EMAIL TRANSPORTER
// -------------------------
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// -------------------------
// SEND OTP + PDF
// -------------------------
async function sendVerificationCode(email, currency, cart) {
  const code = Math.floor(100000 + Math.random() * 900000);
  otpStore[email] = code;

  const pdfPath = await generatePaymentPDF(email, currency, cart);

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your Verification Code & Payment Order",
    text: `Your verification code is: ${code}`,
    attachments: [
      {
        filename: "Payment_Order.pdf",
        path: pdfPath
      }
    ]
  });

  return code;
}

// -------------------------
// VERIFY OTP
// -------------------------
function verifyCode(email, code) {
  if (otpStore[email] && otpStore[email] == code) {
    delete otpStore[email];
    return true;
  }
  return false;
}

// -------------------------
// GENERATE PAYMENT PDF
// -------------------------
async function generatePaymentPDF(email, currency, cart) {

  // ✅ SAFELY PARSE CART
  const parsedCart = Array.isArray(cart)
    ? cart
    : JSON.parse(cart || "[]");

  console.log("Generating PDF for:", email, currency);
  console.log("Cart items:", parsedCart);

  const accounts = await BankAccount.find({
    currency,
    isActive: true
  });

  if (!accounts.length) {
    throw new Error("No active bank accounts found.");
  }

  const filename = `payment_order_${Date.now()}.pdf`;
  const filepath = path.join(__dirname, filename);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  // -------------------------
  // HEADER
  // -------------------------
  try {
    doc.image(path.join(__dirname, "assets", "logo.png"), 40, 30, { width: 80 });
  } catch {}

  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("Asterya TRADING P.L.C", { align: "center" });

  doc
    .fontSize(12)
    .font("Helvetica")
    .text("Gemstone & Jewellery", { align: "center" })
    .text("Addis Ababa, Ethiopia", { align: "center" });

  doc.moveDown(2);

  // -------------------------
  // CUSTOMER INFO
  // -------------------------
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("Payment Order Details", { underline: true });

  doc.moveDown(0.5);

  doc
    .fontSize(12)
    .font("Helvetica")
    .text(`Customer Email: ${email}`)
    .text(`Currency: ${currency}`);

  doc.moveDown(1);

  // -------------------------
  // ORDER DETAILS TABLE ✅
  // -------------------------
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("Order Details", { underline: true });

  doc.moveDown(0.5);

  if (parsedCart.length === 0) {
    doc.text("No items in the order.");
  } else {
    const orderTable = {
      headers: ["Item", "Price", "Qty", "Total"],
      rows: parsedCart.map(item => [
        item.name,
        `${item.price} ${currency}`,
        item.quantity,
        `${(item.price * item.quantity).toFixed(2)} ${currency}`
      ])
    };

    await doc.table(orderTable, {
      width: 500,
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(12),
      prepareRow: () => doc.font("Helvetica").fontSize(11)
    });
  }

  doc.moveDown(2);

  // -------------------------
  // BANK ACCOUNTS TABLE
  // -------------------------
  const bankTable = {
    headers: ["Bank", "Account Name", "Account Number", "Branch", "SWIFT"],
    rows: accounts.map(acc => [
      acc.bankName,
      acc.accountName,
      acc.accountNumber,
      acc.branch || "-",
      acc.swiftCode || "-"
    ])
  };

  await doc.table(bankTable, {
    width: 500,
    prepareHeader: () => doc.font("Helvetica-Bold").fontSize(12),
    prepareRow: () => doc.font("Helvetica").fontSize(11)
  });

  doc.moveDown(2);

  // -------------------------
  // PAYMENT INSTRUCTIONS
  // -------------------------
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("Payment Instructions", { underline: true });

  doc.moveDown(0.5);

  doc.fontSize(12).list([
    "Choose one intermediary bank from the table above.",
    "Verification code was sent to your email.",
    "Submit verification code on the website.",
    "Upload payment proof.",
    "Tracking details will be sent shortly."
  ]);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve(filepath));
    stream.on("error", reject);
  });
}

module.exports = {
  sendVerificationCode,
  verifyCode
};
