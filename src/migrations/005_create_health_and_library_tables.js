const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const up = async () => {
  logger.info('Creating health records and library tables...');

  // Health records table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS health_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      student_id INT NOT NULL,
      record_type ENUM('routine_checkup', 'illness', 'injury', 'vaccination', 'emergency', 'follow_up', 'physical_exam') NOT NULL,
      record_date DATE NOT NULL,
      height DECIMAL(5,2), -- in cm
      weight DECIMAL(5,2), -- in kg
      blood_pressure VARCHAR(20),
      temperature DECIMAL(4,1), -- in celsius
      pulse_rate INT,
      symptoms TEXT,
      diagnosis TEXT,
      treatment TEXT,
      medications TEXT,
      doctor_name VARCHAR(100),
      follow_up_date DATE,
      notes TEXT,
      status ENUM('active', 'resolved', 'ongoing', 'follow_up_required') DEFAULT 'active',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_student_id (student_id),
      INDEX idx_record_type (record_type),
      INDEX idx_record_date (record_date),
      INDEX idx_follow_up_date (follow_up_date),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Vaccinations table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS vaccinations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      vaccine_name VARCHAR(100) NOT NULL,
      vaccine_type VARCHAR(50),
      dose_number INT DEFAULT 1,
      vaccination_date DATE NOT NULL,
      next_due_date DATE,
      administered_by VARCHAR(100),
      batch_number VARCHAR(50),
      manufacturer VARCHAR(100),
      side_effects TEXT,
      notes TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_student_id (student_id),
      INDEX idx_vaccine_name (vaccine_name),
      INDEX idx_vaccination_date (vaccination_date),
      INDEX idx_next_due_date (next_due_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Medical conditions table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS medical_conditions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      condition_name VARCHAR(100) NOT NULL,
      description TEXT,
      severity ENUM('mild', 'moderate', 'severe') DEFAULT 'mild',
      diagnosed_date DATE,
      current_medications TEXT,
      special_instructions TEXT,
      emergency_action_plan TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_student_id (student_id),
      INDEX idx_condition_name (condition_name),
      INDEX idx_severity (severity),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Library categories table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS library_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      parent_category_id INT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (parent_category_id) REFERENCES library_categories(id) ON DELETE SET NULL,
      INDEX idx_name (name),
      INDEX idx_parent_category_id (parent_category_id),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Books table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS books (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      author VARCHAR(255) NOT NULL,
      isbn VARCHAR(20) UNIQUE,
      category_id INT,
      publisher VARCHAR(100),
      published_year YEAR,
      edition VARCHAR(50),
      language VARCHAR(50) DEFAULT 'English',
      pages INT,
      total_copies INT NOT NULL DEFAULT 1,
      available_copies INT NOT NULL DEFAULT 1,
      location VARCHAR(100),
      description TEXT,
      cover_image VARCHAR(255),
      price DECIMAL(8,2),
      status ENUM('available', 'checked_out', 'reserved', 'damaged', 'lost', 'under_repair') DEFAULT 'available',
      added_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (category_id) REFERENCES library_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_title (title),
      INDEX idx_author (author),
      INDEX idx_isbn (isbn),
      INDEX idx_category_id (category_id),
      INDEX idx_publisher (publisher),
      INDEX idx_published_year (published_year),
      INDEX idx_language (language),
      INDEX idx_status (status),
      INDEX idx_available_copies (available_copies)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Book borrowing records table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS book_borrowings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      book_id INT NOT NULL,
      borrower_id INT NOT NULL,
      borrower_type ENUM('student', 'teacher', 'staff') NOT NULL,
      borrowed_date DATE NOT NULL,
      due_date DATE NOT NULL,
      returned_date DATE,
      renewal_count INT DEFAULT 0,
      fine_amount DECIMAL(8,2) DEFAULT 0.00,
      fine_paid BOOLEAN DEFAULT FALSE,
      status ENUM('borrowed', 'returned', 'overdue', 'lost', 'damaged') DEFAULT 'borrowed',
      notes TEXT,
      issued_by INT,
      returned_to INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (returned_to) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_book_id (book_id),
      INDEX idx_borrower_id (borrower_id),
      INDEX idx_borrower_type (borrower_type),
      INDEX idx_borrowed_date (borrowed_date),
      INDEX idx_due_date (due_date),
      INDEX idx_returned_date (returned_date),
      INDEX idx_status (status),
      INDEX idx_fine_amount (fine_amount)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Book reservations table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS book_reservations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      book_id INT NOT NULL,
      user_id INT NOT NULL,
      reservation_date DATE NOT NULL,
      expiry_date DATE NOT NULL,
      status ENUM('active', 'fulfilled', 'expired', 'cancelled') DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_book_id (book_id),
      INDEX idx_user_id (user_id),
      INDEX idx_reservation_date (reservation_date),
      INDEX idx_expiry_date (expiry_date),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Insert default library categories
  await executeQuery(`
    INSERT IGNORE INTO library_categories (name, description) VALUES
    ('Fiction', 'Fictional literature and novels'),
    ('Non-Fiction', 'Non-fictional books and references'),
    ('Science', 'Science and technology books'),
    ('Mathematics', 'Mathematics and related subjects'),
    ('History', 'Historical books and references'),
    ('Geography', 'Geography and earth sciences'),
    ('Literature', 'Literature and language arts'),
    ('Biography', 'Biographical and autobiographical works'),
    ('Reference', 'Reference books and encyclopedias'),
    ('Children', 'Children and young adult books'),
    ('Textbook', 'Academic textbooks and course materials')
  `);

  logger.info('Health records and library tables created successfully');
};

const down = async () => {
  logger.info('Dropping health records and library tables...');
  
  await executeQuery('DROP TABLE IF EXISTS book_reservations');
  await executeQuery('DROP TABLE IF EXISTS book_borrowings');
  await executeQuery('DROP TABLE IF EXISTS books');
  await executeQuery('DROP TABLE IF EXISTS library_categories');
  await executeQuery('DROP TABLE IF EXISTS medical_conditions');
  await executeQuery('DROP TABLE IF EXISTS vaccinations');
  await executeQuery('DROP TABLE IF EXISTS health_records');
  
  logger.info('Health records and library tables dropped');
};

module.exports = { up, down };
