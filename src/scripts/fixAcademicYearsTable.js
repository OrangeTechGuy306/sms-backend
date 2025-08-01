const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'school_management_system'
};

async function fixAcademicYearsTable() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('📅 Fixing academic_years table to use UUID...');
    
    // First, let's backup the existing data
    const [existingData] = await connection.execute('SELECT * FROM academic_years');
    console.log(`📋 Found ${existingData.length} existing academic years`);
    
    // Disable foreign key checks temporarily
    console.log('🔓 Disabling foreign key checks...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // Create a new table with UUID structure
    console.log('🆕 Creating new academic_years_new table with UUID...');
    await connection.execute(`
      CREATE TABLE academic_years_new (
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

    // Insert the data with new UUIDs
    console.log('📝 Inserting academic year data with UUIDs...');
    for (const row of existingData) {
      await connection.execute(`
        INSERT INTO academic_years_new (name, start_date, end_date, is_current, status)
        VALUES (?, ?, ?, ?, ?)
      `, [row.name, row.start_date, row.end_date, row.is_current, row.status]);
    }

    // Drop the old table and rename the new one
    console.log('🔄 Replacing old table...');
    await connection.execute('DROP TABLE academic_years');
    await connection.execute('RENAME TABLE academic_years_new TO academic_years');
    
    // Update any existing classes that reference the old academic year IDs
    console.log('🔄 Updating classes table references...');
    
    // Get the new academic year ID
    const [newAcademicYear] = await connection.execute('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
    
    if (newAcademicYear.length > 0) {
      // Update all classes to use the new academic year ID
      await connection.execute(
        'UPDATE classes SET academic_year_id = ? WHERE academic_year_id IS NOT NULL',
        [newAcademicYear[0].id]
      );
      console.log('✅ Updated classes table with new academic year ID');
    }

    // Re-enable foreign key checks
    console.log('🔒 Re-enabling foreign key checks...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Verify the fix
    console.log('\n🔍 Verifying the fix...');
    
    const [newAcademicYears] = await connection.execute('SELECT id, name, is_current FROM academic_years');
    console.log('📅 Academic years with UUID:');
    newAcademicYears.forEach(ay => {
      console.log(`  - ${ay.id} (${ay.name}) ${ay.is_current ? '[CURRENT]' : ''}`);
    });
    
    // Check classes table
    const [classesCount] = await connection.execute('SELECT COUNT(*) as count FROM classes WHERE academic_year_id IS NOT NULL');
    console.log(`\n🏫 Classes with academic year reference: ${classesCount[0].count}`);
    
    console.log('\n🎉 Academic years table fix completed successfully!');
    console.log('✅ Academic years now use UUID format');
    console.log('✅ Classes table references updated');
    
  } catch (error) {
    console.error('❌ Error fixing academic years table:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
console.log('🔧 School Management System - Fix Academic Years Table');
console.log('======================================================');
fixAcademicYearsTable();
