const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkClassesTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    const [columns] = await connection.execute('DESCRIBE classes');
    console.log('Classes table structure:');
    columns.forEach(col => {
      const nullable = col.Null === 'NO' ? 'NOT NULL' : 'NULL';
      const defaultVal = col.Default ? `DEFAULT ${col.Default}` : '';
      console.log(`  - ${col.Field} (${col.Type}) ${nullable} ${defaultVal}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkClassesTable();
