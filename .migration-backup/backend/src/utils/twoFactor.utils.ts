import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export const generateTOTPSecret = (userEmail: string): speakeasy.GeneratedSecret => {
  return speakeasy.generateSecret({
    name: `Smart University (${userEmail})`,
    issuer: 'Smart University Platform',
    length: 20,
  });
};

export const verifyTOTP = (secret: string, token: string): boolean => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 30s clock drift
  });
};

export const generateQRCodeURL = async (otpAuthUrl: string): Promise<string> => {
  return QRCode.toDataURL(otpAuthUrl);
};
