const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const { uploadToS3, deleteFromS3 } = require('../utils/s3');
const logger = require('../utils/logger');

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || (process.env.AWS_ACCESS_KEY_ID ? 'aws' : 'cloudinary');

/**
 * Uploads a file buffer to the active storage provider
 * @param {Buffer} buffer 
 * @param {string} folder 
 * @param {string} originalName 
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
const uploadMedia = async (buffer, folder = 'uploads', originalName = 'file') => {
  if (STORAGE_PROVIDER === 'aws') {
    logger.info(`[MEDIA SERVICE] Uploading to AWS S3: ${originalName}`);
    return await uploadToS3(buffer, folder, originalName);
  } else {
    logger.info(`[MEDIA SERVICE] Uploading to Cloudinary: ${originalName}`);
    return await uploadToCloudinary(buffer, folder);
  }
};

/**
 * Deletes media from the active storage provider
 * @param {string} publicId 
 * @param {string} resourceType 
 * @returns {Promise<any>}
 */
const deleteMedia = async (publicId, resourceType = 'image') => {
  if (STORAGE_PROVIDER === 'aws') {
    logger.info(`[MEDIA SERVICE] Deleting from AWS S3: ${publicId}`);
    return await deleteFromS3(publicId);
  } else {
    logger.info(`[MEDIA SERVICE] Deleting from Cloudinary: ${publicId}`);
    return await deleteFromCloudinary(publicId, resourceType);
  }
};

/**
 * Extracts the public ID or Key from a URL
 * @param {string} url 
 * @returns {string|null}
 */
const extractMediaId = (url) => {
  if (!url) return null;
  
  if (url.includes('cloudinary.com')) {
    const { extractPublicId } = require('../utils/cloudinary');
    return extractPublicId(url);
  }
  
  if (url.includes('.amazonaws.com/')) {
    try {
      // https://bucket.s3.region.amazonaws.com/folder/file.jpg
      const parts = url.split('.amazonaws.com/');
      if (parts.length > 1) {
        return parts[1];
      }
    } catch (err) {
      logger.error(`[MEDIA SERVICE] Failed to extract S3 ID: ${err.message}`);
    }
  }
  
  return null;
};

/**
 * Determines the resource type (image or video) based on extension
 * @param {string} url 
 * @returns {string}
 */
const getResourceType = (url) => {
  if (!url) return 'image';
  const ext = url.split('.').pop().toLowerCase();
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
  return videoExts.includes(ext) ? 'video' : 'image';
};

module.exports = {
  uploadMedia,
  deleteMedia,
  extractMediaId,
  getResourceType,
  STORAGE_PROVIDER
};
