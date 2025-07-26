-- Database Setup Script for School Management System
-- Run this script as MySQL root user to set up the database and user

-- Create database
CREATE DATABASE IF NOT EXISTS school_management_system 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create dedicated user for the application
CREATE USER IF NOT EXISTS 'sms_user'@'localhost' IDENTIFIED BY 'sms_secure_password_2024';

-- Grant privileges
GRANT ALL PRIVILEGES ON school_management_system.* TO 'sms_user'@'localhost';

-- Flush privileges to ensure they take effect
FLUSH PRIVILEGES;

-- Use the database
USE school_management_system;

-- Show confirmation
SELECT 'Database and user created successfully!' as Status;
SELECT 'Next steps:' as Instructions;
SELECT '1. Update your .env file with the database credentials' as Step1;
SELECT '2. Run: mysql -u sms_user -p school_management_system < database/schema.sql' as Step2;
SELECT '3. Start the application with: npm run dev' as Step3;
