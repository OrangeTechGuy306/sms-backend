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

async function testClassCreation() {
  let connection;
  
  try {
    console.log('🧪 Testing Class Creation with Proper Data');
    console.log('==========================================');
    
    // Connect to database to get actual IDs
    connection = await mysql.createConnection(dbConfig);
    
    // Get actual grade level and academic year IDs
    console.log('📋 Getting actual IDs from database...');
    
    const [gradeLevels] = await connection.execute('SELECT id, name FROM grade_levels LIMIT 1');
    const [academicYears] = await connection.execute('SELECT id, name FROM academic_years LIMIT 1');
    
    if (gradeLevels.length === 0 || academicYears.length === 0) {
      throw new Error('No grade levels or academic years found in database');
    }
    
    console.log(`✅ Grade Level: ${gradeLevels[0].id} (${gradeLevels[0].name})`);
    console.log(`✅ Academic Year: ${academicYears[0].id} (${academicYears[0].name})`);
    
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
    
    // Test class creation with exact data types
    console.log('\n➕ Testing class creation...');
    
    const testCases = [
      {
        name: 'Test Case 1: String IDs',
        data: {
          name: 'Test Class A',
          gradeLevelId: gradeLevels[0].id.toString(),
          academicYearId: academicYears[0].id.toString(),
          section: 'A',
          capacity: 30,
          roomNumber: 'Room 101'
        }
      },
      {
        name: 'Test Case 2: Mixed types (UUID string, integer)',
        data: {
          name: 'Test Class B',
          gradeLevelId: gradeLevels[0].id,
          academicYearId: academicYears[0].id,
          section: 'B',
          capacity: 25,
          roomNumber: 'Room 102'
        }
      }
    ];
    
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
        
        console.log('   ✅ Success!');
        console.log('   Response:', response.data);
        
      } catch (error) {
        console.log('   ❌ Failed');
        if (error.response) {
          console.log('   Status:', error.response.status);
          console.log('   Error:', JSON.stringify(error.response.data, null, 2));
        } else {
          console.log('   Error:', error.message);
        }
      }
    }
    
    // Check what classes were created
    console.log('\n📊 Checking created classes...');
    try {
      const classesResponse = await axios.get(`${API_BASE_URL}/classes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log(`✅ Total classes now: ${classesResponse.data.data?.pagination?.totalItems || 0}`);
      if (classesResponse.data.data?.classes?.length > 0) {
        classesResponse.data.data.classes.forEach((cls, index) => {
          console.log(`   ${index + 1}. ${cls.name} - ${cls.grade_level} (${cls.student_count} students)`);
        });
      }
    } catch (error) {
      console.log('❌ Failed to fetch classes:', error.response?.data || error.message);
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

testClassCreation();
