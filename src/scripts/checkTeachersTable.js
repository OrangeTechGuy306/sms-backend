const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTeachersTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    console.log('📋 Teachers table structure:');
    const [columns] = await connection.execute('DESCRIBE teachers');
    columns.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));
    
    console.log('\n📋 Users table structure:');
    const [userColumns] = await connection.execute('DESCRIBE users');
    userColumns.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkTeachersTable();
