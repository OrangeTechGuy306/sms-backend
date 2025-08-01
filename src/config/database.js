const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

// Ensure environment variables are loaded
require('dotenv').config();

let pool;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'school_management_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+00:00'
};

async function connectDatabase() {
  try {
    logger.info('Attempting to connect to database with config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      password: dbConfig.password ? '[HIDDEN]' : '[EMPTY]'
    });

    pool = mysql.createPool(dbConfig);

    // Test the connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    logger.info('Database connection pool created successfully');
    return pool;
  } catch (error) {
    logger.error('Database connection failed:', error);
    logger.error('Database config used:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      password: dbConfig.password ? '[HIDDEN]' : '[EMPTY]'
    });
    throw error;
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDatabase() first.');
  }
  return pool;
}

async function executeQuery(query, params = []) {
  try {
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    logger.error('Database query error:', { query, params, error: error.message });
    throw error;
  }
}

async function executeTransaction(queries) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const results = [];
    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    logger.error('Transaction error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  connectDatabase,
  getPool,
  executeQuery,
  executeTransaction
};
