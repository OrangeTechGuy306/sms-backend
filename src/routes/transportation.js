const express = require('express');
const { body } = require('express-validator');
const { 
  getRoutes, 
  getRouteById, 
  createRoute,
  getBuses,
  createBus,
  getDrivers,
  createDriver
} = require('../controllers/transportationController');
const { authenticate, authorize } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// =============================================
// ROUTES ENDPOINTS
// =============================================

/**
 * @route   GET /api/transportation/routes
 * @desc    Get all transportation routes with pagination and filtering
 * @access  Private (All authenticated users)
 */
router.get('/routes', [
  authenticate,
  validationRules.page(),
  validationRules.limit(),
  validationRules.search(),
  handleValidationErrors
], getRoutes);

/**
 * @route   POST /api/transportation/routes
 * @desc    Create new transportation route
 * @access  Private (Admins only)
 */
router.post('/routes', [
  authenticate,
  authorize(['admin']),
  body('route_name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Route name is required and must be less than 255 characters'),
  body('route_code')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Route code is required and must be less than 50 characters')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Route code can only contain uppercase letters, numbers, and hyphens'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('start_location')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Start location is required and must be less than 255 characters'),
  body('end_location')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('End location is required and must be less than 255 characters'),
  body('estimated_duration')
    .isInt({ min: 1, max: 480 })
    .withMessage('Estimated duration must be between 1 and 480 minutes'),
  body('distance_km')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Distance must be a positive number'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'maintenance'])
    .withMessage('Status must be active, inactive, or maintenance'),
  handleValidationErrors
], createRoute);

/**
 * @route   GET /api/transportation/routes/:id
 * @desc    Get transportation route by ID with stops and assignments
 * @access  Private (All authenticated users)
 */
router.get('/routes/:id', [
  authenticate,
  validationRules.uuid('id'),
  handleValidationErrors
], getRouteById);

// =============================================
// BUSES ENDPOINTS
// =============================================

/**
 * @route   GET /api/transportation/buses
 * @desc    Get all transportation buses with pagination and filtering
 * @access  Private (All authenticated users)
 */
router.get('/buses', [
  authenticate,
  validationRules.page(),
  validationRules.limit(),
  validationRules.search(),
  handleValidationErrors
], getBuses);

/**
 * @route   POST /api/transportation/buses
 * @desc    Create new transportation bus
 * @access  Private (Admins only)
 */
router.post('/buses', [
  authenticate,
  authorize(['admin']),
  body('bus_number')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Bus number is required and must be less than 50 characters'),
  body('license_plate')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('License plate is required and must be less than 50 characters'),
  body('capacity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Capacity must be between 1 and 100'),
  body('model')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Model must be less than 100 characters'),
  body('year_manufactured')
    .optional()
    .isInt({ min: 1990, max: new Date().getFullYear() + 1 })
    .withMessage('Year manufactured must be between 1990 and current year'),
  body('fuel_type')
    .optional()
    .isIn(['diesel', 'petrol', 'electric', 'hybrid'])
    .withMessage('Fuel type must be diesel, petrol, electric, or hybrid'),
  body('insurance_expiry')
    .optional()
    .isISO8601()
    .withMessage('Insurance expiry must be a valid date'),
  body('gps_device_id')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('GPS device ID must be less than 100 characters'),
  body('status')
    .optional()
    .isIn(['active', 'maintenance', 'retired'])
    .withMessage('Status must be active, maintenance, or retired'),
  handleValidationErrors
], createBus);

// =============================================
// DRIVERS ENDPOINTS
// =============================================

/**
 * @route   GET /api/transportation/drivers
 * @desc    Get all transportation drivers with pagination and filtering
 * @access  Private (All authenticated users)
 */
router.get('/drivers', [
  authenticate,
  validationRules.page(),
  validationRules.limit(),
  validationRules.search(),
  handleValidationErrors
], getDrivers);

/**
 * @route   POST /api/transportation/drivers
 * @desc    Create new transportation driver
 * @access  Private (Admins only)
 */
router.post('/drivers', [
  authenticate,
  authorize(['admin']),
  body('employee_id')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Employee ID is required and must be less than 50 characters'),
  validationRules.firstName(),
  validationRules.lastName(),
  body('phone')
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address is required'),
  body('license_number')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('License number is required and must be less than 50 characters'),
  body('license_expiry')
    .isISO8601()
    .withMessage('Valid license expiry date is required')
    .custom((value) => {
      const expiryDate = new Date(value);
      const today = new Date();
      if (expiryDate <= today) {
        throw new Error('License expiry date must be in the future');
      }
      return true;
    }),
  body('date_of_birth')
    .isISO8601()
    .withMessage('Valid date of birth is required')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18 || age > 70) {
        throw new Error('Driver age must be between 18 and 70 years');
      }
      return true;
    }),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('emergency_contact_name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Emergency contact name must be less than 255 characters'),
  body('emergency_contact_phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid emergency contact phone number is required'),
  body('hire_date')
    .isISO8601()
    .withMessage('Valid hire date is required'),
  body('status')
    .optional()
    .isIn(['active', 'on_leave', 'terminated'])
    .withMessage('Status must be active, on_leave, or terminated'),
  handleValidationErrors
], createDriver);

// =============================================
// ROUTE ASSIGNMENTS ENDPOINTS
// =============================================

/**
 * @route   GET /api/transportation/assignments
 * @desc    Get route assignments
 * @access  Private (All authenticated users)
 */
router.get('/assignments', [
  authenticate,
  validationRules.page(),
  validationRules.limit(),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement route assignments controller
  res.json({
    success: true,
    message: 'Route assignments endpoint - to be implemented',
    data: {
      assignments: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: 20,
        hasNextPage: false,
        hasPrevPage: false
      }
    }
  });
});

/**
 * @route   GET /api/transportation/tracking
 * @desc    Get real-time bus tracking data
 * @access  Private (All authenticated users)
 */
router.get('/tracking', [
  authenticate,
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement GPS tracking functionality
  res.json({
    success: true,
    message: 'GPS tracking endpoint - to be implemented',
    data: {
      buses: [],
      lastUpdate: new Date().toISOString()
    }
  });
});

/**
 * @route   GET /api/transportation/students/:studentId
 * @desc    Get transportation details for a student
 * @access  Private (Students, Parents, Teachers, Admins)
 */
router.get('/students/:studentId', [
  authenticate,
  validationRules.uuid('studentId'),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement student transportation details
  res.json({
    success: true,
    message: 'Student transportation endpoint - to be implemented',
    data: {
      student_id: req.params.studentId,
      route: null,
      pickup_stop: null,
      dropoff_stop: null,
      monthly_fee: 0
    }
  });
});

/**
 * @route   GET /api/transportation/reports/utilization
 * @desc    Get transportation utilization reports
 * @access  Private (Admins only)
 */
router.get('/reports/utilization', [
  authenticate,
  authorize(['admin']),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement utilization reports
  res.json({
    success: true,
    message: 'Transportation utilization reports - to be implemented',
    data: {
      total_routes: 0,
      total_buses: 0,
      total_drivers: 0,
      total_students: 0,
      utilization_percentage: 0
    }
  });
});

module.exports = router;
