const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testEditDeleteFixes() {
  try {
    console.log('🧪 Testing Edit & Delete Fixes');
    console.log('==============================');
    
    // Login to get token
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@admin.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Login successful');
    
    // Get classes to test with
    console.log('\n📚 Getting classes...');
    const classesResponse = await axios.get(`${API_BASE_URL}/classes`, { headers });
    
    if (classesResponse.data.data.classes.length === 0) {
      console.log('❌ No classes found to test with');
      return;
    }
    
    const testClass = classesResponse.data.data.classes[0];
    console.log(`✅ Found test class: ${testClass.name} (ID: ${testClass.id})`);
    
    // Test 1: Get class by ID (should work with integer ID)
    console.log('\n1️⃣ Testing GET class by ID...');
    try {
      const getResponse = await axios.get(`${API_BASE_URL}/classes/${testClass.id}`, { headers });
      console.log('✅ GET class by ID successful');
      console.log(`   Retrieved: ${getResponse.data.data.name}`);
    } catch (error) {
      console.log('❌ GET class by ID failed:', error.response?.data || error.message);
    }
    
    // Test 2: Update class (should work with integer ID)
    console.log('\n2️⃣ Testing PUT class update...');
    try {
      const updateData = {
        name: testClass.name + ' (Updated)',
        capacity: testClass.capacity + 5
      };
      
      const updateResponse = await axios.put(`${API_BASE_URL}/classes/${testClass.id}`, updateData, { headers });
      console.log('✅ PUT class update successful');
      console.log(`   Updated class: ${updateResponse.data.message}`);
    } catch (error) {
      console.log('❌ PUT class update failed:', error.response?.data || error.message);
    }
    
    // Test 3: Get students in class (should work with integer ID)
    console.log('\n3️⃣ Testing GET students in class...');
    try {
      const studentsResponse = await axios.get(`${API_BASE_URL}/classes/${testClass.id}/students`, { headers });
      console.log('✅ GET students in class successful');
      console.log(`   Found ${studentsResponse.data.data?.length || 0} students`);
    } catch (error) {
      console.log('❌ GET students in class failed:', error.response?.data || error.message);
    }
    
    // Test 4: Delete class (should work with integer ID)
    console.log('\n4️⃣ Testing DELETE class...');
    
    // First, let's create a test class to delete
    console.log('   Creating a test class to delete...');
    try {
      const gradeLevelsResponse = await axios.get(`${API_BASE_URL}/grade-levels`, { headers });
      const academicYearsResponse = await axios.get(`${API_BASE_URL}/academic-years`, { headers });
      
      const testClassData = {
        name: 'Test Class for Deletion',
        gradeLevelId: gradeLevelsResponse.data.data[0].id,
        academicYearId: academicYearsResponse.data.data[0].id,
        section: 'DELETE',
        capacity: 20,
        roomNumber: 'Room DELETE'
      };
      
      const createResponse = await axios.post(`${API_BASE_URL}/classes`, testClassData, { headers });
      const newClassId = createResponse.data.data.classId;
      console.log(`   ✅ Created test class with ID: ${newClassId}`);
      
      // Now try to delete it
      console.log('   Attempting to delete the test class...');
      const deleteResponse = await axios.delete(`${API_BASE_URL}/classes/${newClassId}`, { headers });
      console.log('   ✅ DELETE class successful');
      console.log(`   Response: ${deleteResponse.data.message}`);
      
    } catch (error) {
      console.log('   ❌ DELETE class failed:', error.response?.data || error.message);
    }
    
    console.log('\n🎉 Edit & Delete tests completed!');
    console.log('\n📋 Summary:');
    console.log('   - GET class by ID: Should work with integer IDs');
    console.log('   - PUT class update: Should work with integer IDs');
    console.log('   - GET students in class: Should work with integer IDs');
    console.log('   - DELETE class: Should work with integer IDs');
    console.log('\n✅ Frontend edit and delete operations should now work!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testEditDeleteFixes();
