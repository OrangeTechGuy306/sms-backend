# School Management System Backend

A comprehensive, secure Node.js backend API for a School Management System built with Express.js and MySQL2.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **User Management**: Students, Teachers, Parents, and Admin users
- **Academic Management**: Subjects, Classes, Grades, Results, Attendance
- **Financial Management**: Fee tracking, Payment processing, Invoicing
- **Communication**: Messaging system, Notifications, Announcements
- **Health Records**: Medical information, Vaccinations, Nurse visits
- **Analytics & Reporting**: Comprehensive dashboard and reports
- **File Management**: Document upload/download with security
- **Security**: Input validation, Rate limiting, Password hashing, SQL injection prevention

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL 8.0+
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Validation**: express-validator
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate limiting
- **File Upload**: Multer

## Prerequisites

- Node.js (v16 or higher)
- MySQL 8.0 or higher
- npm or yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=school_management_system
   DB_USER=your_mysql_username
   DB_PASSWORD=your_mysql_password
   
   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key_here
   ```

4. **Set up MySQL Database**
   
   Create the database and user:
   ```sql
   CREATE DATABASE school_management_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'sms_user'@'localhost' IDENTIFIED BY 'your_secure_password';
   GRANT ALL PRIVILEGES ON school_management_system.* TO 'sms_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

5. **Run database schema**
   ```bash
   mysql -u your_username -p school_management_system < database/schema.sql
   ```

6. **Create uploads directory**
   ```bash
   mkdir uploads
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000` (or the port specified in your .env file).

## API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/change-password` - Change password (authenticated)

### User Management Endpoints

- `GET /api/students` - List students
- `POST /api/students` - Create student
- `GET /api/students/:id` - Get student details
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

- `GET /api/teachers` - List teachers
- `POST /api/teachers` - Create teacher
- `GET /api/teachers/:id` - Get teacher details
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher

### Academic Management Endpoints

- `GET /api/subjects` - List subjects
- `POST /api/subjects` - Create subject
- `GET /api/classes` - List classes
- `POST /api/classes` - Create class
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance` - Mark attendance
- `GET /api/results` - Get results
- `POST /api/results` - Create result

### Other Endpoints

- `GET /api/fees` - Fee management
- `GET /api/events` - Event management
- `GET /api/messages` - Messaging system
- `GET /api/health-records` - Health records
- `GET /api/analytics` - Analytics and reports
- `POST /api/files/upload` - File upload

## Security Features

1. **Authentication**: JWT-based authentication with access and refresh tokens
2. **Authorization**: Role-based access control (Student, Teacher, Parent, Admin)
3. **Password Security**: bcrypt hashing with configurable rounds
4. **Input Validation**: Comprehensive validation using express-validator
5. **Rate Limiting**: Configurable rate limiting to prevent abuse
6. **CORS**: Configurable CORS settings
7. **Helmet**: Security headers for protection against common vulnerabilities
8. **SQL Injection Prevention**: Parameterized queries with mysql2
9. **File Upload Security**: File type and size validation
10. **Audit Logging**: Comprehensive logging of all actions

## Database Schema

The database includes the following main entities:

- **Users**: Base user table with authentication
- **Students**: Student profiles and academic information
- **Teachers**: Teacher profiles and assignments
- **Parents**: Parent/guardian information
- **Admins**: Administrative users
- **Classes**: Class organization
- **Subjects**: Subject management
- **Attendance**: Daily attendance tracking
- **Results**: Academic results and grades
- **Fees**: Financial management
- **Messages**: Communication system
- **Events**: Event management
- **Health Records**: Medical information
- **Files**: Document management

## Error Handling

The API uses consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message",
      "value": "invalid_value"
    }
  ]
}
```

## Logging

The application uses Winston for logging with the following levels:
- `error`: Error messages
- `warn`: Warning messages
- `info`: Informational messages
- `debug`: Debug messages (development only)

Logs are stored in:
- `logs/error.log`: Error logs only
- `logs/combined.log`: All logs
- Console output (development mode)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 3306 |
| `DB_NAME` | Database name | school_management_system |
| `DB_USER` | Database user | root |
| `DB_PASSWORD` | Database password | |
| `JWT_SECRET` | JWT secret key | |
| `JWT_EXPIRES_IN` | JWT expiration | 24h |
| `BCRYPT_ROUNDS` | Password hash rounds | 12 |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit max requests | 100 |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:3000 |

## Development

### Project Structure
```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── models/          # Database models (if using ORM)
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── validators/      # Input validation
├── database/            # Database schema and migrations
├── logs/               # Log files
├── uploads/            # File uploads
├── .env                # Environment variables
├── .env.example        # Environment template
├── server.js           # Main server file
└── package.json        # Dependencies
```

### Adding New Features

1. Create route handlers in `src/routes/`
2. Implement business logic in `src/controllers/`
3. Add validation rules in `src/utils/validation.js`
4. Update database schema if needed
5. Add appropriate middleware for authentication/authorization
6. Write tests for new functionality

## Contributing

1. Follow the existing code style and patterns
2. Add proper error handling and validation
3. Include appropriate logging
4. Update documentation
5. Test thoroughly before submitting

## License

This project is licensed under the ISC License.
