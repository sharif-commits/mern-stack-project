# Event Management System - Backend API

## Phase 1: Foundation & Authentication ✅

### Completed Features:
- MongoDB database connection
- User authentication (Register/Login with JWT)
- Password hashing with bcrypt
- Role-based access control (Participant, Organizer, Admin)
- Protected routes middleware
- Error handling middleware

### Models Created:
- **User**: Authentication and user management
- **Club**: Club/organization management
- **Event**: Event information and settings
- **Registration**: Event registrations and tickets

### API Endpoints:

#### Authentication Routes (`/api/auth`)
- `POST /api/auth/register` - Register new participant
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (Protected)
- `PUT /api/auth/updateprofile` - Update user profile (Protected)
- `PUT /api/auth/updatepassword` - Update password (Protected)

### Setup Instructions:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   - Copy `.env.example` to `.env`
   - Update MongoDB URI and JWT secret

3. **Start MongoDB**:
   ```bash
   # Make sure MongoDB is running on your system
   mongod
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

5. **Test the API**:
   ```bash
   # Health check
   curl http://localhost:5000/health
   ```

### Environment Variables:
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/event_management
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5174
```

### Next Phases:
- Phase 2: Event Management APIs
- Phase 3: Registration & Payment APIs
- Phase 4: Admin & Club Management APIs
- Phase 5: Advanced Features (Discussion, Feedback, QR)

### Tech Stack:
- Node.js & Express
- MongoDB & Mongoose
- JWT Authentication
- bcryptjs for password hashing
- CORS enabled
