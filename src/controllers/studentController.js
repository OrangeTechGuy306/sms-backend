const { executeQuery, executeTransaction } = require('../config/database');
const { hashPassword, generateRandomPassword } = require('../utils/password');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// =============================================
// STUDENT DASHBOARD SPECIFIC ENDPOINTS
// =============================================

/**
 * Get student dashboard data
 * @route GET /api/students/dashboard
 * @access Private (Student only - own data)
 */
async function getStudentDashboard(req, res) {
  try {
    const userId = req.user.id;

    // Get student basic info with class details
    const studentQuery = `
      SELECT
        s.id,
        s.student_id,
        s.admission_number,
        s.roll_number,
        s.admission_date,
        s.status,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.profile_picture,
        c.name as class_name,
        c.grade_level,
        c.section,
        ay.name as academic_year,
        CONCAT(ct.first_name, ' ', ct.last_name) as class_teacher_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN users ct ON c.class_teacher_id = ct.id
      WHERE s.user_id = ? AND s.status = 'active'
    `;

    const studentData = await executeQuery(studentQuery, [userId]);

    if (studentData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    const student = studentData[0];

    // Get attendance summary for current month
    const attendanceQuery = `
      SELECT
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
        ROUND((SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_percentage
      FROM attendance
      WHERE student_id = ?
        AND attendance_date >= DATE_FORMAT(NOW(), '%Y-%m-01')
        AND attendance_date <= LAST_DAY(NOW())
    `;

    const attendanceData = await executeQuery(attendanceQuery, [student.id]);

    // Get recent grades/results
    const gradesQuery = `
      SELECT
        r.id,
        r.marks_obtained,
        r.total_marks,
        r.grade,
        r.remarks,
        r.exam_date,
        s.name as subject_name,
        s.code as subject_code,
        a.name as assessment_name,
        a.assessment_type
      FROM results r
      JOIN subjects s ON r.subject_id = s.id
      JOIN assessments a ON r.assessment_id = a.id
      WHERE r.student_id = ?
      ORDER BY r.exam_date DESC
      LIMIT 5
    `;

    const recentGrades = await executeQuery(gradesQuery, [student.id]);

    // Get fee status
    const feeQuery = `
      SELECT
        SUM(amount) as total_fees,
        SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END) as pending_amount,
        COUNT(CASE WHEN payment_status = 'overdue' THEN 1 END) as overdue_count
      FROM fees
      WHERE student_id = ?
        AND academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE)
    `;

    const feeData = await executeQuery(feeQuery, [student.id]);

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
        AND (target_audience = 'all' OR target_audience = 'students' OR FIND_IN_SET('${student.class_name}', target_classes))
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
      message: 'Student dashboard data retrieved successfully',
      data: {
        student: student,
        attendance: attendanceData[0] || {
          total_days: 0,
          present_days: 0,
          absent_days: 0,
          late_days: 0,
          attendance_percentage: 0
        },
        recent_grades: recentGrades,
        fees: feeData[0] || {
          total_fees: 0,
          paid_amount: 0,
          pending_amount: 0,
          overdue_count: 0
        },
        upcoming_events: upcomingEvents,
        unread_messages: messageData[0].unread_count
      }
    });

  } catch (error) {
    logger.error('Error fetching student dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
}

/**
 * Get student profile
 * @route GET /api/students/profile
 * @access Private (Student only - own data)
 */
async function getStudentProfile(req, res) {
  try {
    const userId = req.user.id;

    const profileQuery = `
      SELECT
        s.id,
        s.student_id,
        s.admission_number,
        s.roll_number,
        s.admission_date,
        s.blood_group,
        s.nationality,
        s.religion,
        s.category,
        s.mother_tongue,
        s.previous_school,
        s.medical_conditions,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.emergency_contact_relation,
        s.transport_required,
        s.hostel_required,
        s.status,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.date_of_birth,
        u.gender,
        u.address,
        u.profile_picture,
        c.name as class_name,
        c.grade_level,
        c.section,
        ay.name as academic_year
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      WHERE s.user_id = ? AND s.status = 'active'
    `;

    const profileData = await executeQuery(profileQuery, [userId]);

    if (profileData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    res.json({
      success: true,
      message: 'Student profile retrieved successfully',
      data: profileData[0]
    });

  } catch (error) {
    logger.error('Error fetching student profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile data'
    });
  }
}

/**
 * Update student profile (limited fields)
 * @route PUT /api/students/profile
 * @access Private (Student only - own data)
 */
async function updateStudentProfile(req, res) {
  try {
    const userId = req.user.id;
    const {
      phone,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relation,
      medical_conditions
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

      // Update students table
      const studentUpdateQuery = `
        UPDATE students
        SET emergency_contact_name = COALESCE(?, emergency_contact_name),
            emergency_contact_phone = COALESCE(?, emergency_contact_phone),
            emergency_contact_relation = COALESCE(?, emergency_contact_relation),
            medical_conditions = COALESCE(?, medical_conditions),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `;

      await connection.execute(studentUpdateQuery, [
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relation,
        medical_conditions,
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
    logger.error('Error updating student profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
}

/**
 * Get student attendance records
 * @route GET /api/students/attendance
 * @access Private (Student only - own data)
 */
async function getStudentAttendance(req, res) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      month,
      year,
      subject_id
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get student ID
    const studentQuery = `SELECT id FROM students WHERE user_id = ? AND status = 'active'`;
    const studentData = await executeQuery(studentQuery, [userId]);

    if (studentData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    const studentId = studentData[0].id;

    // Build WHERE clause for filtering
    let whereConditions = ['a.student_id = ?'];
    let queryParams = [studentId];

    if (month && year) {
      whereConditions.push('MONTH(a.attendance_date) = ? AND YEAR(a.attendance_date) = ?');
      queryParams.push(parseInt(month), parseInt(year));
    }

    if (subject_id && isValidUUID(subject_id)) {
      whereConditions.push('a.subject_id = (SELECT id FROM subjects WHERE uuid = ?)');
      queryParams.push(subject_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM attendance a
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
        s.name as subject_name,
        s.code as subject_code,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name
      FROM attendance a
      LEFT JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN users t ON a.teacher_id = t.id
      WHERE ${whereClause}
      ORDER BY a.attendance_date DESC, a.period_number ASC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);
    const attendanceRecords = await executeQuery(attendanceQuery, queryParams);

    // Get attendance statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
        ROUND((SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_percentage
      FROM attendance a
      WHERE ${whereClause}
    `;

    const statsResult = await executeQuery(statsQuery, queryParams.slice(0, -2)); // Remove limit and offset

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
        total_days: 0,
        present_days: 0,
        absent_days: 0,
        late_days: 0,
        attendance_percentage: 0
      }
    });

  } catch (error) {
    logger.error('Error fetching student attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records'
    });
  }
}

/**
 * Get student grades/results
 * @route GET /api/students/grades
 * @access Private (Student only - own data)
 */
async function getStudentGrades(req, res) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      subject_id,
      assessment_type,
      academic_year
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get student ID
    const studentQuery = `SELECT id FROM students WHERE user_id = ? AND status = 'active'`;
    const studentData = await executeQuery(studentQuery, [userId]);

    if (studentData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    const studentId = studentData[0].id;

    // Build WHERE clause
    let whereConditions = ['r.student_id = ?'];
    let queryParams = [studentId];

    if (subject_id && isValidUUID(subject_id)) {
      whereConditions.push('s.uuid = ?');
      queryParams.push(subject_id);
    }

    if (assessment_type) {
      whereConditions.push('a.assessment_type = ?');
      queryParams.push(assessment_type);
    }

    if (academic_year) {
      whereConditions.push('ay.name = ?');
      queryParams.push(academic_year);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM results r
      JOIN subjects s ON r.subject_id = s.id
      JOIN assessments a ON r.assessment_id = a.id
      LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get grades
    const gradesQuery = `
      SELECT
        r.id,
        r.marks_obtained,
        r.total_marks,
        r.grade,
        r.percentage,
        r.remarks,
        r.exam_date,
        r.created_at,
        s.name as subject_name,
        s.code as subject_code,
        a.name as assessment_name,
        a.assessment_type,
        a.description as assessment_description,
        ay.name as academic_year,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name
      FROM results r
      JOIN subjects s ON r.subject_id = s.id
      JOIN assessments a ON r.assessment_id = a.id
      LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
      LEFT JOIN users t ON a.created_by = t.id
      WHERE ${whereClause}
      ORDER BY r.exam_date DESC, s.name ASC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);
    const grades = await executeQuery(gradesQuery, queryParams);

    // Get grade statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_assessments,
        AVG(r.percentage) as average_percentage,
        MAX(r.percentage) as highest_percentage,
        MIN(r.percentage) as lowest_percentage,
        SUM(CASE WHEN r.grade IN ('A+', 'A') THEN 1 ELSE 0 END) as excellent_grades,
        SUM(CASE WHEN r.grade IN ('B+', 'B') THEN 1 ELSE 0 END) as good_grades,
        SUM(CASE WHEN r.grade IN ('C+', 'C') THEN 1 ELSE 0 END) as average_grades,
        SUM(CASE WHEN r.grade IN ('D', 'F') THEN 1 ELSE 0 END) as below_average_grades
      FROM results r
      JOIN subjects s ON r.subject_id = s.id
      JOIN assessments a ON r.assessment_id = a.id
      LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
      WHERE ${whereClause}
    `;

    const statsResult = await executeQuery(statsQuery, queryParams.slice(0, -2));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      message: 'Grades retrieved successfully',
      data: grades,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      statistics: statsResult[0] || {
        total_assessments: 0,
        average_percentage: 0,
        highest_percentage: 0,
        lowest_percentage: 0,
        excellent_grades: 0,
        good_grades: 0,
        average_grades: 0,
        below_average_grades: 0
      }
    });

  } catch (error) {
    logger.error('Error fetching student grades:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grades'
    });
  }
}

/**
 * Get student fee records
 * @route GET /api/students/fees
 * @access Private (Student only - own data)
 */
async function getStudentFees(req, res) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      payment_status,
      academic_year
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get student ID
    const studentQuery = `SELECT id FROM students WHERE user_id = ? AND status = 'active'`;
    const studentData = await executeQuery(studentQuery, [userId]);

    if (studentData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    const studentId = studentData[0].id;

    // Build WHERE clause
    let whereConditions = ['f.student_id = ?'];
    let queryParams = [studentId];

    if (payment_status) {
      whereConditions.push('f.payment_status = ?');
      queryParams.push(payment_status);
    }

    if (academic_year) {
      whereConditions.push('ay.name = ?');
      queryParams.push(academic_year);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM fees f
      LEFT JOIN academic_years ay ON f.academic_year_id = ay.id
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get fee records
    const feesQuery = `
      SELECT
        f.id,
        f.fee_type,
        f.amount,
        f.due_date,
        f.payment_status,
        f.payment_date,
        f.payment_method,
        f.transaction_id,
        f.late_fee,
        f.discount,
        f.remarks,
        f.created_at,
        ay.name as academic_year
      FROM fees f
      LEFT JOIN academic_years ay ON f.academic_year_id = ay.id
      WHERE ${whereClause}
      ORDER BY f.due_date DESC, f.created_at DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);
    const fees = await executeQuery(feesQuery, queryParams);

    // Get fee summary
    const summaryQuery = `
      SELECT
        SUM(f.amount) as total_fees,
        SUM(CASE WHEN f.payment_status = 'paid' THEN f.amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN f.payment_status = 'pending' THEN f.amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN f.payment_status = 'overdue' THEN f.amount ELSE 0 END) as overdue_amount,
        SUM(f.late_fee) as total_late_fees,
        SUM(f.discount) as total_discounts,
        COUNT(CASE WHEN f.payment_status = 'overdue' THEN 1 END) as overdue_count
      FROM fees f
      LEFT JOIN academic_years ay ON f.academic_year_id = ay.id
      WHERE ${whereClause}
    `;

    const summaryResult = await executeQuery(summaryQuery, queryParams.slice(0, -2));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      message: 'Fee records retrieved successfully',
      data: fees,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      summary: summaryResult[0] || {
        total_fees: 0,
        paid_amount: 0,
        pending_amount: 0,
        overdue_amount: 0,
        total_late_fees: 0,
        total_discounts: 0,
        overdue_count: 0
      }
    });

  } catch (error) {
    logger.error('Error fetching student fees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee records'
    });
  }
}

/**
 * Get student timetable
 * @route GET /api/students/timetable
 * @access Private (Student only - own data)
 */
async function getStudentTimetable(req, res) {
  try {
    const userId = req.user.id;

    // Get student class information
    const studentQuery = `
      SELECT s.id, s.class_id, c.name as class_name
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.user_id = ? AND s.status = 'active'
    `;
    const studentData = await executeQuery(studentQuery, [userId]);

    if (studentData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    const { class_id, class_name } = studentData[0];

    // Get active timetable for the class
    const timetableQuery = `
      SELECT
        t.id,
        t.name as timetable_name,
        t.effective_from,
        t.effective_to,
        t.status
      FROM timetables t
      WHERE t.class_id = ?
        AND t.status = 'active'
        AND (t.effective_from <= CURDATE() OR t.effective_from IS NULL)
        AND (t.effective_to >= CURDATE() OR t.effective_to IS NULL)
      ORDER BY t.effective_from DESC
      LIMIT 1
    `;

    const timetableData = await executeQuery(timetableQuery, [class_id]);

    if (timetableData.length === 0) {
      return res.json({
        success: true,
        message: 'No active timetable found for your class',
        data: {
          class_name,
          timetable: null,
          periods: []
        }
      });
    }

    const timetable = timetableData[0];

    // Get timetable periods
    const periodsQuery = `
      SELECT
        tp.id,
        tp.day_of_week,
        tp.period_number,
        tp.start_time,
        tp.end_time,
        tp.break_after,
        s.name as subject_name,
        s.code as subject_code,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        tp.room_number
      FROM timetable_periods tp
      LEFT JOIN subjects s ON tp.subject_id = s.id
      LEFT JOIN users t ON tp.teacher_id = t.id
      WHERE tp.timetable_id = ?
      ORDER BY
        FIELD(tp.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
        tp.period_number ASC
    `;

    const periods = await executeQuery(periodsQuery, [timetable.id]);

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
      message: 'Timetable retrieved successfully',
      data: {
        class_name,
        timetable: timetable,
        periods: groupedPeriods
      }
    });

  } catch (error) {
    logger.error('Error fetching student timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timetable'
    });
  }
}

/**
 * Get student subjects
 * @route GET /api/students/subjects
 * @access Private (Student only - own data)
 */
async function getStudentSubjects(req, res) {
  try {
    const userId = req.user.id;

    // Get student class information
    const studentQuery = `
      SELECT s.id, s.class_id, c.grade_level
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.user_id = ? AND s.status = 'active'
    `;
    const studentData = await executeQuery(studentQuery, [userId]);

    if (studentData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    const { class_id, grade_level } = studentData[0];

    // Get subjects for the class
    const subjectsQuery = `
      SELECT DISTINCT
        s.id,
        s.uuid,
        s.name,
        s.code,
        s.description,
        s.department,
        s.credit_hours,
        s.is_mandatory,
        CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
        t.email as teacher_email
      FROM subjects s
      LEFT JOIN class_subjects cs ON s.id = cs.subject_id
      LEFT JOIN teacher_subjects ts ON s.id = ts.subject_id
      LEFT JOIN users t ON ts.teacher_id = t.id
      WHERE (cs.class_id = ? OR JSON_CONTAINS(s.grade_levels, ?))
        AND s.status = 'active'
      ORDER BY s.is_mandatory DESC, s.name ASC
    `;

    const subjects = await executeQuery(subjectsQuery, [class_id, `"${grade_level}"`]);

    res.json({
      success: true,
      message: 'Subjects retrieved successfully',
      data: subjects
    });

  } catch (error) {
    logger.error('Error fetching student subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subjects'
    });
  }
}

/**
 * Get student events
 * @route GET /api/students/events
 * @access Private (Student only)
 */
async function getStudentEvents(req, res) {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      upcoming_only = 'false'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get student class information
    const studentQuery = `
      SELECT s.class_id, c.name as class_name, c.grade_level
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.user_id = ? AND s.status = 'active'
    `;
    const studentData = await executeQuery(studentQuery, [userId]);

    if (studentData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    const { class_name, grade_level } = studentData[0];

    // Build WHERE clause
    let whereConditions = [
      "(target_audience = 'all' OR target_audience = 'students' OR FIND_IN_SET(?, target_classes) OR FIND_IN_SET(?, target_grades))"
    ];
    let queryParams = [class_name, grade_level];

    if (upcoming_only === 'true') {
      whereConditions.push('event_date >= CURDATE()');
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM events
      WHERE ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get events
    const eventsQuery = `
      SELECT
        id,
        title,
        description,
        event_date,
        event_time,
        end_time,
        location,
        event_type,
        target_audience,
        target_classes,
        target_grades,
        is_mandatory,
        registration_required,
        max_participants,
        created_at
      FROM events
      WHERE ${whereClause}
      ORDER BY event_date ASC, event_time ASC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);
    const events = await executeQuery(eventsQuery, queryParams);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      message: 'Events retrieved successfully',
      data: events,
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
    logger.error('Error fetching student events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
}

/**
 * Get all students with pagination and filtering
 */
async function getStudents(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      class_id = '',
      grade_level_id = '',
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
      whereConditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR s.student_id LIKE ? OR u.email LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (class_id && isValidUUID(class_id)) {
      whereConditions.push('s.class_id = ?');
      queryParams.push(class_id);
    }

    if (grade_level_id && isValidUUID(grade_level_id)) {
      whereConditions.push('c.grade_level = ?');
      queryParams.push(grade_level_id);
    }

    if (status) {
      whereConditions.push('s.status = ?');
      queryParams.push(status);
    }

    // Validate sort parameters and map to correct table columns
    const sortFieldMapping = {
      'first_name': 'u.first_name',
      'last_name': 'u.last_name',
      'student_id': 's.student_id',
      'admission_date': 's.admission_date',
      'created_at': 's.created_at',
      'email': 'u.email'
    };

    const allowedSortFields = Object.keys(sortFieldMapping);
    const sortFieldKey = allowedSortFields.includes(sort_by) ? sort_by : 'first_name';
    const sortField = sortFieldMapping[sortFieldKey];
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level = gl.name
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get students
    const studentsQuery = `
      SELECT
        s.id,
        s.student_id,
        u.first_name,
        u.last_name,
        u.date_of_birth,
        u.gender,
        u.phone,
        u.address,
        s.admission_date,
        s.admission_number,
        s.roll_number,
        s.blood_group,
        s.nationality,
        s.religion,
        s.medical_conditions,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.status,
        s.created_at,
        u.email,
        u.profile_picture as passport_photo,
        c.name as class_name,
        gl.name as grade_level,
        ay.name as academic_year,
        CONCAT(u.first_name, ' ', u.last_name) as full_name
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN grade_levels gl ON c.grade_level = gl.name
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      WHERE ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;

    // Execute the students query with fixed LIMIT syntax
    const students = await executeQuery(studentsQuery, queryParams);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: {
        students,
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
    logger.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve students'
    });
  }
}

/**
 * Get student by ID
 */
async function getStudentById(req, res) {
  try {
    const { id } = req.params;

    logger.info(`Getting student by ID: ${id}`);

    // Validate ID format (accept both UUID and integer)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isInteger = /^\d+$/.test(id);

    if (!isUUID && !isInteger) {
      logger.warn(`Invalid student ID format: ${id}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    const studentQuery = `
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

    logger.info(`Executing student query for ID: ${id}`);
    const students = await executeQuery(studentQuery, [id]);

    if (students.length === 0) {
      logger.warn(`Student not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const student = students[0];
    logger.info(`Found student: ${student.first_name} ${student.last_name} (ID: ${student.id})`);

    // Get parent information
    logger.info(`Getting parent information for student ID: ${id}`);
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

    const parents = await executeQuery(parentsQuery, [id]);
    logger.info(`Found ${parents.length} parent(s) for student ID: ${id}`);

    logger.info(`Successfully retrieved student data for ID: ${id}`);

    res.json({
      success: true,
      message: 'Student retrieved successfully',
      data: {
        student,
        parents
      }
    });

  } catch (error) {
    logger.error('Get student by ID error:', error);
    logger.error('Error details:', {
      studentId: req.params.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Create new student
 */
async function createStudent(req, res) {
  try {
    // Validate that res is a proper Express response object
    if (!res || typeof res.status !== 'function') {
      logger.error('Invalid response object passed to createStudent');
      throw new Error('Invalid response object');
    }

    const studentData = sanitizeInput(req.body);
    logger.info('Received student data:', studentData);
    logger.info('Available fields:', Object.keys(studentData));
    
    const {
      email,
      firstName,
      lastName,
      middleName = '',
      dateOfBirth,
      gender,
      bloodGroup = '',
      nationality = '',
      religion = '',
      address = '',
      phone = '',
      guardianName = '',
      guardianPhone = '',
      guardianEmail = '',
      emergencyContactName = '',
      emergencyContactPhone = '',
      emergencyContactRelationship = '',
      admissionDate,
      admissionNumber = '',
      currentClassId,
      academicYearId,
      medicalConditions = '',
      allergies = '',
      generatePassword = true,
      password = '',
      studentId
    } = studentData;

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth || !gender || !admissionDate || !currentClassId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: firstName, lastName, dateOfBirth, gender, admissionDate, currentClassId'
      });
    }

    // Get current academic year if not provided
    let finalAcademicYearId = academicYearId;
    if (!finalAcademicYearId) {
      const currentAcademicYear = await executeQuery('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
      if (currentAcademicYear.length > 0) {
        finalAcademicYearId = currentAcademicYear[0].id;
      } else {
        // Create a default academic year if none exists
        const currentYear = new Date().getFullYear();
        const nextYear = currentYear + 1;
        const defaultAcademicYear = await executeQuery(`
          INSERT INTO academic_years (name, start_date, end_date, is_current, status)
          VALUES (?, ?, ?, TRUE, 'active')
        `, [`${currentYear}-${nextYear}`, `${currentYear}-09-01`, `${nextYear}-06-30`]);
        finalAcademicYearId = defaultAcademicYear.insertId;
      }
    }

    // Check if email already exists (only if email is provided)
    if (email && email.trim()) {
      const existingUser = await executeQuery('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUser.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Generate student ID if not provided
    let finalStudentId = studentId;
    if (!finalStudentId) {
      const currentYear = new Date().getFullYear();
      const countResult = await executeQuery('SELECT COUNT(*) as count FROM students WHERE student_id LIKE ?', [`STU-${currentYear}%`]);
      const nextNumber = (countResult[0].count + 1).toString().padStart(4, '0');
      finalStudentId = `STU-${currentYear}${nextNumber}`;
    }

    // Check if student ID already exists
    const existingStudent = await executeQuery('SELECT id FROM students WHERE student_id = ?', [finalStudentId]);
    if (existingStudent.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Student ID already exists'
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

    // Generate email if not provided
    const finalEmail = email && email.trim() ? email : `${finalStudentId.toLowerCase()}@school.local`;

    // Create user and student in transaction
    logger.info('About to execute transaction with data:', {
      userUuid,
      finalEmail,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      finalStudentId,
      currentClassId
    });

    const queries = [
      {
        query: `INSERT INTO users (uuid, email, password_hash, user_type, first_name, last_name, date_of_birth, gender, phone, address, status, email_verified) VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?, ?, 'active', TRUE)`,
        params: [userUuid, finalEmail, hashedPassword, firstName, lastName, dateOfBirth, gender, phone, address]
      },
      {
        query: `INSERT INTO students (
          user_id, student_id, class_id, admission_number, admission_date,
          blood_group, nationality, religion, medical_conditions,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relation
        ) VALUES (
          LAST_INSERT_ID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )`,
        params: [
          finalStudentId, currentClassId, admissionNumber, admissionDate,
          bloodGroup, nationality, religion, medicalConditions,
          emergencyContactName, emergencyContactPhone, emergencyContactRelationship
        ]
      }
    ];

    await executeTransaction(queries);

    // Get the created student
    const newStudent = await executeQuery('SELECT id FROM students WHERE student_id = ?', [finalStudentId]);

    logger.info(`Student created: ${finalStudentId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: {
        studentId: newStudent[0].id,
        generatedPassword: generatePassword ? finalPassword : undefined
      }
    });

  } catch (error) {
    logger.error('Create student error:', error);
    logger.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      sql: error.sql
    });

    // Check if res is still a valid response object
    if (!res || typeof res.status !== 'function') {
      logger.error('Response object is invalid in error handler');
      return;
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Student with this email or student ID already exists'
      });
    }

    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Database table not found. Please contact administrator.'
      });
    }

    if (error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({
        success: false,
        message: 'Database field error. Please contact administrator.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create student',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Update student
 */
async function updateStudent(req, res) {
  try {
    const { id } = req.params;
    const updates = sanitizeInput(req.body);

    // Validate ID format (accept both UUID and integer)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isInteger = /^\d+$/.test(id);

    if (!isUUID && !isInteger) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    // Check if student exists
    const existingStudent = await executeQuery('SELECT user_id FROM students WHERE id = ?', [id]);
    if (existingStudent.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Remove fields that shouldn't be updated via this endpoint
    delete updates.id;
    delete updates.user_id;
    delete updates.student_id;
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
      'blood_group', 'nationality', 'religion', 'address', 'phone',
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
      'class_id', 'passport_photo', 'medical_conditions', 'allergies', 'status'
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
      UPDATE students 
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

    logger.info(`Student updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Student updated successfully'
    });

  } catch (error) {
    logger.error('Update student error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update student'
    });
  }
}

/**
 * Delete student
 */
async function deleteStudent(req, res) {
  try {
    const { id } = req.params;

    // Validate ID format (accept both UUID and integer)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isInteger = /^\d+$/.test(id);

    if (!isUUID && !isInteger) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    // Check if student exists and get user_id
    logger.info(`Checking if student exists with ID: ${id}`);
    const existingStudent = await executeQuery('SELECT user_id, student_id FROM students WHERE id = ?', [id]);
    if (existingStudent.length === 0) {
      logger.warn(`Student not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const { user_id, student_id } = existingStudent[0];
    logger.info(`Found student: ${student_id}, user_id: ${user_id}`);

    // Skip dependency checks for now - let foreign key constraints handle it
    logger.info(`Proceeding with deletion for student ID: ${id}`);

    // Delete user first - this will cascade delete the student due to foreign key constraint
    logger.info(`Starting deletion for student ${student_id} (ID: ${id}) and user ${user_id}`);

    try {
      // Try deleting just the user first - the student should be cascade deleted
      await executeQuery('DELETE FROM users WHERE id = ?', [user_id]);
      logger.info(`User ${user_id} deleted successfully`);
    } catch (userDeleteError) {
      logger.warn(`Failed to delete user, trying to delete student first:`, userDeleteError.message);

      // Fallback: delete student first, then user
      await executeQuery('DELETE FROM students WHERE id = ?', [id]);
      logger.info(`Student ${id} deleted successfully`);

      await executeQuery('DELETE FROM users WHERE id = ?', [user_id]);
      logger.info(`User ${user_id} deleted successfully`);
    }

    logger.info(`Student deleted successfully: ${student_id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });

  } catch (error) {
    logger.error('Delete student error:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      stack: error.stack
    });

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete student: Student has related records'
      });
    }

    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Database table not found. Please check database setup.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete student',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Get student academic data (grades, attendance summary)
 */
async function getStudentAcademicData(req, res) {
  try {
    const { id } = req.params;

    logger.info(`Getting academic data for student ID: ${id}`);

    // Get recent grades/results
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

    // Get attendance summary
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

    const [grades, attendanceSummary] = await Promise.all([
      executeQuery(gradesQuery, [id]),
      executeQuery(attendanceQuery, [id])
    ]);

    res.json({
      success: true,
      message: 'Student academic data retrieved successfully',
      data: {
        recent_grades: grades,
        attendance_summary: attendanceSummary[0] || {
          total_days: 0,
          present_days: 0,
          absent_days: 0,
          late_days: 0,
          attendance_percentage: 0
        }
      }
    });

  } catch (error) {
    logger.error('Get student academic data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student academic data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  // Admin/Teacher functions
  getStudents,
  getStudentById,
  getStudentAcademicData,
  createStudent,
  updateStudent,
  deleteStudent,

  // Student dashboard functions
  getStudentDashboard,
  getStudentProfile,
  updateStudentProfile,
  getStudentAttendance,
  getStudentGrades,
  getStudentFees,
  getStudentTimetable,
  getStudentSubjects,
  getStudentEvents
};
