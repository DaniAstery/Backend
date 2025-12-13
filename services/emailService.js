const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit-table");
const fs = require("fs");
const path = require("path");
const BankAccount = require("../models/BankAccount");

const otpStore = {};

// ------------------------
// Email transporter
// ------------------------
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ------------------------
// SEND OTP + PDF
// ------------------------
async function sendVerificationCode(email, currency, cart) {
  const code = Math.floor(100000 + Math.random() * 900000);
  otpStore[email] = code;

  console.log(cart);

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

// ------------------------
// VERIFY OTP
// ------------------------
function verifyCode(email, code) {
  if (otpStore[email] && otpStore[email] == code) {
    delete otpStore[email];
    return true;
  }
  return false;
}

module.exports = {
  sendVerificationCode,
  verifyCode
};

// ========================
// PDF GENERATION
// ========================
async function generatePaymentPDF(email, currency, cart) {

  const parsedCart = Array.isArray(cart)
    ? cart
    : JSON.parse(cart || "[]");

  console.log("📦 Cart items:", parsedCart);

  const accounts = await BankAccount.find({
    currency,
    isActive: true
  });

  if (!accounts.length) {
    throw new Error("No active bank accounts found");
  }

  const filename = `payment_order_${Date.now()}.pdf`;
  const filepath = path.join(__dirname, filename);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  /* =======================
     HEADER + LOGO
  ======================= */
  try {
    doc.image(path.join(__dirname, "assets", "logo.png"), 40, 30, { width: 80 });
  } catch {}

  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .text("Asterya TRADING P.L.C", 0, 35, { align: "center" });

  doc
    .font("Helvetica")
    .fontSize(12)
    .text("Gemstone & Jewellery", { align: "center" })
    .text("Addis Ababa, Ethiopia", { align: "center" });

  doc.moveDown(2);

  /* =======================
     PAYMENT ORDER DETAILS
  ======================= */
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("Payment Order Details", { underline: true });

  doc.moveDown(0.7);

  doc
    .font("Helvetica")
    .fontSize(12)
    .text(`Customer Email: ${email}`)
    .text(`Currency: ${currency}`);

  doc.moveDown(1.5);

  /* =======================
     ORDER DETAILS (ITEMS)
  ======================= */
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("Order Details", { underline: true });

  doc.moveDown(0.8);

  if (parsedCart.length === 0) {
    doc.font("Helvetica").fontSize(12).text("No items in the order.");
  } else {

    const totalPrice = parsedCart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const orderTable = {
      headers: ["Item", "Price", "Qty", "Total"],
      rows: [
        ...parsedCart.map(item => [
          item.name || "—",
          `${item.price} ${currency}`,
          item.quantity,
          `${(item.price * item.quantity).toFixed(2)} ${currency}`
        ]),
        ["TOTAL", "", "", `${totalPrice.toFixed(2)} ${currency}`]
      ]
    };

    await doc.table(orderTable, {
      width: 500,
      x: 40,
      y: doc.y,

      prepareHeader: () =>
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#007BFF"),

      prepareRow: (row, i) => {
        if (i === parsedCart.length) {
          doc.font("Helvetica-Bold").fontSize(12).fillColor("#007BFF");
        } else {
          doc.font("Helvetica").fontSize(11).fillColor("#000000");
        }
      },

      rowEvenColor: "#F5F7FA",
      rowOddColor: "#FFFFFF",

      rowBackground: (row, i) =>
        i === parsedCart.length ? "#E6F0FF" : null,

      padding: 6,
      borderWidth: 1
    });
  }

  doc.moveDown(2);

  /* =======================
     BANK DETAILS TABLE
  ======================= */
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
    x: 40,
    y: doc.y,

    prepareHeader: () =>
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#FF5722"),

    prepareRow: () =>
      doc.font("Helvetica").fontSize(11).fillColor("#000000"),

    rowEvenColor: "#FAFAFA",
    rowOddColor: "#FFFFFF",
    padding: 6,
    borderWidth: 1
  });

  doc.moveDown(2);

  /* =======================
     PAYMENT INSTRUCTIONS
  ======================= */
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("Payment Instructions", { underline: true });

  doc.moveDown(0.6);

  doc
    .font("Helvetica")
    .fontSize(12)
    .list([
      "Choose one bank from the table above and complete the payment.",
      "A verification number has been sent to your email.",
      "Enter the verification number on the website.",
      "Upload your proof of payment (PDF/JPG/PNG).",
      "Tracking details will be sent after confirmation."
    ]);

  doc.moveDown(1.5);

  /* =======================
     STAMP
  ======================= */
  try {
    doc.image(
      path.join(__dirname, "assets", "stamp.png"),
      200,
      doc.y,
      { width: 120 }
    );
  } catch {}

  doc.moveDown(2);

  /* =======================
     FOOTER
  ======================= */
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("Customer Support", { underline: true });

  doc
    .font("Helvetica")
    .fontSize(12)
    .text("WhatsApp: Daniel Temesgen")
    .text("Phone: +251 998 476 704");

  doc.moveDown(2);

  doc
    .fontSize(10)
    .fillColor("#666666")
    .text(
      "© Asterya One Member Trading P.L.C – All Rights Reserved",
      { align: "center" }
    );

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve(filepath));
    stream.on("error", reject);
  });
}
