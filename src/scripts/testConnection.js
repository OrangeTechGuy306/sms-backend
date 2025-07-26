const { connectDatabase, executeQuery } = require('../config/database');
const logger = require('../utils/logger');

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connection successful');
    
    // Test a simple query
    const result = await executeQuery('SELECT 1 as test');
    console.log('✅ Database query test successful:', result);
    
    // Test creating a simple table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS test_table (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50)
      )
    `);
    console.log('✅ Table creation test successful');
    
    // Clean up test table
    await executeQuery('DROP TABLE IF EXISTS test_table');
    console.log('✅ Table cleanup successful');
    
    console.log('🎉 All database tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testConnection();
