const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get student health records
 */
async function getStudentHealthRecords(req, res) {
  try {
    const { studentId } = req.params;
    const { type } = req.query;

    if (!isValidUUID(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    let whereConditions = ['hr.student_id = ?'];
    let queryParams = [studentId];

    if (type) {
      whereConditions.push('hr.type = ?');
      queryParams.push(type);
    }

    const whereClause = whereConditions.join(' AND ');

    const healthRecordsQuery = `
      SELECT 
        hr.id,
        hr.type,
        hr.title,
        hr.description,
        hr.date_recorded,
        hr.severity,
        hr.treatment,
        hr.follow_up_required,
        hr.follow_up_date,
        hr.status,
        hr.created_at,
        CONCAT(recorder.first_name, ' ', recorder.last_name) as recorded_by_name,
        CONCAT(s.first_name, ' ', s.last_name) as student_name,
        s.student_id
      FROM health_records hr
      JOIN students s ON hr.student_id = s.id
      LEFT JOIN users recorder ON hr.recorded_by = recorder.id
      WHERE ${whereClause}
      ORDER BY hr.date_recorded DESC, hr.created_at DESC
    `;

    const healthRecords = await executeQuery(healthRecordsQuery, queryParams);

    // Get student basic health info
    const studentHealthQuery = `
      SELECT 
        s.blood_group,
        s.medical_conditions,
        s.allergies,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.emergency_contact_relationship
      FROM students s
      WHERE s.id = ?
    `;

    const studentHealth = await executeQuery(studentHealthQuery, [studentId]);

    res.json({
      success: true,
      data: {
        studentHealth: studentHealth[0] || {},
        healthRecords
      }
    });

  } catch (error) {
    logger.error('Get student health records error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student health records'
    });
  }
}

/**
 * Create health record
 */
async function createHealthRecord(req, res) {
  try {
    const healthData = sanitizeInput(req.body);
    
    const {
      studentId,
      type,
      title,
      description = '',
      dateRecorded,
      severity = 'low',
      treatment = '',
      followUpRequired = false,
      followUpDate = null
    } = healthData;

    // Validate required fields
    if (!studentId || !type || !title || !dateRecorded) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentId, type, title, dateRecorded'
      });
    }

    // Create health record
    const insertQuery = `
      INSERT INTO health_records (
        student_id, type, title, description, date_recorded, severity, 
        treatment, follow_up_required, follow_up_date, status, recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `;

    const result = await executeQuery(insertQuery, [
      studentId, type, title, description, dateRecorded, severity,
      treatment, followUpRequired, followUpDate, req.user.id
    ]);

    logger.info(`Health record created for student ${studentId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Health record created successfully',
      data: {
        healthRecordId: result.insertId
      }
    });

  } catch (error) {
    logger.error('Create health record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create health record'
    });
  }
}

/**
 * Update health record
 */
async function updateHealthRecord(req, res) {
  try {
    const { id } = req.params;
    const updates = sanitizeInput(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid health record ID format'
      });
    }

    // Check if health record exists
    const existingRecord = await executeQuery('SELECT id FROM health_records WHERE id = ?', [id]);
    if (existingRecord.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Health record not found'
      });
    }

    // Remove fields that shouldn't be updated via this endpoint
    delete updates.id;
    delete updates.student_id;
    delete updates.recorded_by;
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
      'type', 'title', 'description', 'date_recorded', 'severity',
      'treatment', 'follow_up_required', 'follow_up_date', 'status'
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
      UPDATE health_records 
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

    logger.info(`Health record updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Health record updated successfully'
    });

  } catch (error) {
    logger.error('Update health record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update health record'
    });
  }
}

/**
 * Record vaccination
 */
async function recordVaccination(req, res) {
  try {
    const vaccinationData = sanitizeInput(req.body);
    
    const {
      studentId,
      vaccineName,
      dateAdministered,
      doseNumber = 1,
      administeredBy = '',
      batchNumber = '',
      nextDueDate = null,
      sideEffects = '',
      notes = ''
    } = vaccinationData;

    // Validate required fields
    if (!studentId || !vaccineName || !dateAdministered) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentId, vaccineName, dateAdministered'
      });
    }

    // Create vaccination record
    const insertQuery = `
      INSERT INTO vaccinations (
        student_id, vaccine_name, date_administered, dose_number, 
        administered_by, batch_number, next_due_date, side_effects, notes, recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(insertQuery, [
      studentId, vaccineName, dateAdministered, doseNumber,
      administeredBy, batchNumber, nextDueDate, sideEffects, notes, req.user.id
    ]);

    logger.info(`Vaccination recorded for student ${studentId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Vaccination recorded successfully',
      data: {
        vaccinationId: result.insertId
      }
    });

  } catch (error) {
    logger.error('Record vaccination error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record vaccination'
    });
  }
}

/**
 * Get student vaccinations
 */
async function getStudentVaccinations(req, res) {
  try {
    const { studentId } = req.params;

    if (!isValidUUID(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    const vaccinationsQuery = `
      SELECT 
        v.id,
        v.vaccine_name,
        v.date_administered,
        v.dose_number,
        v.administered_by,
        v.batch_number,
        v.next_due_date,
        v.side_effects,
        v.notes,
        v.created_at,
        CONCAT(recorder.first_name, ' ', recorder.last_name) as recorded_by_name
      FROM vaccinations v
      LEFT JOIN users recorder ON v.recorded_by = recorder.id
      WHERE v.student_id = ?
      ORDER BY v.date_administered DESC
    `;

    const vaccinations = await executeQuery(vaccinationsQuery, [studentId]);

    res.json({
      success: true,
      data: vaccinations
    });

  } catch (error) {
    logger.error('Get student vaccinations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student vaccinations'
    });
  }
}

/**
 * Record nurse visit
 */
async function recordNurseVisit(req, res) {
  try {
    const visitData = sanitizeInput(req.body);
    
    const {
      studentId,
      visitDate,
      reason,
      symptoms = '',
      treatment = '',
      medication = '',
      temperature = null,
      bloodPressure = '',
      pulse = null,
      weight = null,
      height = null,
      notes = '',
      parentNotified = false,
      sentHome = false
    } = visitData;

    // Validate required fields
    if (!studentId || !visitDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentId, visitDate, reason'
      });
    }

    // Create nurse visit record
    const insertQuery = `
      INSERT INTO nurse_visits (
        student_id, visit_date, reason, symptoms, treatment, medication,
        temperature, blood_pressure, pulse, weight, height, notes,
        parent_notified, sent_home, recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(insertQuery, [
      studentId, visitDate, reason, symptoms, treatment, medication,
      temperature, bloodPressure, pulse, weight, height, notes,
      parentNotified, sentHome, req.user.id
    ]);

    logger.info(`Nurse visit recorded for student ${studentId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Nurse visit recorded successfully',
      data: {
        nurseVisitId: result.insertId
      }
    });

  } catch (error) {
    logger.error('Record nurse visit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record nurse visit'
    });
  }
}

/**
 * Get student nurse visits
 */
async function getStudentNurseVisits(req, res) {
  try {
    const { studentId } = req.params;
    const { limit = 20 } = req.query;

    if (!isValidUUID(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    const nurseVisitsQuery = `
      SELECT 
        nv.id,
        nv.visit_date,
        nv.reason,
        nv.symptoms,
        nv.treatment,
        nv.medication,
        nv.temperature,
        nv.blood_pressure,
        nv.pulse,
        nv.weight,
        nv.height,
        nv.notes,
        nv.parent_notified,
        nv.sent_home,
        nv.created_at,
        CONCAT(recorder.first_name, ' ', recorder.last_name) as recorded_by_name
      FROM nurse_visits nv
      LEFT JOIN users recorder ON nv.recorded_by = recorder.id
      WHERE nv.student_id = ?
      ORDER BY nv.visit_date DESC, nv.created_at DESC
      LIMIT ?
    `;

    const nurseVisits = await executeQuery(nurseVisitsQuery, [studentId, parseInt(limit)]);

    res.json({
      success: true,
      data: nurseVisits
    });

  } catch (error) {
    logger.error('Get student nurse visits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student nurse visits'
    });
  }
}

module.exports = {
  getStudentHealthRecords,
  createHealthRecord,
  updateHealthRecord,
  recordVaccination,
  getStudentVaccinations,
  recordNurseVisit,
  getStudentNurseVisits
};
