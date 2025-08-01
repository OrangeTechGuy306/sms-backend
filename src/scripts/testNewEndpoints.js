const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testNewEndpoints() {
  try {
    console.log('🧪 Testing New API Endpoints');
    console.log('============================');
    
    // Login to get token
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@admin.com',
      password: 'password123'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed: ' + loginResponse.data.message);
    }
    
    const token = loginResponse.data.data.token;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    console.log('✅ Login successful');
    
    // Test grade levels endpoint
    console.log('\n📚 Testing Grade Levels endpoint...');
    try {
      const gradeLevelsResponse = await axios.get(`${API_BASE_URL}/grade-levels`, { headers });
      console.log('✅ Grade Levels endpoint working');
      console.log(`   Found ${gradeLevelsResponse.data.data.length} grade levels:`);
      gradeLevelsResponse.data.data.slice(0, 3).forEach(level => {
        console.log(`   - ${level.name} (ID: ${level.id})`);
      });
    } catch (error) {
      console.log('❌ Grade Levels endpoint failed:', error.response?.data || error.message);
    }
    
    // Test academic years endpoint
    console.log('\n📅 Testing Academic Years endpoint...');
    try {
      const academicYearsResponse = await axios.get(`${API_BASE_URL}/academic-years`, { headers });
      console.log('✅ Academic Years endpoint working');
      console.log(`   Found ${academicYearsResponse.data.data.length} academic years:`);
      academicYearsResponse.data.data.forEach(year => {
        console.log(`   - ${year.name} (ID: ${year.id}) ${year.is_current ? '[CURRENT]' : ''}`);
      });
    } catch (error) {
      console.log('❌ Academic Years endpoint failed:', error.response?.data || error.message);
    }
    
    // Test teachers endpoint
    console.log('\n👨‍🏫 Testing Teachers endpoint...');
    try {
      const teachersResponse = await axios.get(`${API_BASE_URL}/teachers`, { headers });
      console.log('✅ Teachers endpoint working');
      console.log(`   Found ${teachersResponse.data.data?.length || 0} teachers`);
      if (teachersResponse.data.data?.length > 0) {
        teachersResponse.data.data.slice(0, 3).forEach(teacher => {
          console.log(`   - ${teacher.first_name} ${teacher.last_name} (ID: ${teacher.id})`);
        });
      }
    } catch (error) {
      console.log('❌ Teachers endpoint failed:', error.response?.data || error.message);
    }
    
    // Test class creation with the new frontend format
    console.log('\n🏫 Testing Class Creation with Frontend Format...');
    
    // Get actual IDs for testing
    const gradeLevelsResponse = await axios.get(`${API_BASE_URL}/grade-levels`, { headers });
    const academicYearsResponse = await axios.get(`${API_BASE_URL}/academic-years`, { headers });
    
    if (gradeLevelsResponse.data.data.length > 0 && academicYearsResponse.data.data.length > 0) {
      const testClassData = {
        name: 'Frontend Test Class',
        gradeLevelId: gradeLevelsResponse.data.data[0].id,
        academicYearId: academicYearsResponse.data.data[0].id,
        section: 'A',
        capacity: 30,
        roomNumber: 'Room 301',
        status: 'active'
      };
      
      console.log('   Sending class data:', JSON.stringify(testClassData, null, 2));
      
      try {
        const createResponse = await axios.post(`${API_BASE_URL}/classes`, testClassData, { headers });
        console.log('✅ Class creation successful!');
        console.log('   Response:', createResponse.data);
      } catch (error) {
        console.log('❌ Class creation failed:');
        if (error.response) {
          console.log('   Status:', error.response.status);
          console.log('   Error:', JSON.stringify(error.response.data, null, 2));
        } else {
          console.log('   Error:', error.message);
        }
      }
    } else {
      console.log('❌ Cannot test class creation - missing grade levels or academic years');
    }
    
    console.log('\n🎉 Endpoint testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testNewEndpoints();
