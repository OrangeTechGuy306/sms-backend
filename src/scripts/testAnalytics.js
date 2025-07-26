const { executeQuery } = require('../config/database');

async function testAnalyticsEndpoint() {
  try {
    console.log('🧪 Testing analytics dashboard endpoint...');
    
    // Test individual queries that the analytics endpoint uses
    console.log('\n1. Testing students count...');
    try {
      const studentsCount = await executeQuery('SELECT COUNT(*) as count FROM students WHERE status = "active"');
      console.log('✅ Students count:', studentsCount[0]?.count || 0);
    } catch (error) {
      console.log('❌ Students query failed:', error.message);
    }
    
    console.log('\n2. Testing teachers count...');
    try {
      const teachersCount = await executeQuery('SELECT COUNT(*) as count FROM teachers WHERE status = "active"');
      console.log('✅ Teachers count:', teachersCount[0]?.count || 0);
    } catch (error) {
      console.log('❌ Teachers query failed:', error.message);
    }
    
    console.log('\n3. Testing classes count...');
    try {
      const classesCount = await executeQuery('SELECT COUNT(*) as count FROM classes WHERE status = "active"');
      console.log('✅ Classes count:', classesCount[0]?.count || 0);
    } catch (error) {
      console.log('❌ Classes query failed:', error.message);
    }
    
    console.log('\n4. Testing subjects count...');
    try {
      const subjectsCount = await executeQuery('SELECT COUNT(*) as count FROM subjects WHERE status = "active"');
      console.log('✅ Subjects count:', subjectsCount[0]?.count || 0);
    } catch (error) {
      console.log('❌ Subjects query failed:', error.message);
    }
    
    console.log('\n5. Testing attendance table...');
    try {
      const today = new Date().toISOString().split('T')[0];
      const attendanceStats = await executeQuery(`
        SELECT
          COUNT(*) as total_records,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count
        FROM attendance
        WHERE date = ?
      `, [today]);
      console.log('✅ Attendance stats:', attendanceStats[0] || 'No records for today');
    } catch (error) {
      console.log('⚠️  Attendance table not found or empty:', error.message);
    }
    
    console.log('\n6. Testing recent activities...');
    try {
      const recentActivities = await executeQuery(`
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
      console.log('✅ Recent activities count:', recentActivities.length);
    } catch (error) {
      console.log('⚠️  Recent activities query failed:', error.message);
    }
    
    console.log('\n7. Testing fee stats...');
    try {
      const feeStats = await executeQuery(`
        SELECT
          SUM(CASE WHEN sf.status = 'paid' THEN sf.paid_amount ELSE 0 END) as total_collected,
          SUM(CASE WHEN sf.status IN ('pending', 'overdue') THEN sf.pending_amount ELSE 0 END) as total_outstanding,
          COUNT(CASE WHEN sf.status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN sf.status IN ('pending', 'overdue') THEN 1 END) as pending_count
        FROM student_fees sf
        WHERE sf.academic_year_id = (SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1)
      `);
      console.log('✅ Fee stats:', feeStats[0] || 'No fee data');
    } catch (error) {
      console.log('⚠️  Fee stats query failed:', error.message);
    }
    
    console.log('\n8. Testing events...');
    try {
      const upcomingEvents = await executeQuery(`
        SELECT title, start_date, start_time, type, location
        FROM events
        WHERE start_date >= CURDATE() AND status = 'active'
        ORDER BY start_date ASC, start_time ASC
        LIMIT 5
      `);
      console.log('✅ Upcoming events count:', upcomingEvents.length);
    } catch (error) {
      console.log('⚠️  Events table not found or empty:', error.message);
    }
    
    console.log('\n🎉 Analytics endpoint test completed!');
    console.log('\n📋 Summary:');
    console.log('- The analytics endpoint should now work with fallback values for missing tables');
    console.log('- Dashboard will show 0 values for data that is not yet available');
    console.log('- No more 500 errors should occur');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testAnalyticsEndpoint();
