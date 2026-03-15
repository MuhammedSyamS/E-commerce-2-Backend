const express = require('express');
const multer = require('multer');
const path = require('path');
const { uploadToCloudinary } = require('../utils/cloudinary');

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
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: 'No file selected' });
        }

        // Upload to Cloudinary
        const result = await uploadToCloudinary(req.file.buffer, 'products');

        res.send({
            message: 'File uploaded successfully',
            filePath: result.secure_url,
            publicId: result.public_id,
            fileName: result.original_filename
        });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).send({ message: 'Upload successfully failed', error: error.message });
    }
});

module.exports = router;
