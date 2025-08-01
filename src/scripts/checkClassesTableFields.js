const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkClassesTableFields() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    console.log('🔍 Analyzing classes table structure for updates...');
    
    const [columns] = await connection.execute('DESCRIBE classes');
    console.log('\n📋 Classes table fields:');
    columns.forEach(col => {
      const nullable = col.Null === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.Default ? `DEFAULT ${col.Default}` : '';
      console.log(`  - ${col.Field} (${col.Type}) ${nullable} ${defaultVal}`);
    });
    
    console.log('\n🔧 Current backend allowedFields:');
    const currentAllowed = ['name', 'class_teacher_id', 'capacity', 'room_number', 'status'];
    currentAllowed.forEach(field => console.log(`  ✅ ${field}`));
    
    console.log('\n❓ Fields that could potentially be updated:');
    const potentialFields = columns
      .filter(col => !['id', 'uuid', 'created_at', 'updated_at'].includes(col.Field))
      .map(col => col.Field);
    
    potentialFields.forEach(field => {
      const isAllowed = currentAllowed.includes(field);
      console.log(`  ${isAllowed ? '✅' : '❌'} ${field} ${isAllowed ? '(allowed)' : '(NOT allowed)'}`);
    });
    
    console.log('\n🚨 Missing from allowedFields:');
    const missing = potentialFields.filter(field => !currentAllowed.includes(field));
    missing.forEach(field => console.log(`  ❌ ${field}`));
    
    console.log('\n💡 Recommended allowedFields array:');
    console.log(`const allowedFields = [${potentialFields.map(f => `'${f}'`).join(', ')}];`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkClassesTableFields();
