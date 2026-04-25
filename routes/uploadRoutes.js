const express = require('express');
const multer = require('multer');
const path = require('path');
const { uploadMedia } = require('../services/mediaService');
const logger = require('../utils/logger');

const router = express.Router();

const storage = multer.memoryStorage();

function checkFileType(file, cb) {
    const filetypes = /jpg|jpeg|png|webp|gif|mp4|mov|avi|mkv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Images and Videos only!'));
    }
}

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit (safer for RAM)
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: 'No file selected' });
        }

        // Upload via Media Service (AWS S3 or Cloudinary)
        const result = await uploadMedia(req.file.buffer, 'products', req.file.originalname);

        logger.info(`[UPLOAD] File uploaded successfully to ${result.secure_url} | IP: ${req.ip}`);

        res.json({
            message: 'File uploaded successfully',
            filePath: result.secure_url,
            publicId: result.public_id,
            fileName: result.original_filename
        });
    } catch (error) {
        logger.error(`[UPLOAD FAIL] Error: ${error.message} | IP: ${req.ip}`);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

module.exports = router;
