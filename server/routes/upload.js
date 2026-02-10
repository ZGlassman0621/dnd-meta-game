import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for avatar uploads
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log('Rejected file with mimetype:', file.mimetype);
      cb(new Error(`File type not allowed: ${file.mimetype}. Only JPG, PNG, WebP, and GIF images are allowed.`));
    }
  }
});

// Upload avatar - with proper error handling for multer
router.post('/avatar', (req, res) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      console.error('Multer error uploading avatar:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to upload avatar'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Return the file path relative to the uploads directory
    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    res.json({
      success: true,
      avatarPath
    });
  });
});

export default router;
