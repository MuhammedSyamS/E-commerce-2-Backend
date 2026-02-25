const nodemailer = require('nodemailer');
const vault = require('./vault');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: vault.EMAIL_USER,
    pass: vault.EMAIL_PASS,
  },
});

module.exports = transporter;
