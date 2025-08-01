const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testClassUpdate() {
  try {
    console.log('🧪 Testing Class Update Functionality');
    console.log('====================================');
    
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
    console.log('Original class data:', {
      id: testClass.id,
      name: testClass.name,
      capacity: testClass.capacity,
      room_number: testClass.room_number,
      status: testClass.status
    });
    
    // Test update
    console.log('\n🔄 Testing class update...');
    const updateData = {
      name: testClass.name + ' (Updated)',
      capacity: testClass.capacity + 5,
      section: 'Updated Section',
      room_number: testClass.room_number + ' Updated',
      status: testClass.status
    };
    
    console.log('Update data being sent:', updateData);
    
    try {
      const updateResponse = await axios.put(`${API_BASE_URL}/classes/${testClass.id}`, updateData, { headers });
      console.log('✅ Update successful!');
      console.log('Update response:', updateResponse.data);
      
      // Verify the update by fetching the class again
      console.log('\n🔍 Verifying update by fetching class...');
      const verifyResponse = await axios.get(`${API_BASE_URL}/classes/${testClass.id}`, { headers });
      
      if (verifyResponse.data.success) {
        console.log('✅ Verification successful!');
        console.log('Updated class data:', {
          id: verifyResponse.data.data.id,
          name: verifyResponse.data.data.name,
          capacity: verifyResponse.data.data.capacity,
          room_number: verifyResponse.data.data.room_number,
          status: verifyResponse.data.data.status
        });
        
        // Check if changes were applied
        const changes = {
          nameChanged: verifyResponse.data.data.name !== testClass.name,
          capacityChanged: verifyResponse.data.data.capacity !== testClass.capacity,
          roomChanged: verifyResponse.data.data.room_number !== testClass.room_number
        };
        
        console.log('\n📊 Change verification:', changes);
        
        if (changes.nameChanged && changes.capacityChanged) {
          console.log('🎉 Update test PASSED - Changes were applied successfully!');
        } else {
          console.log('⚠️ Update test PARTIAL - Some changes may not have been applied');
        }
        
      } else {
        console.log('❌ Verification failed:', verifyResponse.data);
      }
      
    } catch (updateError) {
      console.log('❌ Update failed:');
      console.log('Status:', updateError.response?.status);
      console.log('Error:', JSON.stringify(updateError.response?.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testClassUpdate();
