const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkStudentsTableSimple() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    console.log('🔍 Checking students table...');
    
    // Check if students table exists
    const [tables] = await connection.execute("SHOW TABLES");
    console.log('\n📋 All tables in database:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    });
    
    const studentsTableExists = tables.some(table => 
      Object.values(table)[0].toLowerCase() === 'students'
    );
    
    if (!studentsTableExists) {
      console.log('\n❌ Students table does not exist!');
      console.log('This explains why student_count is always 0.');
      console.log('\n💡 Solution: Create students table or fix the student count query.');
      return;
    }
    
    // If students table exists, check its structure
    console.log('\n✅ Students table exists. Checking structure...');
    const [columns] = await connection.execute('DESCRIBE students');
    console.log('\n📋 Students table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    // Check for class relationship columns
    const classRelatedColumns = columns.filter(col => 
      col.Field.toLowerCase().includes('class')
    );
    
    console.log('\n🔗 Class relationship columns:');
    if (classRelatedColumns.length === 0) {
      console.log('  ❌ No class-related columns found!');
    } else {
      classRelatedColumns.forEach(col => {
        console.log(`  ✅ ${col.Field} (${col.Type})`);
      });
    }
    
    // Count total students
    const [count] = await connection.execute('SELECT COUNT(*) as total FROM students');
    console.log(`\n📊 Total students: ${count[0].total}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkStudentsTableSimple();
