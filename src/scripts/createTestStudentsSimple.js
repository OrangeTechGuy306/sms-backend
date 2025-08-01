const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTestStudentsSimple() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    console.log('🧪 Creating Test Students (Simple Approach)');
    console.log('===========================================');
    
    // Get a class to assign students to
    const [classes] = await connection.execute('SELECT id, name, capacity FROM classes LIMIT 1');
    if (classes.length === 0) {
      console.log('❌ No classes found');
      return;
    }
    
    const testClass = classes[0];
    console.log(`✅ Using class: ${testClass.name} (ID: ${testClass.id})`);
    
    // Get existing users to use as students
    const [users] = await connection.execute('SELECT id, first_name, last_name FROM users LIMIT 5');
    console.log(`📊 Found ${users.length} users to convert to students`);
    
    if (users.length === 0) {
      console.log('❌ No users found to create students');
      return;
    }
    
    // Create student records using existing users
    let studentsCreated = 0;
    
    for (let i = 0; i < Math.min(3, users.length); i++) {
      const user = users[i];
      
      try {
        // Check if student already exists for this user
        const [existing] = await connection.execute(
          'SELECT id FROM students WHERE user_id = ?', 
          [user.id]
        );
        
        if (existing.length > 0) {
          console.log(`⚠️ Student already exists for user ${user.first_name} ${user.last_name}`);
          
          // Update the existing student to be in our test class
          await connection.execute(`
            UPDATE students 
            SET class_id = ?, current_class_id = ?, status = 'active'
            WHERE user_id = ?
          `, [testClass.id, testClass.id, user.id]);
          
          console.log(`✅ Updated existing student to class ${testClass.name}`);
          studentsCreated++;
          
        } else {
          // Create new student record
          const [result] = await connection.execute(`
            INSERT INTO students (
              user_id, 
              student_id, 
              class_id, 
              current_class_id,
              admission_number, 
              admission_date, 
              roll_number,
              status, 
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())
          `, [
            user.id,
            `STU${String(i + 1).padStart(3, '0')}`,
            testClass.id,
            testClass.id,
            `ADM${String(i + 1).padStart(4, '0')}`,
            '2024-09-01',
            i + 1
          ]);
          
          console.log(`✅ Created student STU${String(i + 1).padStart(3, '0')} for ${user.first_name} ${user.last_name}`);
          studentsCreated++;
        }
        
      } catch (error) {
        console.log(`❌ Error with user ${user.first_name}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Students created/updated: ${studentsCreated}`);
    
    // Test the student count query
    console.log('\n🔍 Testing student count queries...');
    
    // Query 1: Using current_class_id (what the backend uses)
    const [count1] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM students 
      WHERE current_class_id = ? AND status = 'active'
    `, [testClass.id]);
    
    console.log(`📊 Count using current_class_id: ${count1[0].count}`);
    
    // Query 2: Using class_id
    const [count2] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM students 
      WHERE class_id = ? AND status = 'active'
    `, [testClass.id]);
    
    console.log(`📊 Count using class_id: ${count2[0].count}`);
    
    // Show the students
    const [students] = await connection.execute(`
      SELECT s.student_id, s.class_id, s.current_class_id, s.status, u.first_name, u.last_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.current_class_id = ?
    `, [testClass.id]);
    
    console.log('\n📋 Students in class:');
    students.forEach(student => {
      console.log(`  - ${student.student_id}: ${student.first_name} ${student.last_name}`);
    });
    
    // Test the full classes query to see if it picks up the count
    console.log('\n🔍 Testing full classes query...');
    const [classWithCount] = await connection.execute(`
      SELECT 
        c.id,
        c.name,
        c.capacity,
        (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id AND s.status = 'active') as student_count
      FROM classes c
      WHERE c.id = ?
    `, [testClass.id]);
    
    if (classWithCount.length > 0) {
      const cls = classWithCount[0];
      console.log(`📊 Class: ${cls.name}`);
      console.log(`📊 Enrolled: ${cls.student_count}/${cls.capacity}`);
      
      if (cls.student_count > 0) {
        console.log('\n🎉 SUCCESS! Student count is working!');
        console.log('   The frontend should now show the correct enrolled count.');
      } else {
        console.log('\n❌ Student count is still 0');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

createTestStudentsSimple();
