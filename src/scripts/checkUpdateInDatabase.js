const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUpdateInDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    console.log('🔍 Checking class updates directly in database...');
    
    // Get the class that was just updated (ID 9)
    const [classes] = await connection.execute(
      'SELECT * FROM classes WHERE id = ?', 
      [9]
    );
    
    if (classes.length === 0) {
      console.log('❌ Class with ID 9 not found');
      return;
    }
    
    const updatedClass = classes[0];
    console.log('\n📋 Current class data in database:');
    console.log({
      id: updatedClass.id,
      name: updatedClass.name,
      grade_level: updatedClass.grade_level,
      section: updatedClass.section,
      capacity: updatedClass.capacity,
      room_number: updatedClass.room_number,
      status: updatedClass.status,
      description: updatedClass.description,
      updated_at: updatedClass.updated_at
    });
    
    // Check if the update was successful
    console.log('\n✅ Update verification:');
    console.log(`  - Name contains "All Fields Updated": ${updatedClass.name.includes('All Fields Updated')}`);
    console.log(`  - Grade level is "Updated Grade Level": ${updatedClass.grade_level === 'Updated Grade Level'}`);
    console.log(`  - Section is "Updated Section": ${updatedClass.section === 'Updated Section'}`);
    console.log(`  - Capacity is 30: ${updatedClass.capacity === 30}`);
    console.log(`  - Room is "Updated Room 999": ${updatedClass.room_number === 'Updated Room 999'}`);
    console.log(`  - Status is "inactive": ${updatedClass.status === 'inactive'}`);
    console.log(`  - Description is set: ${updatedClass.description !== null}`);
    
    if (updatedClass.name.includes('All Fields Updated') && 
        updatedClass.grade_level === 'Updated Grade Level' &&
        updatedClass.section === 'Updated Section') {
      console.log('\n🎉 SUCCESS: All fields were updated correctly in the database!');
    } else {
      console.log('\n⚠️ Some fields may not have been updated properly');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkUpdateInDatabase();
