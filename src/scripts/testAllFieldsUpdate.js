const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testAllFieldsUpdate() {
  try {
    console.log('🧪 Testing All Fields Update');
    console.log('=============================');
    
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
    console.log(`✅ Found test class: ${testClass.name} (ID: ${testClass.id})`);
    
    console.log('\n📋 Original class data:');
    console.log({
      id: testClass.id,
      name: testClass.name,
      grade_level: testClass.grade_level,
      section: testClass.section,
      capacity: testClass.capacity,
      room_number: testClass.room_number,
      status: testClass.status,
      academic_year: testClass.academic_year
    });
    
    // Test updating all possible fields
    console.log('\n🔄 Testing comprehensive field update...');
    const updateData = {
      name: testClass.name + ' (All Fields Updated)',
      grade_level: 'Updated Grade Level',
      section: 'Updated Section',
      capacity: testClass.capacity + 10,
      room_number: 'Updated Room 999',
      status: testClass.status === 'active' ? 'inactive' : 'active',
      description: 'This is an updated description for the class'
    };
    
    console.log('\n📤 Update data being sent:');
    console.log(updateData);
    
    try {
      const updateResponse = await axios.put(`${API_BASE_URL}/classes/${testClass.id}`, updateData, { headers });
      console.log('\n✅ Update successful!');
      console.log('Response:', updateResponse.data);
      
      // Verify the update by fetching the class again
      console.log('\n🔍 Verifying update by fetching class...');
      const verifyResponse = await axios.get(`${API_BASE_URL}/classes/${testClass.id}`, { headers });
      
      if (verifyResponse.data.success) {
        console.log('✅ Verification successful!');
        
        const updatedClass = verifyResponse.data.data;
        console.log('\n📋 Updated class data:');
        console.log({
          id: updatedClass.id,
          name: updatedClass.name,
          grade_level: updatedClass.grade_level,
          section: updatedClass.section,
          capacity: updatedClass.capacity,
          room_number: updatedClass.room_number,
          status: updatedClass.status,
          description: updatedClass.description
        });
        
        // Check which fields were actually updated
        console.log('\n📊 Field update verification:');
        const checks = {
          name: updatedClass.name !== testClass.name,
          grade_level: updatedClass.grade_level !== testClass.grade_level,
          section: updatedClass.section !== testClass.section,
          capacity: updatedClass.capacity !== testClass.capacity,
          room_number: updatedClass.room_number !== testClass.room_number,
          status: updatedClass.status !== testClass.status,
          description: updatedClass.description !== null
        };
        
        Object.entries(checks).forEach(([field, changed]) => {
          console.log(`  ${changed ? '✅' : '❌'} ${field}: ${changed ? 'UPDATED' : 'NOT UPDATED'}`);
        });
        
        const successCount = Object.values(checks).filter(Boolean).length;
        const totalFields = Object.keys(checks).length;
        
        console.log(`\n🎯 Update Summary: ${successCount}/${totalFields} fields updated successfully`);
        
        if (successCount === totalFields) {
          console.log('🎉 ALL FIELDS UPDATE TEST PASSED!');
        } else {
          console.log('⚠️ Some fields were not updated - check backend allowedFields');
        }
        
      } else {
        console.log('❌ Verification failed:', verifyResponse.data);
      }
      
    } catch (updateError) {
      console.log('\n❌ Update failed:');
      console.log('Status:', updateError.response?.status);
      console.log('Error:', JSON.stringify(updateError.response?.data, null, 2));
      
      if (updateError.response?.data?.message === 'No valid fields to update') {
        console.log('\n💡 This suggests that the allowedFields array in the backend needs to be updated');
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

testAllFieldsUpdate();
