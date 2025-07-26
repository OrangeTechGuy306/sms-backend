const { executeQuery, connectDatabase } = require('../config/database');

async function checkTables() {
  try {
    console.log('🔍 Checking existing database tables...');
    
    await connectDatabase();
    console.log('✅ Connected to database');

    // Show all tables
    const tables = await executeQuery('SHOW TABLES');
    console.log('\n📊 Existing tables:');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });

    // Check specific table structures
    const tablesToCheck = ['users', 'classes', 'students', 'grade_levels'];
    
    for (const tableName of tablesToCheck) {
      try {
        console.log(`\n🔍 Structure of ${tableName} table:`);
        const structure = await executeQuery(`DESCRIBE ${tableName}`);
        structure.forEach(column => {
          console.log(`   - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''}`);
        });
      } catch (error) {
        console.log(`   ❌ Table ${tableName} does not exist`);
      }
    }

    // Check if we have any data
    console.log('\n📈 Data counts:');
    for (const tableName of tablesToCheck) {
      try {
        const count = await executeQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`   - ${tableName}: ${count[0].count} records`);
      } catch (error) {
        console.log(`   - ${tableName}: Table does not exist`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking tables:', error);
  } finally {
    process.exit(0);
  }
}

checkTables();
