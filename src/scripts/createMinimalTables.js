const { executeQuery, connectDatabase } = require('../config/database');

async function createMinimalTables() {
  try {
    console.log('🚀 Creating minimal database tables...');
    
    await connectDatabase();
    console.log('✅ Connected to database');

    // Create grade_levels table (required for students)
    const gradeLevelsTable = `
      CREATE TABLE IF NOT EXISTS grade_levels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        sort_order INT DEFAULT 0,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_sort_order (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    // Create classes table (required for students)
    const classesTable = `
      CREATE TABLE IF NOT EXISTS classes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        grade_level_id INT,
        teacher_id INT,
        academic_year_id INT,
        capacity INT DEFAULT 30,
        description TEXT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_grade_level (grade_level_id),
        INDEX idx_teacher (teacher_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    // Create students table
    const studentsTable = `
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        student_id VARCHAR(50) UNIQUE NOT NULL,
        class_id INT,
        grade_level_id INT,
        admission_date DATE,
        guardian_name VARCHAR(200),
        guardian_phone VARCHAR(20),
        guardian_email VARCHAR(255),
        emergency_contact VARCHAR(20),
        medical_conditions TEXT,
        status ENUM('active', 'inactive', 'graduated', 'transferred') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_student_id (student_id),
        INDEX idx_class_id (class_id),
        INDEX idx_grade_level_id (grade_level_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    // Execute table creation
    console.log('📋 Creating grade_levels table...');
    await executeQuery(gradeLevelsTable);
    
    console.log('📋 Creating classes table...');
    await executeQuery(classesTable);
    
    console.log('📋 Creating students table...');
    await executeQuery(studentsTable);

    // Insert default grade levels
    console.log('📝 Inserting default grade levels...');
    const defaultGradeLevels = [
      ['Grade 1', 'First Grade', 1],
      ['Grade 2', 'Second Grade', 2],
      ['Grade 3', 'Third Grade', 3],
      ['Grade 4', 'Fourth Grade', 4],
      ['Grade 5', 'Fifth Grade', 5],
      ['Grade 6', 'Sixth Grade', 6],
      ['Grade 7', 'Seventh Grade', 7],
      ['Grade 8', 'Eighth Grade', 8],
      ['Grade 9', 'Ninth Grade', 9],
      ['Grade 10', 'Tenth Grade', 10],
      ['Grade 11', 'Eleventh Grade', 11],
      ['Grade 12', 'Twelfth Grade', 12]
    ];

    for (const [name, description, sortOrder] of defaultGradeLevels) {
      await executeQuery(
        'INSERT IGNORE INTO grade_levels (name, description, sort_order) VALUES (?, ?, ?)',
        [name, description, sortOrder]
      );
    }

    // Insert default classes
    console.log('📝 Inserting default classes...');
    const defaultClasses = [
      ['Class 1A', 1, 'Grade 1 Section A'],
      ['Class 1B', 1, 'Grade 1 Section B'],
      ['Class 2A', 2, 'Grade 2 Section A'],
      ['Class 2B', 2, 'Grade 2 Section B'],
      ['Class 3A', 3, 'Grade 3 Section A']
    ];

    for (const [name, gradeId, description] of defaultClasses) {
      await executeQuery(
        'INSERT IGNORE INTO classes (name, grade_level_id, description) VALUES (?, ?, ?)',
        [name, gradeId, description]
      );
    }

    console.log('✅ Minimal database setup completed successfully!');
    console.log('📊 Created tables: grade_levels, classes, students');
    console.log('📝 Inserted default data for grade levels and classes');
    console.log('🎉 Students page should now work without database errors');

  } catch (error) {
    console.error('❌ Error creating minimal tables:', error);
  } finally {
    process.exit(0);
  }
}

createMinimalTables();
