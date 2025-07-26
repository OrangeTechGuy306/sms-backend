const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');

    // Get total counts
    const [studentsCount] = await executeQuery('SELECT COUNT(*) as count FROM students WHERE status = "active"');
    const [teachersCount] = await executeQuery('SELECT COUNT(*) as count FROM teachers WHERE status = "active"');
    const [classesCount] = await executeQuery('SELECT COUNT(*) as count FROM classes WHERE status = "active"');
    const [subjectsCount] = await executeQuery('SELECT COUNT(*) as count FROM subjects WHERE status = "active"');

    // Get attendance stats for today (if attendance table exists)
    const today = new Date().toISOString().split('T')[0];
    let attendanceStats = { total_records: 0, present_count: 0, absent_count: 0, late_count: 0 };

    try {
      const [stats] = await executeQuery(`
        SELECT
          COUNT(*) as total_records,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count
        FROM attendance
        WHERE date = ?
      `, [today]);
      attendanceStats = stats || attendanceStats;
    } catch (error) {
      console.log('Attendance table not found or empty, using default values');
    }

    // Get recent activities (last 10) - using users table with joins
    let recentActivities = [];
    try {
      recentActivities = await executeQuery(`
        SELECT
          'student_enrollment' as type,
          CONCAT(u.first_name, ' ', u.last_name, ' enrolled') as description,
          s.created_at as timestamp
        FROM students s
        JOIN users u ON s.user_id = u.id
        WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        UNION ALL
        SELECT
          'teacher_assignment' as type,
          CONCAT(u.first_name, ' ', u.last_name, ' joined as teacher') as description,
          t.created_at as timestamp
        FROM teachers t
        JOIN users u ON t.user_id = u.id
        WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY timestamp DESC
        LIMIT 10
      `);
    } catch (error) {
      console.log('Error fetching recent activities:', error.message);
    }

    // Get fee collection stats (if fee tables exist)
    let feeStats = { total_collected: 0, total_outstanding: 0, paid_count: 0, pending_count: 0 };
    try {
      const [stats] = await executeQuery(`
        SELECT
          SUM(CASE WHEN sf.status = 'paid' THEN sf.paid_amount ELSE 0 END) as total_collected,
          SUM(CASE WHEN sf.status IN ('pending', 'overdue') THEN sf.pending_amount ELSE 0 END) as total_outstanding,
          COUNT(CASE WHEN sf.status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN sf.status IN ('pending', 'overdue') THEN 1 END) as pending_count
        FROM student_fees sf
        WHERE sf.academic_year_id = (SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1)
      `);
      feeStats = stats || feeStats;
    } catch (error) {
      console.log('Fee tables not found or empty, using default values');
    }

    // Get upcoming events (next 5) - if events table exists
    let upcomingEvents = [];
    try {
      upcomingEvents = await executeQuery(`
        SELECT title, start_date, start_time, type, location
        FROM events
        WHERE start_date >= CURDATE() AND status = 'active'
        ORDER BY start_date ASC, start_time ASC
        LIMIT 5
      `);
    } catch (error) {
      console.log('Events table not found or empty, using default values');
    }

    // Return data in the format expected by the frontend
    const dashboardData = {
      total_students: studentsCount.count || 0,
      total_teachers: teachersCount.count || 0,
      total_classes: classesCount.count || 0,
      total_subjects: subjectsCount.count || 0,
      attendance_today: {
        total: attendanceStats.total_records || 0,
        present: attendanceStats.present_count || 0,
        absent: attendanceStats.absent_count || 0,
        late: attendanceStats.late_count || 0,
        attendance_rate: attendanceStats.total_records > 0
          ? Math.round((attendanceStats.present_count / attendanceStats.total_records) * 100)
          : 0
      },
      fees: {
        total_collected: feeStats.total_collected || 0,
        total_outstanding: feeStats.total_outstanding || 0,
        paid_students: feeStats.paid_count || 0,
        pending_students: feeStats.pending_count || 0
      },
      recent_activities: recentActivities || [],
      upcoming_events: upcomingEvents || []
    };

    res.json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: dashboardData
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data',
      error: error.message
    });
  }
});

router.get('/attendance', authorize(['admin', 'teacher']), async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const { class_id, date_from, date_to } = req.query;

    let whereConditions = ['1=1'];
    let queryParams = [];

    if (class_id) {
      whereConditions.push('a.class_id = ?');
      queryParams.push(class_id);
    }

    if (date_from) {
      whereConditions.push('a.date >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('a.date <= ?');
      queryParams.push(date_to);
    }

    // Get attendance by grade level
    const attendanceByGrade = await executeQuery(`
      SELECT
        gl.name as grade_level,
        COUNT(*) as total_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) as attendance_rate
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON a.class_id = c.id
      JOIN grade_levels gl ON c.grade_level_id = gl.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY gl.id, gl.name
      ORDER BY gl.name
    `, queryParams);

    // Get daily attendance trends (last 30 days)
    const dailyTrends = await executeQuery(`
      SELECT
        a.date,
        COUNT(*) as total_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) as attendance_rate
      FROM attendance a
      WHERE a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY a.date
      ORDER BY a.date DESC
      LIMIT 30
    `);

    res.json({
      success: true,
      message: 'Attendance analytics retrieved successfully',
      data: {
        by_grade_level: attendanceByGrade,
        daily_trends: dailyTrends
      }
    });
  } catch (error) {
    console.error('Attendance analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance analytics',
      error: error.message
    });
  }
});

router.get('/academic', authorize(['admin', 'teacher']), async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');

    // Get grade distribution
    const gradeDistribution = await executeQuery(`
      SELECT
        r.grade,
        COUNT(*) as count,
        ROUND((COUNT(*) / (SELECT COUNT(*) FROM results WHERE status = 'published')) * 100, 1) as percentage
      FROM results r
      WHERE r.status = 'published'
      GROUP BY r.grade
      ORDER BY r.grade
    `);

    // Get subject performance
    const subjectPerformance = await executeQuery(`
      SELECT
        s.name as subject_name,
        AVG(r.percentage) as average_score,
        COUNT(r.id) as total_results,
        SUM(CASE WHEN r.percentage >= 50 THEN 1 ELSE 0 END) as pass_count
      FROM results r
      JOIN subjects s ON r.subject_id = s.id
      WHERE r.status = 'published'
      GROUP BY s.id, s.name
      ORDER BY average_score DESC
    `);

    res.json({
      success: true,
      message: 'Academic analytics retrieved successfully',
      data: {
        grade_distribution: gradeDistribution,
        subject_performance: subjectPerformance
      }
    });
  } catch (error) {
    console.error('Academic analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve academic analytics',
      error: error.message
    });
  }
});

router.get('/financial', authorize(['admin']), async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');

    // Get fee collection by month (last 12 months)
    const monthlyCollection = await executeQuery(`
      SELECT
        DATE_FORMAT(p.payment_date, '%Y-%m') as month,
        SUM(p.amount) as total_collected,
        COUNT(p.id) as payment_count
      FROM payments p
      WHERE p.payment_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m')
      ORDER BY month DESC
    `);

    // Get fee type breakdown
    const feeTypeBreakdown = await executeQuery(`
      SELECT
        ft.name as fee_type,
        SUM(CASE WHEN sf.status = 'paid' THEN ft.amount ELSE 0 END) as collected,
        SUM(CASE WHEN sf.status IN ('pending', 'overdue') THEN ft.amount ELSE 0 END) as outstanding
      FROM fee_types ft
      LEFT JOIN student_fees sf ON ft.id = sf.fee_type_id
      GROUP BY ft.id, ft.name
      ORDER BY collected DESC
    `);

    res.json({
      success: true,
      message: 'Financial analytics retrieved successfully',
      data: {
        monthly_collection: monthlyCollection,
        fee_type_breakdown: feeTypeBreakdown
      }
    });
  } catch (error) {
    console.error('Financial analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve financial analytics',
      error: error.message
    });
  }
});

router.get('/enrollment', authorize(['admin']), async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');

    // Get enrollment by grade level
    const enrollmentByGrade = await executeQuery(`
      SELECT
        gl.name as grade_level,
        COUNT(s.id) as student_count,
        COUNT(c.id) as class_count,
        ROUND(COUNT(s.id) / COUNT(DISTINCT c.id), 1) as avg_students_per_class
      FROM grade_levels gl
      LEFT JOIN classes c ON gl.id = c.grade_level_id AND c.status = 'active'
      LEFT JOIN students s ON c.id = s.class_id AND s.status = 'active'
      GROUP BY gl.id, gl.name
      ORDER BY gl.name
    `);

    // Get enrollment trends (last 6 months)
    const enrollmentTrends = await executeQuery(`
      SELECT
        DATE_FORMAT(s.created_at, '%Y-%m') as month,
        COUNT(s.id) as new_enrollments
      FROM students s
      WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(s.created_at, '%Y-%m')
      ORDER BY month DESC
    `);

    res.json({
      success: true,
      message: 'Enrollment analytics retrieved successfully',
      data: {
        by_grade_level: enrollmentByGrade,
        enrollment_trends: enrollmentTrends
      }
    });
  } catch (error) {
    console.error('Enrollment analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve enrollment analytics',
      error: error.message
    });
  }
});

module.exports = router;
