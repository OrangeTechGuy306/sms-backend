const { executeQuery, connectDatabase } = require('../config/database');

async function checkStudentsTable() {
  try {
    await connectDatabase();
    
    console.log('🔍 Checking students table structure...');
    const structure = await executeQuery('DESCRIBE students');
    structure.forEach(column => {
      console.log(`   - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''}`);
    });

    console.log('\n🔍 Checking classes table structure...');
    const classStructure = await executeQuery('DESCRIBE classes');
    classStructure.forEach(column => {
      console.log(`   - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''}`);
    });

    console.log('\n🔍 Checking academic_years table structure...');
    const academicStructure = await executeQuery('DESCRIBE academic_years');
    academicStructure.forEach(column => {
      console.log(`   - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkStudentsTable();
