const { executeQuery, executeTransaction } = require('../config/database');
const { sanitizeInput, isValidUUID } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Get all transportation routes with pagination and filtering
 */
async function getRoutes(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sort_by = 'route_name',
      sort_order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(tr.route_name LIKE ? OR tr.route_code LIKE ? OR tr.start_location LIKE ? OR tr.end_location LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereConditions.push('tr.status = ?');
      queryParams.push(status);
    }

    // Validate sort parameters
    const allowedSortFields = ['route_name', 'route_code', 'distance_km', 'estimated_duration', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'route_name';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transportation_routes tr
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get routes with assignment info
    const routesQuery = `
      SELECT 
        tr.id,
        tr.route_name,
        tr.route_code,
        tr.description,
        tr.start_location,
        tr.end_location,
        tr.estimated_duration,
        tr.distance_km,
        tr.status,
        tr.created_at,
        tr.updated_at,
        COUNT(DISTINCT ra.id) as active_assignments,
        COUNT(DISTINCT st.id) as enrolled_students
      FROM transportation_routes tr
      LEFT JOIN route_assignments ra ON tr.id = ra.route_id AND ra.status = 'active'
      LEFT JOIN student_transportation st ON tr.id = st.route_id AND st.status = 'active'
      WHERE ${whereClause}
      GROUP BY tr.id
      ORDER BY tr.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const routes = await executeQuery(routesQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: 'Transportation routes retrieved successfully',
      data: {
        routes,
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

    logger.info(`User ${req.user.id} retrieved transportation routes - Page: ${page}, Total: ${total}`);

  } catch (error) {
    logger.error('Error retrieving transportation routes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transportation routes',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get route by ID with stops and assignments
 */
async function getRouteById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid route ID format'
      });
    }

    // Get route details
    const routeQuery = `
      SELECT 
        tr.id,
        tr.route_name,
        tr.route_code,
        tr.description,
        tr.start_location,
        tr.end_location,
        tr.estimated_duration,
        tr.distance_km,
        tr.status,
        tr.created_at,
        tr.updated_at
      FROM transportation_routes tr
      WHERE tr.id = ?
    `;

    const routeResult = await executeQuery(routeQuery, [id]);

    if (routeResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transportation route not found'
      });
    }

    const route = routeResult[0];

    // Get route stops
    const stopsQuery = `
      SELECT 
        rs.id,
        rs.stop_name,
        rs.stop_address,
        rs.latitude,
        rs.longitude,
        rs.stop_order,
        rs.pickup_time,
        rs.dropoff_time,
        rs.estimated_students,
        rs.status,
        COUNT(DISTINCT st.id) as actual_students
      FROM route_stops rs
      LEFT JOIN student_transportation st ON rs.id = st.pickup_stop_id AND st.status = 'active'
      WHERE rs.route_id = ?
      GROUP BY rs.id
      ORDER BY rs.stop_order
    `;

    const stops = await executeQuery(stopsQuery, [id]);

    // Get current assignments
    const assignmentsQuery = `
      SELECT 
        ra.id,
        ra.bus_id,
        ra.driver_id,
        ra.assistant_driver_id,
        ra.shift_type,
        ra.effective_from,
        ra.effective_to,
        ra.status,
        tb.bus_number,
        tb.license_plate,
        tb.capacity,
        CONCAT(td.first_name, ' ', td.last_name) as driver_name,
        td.phone as driver_phone,
        CONCAT(tda.first_name, ' ', tda.last_name) as assistant_driver_name
      FROM route_assignments ra
      LEFT JOIN transportation_buses tb ON ra.bus_id = tb.id
      LEFT JOIN transportation_drivers td ON ra.driver_id = td.id
      LEFT JOIN transportation_drivers tda ON ra.assistant_driver_id = tda.id
      WHERE ra.route_id = ? AND ra.status = 'active'
      ORDER BY ra.shift_type
    `;

    const assignments = await executeQuery(assignmentsQuery, [id]);

    // Get enrolled students count
    const studentsQuery = `
      SELECT COUNT(*) as total_students
      FROM student_transportation st
      WHERE st.route_id = ? AND st.status = 'active'
    `;

    const studentsResult = await executeQuery(studentsQuery, [id]);
    const totalStudents = studentsResult[0].total_students;

    res.json({
      success: true,
      message: 'Transportation route retrieved successfully',
      data: {
        ...route,
        stops,
        assignments,
        total_students: totalStudents
      }
    });

    logger.info(`User ${req.user.id} retrieved transportation route ${id}`);

  } catch (error) {
    logger.error('Error retrieving transportation route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transportation route',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Create new transportation route
 */
async function createRoute(req, res) {
  try {
    const {
      route_name,
      route_code,
      description,
      start_location,
      end_location,
      estimated_duration,
      distance_km,
      status = 'active'
    } = sanitizeInput(req.body);

    // Validate required fields
    if (!route_name || !route_code || !start_location || !end_location || !estimated_duration) {
      return res.status(400).json({
        success: false,
        message: 'Route name, code, start location, end location, and estimated duration are required'
      });
    }

    // Only admins can create routes
    if (req.user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create transportation routes'
      });
    }

    // Check if route code already exists
    const existingRouteQuery = 'SELECT id FROM transportation_routes WHERE route_code = ?';
    const existingRoute = await executeQuery(existingRouteQuery, [route_code]);
    
    if (existingRoute.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Route code already exists'
      });
    }

    // Create route
    const insertQuery = `
      INSERT INTO transportation_routes (
        route_name, route_code, description, start_location, end_location,
        estimated_duration, distance_km, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      route_name, route_code, description, start_location, end_location,
      estimated_duration, distance_km, status
    ];

    const result = await executeQuery(insertQuery, insertParams);
    const routeId = result.insertId;

    // Get the created route
    const createdRoute = await executeQuery(`
      SELECT 
        tr.id,
        tr.route_name,
        tr.route_code,
        tr.description,
        tr.start_location,
        tr.end_location,
        tr.estimated_duration,
        tr.distance_km,
        tr.status,
        tr.created_at,
        tr.updated_at
      FROM transportation_routes tr
      WHERE tr.id = ?
    `, [routeId]);

    res.status(201).json({
      success: true,
      message: 'Transportation route created successfully',
      data: createdRoute[0]
    });

    logger.info(`User ${req.user.id} created transportation route ${routeId} with code ${route_code}`);

  } catch (error) {
    logger.error('Error creating transportation route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transportation route',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get all buses with pagination and filtering
 */
async function getBuses(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sort_by = 'bus_number',
      sort_order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${search}%`;

    // Build WHERE clause
    let whereConditions = ['1=1'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(tb.bus_number LIKE ? OR tb.license_plate LIKE ? OR tb.model LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereConditions.push('tb.status = ?');
      queryParams.push(status);
    }

    // Validate sort parameters
    const allowedSortFields = ['bus_number', 'license_plate', 'capacity', 'model', 'year_manufactured', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'bus_number';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transportation_buses tb
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get buses with assignment info
    const busesQuery = `
      SELECT 
        tb.id,
        tb.bus_number,
        tb.license_plate,
        tb.capacity,
        tb.model,
        tb.year_manufactured,
        tb.fuel_type,
        tb.insurance_expiry,
        tb.last_maintenance,
        tb.next_maintenance,
        tb.gps_device_id,
        tb.status,
        tb.created_at,
        tb.updated_at,
        COUNT(DISTINCT ra.id) as active_assignments
      FROM transportation_buses tb
      LEFT JOIN route_assignments ra ON tb.id = ra.bus_id AND ra.status = 'active'
      WHERE ${whereClause}
      GROUP BY tb.id
      ORDER BY tb.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const buses = await executeQuery(busesQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: 'Transportation buses retrieved successfully',
      data: {
        buses,
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

    logger.info(`User ${req.user.id} retrieved transportation buses - Page: ${page}, Total: ${total}`);

  } catch (error) {
    logger.error('Error retrieving transportation buses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transportation buses',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Create new bus
 */
async function createBus(req, res) {
  try {
    const {
      bus_number,
      license_plate,
      capacity,
      model,
      year_manufactured,
      fuel_type = 'diesel',
      insurance_expiry,
      gps_device_id,
      status = 'active'
    } = sanitizeInput(req.body);

    // Validate required fields
    if (!bus_number || !license_plate || !capacity) {
      return res.status(400).json({
        success: false,
        message: 'Bus number, license plate, and capacity are required'
      });
    }

    // Only admins can create buses
    if (req.user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create buses'
      });
    }

    // Check if bus number or license plate already exists
    const existingBusQuery = 'SELECT id FROM transportation_buses WHERE bus_number = ? OR license_plate = ?';
    const existingBus = await executeQuery(existingBusQuery, [bus_number, license_plate]);

    if (existingBus.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Bus number or license plate already exists'
      });
    }

    // Create bus
    const insertQuery = `
      INSERT INTO transportation_buses (
        bus_number, license_plate, capacity, model, year_manufactured,
        fuel_type, insurance_expiry, gps_device_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      bus_number, license_plate, capacity, model, year_manufactured,
      fuel_type, insurance_expiry, gps_device_id, status
    ];

    const result = await executeQuery(insertQuery, insertParams);
    const busId = result.insertId;

    // Get the created bus
    const createdBus = await executeQuery(`
      SELECT * FROM transportation_buses WHERE id = ?
    `, [busId]);

    res.status(201).json({
      success: true,
      message: 'Transportation bus created successfully',
      data: createdBus[0]
    });

    logger.info(`User ${req.user.id} created transportation bus ${busId} with number ${bus_number}`);

  } catch (error) {
    logger.error('Error creating transportation bus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transportation bus',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get all drivers with pagination and filtering
 */
async function getDrivers(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
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
      whereConditions.push('(td.first_name LIKE ? OR td.last_name LIKE ? OR td.employee_id LIKE ? OR td.license_number LIKE ?)');
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereConditions.push('td.status = ?');
      queryParams.push(status);
    }

    // Validate sort parameters
    const allowedSortFields = ['first_name', 'last_name', 'employee_id', 'hire_date', 'license_expiry', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'first_name';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transportation_drivers td
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0].total;

    // Get drivers with assignment info
    const driversQuery = `
      SELECT
        td.id,
        td.employee_id,
        td.first_name,
        td.last_name,
        td.phone,
        td.email,
        td.license_number,
        td.license_expiry,
        td.date_of_birth,
        td.hire_date,
        td.status,
        td.created_at,
        td.updated_at,
        COUNT(DISTINCT ra.id) as active_assignments,
        CONCAT(td.first_name, ' ', td.last_name) as full_name
      FROM transportation_drivers td
      LEFT JOIN route_assignments ra ON td.id = ra.driver_id AND ra.status = 'active'
      WHERE ${whereClause}
      GROUP BY td.id
      ORDER BY td.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const drivers = await executeQuery(driversQuery, [...queryParams, parseInt(limit), offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      message: 'Transportation drivers retrieved successfully',
      data: {
        drivers,
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

    logger.info(`User ${req.user.id} retrieved transportation drivers - Page: ${page}, Total: ${total}`);

  } catch (error) {
    logger.error('Error retrieving transportation drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transportation drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Create new driver
 */
async function createDriver(req, res) {
  try {
    const {
      employee_id,
      first_name,
      last_name,
      phone,
      email,
      license_number,
      license_expiry,
      date_of_birth,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      hire_date,
      status = 'active'
    } = sanitizeInput(req.body);

    // Validate required fields
    if (!employee_id || !first_name || !last_name || !phone || !license_number || !license_expiry || !date_of_birth || !hire_date) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, name, phone, license details, date of birth, and hire date are required'
      });
    }

    // Only admins can create drivers
    if (req.user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create drivers'
      });
    }

    // Check if employee ID or license number already exists
    const existingDriverQuery = 'SELECT id FROM transportation_drivers WHERE employee_id = ? OR license_number = ?';
    const existingDriver = await executeQuery(existingDriverQuery, [employee_id, license_number]);

    if (existingDriver.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Employee ID or license number already exists'
      });
    }

    // Create driver
    const insertQuery = `
      INSERT INTO transportation_drivers (
        employee_id, first_name, last_name, phone, email, license_number,
        license_expiry, date_of_birth, address, emergency_contact_name,
        emergency_contact_phone, hire_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      employee_id, first_name, last_name, phone, email, license_number,
      license_expiry, date_of_birth, address, emergency_contact_name,
      emergency_contact_phone, hire_date, status
    ];

    const result = await executeQuery(insertQuery, insertParams);
    const driverId = result.insertId;

    // Get the created driver
    const createdDriver = await executeQuery(`
      SELECT
        td.id,
        td.employee_id,
        td.first_name,
        td.last_name,
        td.phone,
        td.email,
        td.license_number,
        td.license_expiry,
        td.date_of_birth,
        td.address,
        td.emergency_contact_name,
        td.emergency_contact_phone,
        td.hire_date,
        td.status,
        td.created_at,
        td.updated_at,
        CONCAT(td.first_name, ' ', td.last_name) as full_name
      FROM transportation_drivers td
      WHERE td.id = ?
    `, [driverId]);

    res.status(201).json({
      success: true,
      message: 'Transportation driver created successfully',
      data: createdDriver[0]
    });

    logger.info(`User ${req.user.id} created transportation driver ${driverId} with employee ID ${employee_id}`);

  } catch (error) {
    logger.error('Error creating transportation driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transportation driver',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  getRoutes,
  getRouteById,
  createRoute,
  getBuses,
  createBus,
  getDrivers,
  createDriver
};
