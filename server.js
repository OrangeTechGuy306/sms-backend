const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('express-async-errors');
require('dotenv').config();

const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');
const { connectDatabase } = require('./src/config/database');

// Import routes
const authRoutes = require('./src/routes/auth');
const studentRoutes = require('./src/routes/students');
const studentPortalRoutes = require('./src/routes/studentPortal');
const teacherRoutes = require('./src/routes/teachers');
const teacherPortalRoutes = require('./src/routes/teacherPortal');
const adminRoutes = require('./src/routes/admin');
const subjectRoutes = require('./src/routes/subjects');
const classRoutes = require('./src/routes/classes');
const attendanceRoutes = require('./src/routes/attendance');
const resultRoutes = require('./src/routes/results');
const feeRoutes = require('./src/routes/fees');
const eventRoutes = require('./src/routes/events');
const messageRoutes = require('./src/routes/messages');
const healthRoutes = require('./src/routes/health');
const analyticsRoutes = require('./src/routes/analytics');
const fileRoutes = require('./src/routes/files');
const lessonNotesRoutes = require('./src/routes/lessonNotes');
const timetableRoutes = require('./src/routes/timetables');
const transportationRoutes = require('./src/routes/transportation');
const assessmentRoutes = require('./src/routes/assessments');
const libraryRoutes = require('./src/routes/library');
const parentRoutes = require('./src/routes/parents');
const gradeLevelRoutes = require('./src/routes/gradeLevels');
const academicYearRoutes = require('./src/routes/academicYears');

const app = express();
// Server configuration
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/student-portal', studentPortalRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/teacher-portal', teacherPortalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/lesson-notes', lessonNotesRoutes);
app.use('/api/timetables', timetableRoutes);
app.use('/api/transportation', transportationRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/grade-levels', gradeLevelRoutes);
app.use('/api/academic-years', academicYearRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Start listening
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

startServer();

module.exports = app;
