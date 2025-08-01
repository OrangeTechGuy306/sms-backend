const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkIds() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    console.log('Grade Levels:');
    const [gradeLevels] = await connection.execute('SELECT id, name FROM grade_levels LIMIT 3');
    gradeLevels.forEach(gl => console.log(`  - ${gl.id} (${gl.name})`));
    
    console.log('\nAcademic Years:');
    const [academicYears] = await connection.execute('SELECT id, name FROM academic_years LIMIT 3');
    academicYears.forEach(ay => console.log(`  - ${ay.id} (${ay.name})`));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkIds();
