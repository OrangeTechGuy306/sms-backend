const { executeQuery, connectDatabase } = require('../config/database');
const { comparePassword } = require('../utils/password');

async function checkUser() {
  try {
    await connectDatabase();
    
    const email = 'admin@school.com';
    const password = 'admin123';
    
    console.log('🔍 Checking user:', email);
    
    // Get user with password hash
    const userQuery = `
      SELECT id, email, password_hash, user_type, first_name, last_name, status, last_login
      FROM users
      WHERE email = ?
    `;
    
    const users = await executeQuery(userQuery, [email]);
    
    if (users.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = users[0];
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      user_type: user.user_type,
      status: user.status,
      first_name: user.first_name,
      last_name: user.last_name,
      has_password_hash: !!user.password_hash,
      password_hash_length: user.password_hash?.length
    });
    
    // Check password
    console.log('🔑 Testing password...');
    const isPasswordValid = await comparePassword(password, user.password_hash);
    console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ Password does not match');
    } else {
      console.log('✅ Password matches');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkUser();
