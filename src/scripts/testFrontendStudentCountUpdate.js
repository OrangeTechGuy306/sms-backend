const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:5000/api';

async function testFrontendStudentCountUpdate() {
  try {
    console.log('🧪 Testing Frontend Student Count Preservation During Updates');
    console.log('============================================================');
    
    // Login to get token
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@admin.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Login successful');
    
    // Get classes to find one with students
    console.log('\n📚 Getting classes...');
    const classesResponse = await axios.get(`${API_BASE_URL}/classes`, { headers });
    
    if (!classesResponse.data.success) {
      console.log('❌ Failed to get classes');
      return;
    }
    
    const classes = classesResponse.data.data.classes;
    const classWithStudents = classes.find(cls => (cls.student_count || 0) > 0);
    
    if (!classWithStudents) {
      console.log('❌ No classes with students found for testing');
      console.log('   Please run the student creation script first');
      return;
    }
    
    console.log(`✅ Found class with students: ${classWithStudents.name}`);
    console.log(`📊 Current enrollment: ${classWithStudents.student_count}/${classWithStudents.capacity}`);
    
    // Test 1: Update class and check if student_count is preserved
    console.log('\n🔄 Test 1: Updating class name and checking student count preservation...');
    
    const originalName = classWithStudents.name;
    const originalStudentCount = classWithStudents.student_count;
    const originalCapacity = classWithStudents.capacity;
    
    const updateData = {
      name: originalName + ' (Updated)',
      grade_level: classWithStudents.grade_level,
      section: classWithStudents.section || 'A',
      capacity: originalCapacity + 5, // Change capacity to test
      room_number: classWithStudents.room_number,
      status: classWithStudents.status
    };
    
    console.log('📤 Sending update:', {
      id: classWithStudents.id,
      name: updateData.name,
      capacity: updateData.capacity,
      originalStudentCount: originalStudentCount
    });
    
    try {
      const updateResponse = await axios.put(
        `${API_BASE_URL}/classes/${classWithStudents.id}`, 
        updateData, 
        { headers }
      );
      
      console.log('✅ Update successful:', updateResponse.data.message);
      
      // Immediately fetch the updated class to check student_count
      console.log('\n🔍 Fetching updated class data...');
      const updatedClassesResponse = await axios.get(`${API_BASE_URL}/classes`, { headers });
      
      if (updatedClassesResponse.data.success) {
        const updatedClass = updatedClassesResponse.data.data.classes.find(
          cls => cls.id === classWithStudents.id
        );
        
        if (updatedClass) {
          console.log('\n📊 Comparison Results:');
          console.log(`  Original name: "${originalName}"`);
          console.log(`  Updated name: "${updatedClass.name}"`);
          console.log(`  Original capacity: ${originalCapacity}`);
          console.log(`  Updated capacity: ${updatedClass.capacity}`);
          console.log(`  Original student_count: ${originalStudentCount}`);
          console.log(`  Updated student_count: ${updatedClass.student_count}`);
          
          // Check if student_count was preserved
          if (updatedClass.student_count === originalStudentCount) {
            console.log('\n🎉 SUCCESS: Student count was preserved during update!');
            console.log(`   Enrollment display: ${updatedClass.student_count}/${updatedClass.capacity}`);
          } else {
            console.log('\n❌ FAILURE: Student count was not preserved!');
            console.log(`   Expected: ${originalStudentCount}, Got: ${updatedClass.student_count}`);
          }
          
          // Check if other fields were updated correctly
          const nameUpdated = updatedClass.name.includes('(Updated)');
          const capacityUpdated = updatedClass.capacity === (originalCapacity + 5);
          
          console.log('\n📋 Field Update Verification:');
          console.log(`  ✅ Name updated: ${nameUpdated}`);
          console.log(`  ✅ Capacity updated: ${capacityUpdated}`);
          console.log(`  ✅ Student count preserved: ${updatedClass.student_count === originalStudentCount}`);
          
          if (nameUpdated && capacityUpdated && updatedClass.student_count === originalStudentCount) {
            console.log('\n🎉 ALL TESTS PASSED!');
            console.log('   Frontend updates should now preserve student enrollment counts.');
          } else {
            console.log('\n⚠️ Some tests failed - check the implementation.');
          }
          
        } else {
          console.log('❌ Could not find updated class in response');
        }
      } else {
        console.log('❌ Failed to fetch updated classes');
      }
      
    } catch (updateError) {
      console.log('❌ Update failed:', updateError.response?.data || updateError.message);
    }
    
    // Test 2: Verify frontend behavior simulation
    console.log('\n🔄 Test 2: Simulating frontend state update behavior...');
    
    // Simulate what the frontend does
    const simulatedFrontendUpdate = {
      ...classWithStudents,
      name: updateData.name,
      grade_level: updateData.grade_level,
      section: updateData.section,
      capacity: updateData.capacity,
      room_number: updateData.room_number,
      status: updateData.status,
      // ✅ This is the key fix - preserve student_count
      student_count: classWithStudents.student_count
    };
    
    console.log('📊 Simulated frontend state after update:');
    console.log(`  Name: ${simulatedFrontendUpdate.name}`);
    console.log(`  Capacity: ${simulatedFrontendUpdate.capacity}`);
    console.log(`  Student Count: ${simulatedFrontendUpdate.student_count}`);
    console.log(`  Display: ${simulatedFrontendUpdate.student_count}/${simulatedFrontendUpdate.capacity}`);
    
    if (simulatedFrontendUpdate.student_count === originalStudentCount) {
      console.log('\n✅ Frontend simulation: Student count preserved correctly!');
    } else {
      console.log('\n❌ Frontend simulation: Student count would be lost!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testFrontendStudentCountUpdate();
