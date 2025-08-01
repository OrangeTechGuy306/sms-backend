const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDirectDatabaseUpdate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    console.log('🧪 Testing Direct Database Update');
    console.log('=================================');
    
    // Test updating each field individually to see which ones work
    const testFields = [
      { field: 'name', value: 'Direct DB Test Name' },
      { field: 'grade_level', value: 'Direct DB Grade Level' },
      { field: 'section', value: 'Direct DB Section' },
      { field: 'capacity', value: 99 },
      { field: 'room_number', value: 'Direct DB Room' },
      { field: 'status', value: 'inactive' },
      { field: 'description', value: 'Direct DB Description' }
    ];
    
    for (const { field, value } of testFields) {
      try {
        console.log(`\n🔄 Testing update of ${field} to "${value}"...`);
        
        const updateQuery = `UPDATE classes SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        console.log(`  SQL: ${updateQuery}`);
        console.log(`  Params: [${value}, 9]`);
        
        const [result] = await connection.execute(updateQuery, [value, 9]);
        console.log(`  ✅ ${field} update successful - Affected rows: ${result.affectedRows}`);
        
        // Verify the update
        const [verification] = await connection.execute(`SELECT ${field} FROM classes WHERE id = ?`, [9]);
        const actualValue = verification[0][field];
        console.log(`  📋 Verification: ${field} = "${actualValue}"`);
        
        if (actualValue == value) {
          console.log(`  ✅ ${field} verified successfully`);
        } else {
          console.log(`  ❌ ${field} verification failed - Expected: "${value}", Got: "${actualValue}"`);
        }
        
      } catch (error) {
        console.log(`  ❌ ${field} update failed: ${error.message}`);
      }
    }
    
    // Show final state
    console.log('\n📋 Final class state:');
    const [finalState] = await connection.execute('SELECT * FROM classes WHERE id = ?', [9]);
    if (finalState.length > 0) {
      const cls = finalState[0];
      console.log({
        id: cls.id,
        name: cls.name,
        grade_level: cls.grade_level,
        section: cls.section,
        capacity: cls.capacity,
        room_number: cls.room_number,
        status: cls.status,
        description: cls.description,
        updated_at: cls.updated_at
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

testDirectDatabaseUpdate();
