const express = require('express');
const { body } = require('express-validator');
const { 
  getBooks, 
  getBookById, 
  createBook,
  issueBook,
  returnBook,
  getLoans
} = require('../controllers/libraryController');
const { authenticate, authorize } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');

const router = express.Router();

// =============================================
// BOOKS ENDPOINTS
// =============================================

/**
 * @route   GET /api/library/books
 * @desc    Get all library books with pagination and filtering
 * @access  Private (All authenticated users)
 */
router.get('/books', [
  authenticate,
  validationRules.page(),
  validationRules.limit(),
  validationRules.search(),
  handleValidationErrors
], getBooks);

/**
 * @route   POST /api/library/books
 * @desc    Add new book to library
 * @access  Private (Admins only)
 */
router.post('/books', [
  authenticate,
  authorize(['admin']),
  body('title')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Title is required and must be less than 500 characters'),
  body('author')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Author is required and must be less than 255 characters'),
  body('isbn')
    .optional()
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('ISBN must be between 10 and 20 characters')
    .matches(/^[0-9-X]+$/)
    .withMessage('ISBN can only contain numbers, hyphens, and X'),
  body('publisher')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Publisher must be less than 255 characters'),
  body('publication_year')
    .optional()
    .isInt({ min: 1000, max: new Date().getFullYear() + 1 })
    .withMessage('Publication year must be between 1000 and current year'),
  body('edition')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Edition must be less than 50 characters'),
  body('category')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category is required and must be less than 100 characters'),
  body('subcategory')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Subcategory must be less than 100 characters'),
  body('language')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Language must be less than 50 characters'),
  body('pages')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Pages must be between 1 and 10000'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('location_shelf')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Location shelf must be less than 50 characters'),
  body('total_copies')
    .isInt({ min: 1, max: 100 })
    .withMessage('Total copies must be between 1 and 100'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('acquisition_date')
    .optional()
    .isISO8601()
    .withMessage('Acquisition date must be a valid date'),
  body('condition_status')
    .optional()
    .isIn(['excellent', 'good', 'fair', 'poor', 'damaged'])
    .withMessage('Condition status must be excellent, good, fair, poor, or damaged'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'lost', 'damaged'])
    .withMessage('Status must be active, inactive, lost, or damaged'),
  body('cover_image_url')
    .optional()
    .isURL()
    .withMessage('Cover image URL must be a valid URL'),
  handleValidationErrors
], createBook);

/**
 * @route   GET /api/library/books/:id
 * @desc    Get book by ID with loan history
 * @access  Private (All authenticated users)
 */
router.get('/books/:id', [
  authenticate,
  validationRules.uuid('id'),
  handleValidationErrors
], getBookById);

/**
 * @route   POST /api/library/books/:id/issue
 * @desc    Issue book to borrower
 * @access  Private (Admins only)
 */
router.post('/books/:id/issue', [
  authenticate,
  authorize(['admin']),
  validationRules.uuid('id'),
  body('borrower_id')
    .isUUID()
    .withMessage('Valid borrower ID is required'),
  body('borrower_type')
    .isIn(['student', 'teacher', 'staff'])
    .withMessage('Borrower type must be student, teacher, or staff'),
  body('loan_period_days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Loan period must be between 1 and 365 days'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
  handleValidationErrors
], issueBook);

// =============================================
// LOANS ENDPOINTS
// =============================================

/**
 * @route   GET /api/library/loans
 * @desc    Get all library loans with pagination and filtering
 * @access  Private (All authenticated users)
 */
router.get('/loans', [
  authenticate,
  validationRules.page(),
  validationRules.limit(),
  validationRules.search(),
  handleValidationErrors
], getLoans);

/**
 * @route   PUT /api/library/loans/:loanId/return
 * @desc    Return book
 * @access  Private (Admins only)
 */
router.put('/loans/:loanId/return', [
  authenticate,
  authorize(['admin']),
  validationRules.uuid('loanId'),
  body('condition_on_return')
    .optional()
    .isIn(['excellent', 'good', 'fair', 'poor', 'damaged'])
    .withMessage('Condition on return must be excellent, good, fair, poor, or damaged'),
  body('fine_amount')
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage('Fine amount must be between 0 and 1000'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
  handleValidationErrors
], returnBook);

/**
 * @route   GET /api/library/loans/overdue
 * @desc    Get overdue loans
 * @access  Private (Admins only)
 */
router.get('/loans/overdue', [
  authenticate,
  authorize(['admin']),
  validationRules.page(),
  validationRules.limit(),
  handleValidationErrors
], async (req, res) => {
  // Redirect to main loans endpoint with overdue filter
  req.query.overdue = 'true';
  req.query.status = 'active';
  return getLoans(req, res);
});

/**
 * @route   GET /api/library/loans/user/:userId
 * @desc    Get loans by user
 * @access  Private (Users can view their own loans, Admins can view any)
 */
router.get('/loans/user/:userId', [
  authenticate,
  validationRules.uuid('userId'),
  validationRules.page(),
  validationRules.limit(),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement user-specific loan filtering with permission checks
  res.json({
    success: true,
    message: 'User loans endpoint - to be implemented',
    data: {
      user_id: req.params.userId,
      loans: [],
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

// =============================================
// RESERVATIONS ENDPOINTS
// =============================================

/**
 * @route   GET /api/library/reservations
 * @desc    Get book reservations
 * @access  Private (All authenticated users)
 */
router.get('/reservations', [
  authenticate,
  validationRules.page(),
  validationRules.limit(),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement reservations functionality
  res.json({
    success: true,
    message: 'Reservations endpoint - to be implemented',
    data: {
      reservations: [],
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
 * @route   POST /api/library/books/:id/reserve
 * @desc    Reserve a book
 * @access  Private (Students and Teachers only)
 */
router.post('/books/:id/reserve', [
  authenticate,
  authorize(['student', 'teacher']),
  validationRules.uuid('id'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement book reservation functionality
  res.json({
    success: true,
    message: 'Book reservation functionality - to be implemented',
    data: {
      book_id: req.params.id,
      user_id: req.user.id,
      reservation_date: new Date().toISOString(),
      status: 'active'
    }
  });
});

// =============================================
// REPORTS ENDPOINTS
// =============================================

/**
 * @route   GET /api/library/reports/statistics
 * @desc    Get library statistics
 * @access  Private (Admins only)
 */
router.get('/reports/statistics', [
  authenticate,
  authorize(['admin']),
  handleValidationErrors
], async (req, res) => {
  // TODO: Implement library statistics
  res.json({
    success: true,
    message: 'Library statistics - to be implemented',
    data: {
      total_books: 0,
      total_copies: 0,
      available_copies: 0,
      active_loans: 0,
      overdue_loans: 0,
      total_reservations: 0,
      popular_books: [],
      category_distribution: {}
    }
  });
});

/**
 * @route   GET /api/library/search
 * @desc    Advanced book search
 * @access  Private (All authenticated users)
 */
router.get('/search', [
  authenticate,
  validationRules.page(),
  validationRules.limit(),
  handleValidationErrors
], async (req, res) => {
  // Redirect to books endpoint with search parameters
  return getBooks(req, res);
});

module.exports = router;
