const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit-table");
const fs = require("fs");
const path = require("path");
const BankAccount = require("../models/BankAccount");

const otpStore = {}; // temporary storage for OTPs

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send OTP + PDF
async function sendVerificationCode(email, currency, cart) {
  const code = Math.floor(100000 + Math.random() * 900000);
  otpStore[email] = code;

  const pdfPath = await generatePaymentPDF(email,currency,cart);

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

// Verify OTP
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



async function generatePaymentPDF(email, currency, cart) {

  // Parse cart if it's a string its a string because it was set from local storage in the frontend
  const parsedCart= typeof cart === "string" ? JSON.parse(cart) : cart
  console.log("Generating PDF for:", email, currency, parsedCart);

  try {
    const accounts = await BankAccount.find({
      currency,
      isActive: true
    });

    if (accounts.length === 0) {
      throw new Error("No active bank accounts found for this currency.");
    }

    const filename = `payment_order_${Date.now()}.pdf`;
    const filepath = path.join(__dirname, filename);

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // -------------------------
    // HEADER + LOGO
    // -------------------------
    try {
      doc.image(path.join(__dirname, "assets", "logo.png"), 40, 30, { width: 80 });
    } catch {
      console.log("Logo missing");
    }

    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Asterya TRADING P.L.C", 0, 35, { align: "center" });

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
    // ORDER DETAILS TABLE (CART ITEMS)
    // -------------------------
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Order Details", { underline: true });

    doc.moveDown(0.5);

    if (!parsedCart || parsedCart.length === 0) {
      doc.fontSize(12).font("Helvetica").text("No items in the order.");
    } else {
      const orderTable = {
        headers: ["Item", "Price", "Quantity", "Total"],
        rows: parsedCart.map(item => [
          item.name || item.title || "—",
          `${item.price} ${currency}`,
          item.quantity,
          `${item.price * item.quantity} ${currency}`
        ])
      };

      await doc.table(orderTable, {
        width: 500,
        x: 40,
        y: doc.y,
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(12),
        prepareRow: () => doc.font("Helvetica").fontSize(11)
      });
    }

    doc.moveDown(2);

    // -------------------------
    // BANK ACCOUNTS TABLE
    // -------------------------
    const bankTable = {
      headers: ["Bank", "Account Name", "Account Number", "Branch", "SWIFT","Currency"],
      rows: accounts.map(acc => [
        acc.bankName,
        acc.accountName,
        acc.accountNumber,
        acc.branch || "-",
        acc.swiftCode || "-",
        acc.currency  || "-"  
      ])
    };

    await doc.table(bankTable, {
      width: 500,
      x: 40,
      y: doc.y,
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

    doc.fontSize(12).font("Helvetica").list([
      "Choose one intermediary bank from the table above and complete the payment.",
      "Verification Number has been sent to your email.",
      "After payment, insert your Verification Number on the website.",
      "Upload your Proof of Payment (PDF/JPG/PNG).",
      "Tracking Number and further details will be sent shortly."
    ]);

    doc.moveDown(1);
    doc.fontSize(13).font("Helvetica-Oblique").text("Your Best Access To Ethiopia ", { align: "center" });

    doc.moveDown(1);

    // -------------------------
    // STAMP
    // -------------------------
    try {
      doc.image(path.join(__dirname, "assets", "stamp.png"), 200, doc.y, { width: 120 });
    } catch {
      console.log("Stamp missing");
    }

    doc.moveDown(2);

    // -------------------------
    // FOOTER
    // -------------------------
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Customer Support", { underline: true });

    doc
      .fontSize(12)
      .font("Helvetica")
      .text("WhatsApp: DANIEL TEMESGEN")
      .text("Phone: +251 911 711 836");

    doc.moveDown(2);

    doc
      .fontSize(10)
      .fillColor("#666666")
      .text("© Asterya One Member Trading P.L.C – All Rights Reserved", {
        align: "center"
      });

    doc.end();

    // Resolve file path
    return new Promise((resolve, reject) => {
      stream.on("finish", () => resolve(filepath));
      stream.on("error", reject);
    });

  } catch (error) {
    console.error("PDF generation error:", error);
    throw error;
  }
}
