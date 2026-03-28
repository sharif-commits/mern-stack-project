# Event Management System - DASS Assignment 1

A comprehensive event management platform built with the MERN stack for managing events, clubs, and participants for Felicity and other campus activities.

## 🚀 Technology Stack

- **Frontend**: React 19.2, React Router DOM 7.13, Vite 7.2
- **Backend**: Node.js, Express.js (To be implemented)
- **Database**: MongoDB (To be implemented)
- **Authentication**: JWT + bcrypt (To be implemented)

## 📋 Features Implemented

### Phase 1: Foundation & Infrastructure ✅
- ✅ Project structure setup
- ✅ Constants and utilities
- ✅ Toast notification system
- ✅ Mock data management
- ✅ Data context for centralized state
- ✅ Helper functions for validation, formatting, and filtering
- ✅ Fixed ESLint configuration

### Phase 2: Participant Features (In Progress)
- 🔄 Dashboard with upcoming events
- 🔄 Browse Events page with search and filters
- 🔄 Event Details page
- 🔄 Registration workflows
- 🔄 Profile management
- 🔄 Clubs/Organizers listing

### Phase 3: Organizer Features (Pending)
- ⏳ Dashboard with event carousel
- ⏳ Event creation and editing
- ⏳ Custom form builder
- ⏳ Event analytics
- ⏳ Participant management

### Phase 4: Admin Features (Pending)
- ⏳ Admin dashboard
- ⏳ Club/Organizer management
- ⏳ Password reset requests

### Phase 5: Advanced Features (Pending)
- ⏳ Team-based registration (Tier A)
- ⏳ Payment approval workflow (Tier A)
- ⏳ QR Scanner & Attendance (Tier A)
- ⏳ Real-time discussion forum (Tier B)
- ⏳ Password reset workflow (Tier B)
- ⏳ Anonymous feedback system (Tier C)

## 🏗️ Project Structure

```
src/
├── components/          # Reusable UI components
├── context/            # React context providers
├── utils/              # Utility functions and constants
├── pages/              # Page components (to be created)
├── assets/             # Static assets
└── App.jsx            # Main app component
```

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 👥 User Roles

1. **Participant** (IIIT / Non-IIIT)
2. **Organizer** (Clubs / Councils / Fest Teams)
3. **Admin** (System administrator)

## 🔐 Test Credentials (Mock)

### Participant
- Email: participant@iiit.ac.in
- Password: password123

### Organizer
- Email: organizer@iiit.ac.in
- Password: password123

### Admin
- Email: admin@iiit.ac.in
- Password: admin123

## 📝 Development Progress

**Current Phase**: Phase 1 Complete, Starting Phase 2

**Next Steps**:
1. Implement Participant Dashboard
2. Build Browse Events page with filters
3. Create Event Details and Registration flow
4. Implement Profile management
