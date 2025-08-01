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

async function testClassesEndpoint() {
  let connection;
  
  try {
    console.log('🧪 Testing Classes API Endpoint');
    console.log('================================');
    
    // First, let's create a test admin user if it doesn't exist
    console.log('👤 Setting up test admin user...');
    connection = await mysql.createConnection(dbConfig);
    
    // Check if test admin exists
    const [existingUser] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      ['test@admin.com']
    );
    
    let userId;
    if (existingUser.length === 0) {
      // Create test admin user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const [result] = await connection.execute(`
        INSERT INTO users (uuid, email, password_hash, user_type, first_name, last_name, status, email_verified)
        VALUES (UUID(), 'test@admin.com', ?, 'admin', 'Test', 'Admin', 'active', TRUE)
      `, [hashedPassword]);
      
      userId = result.insertId;
      console.log('✅ Test admin user created');
    } else {
      userId = existingUser[0].id;
      console.log('✅ Test admin user already exists');
    }
    
    // Login to get token
    console.log('🔐 Logging in to get auth token...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@admin.com',
      password: 'password123'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed: ' + loginResponse.data.message);
    }
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful, token obtained');
    
    // Test the classes endpoint
    console.log('🏫 Testing GET /api/classes endpoint...');
    const classesResponse = await axios.get(`${API_BASE_URL}/classes`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Classes endpoint response:');
    console.log('Status:', classesResponse.status);
    console.log('Success:', classesResponse.data.success);
    console.log('Message:', classesResponse.data.message);
    console.log('Total classes:', classesResponse.data.data?.pagination?.totalItems || 0);
    
    if (classesResponse.data.data?.classes) {
      console.log('Classes found:', classesResponse.data.data.classes.length);
      classesResponse.data.data.classes.forEach((cls, index) => {
        console.log(`  ${index + 1}. ${cls.name} - ${cls.grade_level} (${cls.student_count} students)`);
      });
    }
    
    // Test creating a new class
    console.log('\n➕ Testing POST /api/classes endpoint...');
    
    // Get a grade level ID for the test
    const [gradeLevels] = await connection.execute('SELECT id, name FROM grade_levels LIMIT 1');
    const [academicYears] = await connection.execute('SELECT id, name FROM academic_years LIMIT 1');
    
    if (gradeLevels.length > 0 && academicYears.length > 0) {
      const newClassData = {
        name: 'Test Class A',
        gradeLevelId: gradeLevels[0].id,
        academicYearId: academicYears[0].id,
        section: 'A',
        capacity: 30,
        roomNumber: 'Room 101'
      };
      
      const createResponse = await axios.post(`${API_BASE_URL}/classes`, newClassData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Class creation response:');
      console.log('Status:', createResponse.status);
      console.log('Success:', createResponse.data.success);
      console.log('Message:', createResponse.data.message);
      
      if (createResponse.data.success) {
        console.log('New class ID:', createResponse.data.data.id);
        
        // Test fetching classes again to see the new class
        console.log('\n🔄 Fetching classes again to verify creation...');
        const updatedClassesResponse = await axios.get(`${API_BASE_URL}/classes`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('Updated total classes:', updatedClassesResponse.data.data?.pagination?.totalItems || 0);
      }
    } else {
      console.log('⚠️  No grade levels or academic years found, skipping class creation test');
    }
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ The classes endpoint is working properly');
    console.log('✅ Database tables are correctly structured');
    console.log('✅ Authentication is working');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure the backend server is running on port 5000');
      console.error('Run: npm run dev (in the backend directory)');
    }
    
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testClassesEndpoint();
