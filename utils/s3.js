const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const path = require("path");
const logger = require("./logger");

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

/**
 * Uploads a file buffer to AWS S3
 * @param {Buffer} fileBuffer 
 * @param {string} folder 
 * @param {string} originalName 
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
const uploadToS3 = async (fileBuffer, folder = 'uploads', originalName = 'file') => {
  try {
    const fileName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(originalName)}`;
    
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.AWS_BUCKET_NAME || "",
        Key: fileName,
        Body: fileBuffer,
        ACL: "public-read", // Ensure bucket allows public read
      },
    });

    await upload.done();

    const secure_url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    return {
      secure_url,
      public_id: fileName,
      original_filename: originalName
    };
  } catch (error) {
    logger.error(`[S3 UPLOAD ERROR] ${error.message}`);
    throw error;
  }
};

/**
 * Deletes a file from AWS S3
 * @param {string} publicId - S3 Key (path)
 * @returns {Promise<any>}
 */
const deleteFromS3 = async (publicId) => {
  try {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME || "",
      Key: publicId,
    });
    return await s3Client.send(command);
  } catch (error) {
    logger.error(`[S3 DELETE ERROR] ${error.message}`);
    throw error;
  }
};

module.exports = { uploadToS3, deleteFromS3, s3Client };
