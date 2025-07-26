const { executeQuery, executeTransaction } = require('../config/database');
const { hashPassword } = require('../utils/password');
const { v4: uuidv4 } = require('uuid');

async function testAdminCreation() {
  try {
    console.log('🧪 Testing admin creation...');
    
    // Test data
    const testAdmin = {
      email: 'test-admin@school.com',
      firstName: 'Test',
      lastName: 'Admin',
      phone: '+1234567890',
      role: 'Super Admin'
    };
    
    // Generate UUID and hash password
    const userUuid = uuidv4();
    const hashedPassword = await hashPassword('password123');
    
    console.log('✅ Generated UUID:', userUuid);
    console.log('✅ Generated password hash');
    
    // Check if user already exists
    const existingUser = await executeQuery('SELECT id FROM users WHERE email = ?', [testAdmin.email]);
    if (existingUser.length > 0) {
      console.log('🗑️  Removing existing test user...');
      await executeQuery('DELETE FROM users WHERE email = ?', [testAdmin.email]);
    }
    
    // Create user and assign admin role in transaction
    const queries = [
      {
        query: `INSERT INTO users (uuid, email, password_hash, user_type, first_name, last_name, phone, status, email_verified) VALUES (?, ?, ?, 'admin', ?, ?, ?, 'active', TRUE)`,
        params: [userUuid, testAdmin.email, hashedPassword, testAdmin.firstName, testAdmin.lastName, testAdmin.phone]
      },
      {
        query: `INSERT INTO user_roles (user_id, role_id) VALUES (LAST_INSERT_ID(), (SELECT id FROM roles WHERE name = ? LIMIT 1))`,
        params: [testAdmin.role]
      }
    ];
    
    console.log('🔄 Executing transaction...');
    await executeTransaction(queries);
    
    // Verify the user was created
    const newUser = await executeQuery(`
      SELECT 
        u.id, u.uuid, u.email, u.first_name, u.last_name, u.user_type, u.status,
        GROUP_CONCAT(r.name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.email = ?
      GROUP BY u.id
    `, [testAdmin.email]);
    
    if (newUser.length > 0) {
      console.log('🎉 Admin user created successfully!');
      console.log('📊 User details:', {
        id: newUser[0].id,
        uuid: newUser[0].uuid,
        email: newUser[0].email,
        name: `${newUser[0].first_name} ${newUser[0].last_name}`,
        type: newUser[0].user_type,
        status: newUser[0].status,
        roles: newUser[0].roles
      });
      
      // Clean up test user
      console.log('🧹 Cleaning up test user...');
      await executeQuery('DELETE FROM users WHERE email = ?', [testAdmin.email]);
      console.log('✅ Test completed successfully!');
      
    } else {
      console.log('❌ Failed to create admin user');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testAdminCreation();
