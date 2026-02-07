const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename(req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    },
});

function checkFileType(file, cb) {
    const filetypes = /jpg|jpeg|png|mp4|mov|avi|mkv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Error: Videos/Images Only!');
    }
}

const upload = multer({
    storage,
    limits: { fileSize: 100000000 }, // 100MB limit
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: 'No file selected' });
    }

    // Return the full URL or relative path. 
    // Determining protocol/host is tricky in production, so we return relative path.
    // Frontend assumes static serve at /uploads
    const filePath = `/uploads/${req.file.filename}`;
    res.send({
        message: 'File uploaded',
        filePath,
        fileName: req.file.filename
    });
});

module.exports = router;
