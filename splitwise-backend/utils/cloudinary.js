const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage engine for multer — auto-detects image/video/raw
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let resourceType = 'raw';
    let folder = 'splitwise/chat/files';

    if (file.mimetype.startsWith('image/')) {
      resourceType = 'image';
      folder = 'splitwise/chat/images';
    } else if (file.mimetype.startsWith('video/')) {
      resourceType = 'video';
      folder = 'splitwise/chat/videos';
    } else if (file.mimetype.startsWith('audio/')) {
      resourceType = 'video'; // Cloudinary audio = video resource type
      folder = 'splitwise/chat/audio';
    }

    return {
      folder,
      resource_type: resourceType,
      // Keep original filename in public_id
      public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`,
      // Allow up to 50 MB
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

module.exports = { cloudinary, upload };
