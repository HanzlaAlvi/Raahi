// config/otpHelper.js
// Safe stub — No Firebase Admin. OTP is stored and verified via DB.
// Kept for compatibility with any existing imports.

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTP = async (mobileNumber, otp) => {
  console.log(`[OTP] ${mobileNumber}: ${otp}`);
  return true;
};

const verifyOTP = async () => false;           // deprecated
const verifyFirebaseToken = async () => false; // deprecated

module.exports = { generateOTP, sendOTP, verifyOTP, verifyFirebaseToken };