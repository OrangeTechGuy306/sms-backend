# 🚀 **QUICK DATABASE SETUP GUIDE**

## ⚡ **FASTEST SOLUTION - Execute SQL Directly**

### **Step 1: Open MySQL Client**
Choose one of these options:
- **phpMyAdmin** (if using XAMPP/WAMP)
- **MySQL Workbench**
- **Command Line MySQL**
- **HeidiSQL** or other MySQL client

### **Step 2: Execute the Setup Script**
1. **Copy the entire contents** of `backend/database/EXECUTE_THIS_IN_MYSQL.sql`
2. **Paste and execute** in your MySQL client
3. **Wait for completion** (should take 10-30 seconds)

### **Step 3: Verify Setup**
You should see output like:
```
Database setup completed successfully!
total_tables: 12
total_roles: 8
total_migrations: 2
```

## 🔧 **ALTERNATIVE: Command Line Method**

If you prefer command line:

```bash
# Navigate to the project directory
cd backend/database

# Execute the SQL file
mysql -u root -p school_management_system < EXECUTE_THIS_IN_MYSQL.sql

# Or if database doesn't exist yet:
mysql -u root -p < EXECUTE_THIS_IN_MYSQL.sql
```

## 📊 **What Gets Created**

### **Core Tables (12 tables)**
1. ✅ `migrations` - Migration tracking
2. ✅ `users` - All user types (admin, teacher, student, parent)
3. ✅ `roles` - Role-based access control
4. ✅ `user_roles` - User-role assignments
5. ✅ `password_reset_tokens` - Password recovery
6. ✅ `academic_years` - Academic year management
7. ✅ `subjects` - Subject catalog
8. ✅ `classes` - Class organization
9. ✅ `students` - Student profiles
10. ✅ `teachers` - Teacher profiles
11. ✅ `parents` - Parent profiles
12. ✅ `student_parents` - Student-parent relationships

### **Default Data Inserted**
- ✅ **8 System Roles**: Super Admin, Principal, Vice Principal, Teacher, Student, Parent, Librarian, Accountant
- ✅ **Migration Records**: Tracks which migrations have been executed

## 🎯 **Next Steps After Database Setup**

### **1. Create Admin User**
```sql
-- Insert admin user (replace with your details)
INSERT INTO users (uuid, email, password_hash, user_type, first_name, last_name, status, email_verified) 
VALUES (UUID(), 'admin@yourschool.com', '$2b$10$your_bcrypt_hashed_password', 'admin', 'System', 'Administrator', 'active', TRUE);

-- Assign Super Admin role
INSERT INTO user_roles (user_id, role_id) 
SELECT u.id, r.id FROM users u, roles r 
WHERE u.email = 'admin@yourschool.com' AND r.name = 'Super Admin';
```

### **2. Start Backend Server**
```bash
cd backend
npm run dev
```

### **3. Test API Connection**
Visit: `http://localhost:3000/api/health` (or your configured port)

### **4. Start Frontend**
```bash
cd frontend
npm run dev
```

## 🔍 **Troubleshooting**

### **Common Issues:**

**1. "Access denied" error**
```sql
-- Grant privileges to your MySQL user
GRANT ALL PRIVILEGES ON school_management_system.* TO 'your_username'@'localhost';
FLUSH PRIVILEGES;
```

**2. "Database doesn't exist" error**
- The script creates the database automatically
- Make sure you have CREATE DATABASE privileges

**3. "Table already exists" warnings**
- Safe to ignore - script uses `IF NOT EXISTS`

**4. Foreign key constraint errors**
- Script temporarily disables foreign key checks
- Re-run the script if needed

### **Verify Everything Works:**
```sql
USE school_management_system;

-- Check tables
SHOW TABLES;

-- Check roles
SELECT * FROM roles;

-- Check migrations
SELECT * FROM migrations;
```

## 🎉 **Success Indicators**

You'll know setup is successful when:
- ✅ Database `school_management_system` exists
- ✅ 12+ tables are created
- ✅ 8 roles are inserted
- ✅ 2 migration records exist
- ✅ No error messages during execution

## 📞 **Still Having Issues?**

If the SQL script doesn't work:

1. **Check MySQL version** (5.7+ recommended)
2. **Verify user privileges** (CREATE, INSERT, UPDATE, DELETE)
3. **Ensure MySQL server is running**
4. **Try running sections of the script separately**

## 🚀 **Ready for Production**

Once the database is set up, your school management system will have:
- Complete user management with role-based access
- Academic structure (years, subjects, classes)
- Student and teacher management
- Parent portal foundation
- Extensible architecture for additional features

**The core foundation is now ready!** 🎉

You can now:
1. Start the backend server
2. Create your first admin user
3. Begin adding school data through the frontend
4. Extend with additional features as needed
