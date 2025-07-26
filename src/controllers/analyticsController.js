const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get dashboard statistics for admin/teacher
 * @route GET /api/analytics/dashboard
 * @access Private (Admin, Teacher)
 */
async function getDashboard(req, res) {
  try {
    // Get total counts
    const totalStudentsQuery = `
      SELECT COUNT(*) as total_students
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'active' AND u.status = 'active'
    `;

    const totalTeachersQuery = `
      SELECT COUNT(*) as total_teachers
      FROM users
      WHERE user_type = 'teacher' AND status = 'active'
    `;

    const totalClassesQuery = `
      SELECT COUNT(*) as total_classes
      FROM classes
      WHERE status = 'active'
    `;

    const totalSubjectsQuery = `
      SELECT COUNT(*) as total_subjects
      FROM subjects
      WHERE status = 'active'
    `;

    // Get today's attendance
    const attendanceTodayQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
        ROUND((SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_rate
      FROM attendance
      WHERE attendance_date = CURDATE()
    `;

    // Get fee statistics
    const feeStatsQuery = `
      SELECT 
        SUM(amount) as total_collected,
        SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END) as total_outstanding,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_students,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_students
      FROM fees f
      JOIN academic_years ay ON f.academic_year_id = ay.id
      WHERE ay.is_current = TRUE
    `;

    // Execute all queries
    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      attendanceToday,
      feeStats
    ] = await Promise.all([
      executeQuery(totalStudentsQuery),
      executeQuery(totalTeachersQuery),
      executeQuery(totalClassesQuery),
      executeQuery(totalSubjectsQuery),
      executeQuery(attendanceTodayQuery),
      executeQuery(feeStatsQuery)
    ]);

    res.json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: {
        total_students: totalStudents[0].total_students,
        total_teachers: totalTeachers[0].total_teachers,
        total_classes: totalClasses[0].total_classes,
        total_subjects: totalSubjects[0].total_subjects,
        attendance_today: attendanceToday[0] || {
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          attendance_rate: 0
        },
        fees: feeStats[0] || {
          total_collected: 0,
          total_outstanding: 0,
          paid_students: 0,
          pending_students: 0
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching dashboard statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
}

/**
 * Get attendance analytics
 * @route GET /api/analytics/attendance
 * @access Private (Admin, Teacher)
 */
async function getAttendanceStats(req, res) {
  try {
    const { date_from, date_to, class_id, grade_level } = req.query;

    let whereConditions = ['1=1'];
    let queryParams = [];

    if (date_from) {
      whereConditions.push('a.attendance_date >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('a.attendance_date <= ?');
      queryParams.push(date_to);
    }

    if (class_id) {
      whereConditions.push('a.class_id = ?');
      queryParams.push(class_id);
    }

    if (grade_level) {
      whereConditions.push('c.grade_level = ?');
      queryParams.push(grade_level);
    }

    const whereClause = whereConditions.join(' AND ');

    // Overall attendance statistics
    const overallStatsQuery = `
      SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
        ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_rate
      FROM attendance a
      LEFT JOIN classes c ON a.class_id = c.id
      WHERE ${whereClause}
    `;

    // Daily attendance trend
    const dailyTrendQuery = `
      SELECT 
        a.attendance_date,
        COUNT(*) as total_students,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_rate
      FROM attendance a
      LEFT JOIN classes c ON a.class_id = c.id
      WHERE ${whereClause}
      GROUP BY a.attendance_date
      ORDER BY a.attendance_date DESC
      LIMIT 30
    `;

    // Class-wise attendance
    const classWiseQuery = `
      SELECT 
        c.name as class_name,
        c.grade_level,
        COUNT(*) as total_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_rate
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      WHERE ${whereClause}
      GROUP BY c.id, c.name, c.grade_level
      ORDER BY attendance_rate DESC
    `;

    const [overallStats, dailyTrend, classWise] = await Promise.all([
      executeQuery(overallStatsQuery, queryParams),
      executeQuery(dailyTrendQuery, queryParams),
      executeQuery(classWiseQuery, queryParams)
    ]);

    res.json({
      success: true,
      message: 'Attendance analytics retrieved successfully',
      data: {
        overall_stats: overallStats[0] || {
          total_records: 0,
          present_count: 0,
          absent_count: 0,
          late_count: 0,
          attendance_rate: 0
        },
        daily_trend: dailyTrend,
        class_wise: classWise
      }
    });

  } catch (error) {
    logger.error('Error fetching attendance analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance analytics'
    });
  }
}

/**
 * Get academic performance analytics
 * @route GET /api/analytics/academic
 * @access Private (Admin, Teacher)
 */
async function getAcademicStats(req, res) {
  try {
    const { academic_year, class_id, subject_id } = req.query;

    let whereConditions = ['1=1'];
    let queryParams = [];

    if (academic_year) {
      whereConditions.push('ay.name = ?');
      queryParams.push(academic_year);
    }

    if (class_id) {
      whereConditions.push('r.class_id = ?');
      queryParams.push(class_id);
    }

    if (subject_id) {
      whereConditions.push('r.subject_id = ?');
      queryParams.push(subject_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // Overall performance statistics
    const performanceStatsQuery = `
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
      LEFT JOIN assessments a ON r.assessment_id = a.id
      LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
      WHERE ${whereClause}
    `;

    // Subject-wise performance
    const subjectWiseQuery = `
      SELECT 
        s.name as subject_name,
        s.code as subject_code,
        COUNT(*) as total_results,
        AVG(r.percentage) as average_percentage,
        MAX(r.percentage) as highest_percentage,
        MIN(r.percentage) as lowest_percentage
      FROM results r
      JOIN subjects s ON r.subject_id = s.id
      LEFT JOIN assessments a ON r.assessment_id = a.id
      LEFT JOIN academic_years ay ON a.academic_year_id = ay.id
      WHERE ${whereClause}
      GROUP BY s.id, s.name, s.code
      ORDER BY average_percentage DESC
    `;

    const [performanceStats, subjectWise] = await Promise.all([
      executeQuery(performanceStatsQuery, queryParams),
      executeQuery(subjectWiseQuery, queryParams)
    ]);

    res.json({
      success: true,
      message: 'Academic analytics retrieved successfully',
      data: {
        performance_stats: performanceStats[0] || {
          total_results: 0,
          average_percentage: 0,
          highest_percentage: 0,
          lowest_percentage: 0,
          excellent_count: 0,
          good_count: 0,
          average_count: 0,
          below_average_count: 0
        },
        subject_wise: subjectWise
      }
    });

  } catch (error) {
    logger.error('Error fetching academic analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch academic analytics'
    });
  }
}

/**
 * Get financial analytics
 * @route GET /api/analytics/financial
 * @access Private (Admin)
 */
async function getFinancialStats(req, res) {
  try {
    const { academic_year, month, year } = req.query;

    let whereConditions = ['1=1'];
    let queryParams = [];

    if (academic_year) {
      whereConditions.push('ay.name = ?');
      queryParams.push(academic_year);
    }

    if (month && year) {
      whereConditions.push('MONTH(f.payment_date) = ? AND YEAR(f.payment_date) = ?');
      queryParams.push(parseInt(month), parseInt(year));
    }

    const whereClause = whereConditions.join(' AND ');

    // Financial overview
    const financialOverviewQuery = `
      SELECT 
        SUM(f.amount) as total_fees,
        SUM(CASE WHEN f.payment_status = 'paid' THEN f.amount ELSE 0 END) as total_collected,
        SUM(CASE WHEN f.payment_status = 'pending' THEN f.amount ELSE 0 END) as total_pending,
        SUM(CASE WHEN f.payment_status = 'overdue' THEN f.amount ELSE 0 END) as total_overdue,
        COUNT(CASE WHEN f.payment_status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN f.payment_status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN f.payment_status = 'overdue' THEN 1 END) as overdue_count
      FROM fees f
      LEFT JOIN academic_years ay ON f.academic_year_id = ay.id
      WHERE ${whereClause}
    `;

    const financialOverview = await executeQuery(financialOverviewQuery, queryParams);

    res.json({
      success: true,
      message: 'Financial analytics retrieved successfully',
      data: {
        financial_overview: financialOverview[0] || {
          total_fees: 0,
          total_collected: 0,
          total_pending: 0,
          total_overdue: 0,
          paid_count: 0,
          pending_count: 0,
          overdue_count: 0
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching financial analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch financial analytics'
    });
  }
}

/**
 * Get enrollment statistics
 * @route GET /api/analytics/enrollment
 * @access Private (Admin)
 */
async function getEnrollmentStats(req, res) {
  try {
    // Enrollment by grade level
    const enrollmentByGradeQuery = `
      SELECT 
        c.grade_level,
        COUNT(s.id) as student_count,
        SUM(c.capacity) as total_capacity,
        ROUND((COUNT(s.id) / SUM(c.capacity)) * 100, 2) as utilization_rate
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id AND s.status = 'active'
      WHERE c.status = 'active'
      GROUP BY c.grade_level
      ORDER BY c.grade_level
    `;

    // Monthly enrollment trend
    const enrollmentTrendQuery = `
      SELECT 
        DATE_FORMAT(s.admission_date, '%Y-%m') as month,
        COUNT(*) as new_admissions
      FROM students s
      WHERE s.admission_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(s.admission_date, '%Y-%m')
      ORDER BY month DESC
    `;

    const [enrollmentByGrade, enrollmentTrend] = await Promise.all([
      executeQuery(enrollmentByGradeQuery),
      executeQuery(enrollmentTrendQuery)
    ]);

    res.json({
      success: true,
      message: 'Enrollment analytics retrieved successfully',
      data: {
        enrollment_by_grade: enrollmentByGrade,
        enrollment_trend: enrollmentTrend
      }
    });

  } catch (error) {
    logger.error('Error fetching enrollment analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enrollment analytics'
    });
  }
}

module.exports = {
  getDashboard,
  getAttendanceStats,
  getAcademicStats,
  getFinancialStats,
  getEnrollmentStats
};
