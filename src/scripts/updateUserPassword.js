const { executeQuery, connectDatabase } = require('../config/database');
const { hashPassword } = require('../utils/password');

async function updateUserPassword() {
  try {
    await connectDatabase();
    
    const email = 'admin@school.com';
    const newPassword = 'admin123';
    
    console.log('🔄 Updating password for:', email);
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    console.log('✅ Password hashed');
    
    // Update the user's password
    const result = await executeQuery(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [hashedPassword, email]
    );
    
    if (result.affectedRows > 0) {
      console.log('✅ Password updated successfully');
      console.log('📧 Email:', email);
      console.log('🔑 Password: admin123');
    } else {
      console.log('❌ No user found with that email');
    }
    
  } catch (error) {
    console.error('❌ Error updating password:', error);
  } finally {
    process.exit(0);
  }
}

updateUserPassword();
