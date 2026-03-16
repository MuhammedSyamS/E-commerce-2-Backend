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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit (Images only)
    fileFilter: function (req, file, cb) {
        const filetypes = /jpg|jpeg|png|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed (JPG, PNG, WebP)!'));
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
