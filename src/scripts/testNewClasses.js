const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'school_management_system'
};

async function testNewClasses() {
  let connection;
  
  try {
    console.log('🧪 Testing Class Creation with NEW Class Names');
    console.log('===============================================');
    
    // Connect to database to get actual IDs
    connection = await mysql.createConnection(dbConfig);
    
    // Get actual grade level and academic year IDs
    console.log('📋 Getting actual IDs from database...');
    
    const [gradeLevels] = await connection.execute('SELECT id, name FROM grade_levels LIMIT 3');
    const [academicYears] = await connection.execute('SELECT id, name FROM academic_years LIMIT 1');
    
    if (gradeLevels.length === 0 || academicYears.length === 0) {
      throw new Error('No grade levels or academic years found in database');
    }
    
    console.log('Available Grade Levels:');
    gradeLevels.forEach((gl, index) => {
      console.log(`  ${index + 1}. ${gl.id} (${gl.name})`);
    });
    
    console.log('Available Academic Years:');
    academicYears.forEach((ay, index) => {
      console.log(`  ${index + 1}. ${ay.id} (${ay.name})`);
    });
    
    // Login to get token
    console.log('\n🔐 Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@admin.com',
      password: 'password123'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed: ' + loginResponse.data.message);
    }
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful');
    
    // Test class creation with different data formats and NEW names
    console.log('\n➕ Testing class creation with various data formats...');
    
    const testCases = [
      {
        name: 'Test Case 1: UUID Grade Level + String Academic Year',
        data: {
          name: 'Mathematics Class 1A',
          gradeLevelId: gradeLevels[0].id,
          academicYearId: academicYears[0].id.toString(),
          section: 'A',
          capacity: 30,
          roomNumber: 'Room 201'
        }
      },
      {
        name: 'Test Case 2: UUID Grade Level + Integer Academic Year',
        data: {
          name: 'Science Class 1B',
          gradeLevelId: gradeLevels[0].id,
          academicYearId: academicYears[0].id,
          section: 'B',
          capacity: 25,
          roomNumber: 'Room 202'
        }
      },
      {
        name: 'Test Case 3: Different Grade Level',
        data: {
          name: 'English Class 2A',
          gradeLevelId: gradeLevels[1]?.id || gradeLevels[0].id,
          academicYearId: academicYears[0].id,
          section: 'A',
          capacity: 28,
          roomNumber: 'Room 203'
        }
      }
    ];
    
    let successCount = 0;
    
    for (const testCase of testCases) {
      console.log(`\n🔍 ${testCase.name}:`);
      console.log('   Data being sent:', JSON.stringify(testCase.data, null, 2));
      
      try {
        const response = await axios.post(`${API_BASE_URL}/classes`, testCase.data, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('   ✅ SUCCESS!');
        console.log('   Response:', response.data);
        successCount++;
        
      } catch (error) {
        console.log('   ❌ FAILED');
        if (error.response) {
          console.log('   Status:', error.response.status);
          console.log('   Error:', JSON.stringify(error.response.data, null, 2));
        } else {
          console.log('   Error:', error.message);
        }
      }
    }
    
    // Check final class count
    console.log('\n📊 Final Results:');
    console.log(`✅ Successful creations: ${successCount}/${testCases.length}`);
    
    try {
      const classesResponse = await axios.get(`${API_BASE_URL}/classes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log(`📈 Total classes in system: ${classesResponse.data.data?.pagination?.totalItems || 0}`);
      
      if (classesResponse.data.data?.classes?.length > 0) {
        console.log('\n📋 All classes:');
        classesResponse.data.data.classes.forEach((cls, index) => {
          console.log(`   ${index + 1}. ${cls.name} - ${cls.grade_level} (${cls.student_count} students)`);
        });
      }
    } catch (error) {
      console.log('❌ Failed to fetch classes:', error.response?.data || error.message);
    }
    
    if (successCount === testCases.length) {
      console.log('\n🎉 ALL TESTS PASSED! Class creation is working perfectly!');
    } else if (successCount > 0) {
      console.log('\n✅ PARTIAL SUCCESS! Some class creations worked.');
    } else {
      console.log('\n❌ ALL TESTS FAILED! There are still issues to resolve.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testNewClasses();
