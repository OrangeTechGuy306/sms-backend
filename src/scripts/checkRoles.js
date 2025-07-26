const { executeQuery } = require('../config/database');

async function checkRoles() {
  try {
    console.log('🔍 Checking roles in database...');
    
    // Check if roles table exists and has data
    const roles = await executeQuery('SELECT * FROM roles ORDER BY id');
    
    if (roles.length === 0) {
      console.log('❌ No roles found in database!');
      console.log('🔧 Inserting default roles...');
      
      // Insert default roles
      await executeQuery(`
        INSERT IGNORE INTO roles (name, description, is_system_role, permissions) VALUES
        ('Super Admin', 'Full system access', TRUE, '["*"]'),
        ('Principal', 'School administration access', TRUE, '["users.*", "academic.*", "reports.*"]'),
        ('Vice Principal', 'Assistant administration access', TRUE, '["academic.*", "students.*", "teachers.*"]'),
        ('Teacher', 'Teaching and class management', TRUE, '["classes.*", "students.read", "grades.*", "attendance.*"]'),
        ('Student', 'Student portal access', TRUE, '["profile.read", "grades.read", "attendance.read"]'),
        ('Parent', 'Parent portal access', TRUE, '["children.*", "fees.*", "communication.*"]'),
        ('Librarian', 'Library management', TRUE, '["library.*", "books.*"]'),
        ('Accountant', 'Financial management', TRUE, '["fees.*", "payments.*", "financial_reports.*"]')
      `);
      
      console.log('✅ Default roles inserted');
      
      // Check again
      const newRoles = await executeQuery('SELECT * FROM roles ORDER BY id');
      console.log(`📊 Found ${newRoles.length} roles:`);
      newRoles.forEach(role => {
        console.log(`   - ${role.id}: ${role.name} (${role.description})`);
      });
      
    } else {
      console.log(`✅ Found ${roles.length} roles in database:`);
      roles.forEach(role => {
        console.log(`   - ${role.id}: ${role.name} (${role.description})`);
      });
    }
    
    // Test role lookup
    console.log('\n🧪 Testing role lookup...');
    const testRoles = ['Super Admin', 'Principal', 'Teacher'];
    
    for (const roleName of testRoles) {
      const roleResult = await executeQuery('SELECT id, name FROM roles WHERE name = ? LIMIT 1', [roleName]);
      if (roleResult.length > 0) {
        console.log(`✅ Found role "${roleName}": ID ${roleResult[0].id}`);
      } else {
        console.log(`❌ Role "${roleName}" not found!`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking roles:', error.message);
    console.error('Full error:', error);
  }
}

// Run the check
checkRoles();
