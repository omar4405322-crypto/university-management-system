const speakeasy = require('speakeasy'); 
const QRCode = require('qrcode'); 
 
const generateTOTPSecret = (userEmail) => { 
  return speakeasy.generateSecret({ 
    name: `Smart University (${userEmail})`, 
    issuer: 'Smart University Platform', 
    length: 20, 
  }); 
}; 
 
const verifyTOTP = (secret, token) => { 
  return speakeasy.totp.verify({ 
    secret, 
    encoding: 'base32', 
    token, 
    window: 1, // Allow 30s clock drift 
  }); 
}; 
 
const generateQRCodeURL = async (otpAuthUrl) => { 
  return QRCode.toDataURL(otpAuthUrl); 
}; 
 
module.exports = { generateTOTPSecret, verifyTOTP, generateQRCodeURL }; 
