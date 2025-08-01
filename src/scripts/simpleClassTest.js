const axios = require('axios');

async function simpleTest() {
  try {
    console.log('🧪 Testing classes endpoint...');
    
    // Test GET without auth (should get auth error, not database error)
    try {
      const response = await axios.get('http://localhost:5000/api/classes');
      console.log('❌ Unexpected success:', response.status);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ GET /api/classes returns 401 (auth required) - Database is working!');
      } else if (error.response && error.response.status === 500) {
        console.log('❌ GET /api/classes returns 500 - Database error still exists');
        console.log('Error:', error.response.data);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

simpleTest();
