const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testStudentCountAPI() {
  try {
    console.log('🧪 Testing Student Count in Classes API');
    console.log('=======================================');
    
    // Login to get token
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@admin.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Login successful');
    
    // Get classes to check student count
    console.log('\n📚 Getting classes with student count...');
    const classesResponse = await axios.get(`${API_BASE_URL}/classes`, { headers });
    
    if (!classesResponse.data.success) {
      console.log('❌ Failed to get classes:', classesResponse.data.message);
      return;
    }
    
    const classes = classesResponse.data.data.classes;
    console.log(`✅ Retrieved ${classes.length} classes`);
    
    console.log('\n📊 Student count for each class:');
    classes.forEach(cls => {
      const enrolled = cls.student_count || 0;
      const capacity = cls.capacity || 0;
      const percentage = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
      
      console.log(`  📋 ${cls.name}:`);
      console.log(`     - ID: ${cls.id}`);
      console.log(`     - Enrolled: ${enrolled}/${capacity} (${percentage}%)`);
      console.log(`     - Status: ${cls.status}`);
      console.log(`     - Grade: ${cls.grade_level || 'Not specified'}`);
      console.log('');
    });
    
    // Find classes with students
    const classesWithStudents = classes.filter(cls => (cls.student_count || 0) > 0);
    
    if (classesWithStudents.length > 0) {
      console.log('🎉 SUCCESS: Found classes with enrolled students!');
      console.log(`   ${classesWithStudents.length} classes have students enrolled`);
      
      classesWithStudents.forEach(cls => {
        console.log(`   ✅ ${cls.name}: ${cls.student_count}/${cls.capacity} students`);
      });
      
      console.log('\n📱 Frontend Display:');
      console.log('   The classes table should now show the correct enrolled counts');
      console.log('   instead of 0/capacity for all classes.');
      
    } else {
      console.log('⚠️ No classes have enrolled students yet');
      console.log('   All classes will still show 0/capacity in the frontend');
    }
    
    // Test specific class that we know has students (ID: 5)
    console.log('\n🔍 Testing specific class with students...');
    const testClassId = 5;
    const testClass = classes.find(cls => cls.id === testClassId);
    
    if (testClass) {
      console.log(`📋 Test class: ${testClass.name}`);
      console.log(`📊 Student count: ${testClass.student_count}`);
      console.log(`📊 Capacity: ${testClass.capacity}`);
      console.log(`📊 Display: ${testClass.student_count}/${testClass.capacity}`);
      
      if (testClass.student_count > 0) {
        console.log('✅ Student count is working correctly!');
      } else {
        console.log('❌ Student count is still 0 - there might be an issue');
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

testStudentCountAPI();
