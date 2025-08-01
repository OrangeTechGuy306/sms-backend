const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testFrontendIntegration() {
  try {
    console.log('🔗 Testing Frontend-Backend Integration');
    console.log('======================================');
    
    // Test 1: Login
    console.log('1️⃣ Testing login...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@admin.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Login successful');
    
    // Test 2: Grade Levels
    console.log('\n2️⃣ Testing grade levels...');
    const gradeLevelsResponse = await axios.get(`${API_BASE_URL}/grade-levels`, { headers });
    console.log(`✅ Found ${gradeLevelsResponse.data.data.length} grade levels`);
    
    // Test 3: Academic Years  
    console.log('\n3️⃣ Testing academic years...');
    const academicYearsResponse = await axios.get(`${API_BASE_URL}/academic-years`, { headers });
    console.log(`✅ Found ${academicYearsResponse.data.data.length} academic years`);
    
    // Test 4: Class Creation (Frontend Format)
    console.log('\n4️⃣ Testing class creation with frontend data format...');
    
    const frontendClassData = {
      name: 'Integration Test Class',
      gradeLevelId: gradeLevelsResponse.data.data[0].id,
      academicYearId: academicYearsResponse.data.data[0].id,
      section: 'A',
      capacity: 30,
      roomNumber: 'Room 401'
    };
    
    console.log('📤 Sending data:', JSON.stringify(frontendClassData, null, 2));
    
    const createResponse = await axios.post(`${API_BASE_URL}/classes`, frontendClassData, { headers });
    console.log('✅ Class created successfully!');
    console.log('📥 Response:', createResponse.data);
    
    // Test 5: Fetch Classes
    console.log('\n5️⃣ Testing class retrieval...');
    const classesResponse = await axios.get(`${API_BASE_URL}/classes`, { headers });
    console.log(`✅ Retrieved ${classesResponse.data.data.classes.length} classes`);
    
    console.log('\n🎉 All integration tests passed!');
    console.log('\n📋 Summary:');
    console.log(`   - Grade Levels: ${gradeLevelsResponse.data.data.length}`);
    console.log(`   - Academic Years: ${academicYearsResponse.data.data.length}`);
    console.log(`   - Total Classes: ${classesResponse.data.data.classes.length}`);
    console.log('\n✅ Frontend should now be able to create classes successfully!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testFrontendIntegration();
