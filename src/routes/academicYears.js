const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Get all academic years
 */
router.get('/', authenticate, authorize(['admin', 'teacher']), async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        start_date,
        end_date,
        is_current,
        status,
        created_at,
        updated_at
      FROM academic_years 
      WHERE status IN ('active', 'upcoming')
      ORDER BY is_current DESC, start_date DESC
    `;

    const academicYears = await executeQuery(query);

    res.json({
      success: true,
      message: 'Academic years retrieved successfully',
      data: academicYears
    });

  } catch (error) {
    logger.error('Get academic years error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve academic years'
    });
  }
});

/**
 * Get academic year by ID
 */
router.get('/:id', authenticate, authorize(['admin', 'teacher']), async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id,
        name,
        start_date,
        end_date,
        is_current,
        status,
        created_at,
        updated_at
      FROM academic_years 
      WHERE id = ?
    `;

    const academicYears = await executeQuery(query, [id]);

    if (academicYears.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Academic year not found'
      });
    }

    res.json({
      success: true,
      message: 'Academic year retrieved successfully',
      data: academicYears[0]
    });

  } catch (error) {
    logger.error('Get academic year by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve academic year'
    });
  }
});

/**
 * Get current academic year
 */
router.get('/current', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        start_date,
        end_date,
        is_current,
        status,
        created_at,
        updated_at
      FROM academic_years 
      WHERE is_current = TRUE
      LIMIT 1
    `;

    const academicYears = await executeQuery(query);

    if (academicYears.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No current academic year found'
      });
    }

    res.json({
      success: true,
      message: 'Current academic year retrieved successfully',
      data: academicYears[0]
    });

  } catch (error) {
    logger.error('Get current academic year error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve current academic year'
    });
  }
});

module.exports = router;
