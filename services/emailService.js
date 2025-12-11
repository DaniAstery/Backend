const nodemailer = require("nodemailer");

const otpStore = {}; // temporary storage for OTPs

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


// Send OTP
async function sendVerificationCode(email) {
  const code = Math.floor(100000 + Math.random() * 900000);

  otpStore[email] = code;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your Verification Code",
    text: `Your verification code is: ${code}`
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
