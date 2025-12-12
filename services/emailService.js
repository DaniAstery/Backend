const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const BankAccount = require("../models/BankAccount");

const otpStore = {}; // temporary storage for OTPs

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

    const doc = new PDFDocument({
      margin: 40,
      size: "A4"
    });

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // -----------------------------------------------------
    // HEADER WITH LOGO + COMPANY DETAILS
    // -----------------------------------------------------

    try {
      doc.image(path.join(__dirname, "assets", "logo.png"), 230, 20, {
        width: 120,
      });
    } catch (e) {
      console.log("Logo missing...");
    }

    doc.moveDown(4);

    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("ASTERYA ONE MEMBER TRADING P.L.C", {
        align: "center"
      });

    doc
      .fontSize(14)
      .font("Helvetica")
      .text("Gemstone & Jewellery", { align: "center" })
      .text("Addis Ababa, Ethiopia", { align: "center" });

    doc.moveDown(1.2);

    // Golden divider bar (simulated)
    doc
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .strokeColor("#b69329")
      .stroke();

    doc.moveDown(1.3);

    // -----------------------------------------------------
    // ORDER DETAILS
    // -----------------------------------------------------
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("PAYMENT ORDER DETAILS");

    doc.moveDown(0.8);

    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#000000")
      .text(`Customer Email: ${email}`)
      .text(`Currency: ${currency}`);

    doc.moveDown(1.2);

    // -----------------------------------------------------
    // BANK ACCOUNT SECTION (beautiful box formatting)
    // -----------------------------------------------------
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("AVAILABLE BANK ACCOUNTS");

    doc.moveDown(0.8);

    accounts.forEach((acc, index) => {
      // Box background
      doc
        .rect(40, doc.y, 515, 90)
        .fill("#f7f7f7")
        .strokeColor("#cccccc")
        .stroke();

      doc
        .fillColor("#000000")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(`Account #${index + 1}`, 50, doc.y - 80);

      doc
        .font("Helvetica")
        .fontSize(11)
        .text(`Bank: ${acc.bankName}`, 50)
        .text(`Account Name: ${acc.accountName}`)
        .text(`Account Number: ${acc.accountNumber}`)
        .text(`Branch: ${acc.branch || "N/A"}`)
        .text(acc.swiftCode ? `SWIFT: ${acc.swiftCode}` : "");

      doc.moveDown(1.5);
    });

    doc.moveDown(1);

    // -----------------------------------------------------
    // PAYMENT INSTRUCTIONS (polished formatting)
    // -----------------------------------------------------
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("PAYMENT INSTRUCTIONS");

    doc.moveDown(0.5);

    doc.fontSize(12).font("Helvetica").list([
      "Choose one intermediary bank from the list and complete the payment.",
      "Your Verification Number has been sent to your email.",
      "After payment, insert your Verification Number on the website.",
      "Upload your Proof of Payment (PDF / JPG / PNG).",
      "Tracking Number and additional details will be sent shortly."
    ]);

    doc.moveDown(1);
    doc.fontSize(13).font("Helvetica-Oblique").text("Best in Ethiopia 🇪🇹", { align: "center" });

    doc.moveDown(1.5);

    // -----------------------------------------------------
    // STAMP (AUTHENTICATION MARK)
    // -----------------------------------------------------
    try {
      doc.image(path.join(__dirname, "assets", "stamp.png"), 210, doc.y, {
        width: 170,
      });
    } catch (e) {
      console.log("Stamp missing...");
    }

    doc.moveDown(4);

    // -----------------------------------------------------
    // SUPPORT & FOOTER
    // -----------------------------------------------------
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("Customer Support", { underline: true });

    doc
      .moveDown(0.3)
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#000000")
      .text("WhatsApp: DANIEL TEMESGEN")
      .text("Phone: +251 998476704");

    doc.moveDown(2);

    doc
      .fontSize(10)
      .fillColor("#666666")
      .text("© Asterya One Member Trading P.L.C – All Rights Reserved", {
        align: "center"
      });

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
