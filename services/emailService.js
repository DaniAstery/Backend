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
  try {
    // ⭐ Fetch Bank Account From DB
    const account = await BankAccount.findOne({
      paymentType: currency,
      isActive: true
    });

    if (!account) {
      throw new Error("No bank account found for this currency.");
    }

    const filename = `payment_order_${Date.now()}.pdf`;
    const filepath = path.join(__dirname, filename);

    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // PDF Content
    doc.fontSize(20).text("Payment Order Details", { underline: true });
    doc.moveDown();
    doc.fontSize(14).text(`Customer Email: ${email}`);
    doc.text(`Selected Currency: ${currency}`);

    // ⭐ Inject fetched bank details
    doc.moveDown();
    doc.text("Bank Account Details:", { underline: true });
    doc.text(`Bank Name: ${account.bankName}`);
    doc.text(`Account Name: ${account.accountName}`);
    doc.text(`Account Number: ${account.accountNumber}`);
    doc.text(`Branch: ${account.branch || "N/A"}`);
    if (account.swiftCode) doc.text(`SWIFT Code: ${account.swiftCode}`);

    // OTP notice
    doc.moveDown();
    doc.text(`Verification Number will be sent separately.`);

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
