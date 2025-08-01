const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'school_management_system'
};

async function debugClassesQuery() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 Testing the problematic classes query...');
    
    // Test the exact query from the logs
    const query = `
      SELECT 
        c.id,
        c.name,
        c.capacity,
        c.room_number,
        c.status,
        c.created_at,
        gl.name as grade_level,
        gl.level_number,
        ay.name as academic_year,
        CONCAT(u.first_name, ' ', u.last_name) as class_teacher_name,
        (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id AND s.status = 'active') as student_count,
        (SELECT COUNT(DISTINCT ts.subject_id) FROM teacher_subjects ts WHERE ts.class_id = c.id) as subject_count
      FROM classes c
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN teachers t ON c.class_teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
      ORDER BY gl.level_number, c.name ASC
      LIMIT ? OFFSET ?
    `;
    
    // Test with different parameter types
    console.log('📊 Test 1: Using integers directly...');
    try {
      const result1 = await connection.execute(query, [10, 0]);
      console.log('✅ Success with integers:', result1[0].length, 'rows');
    } catch (error) {
      console.log('❌ Failed with integers:', error.message);
    }
    
    console.log('📊 Test 2: Using string numbers...');
    try {
      const result2 = await connection.execute(query, ['10', '0']);
      console.log('✅ Success with strings:', result2[0].length, 'rows');
    } catch (error) {
      console.log('❌ Failed with strings:', error.message);
    }
    
    console.log('📊 Test 3: Using mixed types...');
    try {
      const result3 = await connection.execute(query, [parseInt('10'), parseInt('0')]);
      console.log('✅ Success with parsed ints:', result3[0].length, 'rows');
    } catch (error) {
      console.log('❌ Failed with parsed ints:', error.message);
    }
    
    // Test without LIMIT/OFFSET
    console.log('📊 Test 4: Without LIMIT/OFFSET...');
    const simpleQuery = `
      SELECT 
        c.id,
        c.name,
        c.capacity,
        c.room_number,
        c.status,
        c.created_at,
        gl.name as grade_level,
        gl.level_number,
        ay.name as academic_year,
        CONCAT(u.first_name, ' ', u.last_name) as class_teacher_name,
        (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id AND s.status = 'active') as student_count,
        (SELECT COUNT(DISTINCT ts.subject_id) FROM teacher_subjects ts WHERE ts.class_id = c.id) as subject_count
      FROM classes c
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN teachers t ON c.class_teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
      ORDER BY gl.level_number, c.name ASC
      LIMIT 10
    `;
    
    try {
      const result4 = await connection.execute(simpleQuery);
      console.log('✅ Success without parameters:', result4[0].length, 'rows');
      
      if (result4[0].length > 0) {
        console.log('📋 Sample result:');
        console.log('  - Class:', result4[0][0].name);
        console.log('  - Grade:', result4[0][0].grade_level);
        console.log('  - Students:', result4[0][0].student_count);
        console.log('  - Subjects:', result4[0][0].subject_count);
      }
    } catch (error) {
      console.log('❌ Failed without parameters:', error.message);
    }
    
    // Test the count query
    console.log('📊 Test 5: Count query...');
    const countQuery = `
      SELECT COUNT(*) as total
      FROM classes c
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN teachers t ON c.class_teacher_id = t.id
      WHERE 1=1
    `;
    
    try {
      const countResult = await connection.execute(countQuery);
      console.log('✅ Count query success:', countResult[0][0].total, 'total classes');
    } catch (error) {
      console.log('❌ Count query failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the debug
console.log('🔧 School Management System - Debug Classes Query');
console.log('==================================================');
debugClassesQuery();
