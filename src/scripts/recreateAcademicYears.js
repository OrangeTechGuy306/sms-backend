const mysql = require('mysql2/promise');
require('dotenv').config();

async function recreateAcademicYears() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    console.log('🆕 Recreating academic_years table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id INT AUTO_INCREMENT PRIMARY KEY,
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
    
    console.log('📝 Inserting default academic year...');
    await connection.execute(`
      INSERT IGNORE INTO academic_years (name, start_date, end_date, is_current, status)
      VALUES ('2024-2025', '2024-09-01', '2025-06-30', TRUE, 'active')
    `);
    
    console.log('✅ Academic years table recreated successfully!');
    
    // Verify
    const [result] = await connection.execute('SELECT id, name FROM academic_years');
    console.log('📅 Academic years:');
    result.forEach(ay => console.log(`  - ${ay.id}: ${ay.name}`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

recreateAcademicYears();
