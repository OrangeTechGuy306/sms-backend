const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'school_management_system'
};

async function fixForeignKeyConstraints() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 Checking current foreign key constraints...');
    
    // Check current constraints on classes table
    const [constraints] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'school_management_system' 
        AND TABLE_NAME = 'classes' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    console.log('📋 Current foreign key constraints on classes table:');
    constraints.forEach(constraint => {
      console.log(`  - ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
    });
    
    // Drop problematic foreign key constraints
    console.log('\n🗑️ Dropping problematic foreign key constraints...');
    
    for (const constraint of constraints) {
      if (constraint.REFERENCED_TABLE_NAME === 'academic_years_new' || 
          constraint.REFERENCED_TABLE_NAME === 'grade_levels_new') {
        try {
          console.log(`   Dropping constraint: ${constraint.CONSTRAINT_NAME}`);
          await connection.execute(`ALTER TABLE classes DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}`);
        } catch (error) {
          console.log(`   ⚠️ Could not drop ${constraint.CONSTRAINT_NAME}: ${error.message}`);
        }
      }
    }
    
    // Disable foreign key checks temporarily
    console.log('\n🔓 Disabling foreign key checks...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // Remove any invalid foreign key constraints
    console.log('🧹 Cleaning up invalid constraints...');
    
    try {
      await connection.execute('ALTER TABLE classes DROP FOREIGN KEY classes_ibfk_1');
      console.log('   ✅ Dropped classes_ibfk_1');
    } catch (error) {
      console.log('   ⚠️ classes_ibfk_1 may not exist:', error.message);
    }
    
    try {
      await connection.execute('ALTER TABLE classes DROP FOREIGN KEY classes_ibfk_2');
      console.log('   ✅ Dropped classes_ibfk_2');
    } catch (error) {
      console.log('   ⚠️ classes_ibfk_2 may not exist:', error.message);
    }
    
    // Re-enable foreign key checks
    console.log('\n🔒 Re-enabling foreign key checks...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    // Verify the fix by checking constraints again
    console.log('\n🔍 Verifying constraint cleanup...');
    const [newConstraints] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'school_management_system' 
        AND TABLE_NAME = 'classes' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    console.log('📋 Remaining foreign key constraints on classes table:');
    if (newConstraints.length === 0) {
      console.log('   ✅ No foreign key constraints (clean slate)');
    } else {
      newConstraints.forEach(constraint => {
        console.log(`  - ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
      });
    }
    
    console.log('\n🎉 Foreign key constraint cleanup completed!');
    console.log('✅ Classes table should now accept inserts without constraint errors');
    
  } catch (error) {
    console.error('❌ Error fixing foreign key constraints:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
console.log('🔧 School Management System - Fix Foreign Key Constraints');
console.log('=========================================================');
fixForeignKeyConstraints();
