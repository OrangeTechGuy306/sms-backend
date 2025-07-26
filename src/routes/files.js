const express = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize, checkResourceOwnership } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');
const { uploadSingle, uploadMultiple, handleUploadError, saveFileMetadata, deleteFile } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/files/upload
 * @desc    Upload file
 * @access  Private (All authenticated users)
 */
router.post('/upload', (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      return handleUploadError(err, req, res, next);
    }
    next();
  });
}, [
  body('relatedToType')
    .optional()
    .isIn(['student', 'teacher', 'class', 'event', 'general'])
    .withMessage('Related to type must be student, teacher, class, event, or general'),
  body('relatedToId')
    .optional()
    .isUUID()
    .withMessage('Related to ID must be a valid UUID'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('Is public must be a boolean'),
  handleValidationErrors
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const logger = require('../utils/logger');

    // Prepare file metadata
    const fileData = {
      ...req.file,
      description: req.body.description,
      isPublic: req.body.isPublic === 'true',
      relatedToType: req.body.relatedToType,
      relatedToId: req.body.relatedToId
    };

    // Save file metadata to database
    const fileId = await saveFileMetadata(fileData, req.user.id);

    logger.info(`File uploaded: ${req.file.originalname} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileId,
        filename: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('File upload error:', error);

    // Clean up uploaded file if database save failed
    if (req.file && req.file.path) {
      deleteFile(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload file'
    });
  }
});

/**
 * @route   GET /api/files/:id
 * @desc    Download/view file
 * @access  Private (All authenticated users with proper permissions)
 */
router.get('/:id', [
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { id } = req.params;

    // Get file information
    const fileQuery = `
      SELECT
        f.id,
        f.filename,
        f.original_filename,
        f.file_path,
        f.file_size,
        f.mime_type,
        f.file_type,
        f.description,
        f.is_public,
        f.related_to_type,
        f.related_to_id,
        f.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.id = ?
    `;

    const files = await executeQuery(fileQuery, [id]);

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];

    // Check permissions
    if (!file.is_public) {
      // Check if user has permission to access this file
      // This would involve checking if user is admin, teacher, or has access to the related resource
      if (req.user.userType !== 'admin') {
        // Additional permission checks would go here
        // For now, allow teachers and related users
        if (req.user.userType !== 'teacher') {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      }
    }

    // Check if file exists on filesystem
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
    res.setHeader('Content-Length', file.file_size);

    // Stream the file
    const fileStream = fs.createReadStream(file.file_path);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      const logger = require('../utils/logger');
      logger.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming file'
        });
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('File download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
});

/**
 * @route   DELETE /api/files/:id
 * @desc    Delete file
 * @access  Private (Admin, File uploader)
 */
router.delete('/:id', [
  validationRules.uuid('id'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const logger = require('../utils/logger');
    const { id } = req.params;

    // Get file information
    const fileQuery = 'SELECT uploaded_by, filename, file_path FROM files WHERE id = ?';
    const files = await executeQuery(fileQuery, [id]);

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];

    // Check permissions - only admin or file uploader can delete
    if (req.user.userType !== 'admin' && file.uploaded_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete file from filesystem
    const fileDeleted = deleteFile(file.file_path);
    if (!fileDeleted) {
      logger.warn(`Failed to delete physical file: ${file.file_path}`);
    }

    // Delete file record from database
    await executeQuery('DELETE FROM files WHERE id = ?', [id]);

    logger.info(`File deleted: ${file.filename} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('File delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

/**
 * @route   GET /api/files/student/:studentId
 * @desc    Get files for a student
 * @access  Private (Admin, Teacher, Student themselves, Parents)
 */
router.get('/student/:studentId', [
  validationRules.uuid('studentId'),
  query('file_type')
    .optional()
    .isIn(['document', 'image', 'video', 'audio', 'other'])
    .withMessage('File type must be document, image, video, audio, or other'),
  query('is_public')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Is public must be true or false'),
  handleValidationErrors,
  checkResourceOwnership('studentId', 'student')
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { studentId } = req.params;
    const { file_type, is_public } = req.query;

    let whereConditions = ['f.related_to_type = "student" AND f.related_to_id = ?'];
    let queryParams = [studentId];

    if (file_type) {
      whereConditions.push('f.file_type = ?');
      queryParams.push(file_type);
    }

    if (is_public !== undefined) {
      whereConditions.push('f.is_public = ?');
      queryParams.push(is_public === 'true');
    }

    const whereClause = whereConditions.join(' AND ');

    const filesQuery = `
      SELECT
        f.id,
        f.filename,
        f.original_filename,
        f.file_size,
        f.mime_type,
        f.file_type,
        f.description,
        f.is_public,
        f.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE ${whereClause}
      ORDER BY f.created_at DESC
    `;

    const files = await executeQuery(filesQuery, queryParams);

    res.json({
      success: true,
      data: files
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get student files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student files'
    });
  }
});

/**
 * @route   GET /api/files/list
 * @desc    Get files with pagination and filtering
 * @access  Private (Admin, Teacher)
 */
router.get('/list', [
  authorize(['admin', 'teacher']),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('file_type')
    .optional()
    .isIn(['document', 'image', 'video', 'audio', 'other'])
    .withMessage('File type must be document, image, video, audio, or other'),
  query('related_to_type')
    .optional()
    .isIn(['student', 'teacher', 'class', 'event', 'general'])
    .withMessage('Related to type must be student, teacher, class, event, or general'),
  query('is_public')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Is public must be true or false'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const {
      page = 1,
      limit = 20,
      search = '',
      file_type = '',
      related_to_type = '',
      is_public = ''
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(f.original_filename LIKE ? OR f.description LIKE ?)');
      queryParams.push(searchTerm, searchTerm);
    }

    if (file_type) {
      whereConditions.push('f.file_type = ?');
      queryParams.push(file_type);
    }

    if (related_to_type) {
      whereConditions.push('f.related_to_type = ?');
      queryParams.push(related_to_type);
    }

    if (is_public !== '') {
      whereConditions.push('f.is_public = ?');
      queryParams.push(is_public === 'true');
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM files f WHERE ${whereClause}`;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get files
    const filesQuery = `
      SELECT
        f.id,
        f.filename,
        f.original_filename,
        f.file_size,
        f.mime_type,
        f.file_type,
        f.description,
        f.is_public,
        f.related_to_type,
        f.related_to_id,
        f.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE ${whereClause}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const files = await executeQuery(filesQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: {
        files,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Get files list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve files'
    });
  }
});

/**
 * @route   POST /api/files/bulk-upload
 * @desc    Bulk file upload
 * @access  Private (Admin only)
 */
router.post('/bulk-upload', [
  authorize(['admin'])
], (req, res, next) => {
  uploadMultiple(req, res, (err) => {
    if (err) {
      return handleUploadError(err, req, res, next);
    }
    next();
  });
}, [
  body('relatedToType')
    .optional()
    .isIn(['student', 'teacher', 'class', 'event', 'general'])
    .withMessage('Related to type must be student, teacher, class, event, or general'),
  body('relatedToId')
    .optional()
    .isUUID()
    .withMessage('Related to ID must be a valid UUID'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('Is public must be a boolean'),
  handleValidationErrors
], async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const logger = require('../utils/logger');
    const uploadedFiles = [];
    const errors = [];

    // Process each uploaded file
    for (const file of req.files) {
      try {
        const fileData = {
          ...file,
          description: req.body.description,
          isPublic: req.body.isPublic === 'true',
          relatedToType: req.body.relatedToType,
          relatedToId: req.body.relatedToId
        };

        const fileId = await saveFileMetadata(fileData, req.user.id);
        uploadedFiles.push({
          fileId,
          filename: file.originalname,
          size: file.size,
          type: file.mimetype
        });
      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error.message
        });
        // Clean up file if database save failed
        deleteFile(file.path);
      }
    }

    logger.info(`Bulk upload completed: ${uploadedFiles.length} files uploaded, ${errors.length} errors by user ${req.user.id}`);

    res.json({
      success: true,
      message: `Bulk upload completed: ${uploadedFiles.length} files uploaded successfully`,
      data: {
        uploadedFiles,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Bulk file upload error:', error);

    // Clean up all uploaded files if there's a general error
    if (req.files) {
      req.files.forEach(file => deleteFile(file.path));
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload files'
    });
  }
});

module.exports = router;
