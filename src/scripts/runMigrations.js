#!/usr/bin/env node

const path = require('path');
const { connectDatabase } = require('../config/database');
const MigrationRunner = require('../migrations/migrationRunner');
const logger = require('../utils/logger');

async function runMigrations() {
  try {
    logger.info('Starting database migration process...');
    
    // Connect to database
    await connectDatabase();
    logger.info('Database connection established');
    
    // Create migration runner instance
    const migrationRunner = new MigrationRunner();
    
    // Run all pending migrations
    await migrationRunner.runMigrations();
    
    logger.info('Database migration process completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration process failed:', error);
    process.exit(1);
  }
}

async function rollbackMigration() {
  try {
    const migrationFile = process.argv[3];
    if (!migrationFile) {
      logger.error('Please provide migration filename to rollback');
      process.exit(1);
    }
    
    logger.info(`Starting rollback for migration: ${migrationFile}`);
    
    // Connect to database
    await connectDatabase();
    logger.info('Database connection established');
    
    // Create migration runner instance
    const migrationRunner = new MigrationRunner();
    
    // Rollback specific migration
    await migrationRunner.rollbackMigration(migrationFile);
    
    logger.info('Migration rollback completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration rollback failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
  case 'up':
  case 'migrate':
    runMigrations();
    break;
  case 'down':
  case 'rollback':
    rollbackMigration();
    break;
  default:
    console.log('Usage:');
    console.log('  node runMigrations.js up|migrate     - Run all pending migrations');
    console.log('  node runMigrations.js down|rollback <filename> - Rollback specific migration');
    process.exit(1);
}
