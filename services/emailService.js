const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const BankAccount = require("../models/BankAccount");

const otpStore = {}; // temporary storage for OTPs

// EMAIL TRANSPORTER
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function generatePaymentPDF(email, currency) {
  console.log("Generating PDF for:", email, currency);

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

    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // ------------------------------------
    // COMPANY HEADER
    // ------------------------------------

    try {
      doc.image(path.join(__dirname, "assets", "logo.png"), {
        width: 90,
        align: "center"
      });
    } catch (e) {
      console.log("Logo not found, skipping...");
    }

    doc.moveDown(0.5);
    doc.fontSize(20).text("ASTERYA ONE MEMBER TRADING P.L.C", {
      align: "center",
      underline: true
    });

    doc.moveDown(0.3);
    doc.fontSize(14).text("Gemstone and Jewellery", { align: "center" });
    doc.text("Ethiopia, Addis Ababa", { align: "center" });

    doc.moveDown(1.5);

    // ------------------------------------
    // CUSTOMER + ORDER DETAILS
    // ------------------------------------
    doc.fontSize(16).text("Payment Order Details", { underline: true });
    doc.moveDown();

    doc.fontSize(13).text(`Customer Email: ${email}`);
    doc.text(`Currency: ${currency}`);
    doc.moveDown();

    // ------------------------------------
    // BANK ACCOUNTS
    // ------------------------------------
    doc.fontSize(16).text("Available Bank Accounts", { underline: true });
    doc.moveDown(0.8);

    accounts.forEach((acc, index) => {
      doc.fontSize(14).text(`Account #${index + 1}`, { underline: true });
      doc.fontSize(12).text(`Bank: ${acc.bankName}`);
      doc.text(`Account Name: ${acc.accountName}`);
      doc.text(`Account Number: ${acc.accountNumber}`);
      doc.text(`Branch: ${acc.branch || "N/A"}`);
      if (acc.swiftCode) doc.text(`SWIFT Code: ${acc.swiftCode}`);
      doc.moveDown();
    });

    // ------------------------------------
    // PAYMENT STEPS
    // ------------------------------------
    doc.moveDown(1);
    doc.fontSize(16).text("Payment Instructions", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12).list([
      "Choose one intermediary bank from the list above and make the payment.",
      "Verification Number has been sent to your email address.",
      "After finishing the payment, insert the Verification Number on the website.",
      "Upload your Proof of Payment (PDF/JPG/PNG).",
      "Tracking number and further details will be sent to you shortly."
    ]);

    doc.moveDown(1);
    doc.fontSize(13).text("Best in Ethiopia 🇪🇹", { align: "center" });

    // ------------------------------------
    // SUPPORT
    // ------------------------------------
    doc.moveDown(1.2);
    doc.fontSize(14).text("Customer Support", { underline: true });
    doc.moveDown(0.3);

    doc.fontSize(12).text("Whatsapp: DANIEL TEMESGEN");
    doc.text("Phone: +251 911 711 836");

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on("finish", () => resolve(filepath));
      stream.on("error", reject);
    });

  } catch (error) {
    console.error("PDF generation error:", error);
    throw error;
  }
}



// Send OTP + PDF
async function sendVerificationCode(email, currency, accountNumber) {
  const code = Math.floor(100000 + Math.random() * 900000);
  otpStore[email] = code;

  const pdfPath = await generatePaymentPDF(email, currency, accountNumber);

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
