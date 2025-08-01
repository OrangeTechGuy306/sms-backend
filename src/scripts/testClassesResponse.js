const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testClassesResponse() {
  try {
    console.log('🧪 Testing Classes API Response Format');
    console.log('=====================================');
    
    // Login to get token
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@admin.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Login successful');
    
    // Test classes endpoint
    console.log('\n📚 Testing Classes endpoint...');
    const classesResponse = await axios.get(`${API_BASE_URL}/classes`, { headers });
    
    console.log('✅ Classes API Response:');
    console.log('📋 Full Response Structure:');
    console.log(JSON.stringify(classesResponse.data, null, 2));
    
    if (classesResponse.data.data && classesResponse.data.data.classes) {
      console.log('\n📊 Classes Array:');
      console.log(`   Total classes: ${classesResponse.data.data.classes.length}`);
      
      if (classesResponse.data.data.classes.length > 0) {
        console.log('\n🔍 First Class Object Structure:');
        const firstClass = classesResponse.data.data.classes[0];
        console.log(JSON.stringify(firstClass, null, 2));
        
        console.log('\n📝 Available Fields:');
        Object.keys(firstClass).forEach(key => {
          console.log(`   - ${key}: ${typeof firstClass[key]} = ${firstClass[key]}`);
        });
      }
      
      if (classesResponse.data.data.pagination) {
        console.log('\n📄 Pagination Info:');
        console.log(JSON.stringify(classesResponse.data.data.pagination, null, 2));
      }
    } else {
      console.log('❌ No classes data found in response');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testClassesResponse();
