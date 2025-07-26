const fs = require('fs').promises;
const path = require('path');
const { executeQuery, executeTransaction } = require('../config/database');
const logger = require('../utils/logger');

class MigrationRunner {
  constructor() {
    this.migrationsPath = __dirname;
  }

  async createMigrationsTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_filename (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await executeQuery(createTableQuery);
    logger.info('Migrations table created or already exists');
  }

  async getExecutedMigrations() {
    try {
      const result = await executeQuery('SELECT filename FROM migrations ORDER BY executed_at');
      return result.map(row => row.filename);
    } catch (error) {
      logger.error('Error fetching executed migrations:', error);
      return [];
    }
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.js') && file !== 'migrationRunner.js')
        .sort();
    } catch (error) {
      logger.error('Error reading migration files:', error);
      return [];
    }
  }

  async executeMigration(filename) {
    try {
      const migrationPath = path.join(this.migrationsPath, filename);
      const migration = require(migrationPath);
      
      logger.info(`Executing migration: ${filename}`);
      
      if (typeof migration.up === 'function') {
        await migration.up();
      } else if (typeof migration === 'function') {
        await migration();
      } else {
        throw new Error(`Invalid migration format in ${filename}`);
      }
      
      // Record the migration as executed
      await executeQuery(
        'INSERT INTO migrations (filename) VALUES (?)',
        [filename]
      );
      
      logger.info(`Migration completed: ${filename}`);
    } catch (error) {
      logger.error(`Migration failed: ${filename}`, error);
      throw error;
    }
  }

  async runMigrations() {
    try {
      await this.createMigrationsTable();
      
      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = await this.getMigrationFiles();
      
      const pendingMigrations = migrationFiles.filter(
        file => !executedMigrations.includes(file)
      );
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to execute');
        return;
      }
      
      logger.info(`Found ${pendingMigrations.length} pending migrations`);
      
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }
      
      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration process failed:', error);
      throw error;
    }
  }

  async rollbackMigration(filename) {
    try {
      const migrationPath = path.join(this.migrationsPath, filename);
      const migration = require(migrationPath);
      
      if (typeof migration.down === 'function') {
        logger.info(`Rolling back migration: ${filename}`);
        await migration.down();
        
        // Remove from migrations table
        await executeQuery(
          'DELETE FROM migrations WHERE filename = ?',
          [filename]
        );
        
        logger.info(`Migration rolled back: ${filename}`);
      } else {
        logger.warn(`No rollback function found for migration: ${filename}`);
      }
    } catch (error) {
      logger.error(`Rollback failed: ${filename}`, error);
      throw error;
    }
  }
}

module.exports = MigrationRunner;
