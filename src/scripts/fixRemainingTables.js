const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'school_management_system'
};

async function fixRemainingTables() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🏫 Creating missing tables for classes controller...');
    
    // Create teacher_subjects table
    console.log('📚 Creating teacher_subjects table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS teacher_subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        subject_id INT NOT NULL,
        class_id VARCHAR(36),
        academic_year_id VARCHAR(36),
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        INDEX idx_teacher_id (teacher_id),
        INDEX idx_subject_id (subject_id),
        INDEX idx_class_id (class_id),
        UNIQUE KEY unique_teacher_subject_class (teacher_id, subject_id, class_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create subjects table if it doesn't exist
    console.log('📖 Creating subjects table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) UNIQUE,
        description TEXT,
        department VARCHAR(100),
        credit_hours INT DEFAULT 1,
        is_mandatory BOOLEAN DEFAULT TRUE,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_name (name),
        INDEX idx_code (code),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Update students table to add current_class_id column
    console.log('👥 Updating students table structure...');
    
    // Check if current_class_id column exists
    const [studentsColumns] = await connection.execute('DESCRIBE students');
    const hasCurrentClassId = studentsColumns.some(col => col.Field === 'current_class_id');
    
    if (!hasCurrentClassId) {
      console.log('➕ Adding current_class_id column to students table...');
      await connection.execute('ALTER TABLE students ADD COLUMN current_class_id VARCHAR(36)');
      
      // Update existing students to use their class_id as current_class_id
      await connection.execute('UPDATE students SET current_class_id = class_id WHERE current_class_id IS NULL');
    } else {
      console.log('✅ current_class_id column already exists in students table');
    }
    
    // Insert some default subjects
    console.log('📝 Inserting default subjects...');
    await connection.execute(`
      INSERT IGNORE INTO subjects (uuid, name, code, description, department, is_mandatory) VALUES
      (UUID(), 'Mathematics', 'MATH', 'Basic Mathematics', 'Mathematics', TRUE),
      (UUID(), 'English Language', 'ENG', 'English Language and Literature', 'Languages', TRUE),
      (UUID(), 'Science', 'SCI', 'General Science', 'Science', TRUE),
      (UUID(), 'Social Studies', 'SS', 'Social Studies and History', 'Social Sciences', TRUE),
      (UUID(), 'Physical Education', 'PE', 'Physical Education and Sports', 'Physical Education', FALSE),
      (UUID(), 'Art', 'ART', 'Creative Arts and Drawing', 'Arts', FALSE),
      (UUID(), 'Music', 'MUS', 'Music and Performance', 'Arts', FALSE),
      (UUID(), 'Computer Science', 'CS', 'Basic Computer Skills', 'Technology', FALSE)
    `);
    
    // Create admins table (referenced in auth controller)
    console.log('👨‍💼 Creating admins table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        employee_id VARCHAR(50) UNIQUE,
        department VARCHAR(100),
        position VARCHAR(100),
        hire_date DATE,
        salary DECIMAL(10,2),
        permissions JSON,
        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_employee_id (employee_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Create parents table (referenced in other controllers)
    console.log('👨‍👩‍👧‍👦 Creating parents table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS parents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        occupation VARCHAR(100),
        workplace VARCHAR(200),
        emergency_contact VARCHAR(20),
        relationship_to_student ENUM('father', 'mother', 'guardian', 'other') DEFAULT 'father',
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Verify the fix by testing the problematic query
    console.log('\n🔍 Testing the classes query...');

    const [testResult] = await connection.execute(`
      SELECT
        c.id,
        c.name,
        c.capacity,
        c.room_number,
        c.status,
        c.created_at,
        gl.name as grade_level,
        gl.level_number,
        ay.name as academic_year,
        CONCAT(u.first_name, ' ', u.last_name) as class_teacher_name,
        (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id AND s.status = 'active') as student_count,
        (SELECT COUNT(DISTINCT ts.subject_id) FROM teacher_subjects ts WHERE ts.class_id = c.id) as subject_count
      FROM classes c
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN teachers t ON c.class_teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
      ORDER BY gl.level_number, c.name ASC
      LIMIT 5 OFFSET 0
    `);
    
    console.log('✅ Classes query executed successfully!');
    console.log(`📊 Found ${testResult.length} classes in the test query`);
    
    // Show table counts
    console.log('\n📈 Table summary:');
    
    const tables = ['subjects', 'teacher_subjects', 'students', 'teachers', 'admins', 'parents', 'classes', 'grade_levels', 'academic_years'];
    
    for (const table of tables) {
      try {
        const [count] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  - ${table}: ${count[0].count} records`);
      } catch (error) {
        console.log(`  - ${table}: Table doesn't exist or error: ${error.message}`);
      }
    }
    
    console.log('\n🎉 All missing tables have been created successfully!');
    console.log('🚀 The classes controller should now work without errors.');
    
  } catch (error) {
    console.error('❌ Error fixing remaining tables:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure MySQL server is running and connection details are correct.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Database access denied. Check your username and password.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Database does not exist. Create the database first.');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
console.log('🔧 School Management System - Fix Remaining Tables');
console.log('==================================================');
fixRemainingTables();
