const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Get all grade levels
 */
router.get('/', authenticate, authorize(['admin', 'teacher']), async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        level_number,
        description,
        status,
        created_at,
        updated_at
      FROM grade_levels 
      WHERE status = 'active'
      ORDER BY level_number ASC
    `;

    const gradeLevels = await executeQuery(query);

    res.json({
      success: true,
      message: 'Grade levels retrieved successfully',
      data: gradeLevels
    });

  } catch (error) {
    logger.error('Get grade levels error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve grade levels'
    });
  }
});

/**
 * Get grade level by ID
 */
router.get('/:id', authenticate, authorize(['admin', 'teacher']), async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id,
        name,
        level_number,
        description,
        status,
        created_at,
        updated_at
      FROM grade_levels 
      WHERE id = ?
    `;

    const gradeLevels = await executeQuery(query, [id]);

    if (gradeLevels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Grade level not found'
      });
    }

    res.json({
      success: true,
      message: 'Grade level retrieved successfully',
      data: gradeLevels[0]
    });

  } catch (error) {
    logger.error('Get grade level by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve grade level'
    });
  }
});

module.exports = router;
