const { executeQuery, connectDatabase } = require('../config/database');
const logger = require('../utils/logger');

async function testStudentDetailEndpoint() {
  try {
    await connectDatabase();
    logger.info('Testing student detail endpoint...');

    // First, let's see what students exist
    const studentsQuery = `
      SELECT 
        s.id,
        s.student_id,
        u.first_name,
        u.last_name,
        u.email
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      LIMIT 5
    `;

    const students = await executeQuery(studentsQuery);
    console.log('Available students:');
    console.table(students);

    if (students.length === 0) {
      console.log('No students found in database');
      return;
    }

    // Test the student detail query with the first student
    const testStudentId = students[0].id;
    console.log(`\nTesting with student ID: ${testStudentId}`);

    const studentDetailQuery = `
      SELECT
        s.*,
        u.first_name,
        u.last_name,
        u.date_of_birth,
        u.gender,
        u.phone,
        u.address,
        u.email,
        u.profile_picture,
        u.status as user_status,
        u.last_login,
        c.name as class_name,
        c.grade_level,
        ay.name as academic_year,
        CONCAT(u.first_name, ' ', u.last_name) as full_name
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      WHERE s.id = ?
    `;

    const studentDetail = await executeQuery(studentDetailQuery, [testStudentId]);
    console.log('\nStudent detail result:');
    console.table(studentDetail);

    // Test parent query
    const parentsQuery = `
      SELECT
        p.id,
        u.first_name,
        u.last_name,
        sp.relationship,
        u.phone,
        p.office_phone as work_phone,
        p.occupation,
        u.address,
        sp.is_primary_contact as is_primary,
        u.email
      FROM parents p
      JOIN student_parents sp ON p.id = sp.parent_id
      JOIN users u ON p.user_id = u.id
      WHERE sp.student_id = ?
      ORDER BY sp.is_primary_contact DESC
    `;

    const parents = await executeQuery(parentsQuery, [testStudentId]);
    console.log('\nParent data:');
    console.table(parents);

    // Test academic data query
    const gradesQuery = `
      SELECT 
        ar.id,
        ar.marks_obtained as score,
        a.total_marks as max_score,
        ar.grade,
        ar.percentage,
        ar.remarks,
        ar.created_at as exam_date,
        s.name as subject_name,
        s.code as subject_code,
        a.type as assessment_type,
        ay.name as academic_year
      FROM assessment_results ar
      LEFT JOIN assessments a ON ar.assessment_id = a.id
      LEFT JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
      WHERE ar.student_id = ?
      ORDER BY ar.created_at DESC
      LIMIT 10
    `;

    const grades = await executeQuery(gradesQuery, [testStudentId]);
    console.log('\nGrades data:');
    console.table(grades);

    // Test attendance query
    const attendanceQuery = `
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
        ROUND((SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_percentage
      FROM attendance 
      WHERE student_id = ?
      AND attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `;

    const attendance = await executeQuery(attendanceQuery, [testStudentId]);
    console.log('\nAttendance data:');
    console.table(attendance);

    console.log('\n✅ Student detail endpoint test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('Student detail test error:', error);
  }
}

// Run the test
testStudentDetailEndpoint();
