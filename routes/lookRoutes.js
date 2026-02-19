const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, admin, manager } = require('../middleware/authMiddleware');
const {
    createLook,
    getAllLooks,
    getMyLooks,
    toggleLike,
    deleteLook,
    getAllLooksAdmin,
    updateLookStatus
} = require('../controllers/lookController');

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination(req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename(req, file, cb) {
        cb(null, `look-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpg|jpeg|png|webp|heic|heif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype) || file.mimetype === 'application/octet-stream'; // Handle some HEIC edge cases
        if (extname) {
            return cb(null, true);
        } else {
            cb('Error: Images Only!');
        }
    },
});

// Routes
router.route('/')
    .get(getAllLooks)
    .post(protect, upload.single('image'), createLook);

router.get('/my', protect, getMyLooks);

// Admin Routes
router.get('/admin', protect, manager, getAllLooksAdmin);
router.patch('/:id/status', protect, manager, updateLookStatus);

router.post('/:id/like', protect, toggleLike);

router.delete('/:id', protect, deleteLook);

module.exports = router;
