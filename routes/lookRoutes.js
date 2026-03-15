const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, admin, manager, hasPermission } = require('../middleware/authMiddleware');
const {
    createLook,
    getAllLooks,
    getMyLooks,
    toggleLike,
    deleteLook,
    getAllLooksAdmin,
    updateLookStatus,
    updateLook
} = require('../controllers/lookController');

// Multer Storage Configuration
const storage = multer.memoryStorage();

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
router.get('/admin', protect, hasPermission('manage_looks'), getAllLooksAdmin);
router.patch('/:id/status', protect, hasPermission('manage_looks'), updateLookStatus);
router.put('/:id', protect, hasPermission('manage_looks'), updateLook);

router.post('/:id/like', protect, toggleLike);

router.delete('/:id', protect, deleteLook);

module.exports = router;
