const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const up = async () => {
  logger.info('Creating assessment and grading tables...');

  // Assessments table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS assessments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      type ENUM('exam', 'quiz', 'test', 'assignment', 'project', 'presentation', 'practical') NOT NULL,
      subject_id INT NOT NULL,
      class_id INT NOT NULL,
      teacher_id INT NOT NULL,
      academic_year_id INT,
      total_marks INT NOT NULL,
      passing_marks INT NOT NULL,
      duration INT, -- in minutes
      assessment_date DATE,
      assessment_time TIME,
      instructions TEXT,
      syllabus_covered TEXT,
      status ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled') DEFAULT 'draft',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_title (title),
      INDEX idx_type (type),
      INDEX idx_subject_id (subject_id),
      INDEX idx_class_id (class_id),
      INDEX idx_teacher_id (teacher_id),
      INDEX idx_assessment_date (assessment_date),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Assessment results table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS assessment_results (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assessment_id INT NOT NULL,
      student_id INT NOT NULL,
      marks_obtained DECIMAL(5,2) NOT NULL,
      percentage DECIMAL(5,2),
      grade VARCHAR(5),
      remarks TEXT,
      is_absent BOOLEAN DEFAULT FALSE,
      submission_date TIMESTAMP,
      graded_by INT,
      graded_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_assessment_id (assessment_id),
      INDEX idx_student_id (student_id),
      INDEX idx_marks_obtained (marks_obtained),
      INDEX idx_percentage (percentage),
      INDEX idx_grade (grade),
      INDEX idx_is_absent (is_absent),
      UNIQUE KEY unique_assessment_student (assessment_id, student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Grade scales table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS grade_scales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      description TEXT,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_name (name),
      INDEX idx_is_default (is_default)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Grade scale ranges table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS grade_scale_ranges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      grade_scale_id INT NOT NULL,
      grade VARCHAR(5) NOT NULL,
      min_percentage DECIMAL(5,2) NOT NULL,
      max_percentage DECIMAL(5,2) NOT NULL,
      grade_point DECIMAL(3,2),
      description VARCHAR(100),
      
      FOREIGN KEY (grade_scale_id) REFERENCES grade_scales(id) ON DELETE CASCADE,
      INDEX idx_grade_scale_id (grade_scale_id),
      INDEX idx_grade (grade),
      INDEX idx_percentage_range (min_percentage, max_percentage)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Report cards table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS report_cards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      student_id INT NOT NULL,
      class_id INT NOT NULL,
      academic_year_id INT NOT NULL,
      term ENUM('first', 'second', 'third', 'annual') NOT NULL,
      total_marks DECIMAL(8,2) DEFAULT 0,
      marks_obtained DECIMAL(8,2) DEFAULT 0,
      percentage DECIMAL(5,2),
      overall_grade VARCHAR(5),
      rank_in_class INT,
      attendance_percentage DECIMAL(5,2),
      teacher_remarks TEXT,
      principal_remarks TEXT,
      status ENUM('draft', 'published', 'sent_to_parent') DEFAULT 'draft',
      generated_by INT,
      generated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
      FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_student_id (student_id),
      INDEX idx_class_id (class_id),
      INDEX idx_academic_year_id (academic_year_id),
      INDEX idx_term (term),
      INDEX idx_percentage (percentage),
      INDEX idx_rank_in_class (rank_in_class),
      INDEX idx_status (status),
      UNIQUE KEY unique_student_term_year (student_id, term, academic_year_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Report card subjects table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS report_card_subjects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      report_card_id INT NOT NULL,
      subject_id INT NOT NULL,
      total_marks DECIMAL(6,2) NOT NULL,
      marks_obtained DECIMAL(6,2) NOT NULL,
      grade VARCHAR(5),
      remarks TEXT,
      
      FOREIGN KEY (report_card_id) REFERENCES report_cards(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      INDEX idx_report_card_id (report_card_id),
      INDEX idx_subject_id (subject_id),
      UNIQUE KEY unique_report_subject (report_card_id, subject_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Insert default grade scale
  await executeQuery(`
    INSERT IGNORE INTO grade_scales (name, description, is_default) VALUES
    ('Standard Grade Scale', 'Standard A-F grading system', TRUE)
  `);

  // Insert default grade scale ranges
  await executeQuery(`
    INSERT IGNORE INTO grade_scale_ranges (grade_scale_id, grade, min_percentage, max_percentage, grade_point, description) VALUES
    (1, 'A+', 95.00, 100.00, 4.00, 'Outstanding'),
    (1, 'A', 90.00, 94.99, 3.75, 'Excellent'),
    (1, 'B+', 85.00, 89.99, 3.50, 'Very Good'),
    (1, 'B', 80.00, 84.99, 3.00, 'Good'),
    (1, 'C+', 75.00, 79.99, 2.50, 'Above Average'),
    (1, 'C', 70.00, 74.99, 2.00, 'Average'),
    (1, 'D', 60.00, 69.99, 1.00, 'Below Average'),
    (1, 'F', 0.00, 59.99, 0.00, 'Fail')
  `);

  logger.info('Assessment and grading tables created successfully');
};

const down = async () => {
  logger.info('Dropping assessment and grading tables...');
  
  await executeQuery('DROP TABLE IF EXISTS report_card_subjects');
  await executeQuery('DROP TABLE IF EXISTS report_cards');
  await executeQuery('DROP TABLE IF EXISTS grade_scale_ranges');
  await executeQuery('DROP TABLE IF EXISTS grade_scales');
  await executeQuery('DROP TABLE IF EXISTS assessment_results');
  await executeQuery('DROP TABLE IF EXISTS assessments');
  
  logger.info('Assessment and grading tables dropped');
};

module.exports = { up, down };
