const { executeQuery, executeTransaction, connectDatabase } = require('../config/database');
const { hashPassword } = require('../utils/password');
const { v4: uuidv4 } = require('uuid');

async function createTestUser() {
  // Initialize database connection
  await connectDatabase();
  try {
    console.log('🧪 Creating test admin user...');
    
    // Test data
    const testAdmin = {
      email: 'admin@school.com',
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1234567890'
    };
    
    // Generate UUID and hash password
    const userUuid = uuidv4();
    const hashedPassword = await hashPassword('admin123');
    
    console.log('✅ Generated UUID:', userUuid);
    console.log('✅ Generated password hash');
    
    // Check if user already exists
    const existingUser = await executeQuery('SELECT id FROM users WHERE email = ?', [testAdmin.email]);
    if (existingUser.length > 0) {
      console.log('👤 Test user already exists!');
      console.log('📧 Email:', testAdmin.email);
      console.log('🔑 Password: admin123');
      return;
    }
    
    // Create user
    const result = await executeQuery(`
      INSERT INTO users (uuid, email, password_hash, user_type, first_name, last_name, phone, status, email_verified) 
      VALUES (?, ?, ?, 'admin', ?, ?, ?, 'active', TRUE)
    `, [userUuid, testAdmin.email, hashedPassword, testAdmin.firstName, testAdmin.lastName, testAdmin.phone]);
    
    console.log('🎉 Admin user created successfully!');
    console.log('📧 Email:', testAdmin.email);
    console.log('🔑 Password: admin123');
    console.log('👤 User ID:', result.insertId);
    
  } catch (error) {
    console.error('❌ Failed to create test user:', error.message);
    console.error('Full error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
createTestUser();
