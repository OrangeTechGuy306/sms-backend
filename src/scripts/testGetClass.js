const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testGetClass() {
  try {
    console.log('🧪 Testing GET Class by ID');
    console.log('===========================');
    
    // Login to get token
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@admin.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Login successful');
    
    // Get existing classes
    console.log('\n📚 Getting existing classes...');
    const classesResponse = await axios.get(`${API_BASE_URL}/classes`, { headers });
    
    if (classesResponse.data.data.classes.length === 0) {
      console.log('❌ No classes found to test with');
      return;
    }
    
    const testClass = classesResponse.data.data.classes[0];
    console.log(`✅ Found test class: ${testClass.name} (ID: ${testClass.id}, type: ${typeof testClass.id})`);
    
    // Test GET class by ID
    console.log(`\n🔍 Testing GET /api/classes/${testClass.id}...`);
    
    try {
      const getResponse = await axios.get(`${API_BASE_URL}/classes/${testClass.id}`, { headers });
      console.log('✅ GET class by ID successful!');
      console.log('Response data:', {
        id: getResponse.data.data.id,
        name: getResponse.data.data.name,
        capacity: getResponse.data.data.capacity,
        grade_level: getResponse.data.data.grade_level
      });
    } catch (getError) {
      console.log('❌ GET class by ID failed:');
      console.log('Status:', getError.response?.status);
      console.log('Error:', JSON.stringify(getError.response?.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testGetClass();
