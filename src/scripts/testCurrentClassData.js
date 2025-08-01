const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testCurrentClassData() {
  try {
    console.log('🧪 Testing Current Class Data Structure');
    console.log('======================================');
    
    // Login to get token
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@admin.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Login successful');
    
    // Get classes to see current structure
    console.log('\n📚 Getting current classes...');
    const classesResponse = await axios.get(`${API_BASE_URL}/classes`, { headers });
    
    if (classesResponse.data.data.classes.length === 0) {
      console.log('❌ No classes found');
      return;
    }
    
    const firstClass = classesResponse.data.data.classes[0];
    console.log('\n🔍 First class structure:');
    console.log(JSON.stringify(firstClass, null, 2));
    
    console.log('\n📋 Field analysis for frontend transformation:');
    console.log('Fields that will be used in edit modal:');
    console.log(`  - id: "${firstClass.id}" (${typeof firstClass.id})`);
    console.log(`  - name: "${firstClass.name}" (${typeof firstClass.name})`);
    console.log(`  - level (from grade_level): "${firstClass.grade_level}" (${typeof firstClass.grade_level})`);
    console.log(`  - section: "${firstClass.section}" (${typeof firstClass.section})`);
    console.log(`  - capacity: ${firstClass.capacity} (${typeof firstClass.capacity})`);
    console.log(`  - enrolled (from student_count): ${firstClass.student_count} (${typeof firstClass.student_count})`);
    console.log(`  - classTeacher (from class_teacher_name): "${firstClass.class_teacher_name}" (${typeof firstClass.class_teacher_name})`);
    console.log(`  - room (from room_number): "${firstClass.room_number}" (${typeof firstClass.room_number})`);
    console.log(`  - status: "${firstClass.status}" (${typeof firstClass.status})`);
    console.log(`  - academicYear (from academic_year): "${firstClass.academic_year}" (${typeof firstClass.academic_year})`);
    
    console.log('\n⚠️ Validation checks:');
    console.log(`  - name not empty: ${!!firstClass.name}`);
    console.log(`  - grade_level not empty: ${!!firstClass.grade_level}`);
    console.log(`  - capacity > 0: ${firstClass.capacity > 0}`);
    console.log(`  - room_number not empty: ${!!firstClass.room_number}`);
    console.log(`  - academic_year not empty: ${!!firstClass.academic_year}`);
    
    // Simulate the transformation
    console.log('\n🔄 Simulated transformation result:');
    const transformed = {
      id: firstClass.id || '',
      name: firstClass.name || '',
      level: firstClass.grade_level || 'Not specified',
      section: firstClass.section || '',
      capacity: firstClass.capacity || 0,
      enrolled: firstClass.student_count || 0,
      classTeacher: firstClass.class_teacher_name || '',
      subjects: [],
      room: firstClass.room_number || '',
      schedule: '',
      status: firstClass.status || "active",
      academicYear: firstClass.academic_year || ''
    };
    
    console.log(JSON.stringify(transformed, null, 2));
    
    console.log('\n✅ Validation checks on transformed data:');
    console.log(`  - name not empty: ${!!transformed.name}`);
    console.log(`  - level not empty: ${!!transformed.level}`);
    console.log(`  - capacity > 0: ${transformed.capacity > 0}`);
    console.log(`  - room not empty: ${!!transformed.room}`);
    console.log(`  - academicYear not empty: ${!!transformed.academicYear}`);
    
    const validationPassed = !!(
      transformed.name &&
      transformed.level &&
      transformed.capacity > 0 &&
      transformed.room &&
      transformed.academicYear
    );
    
    console.log(`\n🎯 Overall validation result: ${validationPassed ? '✅ PASS' : '❌ FAIL'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCurrentClassData();
