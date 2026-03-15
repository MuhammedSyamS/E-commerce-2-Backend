const cloudinary = require('cloudinary').v2;
const vault = require('./vault');

cloudinary.config({
  cloud_name: vault.CLOUDINARY_CLOUD_NAME,
  api_key: vault.CLOUDINARY_API_KEY,
  api_secret: vault.CLOUDINARY_API_SECRET
});

module.exports = cloudinary;
