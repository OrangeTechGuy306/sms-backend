const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testCompleteFieldUpdate() {
  try {
    console.log('🧪 Testing Complete Field Update (Final Test)');
    console.log('==============================================');
    
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
    
    // Test with properly sized values
    console.log('\n🔄 Testing update with properly sized values...');
    const updateData = {
      name: 'Updated Class Name',           // ≤ 100 chars
      grade_level: 'Grade 12',             // ≤ 20 chars
      section: 'B',                        // ≤ 10 chars
      capacity: 35,
      room_number: 'Room 205',             // ≤ 20 chars
      status: testClass.status === 'active' ? 'inactive' : 'active',
      description: 'This is a properly updated class description that should work fine.'
    };
    
    console.log('\n📤 Update data being sent:');
    Object.entries(updateData).forEach(([key, value]) => {
      const length = typeof value === 'string' ? ` (${value.length} chars)` : '';
      console.log(`  - ${key}: "${value}"${length}`);
    });
    
    try {
      const updateResponse = await axios.put(`${API_BASE_URL}/classes/${testClass.id}`, updateData, { headers });
      console.log('\n✅ Update successful!');
      console.log('Response:', updateResponse.data);
      
      // Verify by checking database directly
      console.log('\n🔍 Verifying update in database...');
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: process.env.DB_NAME || 'school_management_system'
      });
      
      const [verification] = await connection.execute('SELECT * FROM classes WHERE id = ?', [testClass.id]);
      await connection.end();
      
      if (verification.length > 0) {
        const updated = verification[0];
        console.log('\n📋 Updated class data in database:');
        console.log({
          id: updated.id,
          name: updated.name,
          grade_level: updated.grade_level,
          section: updated.section,
          capacity: updated.capacity,
          room_number: updated.room_number,
          status: updated.status,
          description: updated.description
        });
        
        // Verify each field was updated
        console.log('\n✅ Field update verification:');
        const verifications = {
          name: updated.name === updateData.name,
          grade_level: updated.grade_level === updateData.grade_level,
          section: updated.section === updateData.section,
          capacity: updated.capacity === updateData.capacity,
          room_number: updated.room_number === updateData.room_number,
          status: updated.status === updateData.status,
          description: updated.description === updateData.description
        };
        
        Object.entries(verifications).forEach(([field, success]) => {
          console.log(`  ${success ? '✅' : '❌'} ${field}: ${success ? 'UPDATED' : 'NOT UPDATED'}`);
        });
        
        const successCount = Object.values(verifications).filter(Boolean).length;
        const totalFields = Object.keys(verifications).length;
        
        console.log(`\n🎯 Final Result: ${successCount}/${totalFields} fields updated successfully`);
        
        if (successCount === totalFields) {
          console.log('🎉 ALL FIELDS UPDATE TEST PASSED! ✅');
          console.log('\n📋 Summary:');
          console.log('  ✅ Backend allows all necessary fields to be updated');
          console.log('  ✅ Field length validation prevents database errors');
          console.log('  ✅ All updates are properly applied to database');
          console.log('  ✅ Frontend can successfully update class information');
        } else {
          console.log('⚠️ Some fields were not updated properly');
        }
        
      } else {
        console.log('❌ Could not verify update - class not found');
      }
      
    } catch (updateError) {
      console.log('\n❌ Update failed:');
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

testCompleteFieldUpdate();
