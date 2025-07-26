const { executeQuery } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function createSampleData() {
  try {
    console.log('🚀 Creating sample data for testing...');
    
    // 1. Create academic year if not exists
    console.log('\n1. Creating academic year...');
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    
    const existingAcademicYear = await executeQuery('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
    
    let academicYearId;
    if (existingAcademicYear.length === 0) {
      const academicYearResult = await executeQuery(`
        INSERT INTO academic_years (name, start_date, end_date, is_current, status) 
        VALUES (?, ?, ?, TRUE, 'active')
      `, [`${currentYear}-${nextYear}`, `${currentYear}-09-01`, `${nextYear}-06-30`]);
      academicYearId = academicYearResult.insertId;
      console.log('✅ Academic year created:', `${currentYear}-${nextYear}`);
    } else {
      academicYearId = existingAcademicYear[0].id;
      console.log('✅ Using existing academic year');
    }
    
    // 2. Create sample subjects
    console.log('\n2. Creating sample subjects...');
    const subjects = [
      { name: 'Mathematics', code: 'MATH', description: 'Mathematics and problem solving' },
      { name: 'English Language', code: 'ENG', description: 'English language and literature' },
      { name: 'Science', code: 'SCI', description: 'General science and experiments' },
      { name: 'Social Studies', code: 'SS', description: 'History, geography and civics' },
      { name: 'Physical Education', code: 'PE', description: 'Sports and physical fitness' }
    ];
    
    for (const subject of subjects) {
      const existingSubject = await executeQuery('SELECT id FROM subjects WHERE code = ?', [subject.code]);
      if (existingSubject.length === 0) {
        await executeQuery(`
          INSERT INTO subjects (uuid, name, code, description, status, created_by) 
          VALUES (?, ?, ?, ?, 'active', 1)
        `, [uuidv4(), subject.name, subject.code, subject.description]);
        console.log(`✅ Subject created: ${subject.name}`);
      } else {
        console.log(`⏭️  Subject already exists: ${subject.name}`);
      }
    }
    
    // 3. Create sample classes
    console.log('\n3. Creating sample classes...');
    const classes = [
      { name: 'Grade 1A', grade_level: '1', section: 'A', capacity: 30 },
      { name: 'Grade 1B', grade_level: '1', section: 'B', capacity: 30 },
      { name: 'Grade 2A', grade_level: '2', section: 'A', capacity: 30 },
      { name: 'Grade 2B', grade_level: '2', section: 'B', capacity: 30 },
      { name: 'Grade 3A', grade_level: '3', section: 'A', capacity: 30 },
      { name: 'Grade 4A', grade_level: '4', section: 'A', capacity: 30 },
      { name: 'Grade 5A', grade_level: '5', section: 'A', capacity: 30 }
    ];
    
    for (const classData of classes) {
      const existingClass = await executeQuery('SELECT id FROM classes WHERE name = ?', [classData.name]);
      if (existingClass.length === 0) {
        await executeQuery(`
          INSERT INTO classes (uuid, name, grade_level, section, academic_year_id, capacity, status, created_by) 
          VALUES (?, ?, ?, ?, ?, ?, 'active', 1)
        `, [uuidv4(), classData.name, classData.grade_level, classData.section, academicYearId, classData.capacity]);
        console.log(`✅ Class created: ${classData.name}`);
      } else {
        console.log(`⏭️  Class already exists: ${classData.name}`);
      }
    }
    
    // 4. Show created data
    console.log('\n📊 Sample data summary:');
    
    const academicYears = await executeQuery('SELECT COUNT(*) as count FROM academic_years');
    console.log(`- Academic years: ${academicYears[0].count}`);
    
    const subjectsCount = await executeQuery('SELECT COUNT(*) as count FROM subjects');
    console.log(`- Subjects: ${subjectsCount[0].count}`);
    
    const classesCount = await executeQuery('SELECT COUNT(*) as count FROM classes');
    console.log(`- Classes: ${classesCount[0].count}`);
    
    // 5. Show class UUIDs for frontend
    console.log('\n🔑 Class UUIDs for frontend:');
    const allClasses = await executeQuery('SELECT uuid, name FROM classes ORDER BY name');
    allClasses.forEach(cls => {
      console.log(`- ${cls.name}: ${cls.uuid}`);
    });
    
    console.log('\n🎉 Sample data creation completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Update the frontend form to use these class UUIDs');
    console.log('2. Or fetch classes dynamically from the API');
    console.log('3. Try creating a student again');
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error.message);
    console.error('Full error:', error);
  }
}

// Run the script
createSampleData();
