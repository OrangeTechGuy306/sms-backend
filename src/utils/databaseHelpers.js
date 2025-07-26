const { executeQuery } = require('../config/database');
const logger = require('./logger');

/**
 * Database helper functions for calculated fields
 */

/**
 * Calculate and update percentage for assessment results
 * @param {number} assessmentResultId - The assessment result ID
 * @returns {Promise<number>} The calculated percentage
 */
async function updateAssessmentResultPercentage(assessmentResultId) {
  try {
    const query = `
      UPDATE assessment_results ar
      JOIN assessments a ON ar.assessment_id = a.id
      SET ar.percentage = CASE 
        WHEN a.total_marks > 0 THEN ROUND((ar.marks_obtained / a.total_marks) * 100, 2)
        ELSE 0
      END
      WHERE ar.id = ?
    `;
    
    await executeQuery(query, [assessmentResultId]);
    
    // Get the updated percentage
    const [result] = await executeQuery(
      'SELECT percentage FROM assessment_results WHERE id = ?',
      [assessmentResultId]
    );
    
    return result ? result.percentage : 0;
  } catch (error) {
    logger.error('Error updating assessment result percentage:', error);
    throw error;
  }
}

/**
 * Calculate and update percentage for all assessment results of an assessment
 * @param {number} assessmentId - The assessment ID
 * @returns {Promise<void>}
 */
async function updateAllAssessmentResultsPercentage(assessmentId) {
  try {
    const query = `
      UPDATE assessment_results ar
      JOIN assessments a ON ar.assessment_id = a.id
      SET ar.percentage = CASE 
        WHEN a.total_marks > 0 THEN ROUND((ar.marks_obtained / a.total_marks) * 100, 2)
        ELSE 0
      END
      WHERE a.id = ?
    `;
    
    await executeQuery(query, [assessmentId]);
    logger.info(`Updated percentages for all results of assessment ${assessmentId}`);
  } catch (error) {
    logger.error('Error updating assessment results percentages:', error);
    throw error;
  }
}

/**
 * Calculate and update attendance percentage for a student's monthly summary
 * @param {number} studentId - The student ID
 * @param {number} month - The month (1-12)
 * @param {number} year - The year
 * @returns {Promise<number>} The calculated attendance percentage
 */
async function updateAttendancePercentage(studentId, month, year) {
  try {
    const query = `
      UPDATE attendance_summary
      SET attendance_percentage = CASE 
        WHEN total_days > 0 THEN ROUND((present_days / total_days) * 100, 2)
        ELSE 0
      END
      WHERE student_id = ? AND month = ? AND year = ?
    `;
    
    await executeQuery(query, [studentId, month, year]);
    
    // Get the updated percentage
    const [result] = await executeQuery(
      'SELECT attendance_percentage FROM attendance_summary WHERE student_id = ? AND month = ? AND year = ?',
      [studentId, month, year]
    );
    
    return result ? result.attendance_percentage : 0;
  } catch (error) {
    logger.error('Error updating attendance percentage:', error);
    throw error;
  }
}

/**
 * Calculate and update pending amount for student fees
 * @param {number} studentFeeId - The student fee ID
 * @returns {Promise<number>} The calculated pending amount
 */
async function updateStudentFeePendingAmount(studentFeeId) {
  try {
    const query = `
      UPDATE student_fees
      SET pending_amount = GREATEST(total_amount - paid_amount - discount_amount, 0)
      WHERE id = ?
    `;
    
    await executeQuery(query, [studentFeeId]);
    
    // Get the updated pending amount
    const [result] = await executeQuery(
      'SELECT pending_amount FROM student_fees WHERE id = ?',
      [studentFeeId]
    );
    
    return result ? result.pending_amount : 0;
  } catch (error) {
    logger.error('Error updating student fee pending amount:', error);
    throw error;
  }
}

/**
 * Calculate and update report card percentage
 * @param {number} reportCardId - The report card ID
 * @returns {Promise<number>} The calculated percentage
 */
async function updateReportCardPercentage(reportCardId) {
  try {
    const query = `
      UPDATE report_cards
      SET percentage = CASE 
        WHEN total_marks > 0 THEN ROUND((marks_obtained / total_marks) * 100, 2)
        ELSE 0
      END
      WHERE id = ?
    `;
    
    await executeQuery(query, [reportCardId]);
    
    // Get the updated percentage
    const [result] = await executeQuery(
      'SELECT percentage FROM report_cards WHERE id = ?',
      [reportCardId]
    );
    
    return result ? result.percentage : 0;
  } catch (error) {
    logger.error('Error updating report card percentage:', error);
    throw error;
  }
}

/**
 * Recalculate all percentages for a student's report card based on subject marks
 * @param {number} reportCardId - The report card ID
 * @returns {Promise<void>}
 */
async function recalculateReportCardFromSubjects(reportCardId) {
  try {
    // First, update the total marks and marks obtained from subjects
    const updateTotalsQuery = `
      UPDATE report_cards rc
      SET 
        total_marks = (
          SELECT COALESCE(SUM(rcs.total_marks), 0)
          FROM report_card_subjects rcs
          WHERE rcs.report_card_id = rc.id
        ),
        marks_obtained = (
          SELECT COALESCE(SUM(rcs.marks_obtained), 0)
          FROM report_card_subjects rcs
          WHERE rcs.report_card_id = rc.id
        )
      WHERE rc.id = ?
    `;
    
    await executeQuery(updateTotalsQuery, [reportCardId]);
    
    // Then update the percentage
    await updateReportCardPercentage(reportCardId);
    
    logger.info(`Recalculated report card totals and percentage for report card ${reportCardId}`);
  } catch (error) {
    logger.error('Error recalculating report card from subjects:', error);
    throw error;
  }
}

/**
 * Calculate grade based on percentage and grade scale
 * @param {number} percentage - The percentage score
 * @param {number} gradeScaleId - The grade scale ID (optional, defaults to 1)
 * @returns {Promise<string>} The calculated grade
 */
async function calculateGrade(percentage, gradeScaleId = 1) {
  try {
    const query = `
      SELECT grade
      FROM grade_scale_ranges
      WHERE grade_scale_id = ? 
        AND ? >= min_percentage 
        AND ? <= max_percentage
      LIMIT 1
    `;
    
    const [result] = await executeQuery(query, [gradeScaleId, percentage, percentage]);
    return result ? result.grade : 'F';
  } catch (error) {
    logger.error('Error calculating grade:', error);
    return 'F';
  }
}

/**
 * Update grade for assessment result based on percentage
 * @param {number} assessmentResultId - The assessment result ID
 * @returns {Promise<string>} The calculated grade
 */
async function updateAssessmentResultGrade(assessmentResultId) {
  try {
    // Get the current percentage
    const [result] = await executeQuery(
      'SELECT percentage FROM assessment_results WHERE id = ?',
      [assessmentResultId]
    );
    
    if (!result || result.percentage === null) {
      return 'F';
    }
    
    const grade = await calculateGrade(result.percentage);
    
    // Update the grade
    await executeQuery(
      'UPDATE assessment_results SET grade = ? WHERE id = ?',
      [grade, assessmentResultId]
    );
    
    return grade;
  } catch (error) {
    logger.error('Error updating assessment result grade:', error);
    throw error;
  }
}

module.exports = {
  updateAssessmentResultPercentage,
  updateAllAssessmentResultsPercentage,
  updateAttendancePercentage,
  updateStudentFeePendingAmount,
  updateReportCardPercentage,
  recalculateReportCardFromSubjects,
  calculateGrade,
  updateAssessmentResultGrade
};
