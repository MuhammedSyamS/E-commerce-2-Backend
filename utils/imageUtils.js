/**
 * Cloudinary transformation helper
 * @param {string} url - Original Cloudinary URL
 * @param {object} options - { width, height, quality, format }
 */
const optimizeCloudinaryUrl = (url, options = {}) => {
  if (!url || !url.includes('cloudinary.com')) return url;

  const { width, height, quality = 'auto', format = 'auto' } = options;
  
  // Find the upload part of the URL
  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex === -1) return url;

  const baseUrl = url.substring(0, uploadIndex + 8);
  const remainingUrl = url.substring(uploadIndex + 8);

  // Construct transformations
  let transforms = `f_${format},q_${quality}`;
  if (width) transforms += `,w_${width}`;
  if (height) transforms += `,h_${height}`;
  if (width || height) transforms += `,c_limit`; // Ensure we don't upscale

  return `${baseUrl}${transforms}/${remainingUrl}`;
};

module.exports = { optimizeCloudinaryUrl };
