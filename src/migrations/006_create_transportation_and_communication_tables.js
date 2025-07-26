const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const up = async () => {
  logger.info('Creating transportation and communication tables...');

  // Vehicles table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      vehicle_number VARCHAR(20) NOT NULL UNIQUE,
      vehicle_type ENUM('school_bus', 'mini_bus', 'van', 'car', 'truck') NOT NULL,
      model VARCHAR(100),
      manufacturer VARCHAR(100),
      year_of_manufacture YEAR,
      capacity INT NOT NULL,
      fuel_type ENUM('petrol', 'diesel', 'cng', 'electric', 'hybrid') DEFAULT 'diesel',
      registration_date DATE,
      insurance_expiry DATE,
      fitness_certificate_expiry DATE,
      pollution_certificate_expiry DATE,
      last_maintenance_date DATE,
      next_maintenance_date DATE,
      mileage DECIMAL(8,2),
      status ENUM('active', 'inactive', 'under_maintenance', 'out_of_service') DEFAULT 'active',
      notes TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_vehicle_number (vehicle_number),
      INDEX idx_vehicle_type (vehicle_type),
      INDEX idx_status (status),
      INDEX idx_insurance_expiry (insurance_expiry),
      INDEX idx_next_maintenance_date (next_maintenance_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Drivers table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      user_id INT,
      employee_id VARCHAR(20) UNIQUE,
      license_number VARCHAR(50) NOT NULL UNIQUE,
      license_type VARCHAR(20),
      license_expiry DATE,
      experience_years INT DEFAULT 0,
      phone VARCHAR(20),
      emergency_contact_name VARCHAR(100),
      emergency_contact_phone VARCHAR(20),
      address TEXT,
      status ENUM('active', 'inactive', 'on_leave', 'terminated') DEFAULT 'active',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_employee_id (employee_id),
      INDEX idx_license_number (license_number),
      INDEX idx_license_expiry (license_expiry),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Routes table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS routes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      route_name VARCHAR(100) NOT NULL,
      route_code VARCHAR(20) UNIQUE,
      description TEXT,
      start_location VARCHAR(200),
      end_location VARCHAR(200),
      total_distance DECIMAL(6,2), -- in km
      estimated_duration INT, -- in minutes
      vehicle_id INT,
      driver_id INT,
      conductor_id INT,
      morning_start_time TIME,
      evening_start_time TIME,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
      FOREIGN KEY (conductor_id) REFERENCES drivers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_route_name (route_name),
      INDEX idx_route_code (route_code),
      INDEX idx_vehicle_id (vehicle_id),
      INDEX idx_driver_id (driver_id),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Route stops table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS route_stops (
      id INT AUTO_INCREMENT PRIMARY KEY,
      route_id INT NOT NULL,
      stop_name VARCHAR(100) NOT NULL,
      stop_address TEXT,
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      stop_order INT NOT NULL,
      morning_pickup_time TIME,
      evening_pickup_time TIME,
      is_active BOOLEAN DEFAULT TRUE,
      
      FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
      INDEX idx_route_id (route_id),
      INDEX idx_stop_order (stop_order),
      INDEX idx_coordinates (latitude, longitude),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Student transportation assignments
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS student_transportation (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      route_id INT NOT NULL,
      pickup_stop_id INT NOT NULL,
      drop_stop_id INT,
      monthly_fee DECIMAL(8,2),
      start_date DATE NOT NULL,
      end_date DATE,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
      FOREIGN KEY (pickup_stop_id) REFERENCES route_stops(id) ON DELETE CASCADE,
      FOREIGN KEY (drop_stop_id) REFERENCES route_stops(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_student_id (student_id),
      INDEX idx_route_id (route_id),
      INDEX idx_pickup_stop_id (pickup_stop_id),
      INDEX idx_is_active (is_active),
      UNIQUE KEY unique_active_student_transport (student_id, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Vehicle maintenance records
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS vehicle_maintenance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vehicle_id INT NOT NULL,
      maintenance_type ENUM('routine', 'repair', 'inspection', 'emergency') NOT NULL,
      description TEXT NOT NULL,
      maintenance_date DATE NOT NULL,
      cost DECIMAL(10,2),
      service_provider VARCHAR(100),
      next_service_date DATE,
      odometer_reading DECIMAL(10,2),
      parts_replaced TEXT,
      notes TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_vehicle_id (vehicle_id),
      INDEX idx_maintenance_type (maintenance_type),
      INDEX idx_maintenance_date (maintenance_date),
      INDEX idx_next_service_date (next_service_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Communication tables

  // Messages table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      sender_id INT NOT NULL,
      subject VARCHAR(200) NOT NULL,
      message_body TEXT NOT NULL,
      message_type ENUM('announcement', 'notice', 'personal', 'emergency', 'reminder') DEFAULT 'personal',
      priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
      is_draft BOOLEAN DEFAULT FALSE,
      scheduled_at TIMESTAMP NULL,
      sent_at TIMESTAMP NULL,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_sender_id (sender_id),
      INDEX idx_message_type (message_type),
      INDEX idx_priority (priority),
      INDEX idx_is_draft (is_draft),
      INDEX idx_scheduled_at (scheduled_at),
      INDEX idx_sent_at (sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Message recipients table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS message_recipients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_id INT NOT NULL,
      recipient_id INT NOT NULL,
      recipient_type ENUM('individual', 'class', 'grade', 'all_students', 'all_teachers', 'all_parents') DEFAULT 'individual',
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP NULL,
      is_archived BOOLEAN DEFAULT FALSE,
      
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_message_id (message_id),
      INDEX idx_recipient_id (recipient_id),
      INDEX idx_recipient_type (recipient_type),
      INDEX idx_is_read (is_read),
      INDEX idx_is_archived (is_archived),
      UNIQUE KEY unique_message_recipient (message_id, recipient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Events table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      event_type ENUM('academic', 'sports', 'cultural', 'social', 'meeting', 'workshop', 'ceremony', 'holiday', 'other') NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      start_time TIME,
      end_time TIME,
      location VARCHAR(200),
      organizer VARCHAR(100),
      capacity INT,
      registration_required BOOLEAN DEFAULT FALSE,
      registration_deadline DATE,
      is_public BOOLEAN DEFAULT TRUE,
      status ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed') DEFAULT 'scheduled',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_uuid (uuid),
      INDEX idx_title (title),
      INDEX idx_event_type (event_type),
      INDEX idx_start_date (start_date),
      INDEX idx_end_date (end_date),
      INDEX idx_status (status),
      INDEX idx_is_public (is_public)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  logger.info('Transportation and communication tables created successfully');
};

const down = async () => {
  logger.info('Dropping transportation and communication tables...');
  
  await executeQuery('DROP TABLE IF EXISTS events');
  await executeQuery('DROP TABLE IF EXISTS message_recipients');
  await executeQuery('DROP TABLE IF EXISTS messages');
  await executeQuery('DROP TABLE IF EXISTS vehicle_maintenance');
  await executeQuery('DROP TABLE IF EXISTS student_transportation');
  await executeQuery('DROP TABLE IF EXISTS route_stops');
  await executeQuery('DROP TABLE IF EXISTS routes');
  await executeQuery('DROP TABLE IF EXISTS drivers');
  await executeQuery('DROP TABLE IF EXISTS vehicles');
  
  logger.info('Transportation and communication tables dropped');
};

module.exports = { up, down };
