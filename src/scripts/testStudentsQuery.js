const { executeQuery, connectDatabase } = require('../config/database');

async function testStudentsQuery() {
  try {
    await connectDatabase();
    
    console.log('🔍 Testing simple students query...');
    
    // Test 1: Simple query without parameters
    const simpleQuery = `
      SELECT COUNT(*) as total
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level = gl.name
      WHERE 1=1
    `;
    
    console.log('Query 1 (count):');
    console.log(simpleQuery);
    const result1 = await executeQuery(simpleQuery, []);
    console.log('Result 1:', result1);

    // Test 2: Query with LIMIT and OFFSET (different syntax)
    const limitQuery = `
      SELECT
        s.id,
        s.student_id,
        u.first_name,
        u.last_name,
        u.email
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
      ORDER BY u.first_name ASC
      LIMIT ?, ?
    `;

    console.log('\nQuery 2 (with limit):');
    console.log(limitQuery);
    console.log('Parameters: [0, 10]');
    const result2 = await executeQuery(limitQuery, [0, 10]);
    console.log('Result 2:', result2);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

testStudentsQuery();
