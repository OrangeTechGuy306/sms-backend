-- =============================================
-- INSERT DEFAULT ROLES FOR SCHOOL MANAGEMENT SYSTEM
-- =============================================
-- Execute this script to ensure default roles exist

USE school_management_system;

-- Insert default roles (IGNORE prevents duplicates)
INSERT IGNORE INTO roles (name, description, is_system_role, permissions) VALUES
('Super Admin', 'Full system access', TRUE, '["*"]'),
('Principal', 'School administration access', TRUE, '["users.*", "academic.*", "reports.*"]'),
('Vice Principal', 'Assistant administration access', TRUE, '["academic.*", "students.*", "teachers.*"]'),
('Teacher', 'Teaching and class management', TRUE, '["classes.*", "students.read", "grades.*", "attendance.*"]'),
('Student', 'Student portal access', TRUE, '["profile.read", "grades.read", "attendance.read"]'),
('Parent', 'Parent portal access', TRUE, '["children.*", "fees.*", "communication.*"]'),
('Librarian', 'Library management', TRUE, '["library.*", "books.*"]'),
('Accountant', 'Financial management', TRUE, '["fees.*", "payments.*", "financial_reports.*"]');

-- Verify roles were inserted
SELECT 'Roles inserted successfully!' as message;
SELECT id, name, description FROM roles ORDER BY id;
