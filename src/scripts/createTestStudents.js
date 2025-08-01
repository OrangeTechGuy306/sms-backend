const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTestStudents() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    console.log('🧪 Creating Test Students to Verify Student Count');
    console.log('=================================================');
    
    // First, get a class to assign students to
    const [classes] = await connection.execute('SELECT id, name, capacity FROM classes LIMIT 1');
    if (classes.length === 0) {
      console.log('❌ No classes found to assign students to');
      return;
    }
    
    const testClass = classes[0];
    console.log(`✅ Found test class: ${testClass.name} (ID: ${testClass.id}, Capacity: ${testClass.capacity})`);
    
    // Check if we need to create users first (students need user accounts)
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE role = "student"');
    console.log(`📊 Current student users: ${users[0].count}`);
    
    // Create some test users for students if needed
    const testStudentUsers = [];
    for (let i = 1; i <= 3; i++) {
      try {
        const [result] = await connection.execute(`
          INSERT INTO users (first_name, last_name, email, password, role, status, created_at)
          VALUES (?, ?, ?, ?, 'student', 'active', NOW())
        `, [
          `TestStudent${i}`,
          `LastName${i}`,
          `teststudent${i}@school.com`,
          '$2b$10$hashedpassword' // Placeholder hashed password
        ]);
        
        testStudentUsers.push(result.insertId);
        console.log(`✅ Created user for TestStudent${i} (User ID: ${result.insertId})`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️ User teststudent${i}@school.com already exists`);
          // Get existing user ID
          const [existing] = await connection.execute(
            'SELECT id FROM users WHERE email = ?', 
            [`teststudent${i}@school.com`]
          );
          if (existing.length > 0) {
            testStudentUsers.push(existing[0].id);
          }
        } else {
          console.log(`❌ Error creating user ${i}: ${error.message}`);
        }
      }
    }
    
    // Create student records
    console.log('\n👥 Creating student records...');
    const createdStudents = [];
    
    for (let i = 0; i < testStudentUsers.length; i++) {
      const userId = testStudentUsers[i];
      const studentNumber = i + 1;
      
      try {
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
          userId,
          `STU${String(studentNumber).padStart(3, '0')}`,
          testClass.id,
          testClass.id, // Set both class_id and current_class_id
          `ADM${String(studentNumber).padStart(4, '0')}`,
          '2024-09-01',
          studentNumber
        ]);
        
        createdStudents.push(result.insertId);
        console.log(`✅ Created student STU${String(studentNumber).padStart(3, '0')} (Student ID: ${result.insertId})`);
        
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️ Student with this user_id already exists`);
        } else {
          console.log(`❌ Error creating student ${studentNumber}: ${error.message}`);
        }
      }
    }
    
    // Verify the student count
    console.log('\n🔍 Verifying student count...');
    
    // Test the exact query used in the classes controller
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as student_count 
      FROM students s 
      WHERE s.current_class_id = ? AND s.status = 'active'
    `, [testClass.id]);
    
    console.log(`📊 Student count for class ${testClass.name}: ${countResult[0].student_count}`);
    
    // Also test with class_id
    const [countResult2] = await connection.execute(`
      SELECT COUNT(*) as student_count 
      FROM students s 
      WHERE s.class_id = ? AND s.status = 'active'
    `, [testClass.id]);
    
    console.log(`📊 Student count using class_id: ${countResult2[0].student_count}`);
    
    // Show the students created
    const [students] = await connection.execute(`
      SELECT s.id, s.student_id, s.class_id, s.current_class_id, s.status, u.first_name, u.last_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.current_class_id = ?
    `, [testClass.id]);
    
    console.log('\n📋 Students in class:');
    students.forEach(student => {
      console.log(`  - ${student.student_id}: ${student.first_name} ${student.last_name} (Status: ${student.status})`);
    });
    
    if (countResult[0].student_count > 0) {
      console.log('\n🎉 SUCCESS: Student count is now working!');
      console.log(`   The classes API should now show ${countResult[0].student_count}/${testClass.capacity} enrolled`);
    } else {
      console.log('\n❌ Student count is still 0. There might be an issue with the query or data.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

createTestStudents();
