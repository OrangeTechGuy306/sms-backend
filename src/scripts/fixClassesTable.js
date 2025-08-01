const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'school_management_system'
};

async function fixClassesTable() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🏫 Fixing classes table structure...');
    
    // First, let's check the current structure
    const [currentColumns] = await connection.execute('DESCRIBE classes');
    console.log('\n📋 Current classes table structure:');
    currentColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    // Check if grade_level_id column exists
    const hasGradeLevelId = currentColumns.some(col => col.Field === 'grade_level_id');
    
    if (!hasGradeLevelId) {
      console.log('\n➕ Adding grade_level_id column...');
      await connection.execute('ALTER TABLE classes ADD COLUMN grade_level_id VARCHAR(36)');
      
      // Map existing grade_level values to grade_level_id
      console.log('🔄 Mapping existing grade levels to IDs...');
      
      // Get all grade levels
      const [gradeLevels] = await connection.execute('SELECT id, name, level_number FROM grade_levels ORDER BY level_number');
      
      // Update classes with grade_level_id based on grade_level name
      for (const gradeLevel of gradeLevels) {
        await connection.execute(
          'UPDATE classes SET grade_level_id = ? WHERE grade_level = ?',
          [gradeLevel.id, gradeLevel.name]
        );
        
        // Also try to match by level number patterns
        const levelPatterns = [
          `Grade ${gradeLevel.level_number - 3}`, // For Grade 1-12
          gradeLevel.name,
          gradeLevel.name.toLowerCase(),
          gradeLevel.name.toUpperCase()
        ];
        
        for (const pattern of levelPatterns) {
          await connection.execute(
            'UPDATE classes SET grade_level_id = ? WHERE grade_level = ? AND grade_level_id IS NULL',
            [gradeLevel.id, pattern]
          );
        }
      }
      
      // Set a default grade level for any remaining null values
      const [defaultGrade] = await connection.execute('SELECT id FROM grade_levels ORDER BY level_number LIMIT 1');
      if (defaultGrade.length > 0) {
        await connection.execute(
          'UPDATE classes SET grade_level_id = ? WHERE grade_level_id IS NULL',
          [defaultGrade[0].id]
        );
      }
    } else {
      console.log('✅ grade_level_id column already exists');
    }
    
    // Check if academic_year_id is properly set
    console.log('\n📅 Checking academic_year_id values...');
    const [nullAcademicYears] = await connection.execute('SELECT COUNT(*) as count FROM classes WHERE academic_year_id IS NULL');
    
    if (nullAcademicYears[0].count > 0) {
      console.log(`🔄 Setting academic year for ${nullAcademicYears[0].count} classes...`);
      
      // Get the current academic year
      const [currentAcademicYear] = await connection.execute('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
      
      if (currentAcademicYear.length > 0) {
        await connection.execute(
          'UPDATE classes SET academic_year_id = ? WHERE academic_year_id IS NULL',
          [currentAcademicYear[0].id]
        );
      }
    }
    
    // Verify the fix
    console.log('\n🔍 Verifying the fix...');
    
    const [testQuery] = await connection.execute(`
      SELECT 
        c.id,
        c.name,
        c.grade_level,
        gl.name as grade_level_name,
        gl.level_number,
        ay.name as academic_year_name
      FROM classes c
      LEFT JOIN grade_levels gl ON c.grade_level_id = gl.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LIMIT 5
    `);
    
    console.log('\n📊 Sample classes with joined data:');
    testQuery.forEach(row => {
      console.log(`  - ${row.name}: ${row.grade_level} -> ${row.grade_level_name} (Level ${row.level_number}) - ${row.academic_year_name}`);
    });
    
    // Count total classes
    const [totalClasses] = await connection.execute('SELECT COUNT(*) as count FROM classes');
    console.log(`\n📈 Total classes in database: ${totalClasses[0].count}`);
    
    console.log('\n🎉 Classes table fix completed successfully!');
    console.log('🚀 The classes controller should now work properly.');
    
  } catch (error) {
    console.error('❌ Error fixing classes table:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
console.log('🔧 School Management System - Classes Table Fix');
console.log('===============================================');
fixClassesTable();
