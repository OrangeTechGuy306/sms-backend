const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Muhammedokoh1050',
  multipleStatements: true,
  charset: 'utf8mb4',
  timezone: '+00:00'
};

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🚀 Starting database setup...');
    console.log('📡 Connecting to MySQL server...');
    
    // Connect to MySQL server (without specifying database)
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL server successfully');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../../database/complete_schema.sql');
    console.log('📖 Reading schema file:', schemaPath);
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    console.log('✅ Schema file loaded successfully');
    
    // Execute the schema
    console.log('🔧 Executing database schema...');
    const results = await connection.query(schemaSQL);
    console.log('✅ Database schema executed successfully');
    
    // Check if database was created
    await connection.query('USE school_management_system');
    console.log('✅ Connected to school_management_system database');
    
    // Verify tables were created
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`✅ Created ${tables.length} tables:`);
    
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });
    
    // Check if default data was inserted
    const [roles] = await connection.query('SELECT COUNT(*) as count FROM roles');
    const [categories] = await connection.query('SELECT COUNT(*) as count FROM library_categories');
    const [feeCategories] = await connection.query('SELECT COUNT(*) as count FROM fee_categories');
    const [settings] = await connection.query('SELECT COUNT(*) as count FROM system_settings');
    
    console.log('\n📊 Default data inserted:');
    console.log(`   • Roles: ${roles[0].count}`);
    console.log(`   • Library Categories: ${categories[0].count}`);
    console.log(`   • Fee Categories: ${feeCategories[0].count}`);
    console.log(`   • System Settings: ${settings[0].count}`);
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Start the backend server: npm run dev');
    console.log('   2. Create admin user through API or directly in database');
    console.log('   3. Begin adding school data through the frontend');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('🔐 Access denied. Please check your database credentials in the configuration.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Connection refused. Please ensure MySQL server is running.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('🗄️  Database does not exist. The script will create it.');
    }
    
    console.error('\n🔧 Troubleshooting:');
    console.error('   • Ensure MySQL server is running');
    console.error('   • Check database credentials in backend/src/config/database.js');
    console.error('   • Verify user has CREATE DATABASE privileges');
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('School Management System - Database Setup');
  console.log('');
  console.log('Usage: node setupDatabase.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('');
  console.log('Environment Variables:');
  console.log('  DB_HOST        Database host (default: localhost)');
  console.log('  DB_PORT        Database port (default: 3306)');
  console.log('  DB_USER        Database user (default: root)');
  console.log('  DB_PASSWORD    Database password');
  console.log('');
  process.exit(0);
}

// Run the setup
setupDatabase();
