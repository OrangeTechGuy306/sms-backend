const { executeQuery, executeTransaction } = require('../config/database');
const { hashPassword, generateRandomPassword } = require('../utils/password');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// =============================================
// TEACHER DASHBOARD SPECIFIC ENDPOINTS
// =============================================

/**
 * Get teacher dashboard data
 * @route GET /api/teacher-portal/dashboard
 * @access Private (Teacher only - own data)
 */
async function getTeacherDashboard(req, res) {
  try {
    const userId = req.user.id;

    // Get teacher basic info with department details
    const teacherQuery = `
      SELECT
        t.id,
        t.teacher_id,
        t.employee_id,
        t.joining_date,
        t.department,
        t.designation,
        t.qualification,
        t.experience_years,
        t.status,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.profile_picture,
        ay.name as academic_year
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN academic_years ay ON ay.is_current = TRUE
      WHERE t.user_id = ? AND t.status = 'active'
    `;

    const teacherData = await executeQuery(teacherQuery, [userId]);

    if (teacherData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher record not found'
      });
    }

    const teacher = teacherData[0];

    // Get assigned classes count
    const classesQuery = `
      SELECT COUNT(DISTINCT c.id) as total_classes
      FROM classes c
      WHERE c.class_teacher_id = ? AND c.status = 'active'
    `;
    const classesData = await executeQuery(classesQuery, [userId]);

    // Get assigned subjects
    const subjectsQuery = `
      SELECT COUNT(DISTINCT ts.subject_id) as total_subjects
      FROM teacher_subjects ts
      WHERE ts.teacher_id = ?
    `;
    const subjectsData = await executeQuery(subjectsQuery, [teacher.id]);

    // Get total students under teacher's classes
    const studentsQuery = `
      SELECT COUNT(DISTINCT s.id) as total_students
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.class_teacher_id = ? AND s.status = 'active'
    `;
    const studentsData = await executeQuery(studentsQuery, [userId]);

    // Get today's attendance summary for teacher's classes
    const attendanceQuery = `
      SELECT
        COUNT(*) as total_marked,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        ROUND((SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_rate
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      WHERE c.class_teacher_id = ?
        AND a.attendance_date = CURDATE()
    `;
    const attendanceData = await executeQuery(attendanceQuery, [userId]);

    // Get pending assessments
    const assessmentsQuery = `
      SELECT COUNT(*) as pending_assessments
      FROM assessments a
      WHERE a.created_by = ?
        AND a.status = 'draft'
        AND a.due_date >= CURDATE()
    `;
    const assessmentsData = await executeQuery(assessmentsQuery, [userId]);

    // Get recent lesson notes
    const lessonNotesQuery = `
      SELECT
        ln.id,
        ln.title,
        ln.lesson_date,
        s.name as subject_name,
        c.name as class_name
      FROM lesson_notes ln
      JOIN subjects s ON ln.subject_id = s.id
      JOIN classes c ON ln.class_id = c.id
      WHERE ln.teacher_id = ?
      ORDER BY ln.lesson_date DESC, ln.created_at DESC
      LIMIT 5
    `;
    const recentLessonNotes = await executeQuery(lessonNotesQuery, [userId]);

    // Get upcoming events
    const eventsQuery = `
      SELECT
        id,
        title,
        description,
        event_date,
        event_time,
        location,
        event_type
      FROM events
      WHERE event_date >= CURDATE()
        AND (target_audience = 'all' OR target_audience = 'teachers')
      ORDER BY event_date ASC
      LIMIT 5
    `;
    const upcomingEvents = await executeQuery(eventsQuery);

    // Get unread messages count
    const messagesQuery = `
      SELECT COUNT(*) as unread_count
      FROM messages
      WHERE recipient_id = ?
        AND is_read = FALSE
        AND deleted_at IS NULL
    `;
    const messageData = await executeQuery(messagesQuery, [userId]);

    res.json({
      success: true,
      message: 'Teacher dashboard data retrieved successfully',
      data: {
        teacher: teacher,
        statistics: {
          total_classes: classesData[0].total_classes,
          total_subjects: subjectsData[0].total_subjects,
          total_students: studentsData[0].total_students,
          pending_assessments: assessmentsData[0].pending_assessments
        },
        attendance_today: attendanceData[0] || {
          total_marked: 0,
          present_count: 0,
          absent_count: 0,
          attendance_rate: 0
        },
        recent_lesson_notes: recentLessonNotes,
        upcoming_events: upcomingEvents,
        unread_messages: messageData[0].unread_count
      }
    });

  } catch (error) {
    logger.error('Error fetching teacher dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
}

/**
 * Get teacher profile
 * @route GET /api/teacher-portal/profile
 * @access Private (Teacher only - own data)
 */
async function getTeacherProfile(req, res) {
  try {
    const userId = req.user.id;

    const profileQuery = `
      SELECT
        t.id,
        t.teacher_id,
        t.employee_id,
        t.joining_date,
        t.department,
        t.designation,
        t.qualification,
        t.specialization,
        t.experience_years,
        t.previous_experience,
        t.salary,
        t.emergency_contact_name,
        t.emergency_contact_phone,
        t.emergency_contact_relation,
        t.status,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.date_of_birth,
        u.gender,
        u.address,
        u.profile_picture
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.user_id = ? AND t.status = 'active'
    `;

    const profileData = await executeQuery(profileQuery, [userId]);

    if (profileData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found'
      });
    }

    res.json({
      success: true,
      message: 'Teacher profile retrieved successfully',
      data: profileData[0]
    });

  } catch (error) {
    logger.error('Error fetching teacher profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile data'
    });
  }
}

/**
 * Update teacher profile (limited fields)
 * @route PUT /api/teacher-portal/profile
 * @access Private (Teacher only - own data)
 */
async function updateTeacherProfile(req, res) {
  try {
    const userId = req.user.id;
    const {
      phone,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relation,
      qualification,
      specialization
    } = req.body;

    // Start transaction
    const connection = await executeTransaction();

    try {
      // Update users table
      if (phone || address) {
        const userUpdateQuery = `
          UPDATE users
          SET phone = COALESCE(?, phone),
              address = COALESCE(?, address),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        await connection.execute(userUpdateQuery, [phone, address, userId]);
      }

      // Update teachers table
      const teacherUpdateQuery = `
        UPDATE teachers
        SET emergency_contact_name = COALESCE(?, emergency_contact_name),
            emergency_contact_phone = COALESCE(?, emergency_contact_phone),
            emergency_contact_relation = COALESCE(?, emergency_contact_relation),
            qualification = COALESCE(?, qualification),
            specialization = COALESCE(?, specialization),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `;

      await connection.execute(teacherUpdateQuery, [
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relation,
        qualification,
        specialization,
        userId
      ]);

      await connection.commit();

      res.json({
        success: true,
        message: 'Profile updated successfully'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    logger.error('Error updating teacher profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
}

/**
 * Get teacher's assigned classes
 * @route GET /api/teacher-portal/classes
 * @access Private (Teacher only - own data)
 */
async function getTeacherClasses(req, res) {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get classes where teacher is class teacher
    const classTeacherQuery = `
      SELECT
        c.id,
        c.uuid,
        c.name,
        c.grade_level,
        c.section,
        c.capacity,
        c.current_strength,
        c.room_number,
        ay.name as academic_year,
        'class_teacher' as role,
        COUNT(s.id) as student_count
      FROM classes c
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN students s ON c.id = s.class_id AND s.status = 'active'
      WHERE c.class_teacher_id = ? AND c.status = 'active'
      GROUP BY c.id
    `;

    // Get classes where teacher teaches subjects
    const subjectTeacherQuery = `
      SELECT DISTINCT
        c.id,
        c.uuid,
        c.name,
        c.grade_level,
        c.section,
        c.capacity,
        c.current_strength,
        c.room_number,
        ay.name as academic_year,
        'subject_teacher' as role,
        COUNT(s.id) as student_count,
        GROUP_CONCAT(DISTINCT sub.name) as subjects
      FROM classes c
      JOIN class_subjects cs ON c.id = cs.class_id
      JOIN teacher_subjects ts ON cs.subject_id = ts.subject_id
      JOIN teachers t ON ts.teacher_id = t.id
      JOIN subjects sub ON ts.subject_id = sub.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN students s ON c.id = s.class_id AND s.status = 'active'
      WHERE t.user_id = ? AND c.status = 'active'
      GROUP BY c.id
    `;

    const [classTeacherData, subjectTeacherData] = await Promise.all([
      executeQuery(classTeacherQuery, [userId]),
      executeQuery(subjectTeacherQuery, [userId])
    ]);

    // Combine and deduplicate classes
    const classesMap = new Map();

    classTeacherData.forEach(cls => {
      classesMap.set(cls.id, cls);
    });

    subjectTeacherData.forEach(cls => {
      if (classesMap.has(cls.id)) {
        // Teacher is both class teacher and subject teacher
        classesMap.get(cls.id).role = 'class_and_subject_teacher';
        classesMap.get(cls.id).subjects = cls.subjects;
      } else {
        classesMap.set(cls.id, cls);
      }
    });

    const allClasses = Array.from(classesMap.values());
    const total = allClasses.length;
    const paginatedClasses = allClasses.slice(offset, offset + parseInt(limit));
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      message: 'Teacher classes retrieved successfully',
      data: paginatedClasses,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    logger.error('Error fetching teacher classes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch classes'
    });
  }
}

/**
 * Get teacher's assigned subjects
 * @route GET /api/teacher-portal/subjects
 * @access Private (Teacher only - own data)
 */
async function getTeacherSubjects(req, res) {
  try {
    const userId = req.user.id;

    // Get teacher ID first
    const teacherQuery = `SELECT id FROM teachers WHERE user_id = ? AND status = 'active'`;
    const teacherData = await executeQuery(teacherQuery, [userId]);

    if (teacherData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher record not found'
      });
    }

    const teacherId = teacherData[0].id;

    const subjectsQuery = `
      SELECT
        s.id,
        s.uuid,
        s.name,
        s.code,
        s.description,
        s.department,
        s.credit_hours,
        s.is_mandatory,
        COUNT(DISTINCT cs.class_id) as classes_count,
        GROUP_CONCAT(DISTINCT c.name) as class_names
      FROM subjects s
      JOIN teacher_subjects ts ON s.id = ts.subject_id
      LEFT JOIN class_subjects cs ON s.id = cs.subject_id
      LEFT JOIN classes c ON cs.class_id = c.id AND c.status = 'active'
      WHERE ts.teacher_id = ? AND s.status = 'active'
      GROUP BY s.id
      ORDER BY s.name ASC
    `;

    const subjects = await executeQuery(subjectsQuery, [teacherId]);

    res.json({
      success: true,
      message: 'Teacher subjects retrieved successfully',
      data: subjects
    });

  } catch (error) {
    logger.error('Error fetching teacher subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subjects'
    });
  }
}

/**
 * Get students under teacher's classes
 * @route GET /api/teacher-portal/students
 * @access Private (Teacher only - own data)
 */
async function getTeacherStudents(req, res) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      class_id,
      search = '',
      status = 'active'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    // Build WHERE clause
    let whereConditions = ['s.status = ?'];
    let queryParams = [status];

    if (search) {
      whereConditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR st.student_id LIKE ? OR u.email LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (class_id && isValidUUID(class_id)) {
      whereConditions.push('c.uuid = ?');
      queryParams.push(class_id);
    }

    // Add teacher access condition (either class teacher or subject teacher)
    whereConditions.push(`(
      c.class_teacher_id = ? OR
      EXISTS (
        SELECT 1 FROM teacher_subjects ts
        JOIN class_subjects cs ON ts.subject_id = cs.subject_id
        JOIN teachers t ON ts.teacher_id = t.id
        WHERE cs.class_id = c.id AND t.user_id = ?
      )
    )`);
    queryParams.push(userId, userId);

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN students st ON s.id = st.id
      JOIN classes c ON s.class_id = c.id
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get students
    const studentsQuery = `
      SELECT DISTINCT
        s.id,
        st.student_id,
        st.roll_number,
        st.admission_number,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.profile_picture,
        c.name as class_name,
        c.grade_level,
        c.section,
        s.status,
        st.admission_date
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN students st ON s.id = st.id
      JOIN classes c ON s.class_id = c.id
      WHERE ${whereClause}
      ORDER BY u.first_name ASC, u.last_name ASC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);
    const students = await executeQuery(studentsQuery, queryParams);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      message: 'Students retrieved successfully',
      data: students,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    logger.error('Error fetching teacher students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students'
    });
  }
}

/**
 * Get teacher's timetable/schedule
 * @route GET /api/teacher-portal/timetable
 * @access Private (Teacher only - own data)
 */
async function getTeacherTimetable(req, res) {
  try {
    const userId = req.user.id;

    // Get teacher ID
    const teacherQuery = `SELECT id FROM teachers WHERE user_id = ? AND status = 'active'`;
    const teacherData = await executeQuery(teacherQuery, [userId]);

    if (teacherData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher record not found'
      });
    }

    const teacherId = teacherData[0].id;

    // Get teacher's timetable periods
    const timetableQuery = `
      SELECT
        tp.id,
        tp.day_of_week,
        tp.period_number,
        tp.start_time,
        tp.end_time,
        tp.break_after,
        tp.room_number,
        s.name as subject_name,
        s.code as subject_code,
        c.name as class_name,
        c.grade_level,
        c.section,
        t.name as timetable_name
      FROM timetable_periods tp
      JOIN timetables t ON tp.timetable_id = t.id
      JOIN subjects s ON tp.subject_id = s.id
      JOIN classes c ON t.class_id = c.id
      WHERE tp.teacher_id = ?
        AND t.status = 'active'
        AND (t.effective_from <= CURDATE() OR t.effective_from IS NULL)
        AND (t.effective_to >= CURDATE() OR t.effective_to IS NULL)
      ORDER BY
        FIELD(tp.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
        tp.period_number ASC
    `;

    const periods = await executeQuery(timetableQuery, [userId]);

    // Group periods by day
    const groupedPeriods = periods.reduce((acc, period) => {
      if (!acc[period.day_of_week]) {
        acc[period.day_of_week] = [];
      }
      acc[period.day_of_week].push(period);
      return acc;
    }, {});

    res.json({
      success: true,
      message: 'Teacher timetable retrieved successfully',
      data: {
        periods: groupedPeriods,
        total_periods: periods.length
      }
    });

  } catch (error) {
    logger.error('Error fetching teacher timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timetable'
    });
  }
}

/**
 * Get attendance records for teacher's classes
 * @route GET /api/teacher-portal/attendance
 * @access Private (Teacher only - own data)
 */
async function getTeacherAttendance(req, res) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      class_id,
      subject_id,
      date_from,
      date_to,
      status
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    let whereConditions = [`(
      c.class_teacher_id = ? OR
      EXISTS (
        SELECT 1 FROM teacher_subjects ts
        JOIN teachers t ON ts.teacher_id = t.id
        WHERE ts.subject_id = a.subject_id AND t.user_id = ?
      )
    )`];
    let queryParams = [userId, userId];

    if (class_id && isValidUUID(class_id)) {
      whereConditions.push('c.uuid = ?');
      queryParams.push(class_id);
    }

    if (subject_id && isValidUUID(subject_id)) {
      whereConditions.push('s.uuid = ?');
      queryParams.push(subject_id);
    }

    if (date_from) {
      whereConditions.push('a.attendance_date >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('a.attendance_date <= ?');
      queryParams.push(date_to);
    }

    if (status) {
      whereConditions.push('a.status = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM attendance a
      JOIN students st ON a.student_id = st.id
      JOIN users u ON st.user_id = u.id
      JOIN classes c ON a.class_id = c.id
      LEFT JOIN subjects s ON a.subject_id = s.id
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get attendance records
    const attendanceQuery = `
      SELECT
        a.id,
        a.attendance_date,
        a.period_number,
        a.status,
        a.check_in_time,
        a.check_out_time,
        a.remarks,
        a.marked_at,
        CONCAT(u.first_name, ' ', u.last_name) as student_name,
        st.student_id,
        st.roll_number,
        c.name as class_name,
        c.grade_level,
        s.name as subject_name,
        s.code as subject_code
      FROM attendance a
      JOIN students st ON a.student_id = st.id
      JOIN users u ON st.user_id = u.id
      JOIN classes c ON a.class_id = c.id
      LEFT JOIN subjects s ON a.subject_id = s.id
      WHERE ${whereClause}
      ORDER BY a.attendance_date DESC, a.period_number ASC, u.first_name ASC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);
    const attendanceRecords = await executeQuery(attendanceQuery, queryParams);

    // Get attendance statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
        ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_rate
      FROM attendance a
      JOIN students st ON a.student_id = st.id
      JOIN classes c ON a.class_id = c.id
      LEFT JOIN subjects s ON a.subject_id = s.id
      WHERE ${whereClause}
    `;

    const statsResult = await executeQuery(statsQuery, queryParams.slice(0, -2));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      message: 'Attendance records retrieved successfully',
      data: attendanceRecords,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      statistics: statsResult[0] || {
        total_records: 0,
        present_count: 0,
        absent_count: 0,
        late_count: 0,
        attendance_rate: 0
      }
    });

  } catch (error) {
    logger.error('Error fetching teacher attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records'
    });
  }
}

/**
 * Get teacher's assessments
 * @route GET /api/teacher-portal/assessments
 * @access Private (Teacher only - own data)
 */
async function getTeacherAssessments(req, res) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      status,
      assessment_type,
      subject_id,
      class_id
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    let whereConditions = ['a.created_by = ?'];
    let queryParams = [userId];

    if (status) {
      whereConditions.push('a.status = ?');
      queryParams.push(status);
    }

    if (assessment_type) {
      whereConditions.push('a.assessment_type = ?');
      queryParams.push(assessment_type);
    }

    if (subject_id && isValidUUID(subject_id)) {
      whereConditions.push('s.uuid = ?');
      queryParams.push(subject_id);
    }

    if (class_id && isValidUUID(class_id)) {
      whereConditions.push('c.uuid = ?');
      queryParams.push(class_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM assessments a
      LEFT JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN classes c ON a.class_id = c.id
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get assessments
    const assessmentsQuery = `
      SELECT
        a.id,
        a.uuid,
        a.name,
        a.description,
        a.assessment_type,
        a.total_marks,
        a.duration_minutes,
        a.due_date,
        a.status,
        a.instructions,
        a.created_at,
        s.name as subject_name,
        s.code as subject_code,
        c.name as class_name,
        c.grade_level,
        COUNT(DISTINCT aq.id) as question_count,
        COUNT(DISTINCT asub.id) as submission_count
      FROM assessments a
      LEFT JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN classes c ON a.class_id = c.id
      LEFT JOIN assessment_questions aq ON a.id = aq.assessment_id
      LEFT JOIN assessment_submissions asub ON a.id = asub.assessment_id
      WHERE ${whereClause}
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);
    const assessments = await executeQuery(assessmentsQuery, queryParams);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      message: 'Assessments retrieved successfully',
      data: assessments,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    logger.error('Error fetching teacher assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assessments'
    });
  }
}

/**
 * Get teacher's lesson notes
 * @route GET /api/teacher-portal/lesson-notes
 * @access Private (Teacher only - own data)
 */
async function getTeacherLessonNotes(req, res) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      subject_id,
      class_id,
      date_from,
      date_to
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    let whereConditions = ['ln.teacher_id = ?'];
    let queryParams = [userId];

    if (subject_id && isValidUUID(subject_id)) {
      whereConditions.push('s.uuid = ?');
      queryParams.push(subject_id);
    }

    if (class_id && isValidUUID(class_id)) {
      whereConditions.push('c.uuid = ?');
      queryParams.push(class_id);
    }

    if (date_from) {
      whereConditions.push('ln.lesson_date >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('ln.lesson_date <= ?');
      queryParams.push(date_to);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM lesson_notes ln
      JOIN subjects s ON ln.subject_id = s.id
      JOIN classes c ON ln.class_id = c.id
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get lesson notes
    const lessonNotesQuery = `
      SELECT
        ln.id,
        ln.uuid,
        ln.title,
        ln.content,
        ln.lesson_date,
        ln.period_number,
        ln.objectives,
        ln.materials_needed,
        ln.homework_assigned,
        ln.status,
        ln.created_at,
        ln.updated_at,
        s.name as subject_name,
        s.code as subject_code,
        c.name as class_name,
        c.grade_level,
        c.section
      FROM lesson_notes ln
      JOIN subjects s ON ln.subject_id = s.id
      JOIN classes c ON ln.class_id = c.id
      WHERE ${whereClause}
      ORDER BY ln.lesson_date DESC, ln.period_number ASC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);
    const lessonNotes = await executeQuery(lessonNotesQuery, queryParams);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      message: 'Lesson notes retrieved successfully',
      data: lessonNotes,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    logger.error('Error fetching teacher lesson notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lesson notes'
    });
  }
}

/**
 * Get results for teacher's subjects/classes
 * @route GET /api/teacher-portal/results
 * @access Private (Teacher only - own data)
 */
async function getTeacherResults(req, res) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      subject_id,
      class_id,
      assessment_id,
      student_id
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause - teacher can see results for their subjects/assessments
    let whereConditions = [`(
      a.created_by = ? OR
      EXISTS (
        SELECT 1 FROM teacher_subjects ts
        JOIN teachers t ON ts.teacher_id = t.id
        WHERE ts.subject_id = r.subject_id AND t.user_id = ?
      )
    )`];
    let queryParams = [userId, userId];

    if (subject_id && isValidUUID(subject_id)) {
      whereConditions.push('s.uuid = ?');
      queryParams.push(subject_id);
    }

    if (class_id && isValidUUID(class_id)) {
      whereConditions.push('c.uuid = ?');
      queryParams.push(class_id);
    }

    if (assessment_id && isValidUUID(assessment_id)) {
      whereConditions.push('a.uuid = ?');
      queryParams.push(assessment_id);
    }

    if (student_id && isValidUUID(student_id)) {
      whereConditions.push('st.uuid = ?');
      queryParams.push(student_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM results r
      JOIN students st ON r.student_id = st.id
      JOIN users u ON st.user_id = u.id
      JOIN subjects s ON r.subject_id = s.id
      JOIN assessments a ON r.assessment_id = a.id
      LEFT JOIN classes c ON st.class_id = c.id
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get results
    const resultsQuery = `
      SELECT
        r.id,
        r.uuid,
        r.marks_obtained,
        r.total_marks,
        r.grade,
        r.percentage,
        r.remarks,
        r.exam_date,
        r.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as student_name,
        st.student_id,
        st.roll_number,
        s.name as subject_name,
        s.code as subject_code,
        a.name as assessment_name,
        a.assessment_type,
        c.name as class_name,
        c.grade_level
      FROM results r
      JOIN students st ON r.student_id = st.id
      JOIN users u ON st.user_id = u.id
      JOIN subjects s ON r.subject_id = s.id
      JOIN assessments a ON r.assessment_id = a.id
      LEFT JOIN classes c ON st.class_id = c.id
      WHERE ${whereClause}
      ORDER BY r.exam_date DESC, u.first_name ASC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);
    const results = await executeQuery(resultsQuery, queryParams);

    // Get statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_results,
        AVG(r.percentage) as average_percentage,
        MAX(r.percentage) as highest_percentage,
        MIN(r.percentage) as lowest_percentage,
        COUNT(CASE WHEN r.grade IN ('A+', 'A') THEN 1 END) as excellent_count,
        COUNT(CASE WHEN r.grade IN ('B+', 'B') THEN 1 END) as good_count,
        COUNT(CASE WHEN r.grade IN ('C+', 'C') THEN 1 END) as average_count,
        COUNT(CASE WHEN r.grade IN ('D', 'F') THEN 1 END) as below_average_count
      FROM results r
      JOIN students st ON r.student_id = st.id
      JOIN users u ON st.user_id = u.id
      JOIN subjects s ON r.subject_id = s.id
      JOIN assessments a ON r.assessment_id = a.id
      LEFT JOIN classes c ON st.class_id = c.id
      WHERE ${whereClause}
    `;

    const statsResult = await executeQuery(statsQuery, queryParams.slice(0, -2));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      message: 'Results retrieved successfully',
      data: results,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      statistics: statsResult[0] || {
        total_results: 0,
        average_percentage: 0,
        highest_percentage: 0,
        lowest_percentage: 0,
        excellent_count: 0,
        good_count: 0,
        average_count: 0,
        below_average_count: 0
      }
    });

  } catch (error) {
    logger.error('Error fetching teacher results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch results'
    });
  }
}

/**
 * Get all teachers with pagination and filtering
 */
async function getTeachers(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      department_id = '',
      status = '',
      sort_by = 'first_name',
      sort_order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(t.first_name LIKE ? OR t.last_name LIKE ? OR t.teacher_id LIKE ? OR u.email LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (department_id && isValidUUID(department_id)) {
      whereConditions.push('t.department_id = ?');
      queryParams.push(department_id);
    }

    if (status) {
      whereConditions.push('t.status = ?');
      queryParams.push(status);
    }

    // Validate sort parameters
    const allowedSortFields = ['first_name', 'last_name', 'teacher_id', 'joining_date', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'first_name';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM teachers t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get teachers
    const teachersQuery = `
      SELECT 
        t.id,
        t.teacher_id,
        t.first_name,
        t.last_name,
        t.middle_name,
        t.date_of_birth,
        t.gender,
        t.phone,
        t.qualification,
        t.experience_years,
        t.specialization,
        t.joining_date,
        t.status,
        t.created_at,
        u.email,
        d.name as department_name,
        CONCAT(t.first_name, ' ', t.last_name) as full_name
      FROM teachers t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE ${whereClause}
      ORDER BY t.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const teachers = await executeQuery(teachersQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: {
        teachers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (error) {
    logger.error('Get teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve teachers'
    });
  }
}

/**
 * Get teacher by ID
 */
async function getTeacherById(req, res) {
  try {
    const { id } = req.params;

    // Validate ID format (accept both UUID and integer)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isInteger = /^\d+$/.test(id);

    if (!isUUID && !isInteger) {
      return res.status(400).json({
        success: false,
        message: 'Invalid teacher ID format'
      });
    }

    const teacherQuery = `
      SELECT 
        t.*,
        u.email,
        u.status as user_status,
        u.last_login,
        d.name as department_name,
        CONCAT(t.first_name, ' ', t.last_name) as full_name
      FROM teachers t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.id = ?
    `;

    const teachers = await executeQuery(teacherQuery, [id]);

    if (teachers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    const teacher = teachers[0];

    // Get assigned subjects and classes
    const subjectsQuery = `
      SELECT 
        s.id as subject_id,
        s.name as subject_name,
        s.code as subject_code,
        c.id as class_id,
        c.name as class_name,
        gl.name as grade_level,
        ts.is_primary,
        ay.name as academic_year
      FROM teacher_subjects ts
      JOIN subjects s ON ts.subject_id = s.id
      JOIN classes c ON ts.class_id = c.id
      JOIN grade_levels gl ON c.grade_level_id = gl.id
      JOIN academic_years ay ON ts.academic_year_id = ay.id
      WHERE ts.teacher_id = ?
      ORDER BY s.name, c.name
    `;

    const subjects = await executeQuery(subjectsQuery, [id]);

    res.json({
      success: true,
      data: {
        teacher,
        subjects
      }
    });

  } catch (error) {
    logger.error('Get teacher by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve teacher'
    });
  }
}

/**
 * Create new teacher
 */
async function createTeacher(req, res) {
  try {
    const teacherData = sanitizeInput(req.body);
    
    const {
      email,
      firstName,
      lastName,
      middleName = '',
      dateOfBirth,
      gender,
      phone = '',
      address = '',
      qualification = '',
      experienceYears = 0,
      specialization = '',
      joiningDate,
      salary = null,
      departmentId = null,
      generatePassword = true,
      password = ''
    } = teacherData;

    // Validate required fields
    if (!email || !firstName || !lastName || !joiningDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, firstName, lastName, joiningDate'
      });
    }

    // Check if email already exists
    const existingUser = await executeQuery('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Generate teacher ID if not provided
    let teacherId = teacherData.teacherId;
    if (!teacherId) {
      const currentYear = new Date().getFullYear();
      const countResult = await executeQuery('SELECT COUNT(*) as count FROM teachers WHERE teacher_id LIKE ?', [`TCH-${currentYear}%`]);
      const nextNumber = (countResult[0].count + 1).toString().padStart(4, '0');
      teacherId = `TCH-${currentYear}${nextNumber}`;
    }

    // Check if teacher ID already exists
    const existingTeacher = await executeQuery('SELECT id FROM teachers WHERE teacher_id = ?', [teacherId]);
    if (existingTeacher.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Teacher ID already exists'
      });
    }

    // Generate password if needed
    const finalPassword = generatePassword ? generateRandomPassword(12) : password;
    if (!finalPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    const hashedPassword = await hashPassword(finalPassword);
    const userUuid = uuidv4();

    // Create user and teacher in transaction
    const queries = [
      {
        query: `INSERT INTO users (uuid, email, password_hash, user_type, first_name, last_name, date_of_birth, gender, phone, address, status, email_verified) VALUES (?, ?, ?, 'teacher', ?, ?, ?, ?, ?, ?, 'active', TRUE)`,
        params: [userUuid, email, hashedPassword, firstName, lastName, dateOfBirth, gender, phone, address]
      },
      {
        query: `INSERT INTO teachers (
          user_id, teacher_id, first_name, last_name, middle_name, date_of_birth, gender,
          phone, address, qualification, experience_years, specialization, joining_date,
          salary, department_id
        ) VALUES (
          LAST_INSERT_ID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )`,
        params: [
          teacherId, firstName, lastName, middleName, dateOfBirth, gender,
          phone, address, qualification, experienceYears, specialization, joiningDate,
          salary, departmentId
        ]
      }
    ];

    await executeTransaction(queries);

    // Get the created teacher
    const newTeacher = await executeQuery('SELECT id FROM teachers WHERE teacher_id = ?', [teacherId]);

    logger.info(`Teacher created: ${teacherId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: {
        teacherId: newTeacher[0].id,
        generatedPassword: generatePassword ? finalPassword : undefined
      }
    });

  } catch (error) {
    logger.error('Create teacher error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Teacher with this email or teacher ID already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create teacher'
    });
  }
}

/**
 * Update teacher
 */
async function updateTeacher(req, res) {
  try {
    const { id } = req.params;
    const updates = sanitizeInput(req.body);

    // Validate ID format (accept both UUID and integer)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isInteger = /^\d+$/.test(id);

    if (!isUUID && !isInteger) {
      return res.status(400).json({
        success: false,
        message: 'Invalid teacher ID format'
      });
    }

    // Check if teacher exists
    const existingTeacher = await executeQuery('SELECT user_id FROM teachers WHERE id = ?', [id]);
    if (existingTeacher.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Remove fields that shouldn't be updated via this endpoint
    delete updates.id;
    delete updates.user_id;
    delete updates.teacher_id;
    delete updates.created_at;
    delete updates.updated_at;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Build update query
    const allowedFields = [
      'first_name', 'last_name', 'middle_name', 'date_of_birth', 'gender',
      'phone', 'address', 'qualification', 'experience_years', 'specialization',
      'salary', 'department_id', 'status'
    ];

    const updateFields = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map(key => `${key} = ?`);

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const updateQuery = `
      UPDATE teachers 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const queryParams = [
      ...Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .map(key => updates[key]),
      id
    ];

    await executeQuery(updateQuery, queryParams);

    logger.info(`Teacher updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Teacher updated successfully'
    });

  } catch (error) {
    logger.error('Update teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update teacher'
    });
  }
}

/**
 * Delete teacher
 */
async function deleteTeacher(req, res) {
  try {
    const { id } = req.params;

    // Validate ID format (accept both UUID and integer)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isInteger = /^\d+$/.test(id);

    if (!isUUID && !isInteger) {
      return res.status(400).json({
        success: false,
        message: 'Invalid teacher ID format'
      });
    }

    // Check if teacher exists and get user_id
    const existingTeacher = await executeQuery('SELECT user_id, teacher_id FROM teachers WHERE id = ?', [id]);
    if (existingTeacher.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    const { user_id, teacher_id } = existingTeacher[0];

    // Check for dependencies
    const dependencyChecks = [
      { table: 'teacher_subjects', message: 'Teacher has subject assignments' },
      { table: 'student_results', column: 'teacher_id', message: 'Teacher has recorded results' },
      { table: 'classes', column: 'class_teacher_id', message: 'Teacher is assigned as class teacher' }
    ];

    for (const check of dependencyChecks) {
      const column = check.column || 'teacher_id';
      const result = await executeQuery(`SELECT COUNT(*) as count FROM ${check.table} WHERE ${column} = ?`, [id]);
      if (result[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete teacher: ${check.message}`
        });
      }
    }

    // Delete teacher and user in transaction
    const queries = [
      { query: 'DELETE FROM teachers WHERE id = ?', params: [id] },
      { query: 'DELETE FROM users WHERE id = ?', params: [user_id] }
    ];

    await executeTransaction(queries);

    logger.info(`Teacher deleted: ${teacher_id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Teacher deleted successfully'
    });

  } catch (error) {
    logger.error('Delete teacher error:', error);
    
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete teacher: Teacher has related records'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete teacher'
    });
  }
}

module.exports = {
  // Admin functions
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,

  // Teacher dashboard functions
  getTeacherDashboard,
  getTeacherProfile,
  updateTeacherProfile,
  getTeacherClasses,
  getTeacherSubjects,
  getTeacherStudents,
  getTeacherTimetable,
  getTeacherAttendance,
  getTeacherAssessments,
  getTeacherLessonNotes,
  getTeacherResults
};
