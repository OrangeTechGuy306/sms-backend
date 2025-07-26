const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get all library books with pagination and filtering
 */
async function getBooks(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      language = '',
      status = '',
      availability = '',
      sort_by = 'title',
      sort_order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(lb.title LIKE ? OR lb.author LIKE ? OR lb.isbn LIKE ? OR lb.publisher LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (category) {
      whereConditions.push('lb.category = ?');
      queryParams.push(category);
    }

    if (language) {
      whereConditions.push('lb.language = ?');
      queryParams.push(language);
    }

    if (status) {
      whereConditions.push('lb.status = ?');
      queryParams.push(status);
    }

    if (availability === 'available') {
      whereConditions.push('lb.available_copies > 0');
    } else if (availability === 'unavailable') {
      whereConditions.push('lb.available_copies = 0');
    }

    // Validate sort parameters
    const allowedSortFields = ['title', 'author', 'category', 'publication_year', 'acquisition_date', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'title';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM library_books lb
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get books with loan statistics
    const booksQuery = `
      SELECT 
        lb.id,
        lb.isbn,
        lb.title,
        lb.author,
        lb.publisher,
        lb.publication_year,
        lb.edition,
        lb.category,
        lb.subcategory,
        lb.language,
        lb.pages,
        lb.description,
        lb.location_shelf,
        lb.total_copies,
        lb.available_copies,
        lb.price,
        lb.acquisition_date,
        lb.condition_status,
        lb.status,
        lb.cover_image_url,
        lb.created_at,
        lb.updated_at,
        COUNT(DISTINCT lbl.id) as total_loans,
        COUNT(DISTINCT CASE WHEN lbl.status = 'active' THEN lbl.id END) as active_loans,
        COUNT(DISTINCT lr.id) as active_reservations
      FROM library_books lb
      LEFT JOIN library_book_loans lbl ON lb.id = lbl.book_id
      LEFT JOIN library_reservations lr ON lb.id = lr.book_id AND lr.status = 'active'
      WHERE ${whereClause}
      GROUP BY lb.id
      ORDER BY lb.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const books = await executeQuery(booksQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: 'Library books retrieved successfully',
      data: {
        books,
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

    logger.info(`User ${req.user.id} retrieved library books - Page: ${page}, Total: ${total}`);

  } catch (error) {
    logger.error('Error retrieving library books:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve library books',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get book by ID with loan history
 */
async function getBookById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book ID format'
      });
    }

    // Get book details
    const bookQuery = `
      SELECT 
        lb.id,
        lb.isbn,
        lb.title,
        lb.author,
        lb.publisher,
        lb.publication_year,
        lb.edition,
        lb.category,
        lb.subcategory,
        lb.language,
        lb.pages,
        lb.description,
        lb.location_shelf,
        lb.total_copies,
        lb.available_copies,
        lb.price,
        lb.acquisition_date,
        lb.condition_status,
        lb.status,
        lb.cover_image_url,
        lb.created_at,
        lb.updated_at
      FROM library_books lb
      WHERE lb.id = ?
    `;

    const bookResult = await executeQuery(bookQuery, [id]);

    if (bookResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const book = bookResult[0];

    // Get current loans
    const currentLoansQuery = `
      SELECT 
        lbl.id,
        lbl.borrower_id,
        lbl.borrower_type,
        lbl.loan_date,
        lbl.due_date,
        lbl.renewed_count,
        lbl.fine_amount,
        lbl.status,
        CASE 
          WHEN lbl.borrower_type = 'student' THEN CONCAT(s.first_name, ' ', s.last_name)
          WHEN lbl.borrower_type = 'teacher' THEN CONCAT(t.first_name, ' ', t.last_name)
          ELSE 'Staff Member'
        END as borrower_name
      FROM library_book_loans lbl
      LEFT JOIN students s ON lbl.borrower_id = s.id AND lbl.borrower_type = 'student'
      LEFT JOIN teachers t ON lbl.borrower_id = t.id AND lbl.borrower_type = 'teacher'
      WHERE lbl.book_id = ? AND lbl.status = 'active'
      ORDER BY lbl.loan_date DESC
    `;

    const currentLoans = await executeQuery(currentLoansQuery, [id]);

    // Get reservations
    const reservationsQuery = `
      SELECT 
        lr.id,
        lr.user_id,
        lr.user_type,
        lr.reservation_date,
        lr.expiry_date,
        lr.priority_order,
        lr.status,
        CASE 
          WHEN lr.user_type = 'student' THEN CONCAT(s.first_name, ' ', s.last_name)
          WHEN lr.user_type = 'teacher' THEN CONCAT(t.first_name, ' ', t.last_name)
          ELSE 'Staff Member'
        END as user_name
      FROM library_reservations lr
      LEFT JOIN students s ON lr.user_id = s.id AND lr.user_type = 'student'
      LEFT JOIN teachers t ON lr.user_id = t.id AND lr.user_type = 'teacher'
      WHERE lr.book_id = ? AND lr.status = 'active'
      ORDER BY lr.priority_order, lr.reservation_date
    `;

    const reservations = await executeQuery(reservationsQuery, [id]);

    // Get loan history (last 10 loans)
    const loanHistoryQuery = `
      SELECT 
        lbl.id,
        lbl.borrower_id,
        lbl.borrower_type,
        lbl.loan_date,
        lbl.due_date,
        lbl.return_date,
        lbl.renewed_count,
        lbl.fine_amount,
        lbl.status,
        CASE 
          WHEN lbl.borrower_type = 'student' THEN CONCAT(s.first_name, ' ', s.last_name)
          WHEN lbl.borrower_type = 'teacher' THEN CONCAT(t.first_name, ' ', t.last_name)
          ELSE 'Staff Member'
        END as borrower_name
      FROM library_book_loans lbl
      LEFT JOIN students s ON lbl.borrower_id = s.id AND lbl.borrower_type = 'student'
      LEFT JOIN teachers t ON lbl.borrower_id = t.id AND lbl.borrower_type = 'teacher'
      WHERE lbl.book_id = ?
      ORDER BY lbl.loan_date DESC
      LIMIT 10
    `;

    const loanHistory = await executeQuery(loanHistoryQuery, [id]);

    res.json({
      success: true,
      message: 'Book retrieved successfully',
      data: {
        ...book,
        current_loans: currentLoans,
        reservations,
        loan_history: loanHistory
      }
    });

    logger.info(`User ${req.user.id} retrieved book ${id}`);

  } catch (error) {
    logger.error('Error retrieving book:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve book',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Create new book
 */
async function createBook(req, res) {
  try {
    const {
      isbn,
      title,
      author,
      publisher,
      publication_year,
      edition,
      category,
      subcategory,
      language = 'English',
      pages,
      description,
      location_shelf,
      total_copies = 1,
      price,
      acquisition_date,
      condition_status = 'good',
      status = 'active',
      cover_image_url
    } = sanitizeInput(req.body);

    // Validate required fields
    if (!title || !author || !category || !total_copies) {
      return res.status(400).json({
        success: false,
        message: 'Title, author, category, and total copies are required'
      });
    }

    // Only admins and librarians can create books
    if (!['admin'].includes(req.user.user_type)) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can add books to the library'
      });
    }

    // Check if ISBN already exists (if provided)
    if (isbn) {
      const existingBookQuery = 'SELECT id FROM library_books WHERE isbn = ?';
      const existingBook = await executeQuery(existingBookQuery, [isbn]);
      
      if (existingBook.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Book with this ISBN already exists'
        });
      }
    }

    // Create book
    const insertQuery = `
      INSERT INTO library_books (
        isbn, title, author, publisher, publication_year, edition,
        category, subcategory, language, pages, description, location_shelf,
        total_copies, available_copies, price, acquisition_date,
        condition_status, status, cover_image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      isbn, title, author, publisher, publication_year, edition,
      category, subcategory, language, pages, description, location_shelf,
      total_copies, total_copies, price, acquisition_date,
      condition_status, status, cover_image_url
    ];

    const result = await executeQuery(insertQuery, insertParams);
    const bookId = result.insertId;

    // Get the created book
    const createdBook = await executeQuery(`
      SELECT 
        lb.id,
        lb.isbn,
        lb.title,
        lb.author,
        lb.publisher,
        lb.publication_year,
        lb.edition,
        lb.category,
        lb.subcategory,
        lb.language,
        lb.pages,
        lb.description,
        lb.location_shelf,
        lb.total_copies,
        lb.available_copies,
        lb.price,
        lb.acquisition_date,
        lb.condition_status,
        lb.status,
        lb.cover_image_url,
        lb.created_at,
        lb.updated_at
      FROM library_books lb
      WHERE lb.id = ?
    `, [bookId]);

    res.status(201).json({
      success: true,
      message: 'Book added to library successfully',
      data: createdBook[0]
    });

    logger.info(`User ${req.user.id} added book ${bookId} to library: ${title}`);

  } catch (error) {
    logger.error('Error creating book:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add book to library',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Issue book to borrower
 */
async function issueBook(req, res) {
  try {
    const { id } = req.params;
    const {
      borrower_id,
      borrower_type,
      loan_period_days = 14,
      notes
    } = sanitizeInput(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book ID format'
      });
    }

    // Validate required fields
    if (!borrower_id || !borrower_type) {
      return res.status(400).json({
        success: false,
        message: 'Borrower ID and type are required'
      });
    }

    // Validate borrower type
    if (!['student', 'teacher', 'staff'].includes(borrower_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid borrower type'
      });
    }

    // Only admins and librarians can issue books
    if (!['admin'].includes(req.user.user_type)) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can issue books'
      });
    }

    // Check if book exists and is available
    const bookQuery = `
      SELECT id, title, available_copies, status
      FROM library_books
      WHERE id = ? AND status = 'active'
    `;

    const bookResult = await executeQuery(bookQuery, [id]);

    if (bookResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found or not available'
      });
    }

    const book = bookResult[0];

    if (book.available_copies <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No copies available for loan'
      });
    }

    // Check if borrower exists
    let borrowerQuery;
    if (borrower_type === 'student') {
      borrowerQuery = 'SELECT id, CONCAT(first_name, " ", last_name) as name FROM students WHERE id = ?';
    } else if (borrower_type === 'teacher') {
      borrowerQuery = 'SELECT id, CONCAT(first_name, " ", last_name) as name FROM teachers WHERE id = ?';
    } else {
      // For staff, we'll assume they exist (could be enhanced with staff table)
      borrowerQuery = 'SELECT ? as id, "Staff Member" as name';
    }

    const borrowerResult = await executeQuery(borrowerQuery, [borrower_id]);

    if (borrowerResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Borrower not found'
      });
    }

    // Check if borrower already has this book
    const existingLoanQuery = `
      SELECT id FROM library_book_loans
      WHERE book_id = ? AND borrower_id = ? AND borrower_type = ? AND status = 'active'
    `;

    const existingLoan = await executeQuery(existingLoanQuery, [id, borrower_id, borrower_type]);

    if (existingLoan.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Borrower already has this book on loan'
      });
    }

    // Calculate due date
    const loanDate = new Date();
    const dueDate = new Date(loanDate);
    dueDate.setDate(dueDate.getDate() + parseInt(loan_period_days));

    // Start transaction
    await executeTransaction(async (connection) => {
      // Create loan record
      const insertLoanQuery = `
        INSERT INTO library_book_loans (
          book_id, borrower_id, borrower_type, loan_date, due_date,
          condition_on_loan, notes, status, issued_by
        ) VALUES (?, ?, ?, ?, ?, 'good', ?, 'active', ?)
      `;

      const loanResult = await executeQuery(insertLoanQuery, [
        id, borrower_id, borrower_type, loanDate, dueDate, notes, req.user.id
      ], connection);

      // Update book available copies
      const updateBookQuery = `
        UPDATE library_books
        SET available_copies = available_copies - 1
        WHERE id = ?
      `;

      await executeQuery(updateBookQuery, [id], connection);

      return loanResult.insertId;
    });

    // Get the created loan with details
    const loanDetailsQuery = `
      SELECT
        lbl.id,
        lbl.book_id,
        lbl.borrower_id,
        lbl.borrower_type,
        lbl.loan_date,
        lbl.due_date,
        lbl.status,
        lbl.notes,
        lb.title as book_title,
        lb.author as book_author,
        CASE
          WHEN lbl.borrower_type = 'student' THEN CONCAT(s.first_name, ' ', s.last_name)
          WHEN lbl.borrower_type = 'teacher' THEN CONCAT(t.first_name, ' ', t.last_name)
          ELSE 'Staff Member'
        END as borrower_name
      FROM library_book_loans lbl
      JOIN library_books lb ON lbl.book_id = lb.id
      LEFT JOIN students s ON lbl.borrower_id = s.id AND lbl.borrower_type = 'student'
      LEFT JOIN teachers t ON lbl.borrower_id = t.id AND lbl.borrower_type = 'teacher'
      WHERE lbl.book_id = ? AND lbl.borrower_id = ? AND lbl.borrower_type = ? AND lbl.status = 'active'
      ORDER BY lbl.created_at DESC
      LIMIT 1
    `;

    const loanDetails = await executeQuery(loanDetailsQuery, [id, borrower_id, borrower_type]);

    res.status(201).json({
      success: true,
      message: 'Book issued successfully',
      data: loanDetails[0]
    });

    logger.info(`User ${req.user.id} issued book ${id} to ${borrower_type} ${borrower_id}`);

  } catch (error) {
    logger.error('Error issuing book:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to issue book',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Return book
 */
async function returnBook(req, res) {
  try {
    const { loanId } = req.params;
    const {
      condition_on_return = 'good',
      fine_amount = 0,
      notes
    } = sanitizeInput(req.body);

    if (!isValidUUID(loanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan ID format'
      });
    }

    // Only admins and librarians can process returns
    if (!['admin'].includes(req.user.user_type)) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can process book returns'
      });
    }

    // Check if loan exists and is active
    const loanQuery = `
      SELECT
        lbl.id,
        lbl.book_id,
        lbl.borrower_id,
        lbl.borrower_type,
        lbl.loan_date,
        lbl.due_date,
        lbl.status,
        lb.title as book_title
      FROM library_book_loans lbl
      JOIN library_books lb ON lbl.book_id = lb.id
      WHERE lbl.id = ? AND lbl.status = 'active'
    `;

    const loanResult = await executeQuery(loanQuery, [loanId]);

    if (loanResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active loan not found'
      });
    }

    const loan = loanResult[0];

    // Start transaction
    await executeTransaction(async (connection) => {
      // Update loan record
      const updateLoanQuery = `
        UPDATE library_book_loans
        SET
          return_date = NOW(),
          condition_on_return = ?,
          fine_amount = ?,
          notes = CONCAT(COALESCE(notes, ''), ?, ' [Returned: ', NOW(), ']'),
          status = 'returned',
          returned_to = ?
        WHERE id = ?
      `;

      await executeQuery(updateLoanQuery, [
        condition_on_return, fine_amount, notes ? ` ${notes}` : '', req.user.id, loanId
      ], connection);

      // Update book available copies
      const updateBookQuery = `
        UPDATE library_books
        SET available_copies = available_copies + 1
        WHERE id = ?
      `;

      await executeQuery(updateBookQuery, [loan.book_id], connection);
    });

    // Get the updated loan details
    const returnedLoanQuery = `
      SELECT
        lbl.id,
        lbl.book_id,
        lbl.borrower_id,
        lbl.borrower_type,
        lbl.loan_date,
        lbl.due_date,
        lbl.return_date,
        lbl.condition_on_return,
        lbl.fine_amount,
        lbl.status,
        lb.title as book_title,
        lb.author as book_author,
        CASE
          WHEN lbl.borrower_type = 'student' THEN CONCAT(s.first_name, ' ', s.last_name)
          WHEN lbl.borrower_type = 'teacher' THEN CONCAT(t.first_name, ' ', t.last_name)
          ELSE 'Staff Member'
        END as borrower_name
      FROM library_book_loans lbl
      JOIN library_books lb ON lbl.book_id = lb.id
      LEFT JOIN students s ON lbl.borrower_id = s.id AND lbl.borrower_type = 'student'
      LEFT JOIN teachers t ON lbl.borrower_id = t.id AND lbl.borrower_type = 'teacher'
      WHERE lbl.id = ?
    `;

    const returnedLoan = await executeQuery(returnedLoanQuery, [loanId]);

    res.json({
      success: true,
      message: 'Book returned successfully',
      data: returnedLoan[0]
    });

    logger.info(`User ${req.user.id} processed return for loan ${loanId} - Book: ${loan.book_title}`);

  } catch (error) {
    logger.error('Error returning book:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process book return',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get all loans with pagination and filtering
 */
async function getLoans(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      borrower_type = '',
      status = '',
      overdue = '',
      sort_by = 'loan_date',
      sort_order = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (search) {
      whereConditions.push(`(
        lb.title LIKE ? OR lb.author LIKE ? OR lb.isbn LIKE ? OR
        CASE
          WHEN lbl.borrower_type = 'student' THEN CONCAT(s.first_name, ' ', s.last_name)
          WHEN lbl.borrower_type = 'teacher' THEN CONCAT(t.first_name, ' ', t.last_name)
          ELSE 'Staff Member'
        END LIKE ?
      )`);
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (borrower_type) {
      whereConditions.push('lbl.borrower_type = ?');
      queryParams.push(borrower_type);
    }

    if (status) {
      whereConditions.push('lbl.status = ?');
      queryParams.push(status);
    }

    if (overdue === 'true') {
      whereConditions.push('lbl.due_date < CURDATE() AND lbl.status = "active"');
    }

    // Validate sort parameters
    const allowedSortFields = ['loan_date', 'due_date', 'return_date', 'fine_amount'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'loan_date';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM library_book_loans lbl
      JOIN library_books lb ON lbl.book_id = lb.id
      LEFT JOIN students s ON lbl.borrower_id = s.id AND lbl.borrower_type = 'student'
      LEFT JOIN teachers t ON lbl.borrower_id = t.id AND lbl.borrower_type = 'teacher'
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get loans
    const loansQuery = `
      SELECT
        lbl.id,
        lbl.book_id,
        lbl.borrower_id,
        lbl.borrower_type,
        lbl.loan_date,
        lbl.due_date,
        lbl.return_date,
        lbl.renewed_count,
        lbl.fine_amount,
        lbl.fine_paid,
        lbl.condition_on_loan,
        lbl.condition_on_return,
        lbl.status,
        lb.title as book_title,
        lb.author as book_author,
        lb.isbn,
        CASE
          WHEN lbl.borrower_type = 'student' THEN CONCAT(s.first_name, ' ', s.last_name)
          WHEN lbl.borrower_type = 'teacher' THEN CONCAT(t.first_name, ' ', t.last_name)
          ELSE 'Staff Member'
        END as borrower_name,
        CASE
          WHEN lbl.status = 'active' AND lbl.due_date < CURDATE() THEN TRUE
          ELSE FALSE
        END as is_overdue,
        DATEDIFF(CURDATE(), lbl.due_date) as days_overdue
      FROM library_book_loans lbl
      JOIN library_books lb ON lbl.book_id = lb.id
      LEFT JOIN students s ON lbl.borrower_id = s.id AND lbl.borrower_type = 'student'
      LEFT JOIN teachers t ON lbl.borrower_id = t.id AND lbl.borrower_type = 'teacher'
      WHERE ${whereClause}
      ORDER BY lbl.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const loans = await executeQuery(loansQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: 'Library loans retrieved successfully',
      data: {
        loans,
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

    logger.info(`User ${req.user.id} retrieved library loans - Page: ${page}, Total: ${total}`);

  } catch (error) {
    logger.error('Error retrieving library loans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve library loans',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  getBooks,
  getBookById,
  createBook,
  issueBook,
  returnBook,
  getLoans
};
