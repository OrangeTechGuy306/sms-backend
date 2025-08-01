const mysql = require('mysql2/promise');
require('dotenv').config();

async function testWithCorrectSizes() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    console.log('🧪 Testing With Correct Column Sizes');
    console.log('====================================');
    
    // Check column sizes first
    const [columns] = await connection.execute('DESCRIBE classes');
    console.log('\n📏 Column size constraints:');
    columns.forEach(col => {
      if (['grade_level', 'section', 'room_number'].includes(col.Field)) {
        console.log(`  - ${col.Field}: ${col.Type}`);
      }
    });
    
    // Test with appropriately sized values
    const testFields = [
      { field: 'grade_level', value: 'Grade 10', maxLength: 20 },  // VARCHAR(20)
      { field: 'section', value: 'A', maxLength: 10 },            // VARCHAR(10)
      { field: 'room_number', value: 'Room 101', maxLength: 20 }, // VARCHAR(20)
      { field: 'description', value: 'Updated class description' }
    ];
    
    for (const { field, value, maxLength } of testFields) {
      try {
        console.log(`\n🔄 Testing ${field} with "${value}" (length: ${value.length}${maxLength ? `, max: ${maxLength}` : ''})...`);
        
        if (maxLength && value.length > maxLength) {
          console.log(`  ⚠️ Value too long, truncating to ${maxLength} characters`);
          value = value.substring(0, maxLength);
        }
        
        const updateQuery = `UPDATE classes SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        const [result] = await connection.execute(updateQuery, [value, 9]);
        console.log(`  ✅ ${field} update successful - Affected rows: ${result.affectedRows}`);
        
        // Verify the update
        const [verification] = await connection.execute(`SELECT ${field} FROM classes WHERE id = ?`, [9]);
        const actualValue = verification[0][field];
        console.log(`  📋 Verification: ${field} = "${actualValue}"`);
        
      } catch (error) {
        console.log(`  ❌ ${field} update failed: ${error.message}`);
      }
    }
    
    // Show final state
    console.log('\n📋 Final class state after correct-sized updates:');
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
        description: cls.description
      });
    }
    
    console.log('\n🎯 Summary:');
    console.log('  - grade_level: VARCHAR(20) - Keep values ≤ 20 characters');
    console.log('  - section: VARCHAR(10) - Keep values ≤ 10 characters');
    console.log('  - room_number: VARCHAR(20) - Keep values ≤ 20 characters');
    console.log('  - description: TEXT - No length limit');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

testWithCorrectSizes();
