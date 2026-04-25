const jwt = require('jsonwebtoken');

const generateToken = (id, tokenVersion = 0) => {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '15m', // Enterprise Standard: 15 minutes
  });
};

const generateRefreshToken = (id, tokenVersion = 0) => {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

module.exports = { generateToken, generateRefreshToken };
