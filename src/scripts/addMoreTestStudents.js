const mysql = require('mysql2/promise');
require('dotenv').config();

async function addMoreTestStudents() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'school_management_system'
  });
  
  try {
    console.log('🧪 Adding More Test Students for Better Demo');
    console.log('============================================');
    
    // Get all classes
    const [classes] = await connection.execute('SELECT id, name, capacity FROM classes');
    console.log(`📚 Found ${classes.length} classes`);
    
    // Create additional users to use as students
    const additionalUsers = [
      { firstName: 'Alice', lastName: 'Johnson', email: 'alice.johnson@school.com' },
      { firstName: 'Bob', lastName: 'Smith', email: 'bob.smith@school.com' },
      { firstName: 'Carol', lastName: 'Davis', email: 'carol.davis@school.com' },
      { firstName: 'David', lastName: 'Wilson', email: 'david.wilson@school.com' },
      { firstName: 'Emma', lastName: 'Brown', email: 'emma.brown@school.com' },
      { firstName: 'Frank', lastName: 'Miller', email: 'frank.miller@school.com' }
    ];
    
    const createdUserIds = [];
    
    console.log('\n👥 Creating additional users...');
    for (const user of additionalUsers) {
      try {
        const [result] = await connection.execute(`
          INSERT INTO users (first_name, last_name, email, password_hash, user_type, status, created_at)
          VALUES (?, ?, ?, ?, 'student', 'active', NOW())
        `, [
          user.firstName,
          user.lastName,
          user.email,
          '$2b$10$hashedpassword' // Placeholder
        ]);
        
        createdUserIds.push(result.insertId);
        console.log(`✅ Created user: ${user.firstName} ${user.lastName}`);
        
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️ User ${user.email} already exists`);
          // Get existing user ID
          const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [user.email]);
          if (existing.length > 0) {
            createdUserIds.push(existing[0].id);
          }
        } else {
          console.log(`❌ Error creating ${user.firstName}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📊 Available user IDs: ${createdUserIds.length}`);
    
    // Distribute students across classes
    console.log('\n🎯 Distributing students across classes...');
    let studentCounter = 1;
    
    for (let classIndex = 0; classIndex < classes.length; classIndex++) {
      const cls = classes[classIndex];
      const studentsToAdd = Math.min(3, createdUserIds.length - (classIndex * 2)); // Vary the number
      
      if (studentsToAdd <= 0) break;
      
      console.log(`\n📋 Adding ${studentsToAdd} students to ${cls.name}...`);
      
      for (let i = 0; i < studentsToAdd; i++) {
        const userIndex = (classIndex * 2) + i;
        if (userIndex >= createdUserIds.length) break;
        
        const userId = createdUserIds[userIndex];
        
        try {
          // Check if student already exists
          const [existing] = await connection.execute('SELECT id FROM students WHERE user_id = ?', [userId]);
          
          if (existing.length === 0) {
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
              `STU${String(studentCounter).padStart(3, '0')}`,
              cls.id,
              cls.id,
              `ADM${String(studentCounter).padStart(4, '0')}`,
              '2024-09-01',
              studentCounter
            ]);
            
            console.log(`  ✅ Added student STU${String(studentCounter).padStart(3, '0')}`);
            studentCounter++;
          } else {
            console.log(`  ⚠️ Student already exists for user ID ${userId}`);
          }
          
        } catch (error) {
          console.log(`  ❌ Error adding student: ${error.message}`);
        }
      }
    }
    
    // Show final results
    console.log('\n📊 Final student distribution:');
    
    for (const cls of classes) {
      const [count] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM students 
        WHERE current_class_id = ? AND status = 'active'
      `, [cls.id]);
      
      const enrolled = count[0].count;
      const percentage = cls.capacity > 0 ? Math.round((enrolled / cls.capacity) * 100) : 0;
      
      console.log(`  📋 ${cls.name}: ${enrolled}/${cls.capacity} (${percentage}%)`);
    }
    
    console.log('\n🎉 Test students created successfully!');
    console.log('   Your classes table should now show realistic enrollment numbers.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

addMoreTestStudents();
