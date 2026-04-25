const crypto = require('crypto');

/**
 * Generates a random 6-digit numeric OTP.
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

module.exports = { generateOTP };
