const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const up = async () => {
  logger.info('Creating fees and administrative tables...');

  // Fee categories table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS fee_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      is_mandatory BOOLEAN DEFAULT TRUE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_name (name),
      INDEX idx_is_mandatory (is_mandatory),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Fee structures table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS fee_structures (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      class_id INT,
      academic_year_id INT NOT NULL,
      fee_category_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      due_date DATE,
      late_fee_amount DECIMAL(8,2) DEFAULT 0.00,
      late_fee_days INT DEFAULT 0,
      installments_allowed BOOLEAN DEFAULT FALSE,
      installment_count INT DEFAULT 1,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
      FOREIGN KEY (fee_category_id) REFERENCES fee_categories(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_name (name),
      INDEX idx_class_id (class_id),
      INDEX idx_academic_year_id (academic_year_id),
      INDEX idx_fee_category_id (fee_category_id),
      INDEX idx_due_date (due_date),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Student fees table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS student_fees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      student_id INT NOT NULL,
      fee_structure_id INT NOT NULL,
      academic_year_id INT NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      paid_amount DECIMAL(10,2) DEFAULT 0.00,
      pending_amount DECIMAL(10,2),
      discount_amount DECIMAL(8,2) DEFAULT 0.00,
      late_fee_amount DECIMAL(8,2) DEFAULT 0.00,
      due_date DATE,
      status ENUM('pending', 'partial', 'paid', 'overdue', 'waived') DEFAULT 'pending',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id) ON DELETE CASCADE,
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_student_id (student_id),
      INDEX idx_fee_structure_id (fee_structure_id),
      INDEX idx_academic_year_id (academic_year_id),
      INDEX idx_due_date (due_date),
      INDEX idx_status (status),
      INDEX idx_pending_amount (pending_amount),
      UNIQUE KEY unique_student_fee_structure (student_id, fee_structure_id, academic_year_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Fee payments table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS fee_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      student_fee_id INT NOT NULL,
      payment_date DATE NOT NULL,
      amount_paid DECIMAL(10,2) NOT NULL,
      payment_method ENUM('cash', 'cheque', 'bank_transfer', 'online', 'card', 'upi') NOT NULL,
      transaction_id VARCHAR(100),
      reference_number VARCHAR(100),
      bank_name VARCHAR(100),
      cheque_number VARCHAR(50),
      cheque_date DATE,
      remarks TEXT,
      receipt_number VARCHAR(50) UNIQUE,
      status ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded') DEFAULT 'completed',
      collected_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE,
      FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_student_fee_id (student_fee_id),
      INDEX idx_payment_date (payment_date),
      INDEX idx_payment_method (payment_method),
      INDEX idx_transaction_id (transaction_id),
      INDEX idx_receipt_number (receipt_number),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Fee discounts table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS fee_discounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      discount_type ENUM('percentage', 'fixed_amount') NOT NULL,
      discount_value DECIMAL(8,2) NOT NULL,
      applicable_categories JSON,
      eligibility_criteria TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_name (name),
      INDEX idx_discount_type (discount_type),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Student fee discounts junction table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS student_fee_discounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_fee_id INT NOT NULL,
      fee_discount_id INT NOT NULL,
      discount_amount DECIMAL(8,2) NOT NULL,
      applied_by INT,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      remarks TEXT,
      
      FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE,
      FOREIGN KEY (fee_discount_id) REFERENCES fee_discounts(id) ON DELETE CASCADE,
      FOREIGN KEY (applied_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_student_fee_id (student_fee_id),
      INDEX idx_fee_discount_id (fee_discount_id),
      UNIQUE KEY unique_student_fee_discount (student_fee_id, fee_discount_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Administrative tables

  // System settings table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT,
      setting_type ENUM('string', 'number', 'boolean', 'json', 'date') DEFAULT 'string',
      description TEXT,
      is_public BOOLEAN DEFAULT FALSE,
      category VARCHAR(50) DEFAULT 'general',
      updated_by INT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_setting_key (setting_key),
      INDEX idx_category (category),
      INDEX idx_is_public (is_public)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Audit logs table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      action VARCHAR(100) NOT NULL,
      table_name VARCHAR(100),
      record_id INT,
      old_values JSON,
      new_values JSON,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_action (action),
      INDEX idx_table_name (table_name),
      INDEX idx_record_id (record_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // File uploads table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS file_uploads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      original_name VARCHAR(255) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_type VARCHAR(100),
      file_size INT,
      mime_type VARCHAR(100),
      uploaded_by INT,
      related_table VARCHAR(100),
      related_id INT,
      is_public BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_file_name (file_name),
      INDEX idx_file_type (file_type),
      INDEX idx_uploaded_by (uploaded_by),
      INDEX idx_related_table_id (related_table, related_id),
      INDEX idx_is_public (is_public)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Notifications table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      user_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('info', 'success', 'warning', 'error', 'reminder') DEFAULT 'info',
      related_table VARCHAR(100),
      related_id INT,
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP NULL,
      expires_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_uuid (uuid),
      INDEX idx_user_id (user_id),
      INDEX idx_type (type),
      INDEX idx_is_read (is_read),
      INDEX idx_related_table_id (related_table, related_id),
      INDEX idx_expires_at (expires_at),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Insert default fee categories
  await executeQuery(`
    INSERT IGNORE INTO fee_categories (name, description, is_mandatory) VALUES
    ('Tuition Fee', 'Monthly tuition fees', TRUE),
    ('Admission Fee', 'One-time admission fee', TRUE),
    ('Development Fee', 'Annual development charges', TRUE),
    ('Examination Fee', 'Examination and assessment fees', TRUE),
    ('Library Fee', 'Library usage and maintenance fee', FALSE),
    ('Laboratory Fee', 'Science laboratory usage fee', FALSE),
    ('Sports Fee', 'Sports activities and equipment fee', FALSE),
    ('Transportation Fee', 'School bus transportation fee', FALSE),
    ('Uniform Fee', 'School uniform and accessories', FALSE),
    ('Miscellaneous Fee', 'Other miscellaneous charges', FALSE)
  `);

  // Insert default system settings
  await executeQuery(`
    INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, description, category) VALUES
    ('school_name', 'School Management System', 'string', 'Name of the school', 'general'),
    ('school_address', '', 'string', 'School address', 'general'),
    ('school_phone', '', 'string', 'School contact phone', 'general'),
    ('school_email', '', 'string', 'School contact email', 'general'),
    ('academic_year_start_month', '4', 'number', 'Academic year start month (1-12)', 'academic'),
    ('attendance_grace_period', '15', 'number', 'Grace period for attendance in minutes', 'attendance'),
    ('late_fee_grace_days', '7', 'number', 'Grace days before applying late fee', 'fees'),
    ('max_students_per_class', '40', 'number', 'Maximum students allowed per class', 'academic'),
    ('library_max_books_per_student', '3', 'number', 'Maximum books a student can borrow', 'library'),
    ('library_default_loan_days', '14', 'number', 'Default book loan period in days', 'library')
  `);

  logger.info('Fees and administrative tables created successfully');
};

const down = async () => {
  logger.info('Dropping fees and administrative tables...');
  
  await executeQuery('DROP TABLE IF EXISTS notifications');
  await executeQuery('DROP TABLE IF EXISTS file_uploads');
  await executeQuery('DROP TABLE IF EXISTS audit_logs');
  await executeQuery('DROP TABLE IF EXISTS system_settings');
  await executeQuery('DROP TABLE IF EXISTS student_fee_discounts');
  await executeQuery('DROP TABLE IF EXISTS fee_discounts');
  await executeQuery('DROP TABLE IF EXISTS fee_payments');
  await executeQuery('DROP TABLE IF EXISTS student_fees');
  await executeQuery('DROP TABLE IF EXISTS fee_structures');
  await executeQuery('DROP TABLE IF EXISTS fee_categories');
  
  logger.info('Fees and administrative tables dropped');
};

module.exports = { up, down };
