const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'school_management_system',
  multipleStatements: true
};

async function fixMissingTables() {
  let connection;

  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);

    console.log('⚡ Executing individual SQL statements...');

    // Execute statements one by one
    await connection.execute('SET NAMES utf8mb4');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    console.log('📚 Creating grade_levels table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS grade_levels (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          name VARCHAR(50) NOT NULL,
          level_number INT NOT NULL,
          description TEXT,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

          UNIQUE KEY unique_level (level_number),
          INDEX idx_level (level_number),
          INDEX idx_name (name),
          INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('📅 Creating academic_years table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS academic_years (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          name VARCHAR(100) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          is_current BOOLEAN DEFAULT FALSE,
          status ENUM('active', 'completed', 'upcoming') DEFAULT 'upcoming',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

          INDEX idx_current (is_current),
          INDEX idx_dates (start_date, end_date),
          INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('🏫 Updating classes table structure...');
    try {
      await connection.execute('ALTER TABLE classes ADD COLUMN IF NOT EXISTS grade_level_id VARCHAR(36)');
    } catch (e) { console.log('  - grade_level_id column already exists or error:', e.message); }

    try {
      await connection.execute('ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_year_id VARCHAR(36)');
    } catch (e) { console.log('  - academic_year_id column already exists or error:', e.message); }

    try {
      await connection.execute('ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_teacher_id INT');
    } catch (e) { console.log('  - class_teacher_id column already exists or error:', e.message); }

    try {
      await connection.execute('ALTER TABLE classes ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 30');
    } catch (e) { console.log('  - capacity column already exists or error:', e.message); }

    try {
      await connection.execute('ALTER TABLE classes ADD COLUMN IF NOT EXISTS room_number VARCHAR(50)');
    } catch (e) { console.log('  - room_number column already exists or error:', e.message); }

    console.log('✅ Database structure updated successfully!');

    console.log('📝 Inserting default grade levels...');
    await connection.execute(`
      INSERT IGNORE INTO grade_levels (name, level_number, description) VALUES
      ('Nursery', 1, 'Nursery level'),
      ('KG1', 2, 'Kindergarten 1'),
      ('KG2', 3, 'Kindergarten 2'),
      ('Grade 1', 4, 'Primary Grade 1'),
      ('Grade 2', 5, 'Primary Grade 2'),
      ('Grade 3', 6, 'Primary Grade 3'),
      ('Grade 4', 7, 'Primary Grade 4'),
      ('Grade 5', 8, 'Primary Grade 5'),
      ('Grade 6', 9, 'Middle School Grade 6'),
      ('Grade 7', 10, 'Middle School Grade 7'),
      ('Grade 8', 11, 'Middle School Grade 8'),
      ('Grade 9', 12, 'High School Grade 9'),
      ('Grade 10', 13, 'High School Grade 10'),
      ('Grade 11', 14, 'High School Grade 11'),
      ('Grade 12', 15, 'High School Grade 12')
    `);

    console.log('📅 Inserting default academic year...');
    await connection.execute(`
      INSERT IGNORE INTO academic_years (name, start_date, end_date, is_current, status)
      VALUES ('2024-2025', '2024-09-01', '2025-06-30', TRUE, 'active')
    `);

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Check if tables were created
    console.log('\n📊 Verifying table creation...');

    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📋 Current tables in database:');
    tables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`  ✓ ${tableName}`);
    });

    // Check grade_levels data
    try {
      const [gradeLevels] = await connection.execute('SELECT COUNT(*) as count FROM grade_levels');
      console.log(`\n📚 Grade levels created: ${gradeLevels[0].count}`);
    } catch (error) {
      console.log('⚠️  Grade levels table check failed:', error.message);
    }

    // Check academic_years data
    try {
      const [academicYears] = await connection.execute('SELECT COUNT(*) as count FROM academic_years');
      console.log(`📅 Academic years created: ${academicYears[0].count}`);
    } catch (error) {
      console.log('⚠️  Academic years table check failed:', error.message);
    }
    
    // Check classes table structure
    try {
      const [classesColumns] = await connection.execute('DESCRIBE classes');
      console.log('\n🏫 Classes table columns:');
      classesColumns.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type})`);
      });
    } catch (error) {
      console.log('⚠️  Classes table check failed:', error.message);
    }
    
    console.log('\n🎉 Database fix completed successfully!');
    console.log('🚀 You can now restart your backend server and try creating/fetching classes again.');
    
  } catch (error) {
    console.error('❌ Error fixing database:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure MySQL server is running and connection details are correct.');
      console.error('Check your .env file for correct database credentials.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Database access denied. Check your username and password.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Database does not exist. Create the database first or run the full setup script.');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
console.log('🔧 School Management System - Database Fix Tool');
console.log('================================================');
fixMissingTables();
