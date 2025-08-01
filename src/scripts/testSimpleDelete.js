const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testSimpleDelete() {
  try {
    console.log('🧪 Testing Simple Delete Operation');
    console.log('==================================');
    
    // Login to get token
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@admin.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Login successful');
    
    // Create a test class first
    console.log('\n📝 Creating a test class...');
    const gradeLevelsResponse = await axios.get(`${API_BASE_URL}/grade-levels`, { headers });
    const academicYearsResponse = await axios.get(`${API_BASE_URL}/academic-years`, { headers });
    
    const testClassData = {
      name: `Delete Test ${Date.now()}`, // Unique name
      gradeLevelId: gradeLevelsResponse.data.data[0].id,
      academicYearId: academicYearsResponse.data.data[0].id,
      section: 'TEST',
      capacity: 15,
      roomNumber: 'Room TEST'
    };
    
    const createResponse = await axios.post(`${API_BASE_URL}/classes`, testClassData, { headers });
    const newClassId = createResponse.data.data.classId;
    console.log(`✅ Created test class with ID: ${newClassId} (type: ${typeof newClassId})`);
    
    // Test delete with the integer ID
    console.log(`\n🗑️ Attempting to delete class ID: ${newClassId}...`);
    
    try {
      const deleteResponse = await axios.delete(`${API_BASE_URL}/classes/${newClassId}`, { headers });
      console.log('✅ DELETE successful!');
      console.log('Response:', deleteResponse.data);
    } catch (deleteError) {
      console.log('❌ DELETE failed:');
      console.log('Status:', deleteError.response?.status);
      console.log('Error:', JSON.stringify(deleteError.response?.data, null, 2));
      
      // Let's also test the validation directly
      console.log('\n🔍 Testing validation with different ID formats...');
      
      // Test with string version of the ID
      try {
        console.log(`Testing with string ID: "${newClassId}"`);
        const deleteResponse2 = await axios.delete(`${API_BASE_URL}/classes/${String(newClassId)}`, { headers });
        console.log('✅ DELETE with string ID successful!');
      } catch (error2) {
        console.log('❌ DELETE with string ID failed:', error2.response?.data);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSimpleDelete();
