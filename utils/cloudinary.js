const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

/**
 * Upload a buffer to Cloudinary
 * @param {Buffer} buffer - File buffer from multer
 * @param {String} folder - Cloudinary folder name
 * @returns {Promise}
 */
const uploadToCloudinary = (buffer, folder = 'highphaus') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto', // Support images and videos
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/**
 * Delete a file from Cloudinary by its public ID
 * @param {String} publicId - Cloudinary public ID
 * @param {String} resourceType - 'image' or 'video'
 * @returns {Promise}
 */
const deleteFromCloudinary = (publicId, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

/**
 * Extract public ID from Cloudinary URL
 * @param {String} url - Cloudinary secure_url
 * @returns {String|null}
 */
const extractPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  
  // Example: https://res.cloudinary.com/demo/image/upload/v12345678/folder/sample.jpg
  // Parts after "upload/" are v12345678/folder/sample.jpg
  // We want "folder/sample"
  try {
    const parts = url.split('/upload/')[1].split('/');
    // Remove version part if it exists (starts with 'v')
    if (parts[0].startsWith('v')) {
      parts.shift();
    }
    // Remove extension
    const lastPart = parts[parts.length - 1];
    parts[parts.length - 1] = lastPart.split('.')[0];
    
    return parts.join('/');
  } catch (err) {
    console.error("Failed to extract public ID:", err);
    return null;
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId
};
