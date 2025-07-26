const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../../uploads');
const documentsDir = path.join(uploadDir, 'documents');
const imagesDir = path.join(uploadDir, 'images');
const videosDir = path.join(uploadDir, 'videos');
const audiosDir = path.join(uploadDir, 'audios');
const othersDir = path.join(uploadDir, 'others');

// Create directories if they don't exist
[uploadDir, documentsDir, imagesDir, videosDir, audiosDir, othersDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// File type detection
const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.includes('pdf') || 
      mimetype.includes('document') || 
      mimetype.includes('text') ||
      mimetype.includes('spreadsheet') ||
      mimetype.includes('presentation')) return 'document';
  return 'other';
};

// Get storage directory based on file type
const getStorageDir = (fileType) => {
  switch (fileType) {
    case 'image': return imagesDir;
    case 'video': return videosDir;
    case 'audio': return audiosDir;
    case 'document': return documentsDir;
    default: return othersDir;
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fileType = getFileType(file.mimetype);
    const storageDir = getStorageDir(fileType);
    cb(null, storageDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    const filename = `${uniqueId}${extension}`;
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimeTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    // Documents
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    // Videos
    'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files per upload
  }
});

// Single file upload middleware
const uploadSingle = upload.single('file');

// Multiple files upload middleware
const uploadMultiple = upload.array('files', 10);

// Handle multer errors
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 50MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files per upload.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message.includes('File type') && error.message.includes('not allowed')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  return res.status(500).json({
    success: false,
    message: 'File upload error occurred.'
  });
};

// Save file metadata to database
const saveFileMetadata = async (fileData, userId) => {
  const { executeQuery } = require('../config/database');
  
  const query = `
    INSERT INTO files (
      id, filename, original_filename, file_path, file_size, 
      mime_type, file_type, description, is_public, 
      related_to_type, related_to_id, uploaded_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  const fileId = uuidv4();
  const values = [
    fileId,
    fileData.filename,
    fileData.originalname,
    fileData.path,
    fileData.size,
    fileData.mimetype,
    getFileType(fileData.mimetype),
    fileData.description || null,
    fileData.isPublic || false,
    fileData.relatedToType || null,
    fileData.relatedToId || null,
    userId
  ];

  await executeQuery(query, values);
  return fileId;
};

// Delete file from filesystem
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  saveFileMetadata,
  deleteFile,
  getFileType,
  getStorageDir
};
