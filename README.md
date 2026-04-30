# Felicity Event Management System

Full-stack MERN application to manage Felicity and campus events, clubs, registrations, payments, feedback, and discussions with strict role-based access control.

---

## 1. Project Structure

```
2024101034/
├── backend/        # Node.js + Express + MongoDB API
├── frontend/       # React (Vite) single-page application
├── deployment.txt  # Notes for deployment
└── README.md       # This file
```

---

## 2. Libraries, Frameworks, and Justifications

### 2.1 Frontend (React + Vite)

- **React (with Vite)**
  - **Why**: React provides a component-based model and stateful UI, which fits the multi-role, multi-page dashboard style application (participant, organizer, admin) with many reusable components (`EventCard`, `EventDetails`, `DiscussionForum`, `FeedbackSystem`, dashboards).
  - **What it solves**: Declarative rendering for complex conditional UI, easy composition of pages, and efficient re-rendering when data changes.

- **Vite**
  - **Why**: Vite offers fast dev server and build pipeline with minimal configuration for React.
  - **What it solves**: Much faster local iteration than traditional bundlers (no heavy Webpack config), built-in HMR and sensible defaults.

- **React Router DOM**
  - **Why**: Needed for SPA-style navigation between many routes: dashboards, event details, forum, feedback, admin tools, etc.
  - **What it solves**: Client-side routing with nested routes and route protection (`ProtectedRoute`) for role-based access. It keeps the app as a single-page application with good UX.

- **React Context API (custom contexts)**
  - `AuthContext`: manages logged-in user, JWT token, and helper methods (`login`, `logout`, `updateProfile`, `updatePassword`).
  - `DataContext`: manages global event list and helper operations (`addEvent`, `updateEvent`, `deleteEvent`, `registerForEvent`).
  - **Why**: Context is lightweight and sufficient for this app’s shared state; no need for heavier state managers (Redux) given the well-scoped global state.
  - **What it solves**: Avoids prop drilling for authentication and shared event data across many components and pages.

- **Plain CSS (modularised per component/page)**
  - Example: `EventDetails.css`, `ParticipantDashboard.css`, `ClubManagement.css`, `Toast.css`, etc.
  - **Why**: For an academic project with custom layout and theme, plain CSS keeps dependencies minimal and makes it easy to see styling in one place per component.
  - **What it solves**: Component-scoped styling without adding a UI library; fine-grained control for responsive layout and dashboards.

- **Browser Fetch API**
  - Wrapped in `frontend/src/utils/api.js`.
  - **Why**: Native, no extra dependency (like axios) required.
  - **What it solves**: All HTTP calls structured in one place, automatically attaching auth tokens and handling JSON responses and errors.

### 2.2 Backend (Node.js + Express + MongoDB)

- **Node.js + Express**
  - **Why**: Standard stack for REST APIs with good ecosystem and easy integration with MongoDB.
  - **What it solves**: Route definitions for the many resources: authentication, events, registrations, clubs, admin features, discussions, feedback.

- **MongoDB + Mongoose**
  - **Why**: Flexible schema fits evolving event/registration structures (e.g. dynamic `customFields`, nested merchandise `variants`, embedded `replies` and `reactions` in discussions).
  - **What it solves**: Document modeling for:
    - `User`, `Event`, `Club`, `Registration`, `Team`, `Feedback`, `Discussion`, `PasswordResetRequest`.
    - Validation and hooks (e.g. auto-hash passwords, auto-recalculate event rating when feedback changes).

- **bcryptjs**
  - **Why**: Secure password hashing for `User` passwords.
  - **What it solves**: One-way storage of passwords; used in `User` model pre-save hook and `matchPassword` method.

- **jsonwebtoken (JWT)**
  - **Why**: Stateless authentication shared between backend and frontend.
  - **What it solves**: Encodes user id and role; `protect` middleware validates the token and attaches `req.user`. Used for all protected routes (participant, organizer, admin).

- **Multer**
  - **Why**: File upload middleware for Node/Express.
  - **What it solves**: Handling participant-uploaded payment screenshots (`/registrations/:id/payment-proof`) for merchandise and paid events; integrated into payment verification flows.

- **CORS**
  - **Why**: Allow frontend (Vite dev server) and backend (Express) to communicate during development.
  - **What it solves**: Cross-origin restrictions when calling `http://localhost:5000/api` from the frontend dev origin.

- **Nodemailer (used inside `utils/mailer.js`)**
  - **Why**: Send system emails: organizer provisioning credentials, organizer password resets, event approval notifications.
  - **What it solves**: External communication and credential delivery as per assignment requirement for admin-provisioned organizer accounts.

- **qrcode**
  - **Why**: Generate QR codes for registrations and tickets.
  - **What it solves**: Encodes ticket ids into QR images (stored in `Registration.ticketQr`), which are scanned by the `QRScanner` for attendance.

---

## 3. Advanced Features by Tier (With Justification and Design Notes)

### 3.1 Tier A Features

#### 3.1.1 Team-Based Registration (Invite Workflow)

- **What**:
  - Team registration via `Team` model with invite tokens and status.
  - Flow:
    - Leader creates team (`POST /api/registrations/team/create`).
    - Invited members accept or decline invites either via token links or in-app inbox.
    - When team is complete, registrations for all members are auto-created.
- **Why this feature**:
  - Team events are central to campus fests (hackathons, competitions). This feature offers realistic support for team formation and management instead of a trivial “team size” field.
- **Design and technical decisions**:
  - `Team` schema holds:
    - `leader`, `members`, `desiredTeamSize`, `invites` (each with token and status), `status` (forming/completed).
  - `normalizeEligibility` and capacity checks reused from regular registrations.
  - When all accepted and team is valid, `completeTeamIfReady` creates actual `Registration` documents for each member and issues tickets via `issueTicket`.
  - For merchandise events, team registration is explicitly disallowed in backend and UI to avoid ambiguous payment semantics.

#### 3.1.2 Payment Approval Workflow and Merchandise Store

- **What**:
  - Merchandise events (`Event.type === 'Merchandise'`) with:
    - Inventory: per-variant stock (`merchandise.variants`) or global stock.
    - Purchase limits per participant.
    - Payment proof uploads by participants.
    - Organizer payment approval UI (`PaymentApproval` page) and organizer-specific view in `RegistrationManagement`.
- **Why this feature**:
  - Festival T-shirts and merchandise sales are a major real-world requirement. The assignment’s Tier A explicitly mentions payment approval and merchandise, which are implemented end-to-end.
- **Design and technical decisions**:
  - **Event model**:
    - `merchandise` embedded object: `sizes`, `colors`, `variants` (with price and stock), `stock`, `purchaseLimit`.
  - **Registration model**:
    - Merchandise-specific fields in registration (`merchandise` subdocument with size/color/quantity/pricing).
    - Payment fields: `paymentAmount`, `paymentStatus`, `paymentApprovalStatus`, `paymentScreenshot`.
  - **Backend logic**:
    - `registerForEvent`:
      - For merchandise:
        - Enforces per-user purchase limit based on previous orders.
        - Ensures stock is available (variant or global).
        - Calculates `paymentAmount` and sets `paymentApprovalStatus` to `awaiting-proof` when needed.
    - `uploadPaymentProof`:
      - Uses Multer to store screenshot and transitions approval status from `awaiting-proof` to `pending`.
    - `updatePaymentStatus`:
      - Organizer verifies payment, updates status to `approved` or `rejected`.
      - On approval, decrements stock and issues ticket (QR) via `issueTicket`.
  - **Frontend**:
    - **ParticipantDashboard**:
      - Show merchandise orders with explicit “Awaiting Proof”, “Pending”, “Approved”, “Rejected” states.
      - Allows screenshot upload / re-upload.
    - **RegistrationManagement** and **PaymentApproval**:
      - Provide organizer dashboards to review proofs, approve/reject, and see revenue analytics.

### 3.2 Tier B Features

#### 3.2.1 Real-Time Discussion Forum (Per Event) with Notifications

- **What**:
  - Discussion forum for each event (`/forum/:eventId` and embedded in `EventDetails`).
  - Features:
    - Threads with categories (General, Questions, Technical, Suggestions, Issues, Announcements).
    - Announcements and pinned threads (organizer/admin-only).
    - Nested replies and message threading.
    - Reactions on threads and replies.
    - Polling-based “live updates” with a notification badge and toast notifications.
- **Why this feature**:
  - Tier B explicitly mentions a real-time discussion forum with moderation, announcements, and reactions. This module addresses participant-organizer communication efficiently.
- **Design and technical decisions**:
  - **Backend**:
    - `Discussion` model with embedded `replies` and `reactions`.
    - Routes under `/api/discussions`:
      - CRUD for threads and replies, reactions, pin toggle.
  - **Frontend**:
    - `DiscussionForum` component:
      - Polls every 8 seconds.
      - Maintains a baseline snapshot and compares counts to detect new threads/replies.
      - Increments a “new updates” counter and shows toast notifications (top-right) when new data is detected.
      - Organizer moderation:
        - Delete thread/reply.
        - Pin/unpin threads.
        - Only organizers/admins can post announcements.
      - Reactions implemented via a configurable reaction set.
    - Uses existing `Toast` system to show non-intrusive, top-right notifications.

#### 3.2.2 Organizer Password Reset Workflow

- **What**:
  - Organizer-initiated password reset requests and admin review process.
- **Why this feature**:
  - Tier B points to more advanced user management flows. This meets the requirement that organizer accounts are provisioned and controlled by admin, not self-service.
- **Design and technical decisions**:
  - `PasswordResetRequest` model:
    - Tracks `organizer`, `status` (Pending/Approved/Rejected), `reason`, `adminComment`, `generatedPassword`, and `history`.
  - Organizer endpoints (`/api/auth/organizer/...`):
    - Submit reset request with reason.
    - View own request history.
  - Admin endpoints (`/api/admin/password-reset-requests`):
    - List, filter by status.
    - Approve or reject request; on approval generates a fresh password, updates user, sends email, and returns credentials to admin.
  - **UserManagement** page:
    - Shows reset requests table.
    - Modal to review and approve/reject with comments.
  - **ProfilePage** for organizers:
    - UI to submit reset requests with reason and view their history.

### 3.3 Tier C Features

#### 3.3.1 Feedback and Rating System with Analytics and Export

- **What**:
  - Event-specific feedback system:
    - Participants can rate (1–5) and comment (optionally anonymous).
    - Organizer/admin can view aggregate statistics and export CSV.
- **Why this feature**:
  - Tier C mentions analytics and advanced feedback; this provides organizers with actionable insights and data portability.
- **Design and technical decisions**:
  - **Backend**:
    - `Feedback` model with:
      - `rating`, `comment`, `categories`, `isAnonymous`, `helpful` count.
    - Hooks on `save` and `delete` update `Event.averageRating` and `Event.totalFeedbacks`.
    - Endpoints:
      - List feedback for an event with filters and stats.
      - Mark feedback as helpful (per user).
      - Export CSV (`/feedback/event/:eventId/export`).
  - **Frontend**:
    - `FeedbackSystem` component:
      - Shows overall average score and rating distribution.
      - List of feedback cards with per-feedback stars, author (or “Anonymous”), and “Mark as helpful”.
      - CSV export button for organizers/admins which downloads a file from the backend export endpoint.
      - Enforces eligibility:
        - Feedback only after event ends.
        - Only confirmed registrations may submit.
        - One feedback per user per event.

#### 3.3.2 Admin and Organizer Dashboards with Aggregated Analytics

- **What**:
  - Dashboards for both admin and organizer views:
    - Admin dashboard with high-level system stats (users by role, events by status, registrations, payments, clubs, recent activity).
    - Organizer dashboard with event counts, registration stats, completed event analytics, and quick actions.
- **Why this feature**:
  - Tier C encourages analytics and system-wide insights. Dashboards make it easy for stakeholders to monitor the system without manual queries.
- **Design and technical decisions**:
  - **Admin**:
    - `getSystemStats` aggregates counts from `User`, `Event`, `Registration`, `Club`.
    - Frontend `AdminDashboard` renders metrics, recent events/users, and quick links (event approval, clubs, users).
  - **Organizer**:
    - `OrganizerDashboard`:
      - Computes stats from events owned by the organizer and associated registrations.
      - Shows cards for total events, total registrations, pending approvals, past events, and completed event analytics.
      - Displays recent registrations and quick navigation to registrations/event management.

---

## 4. Setup and Installation Instructions

### 4.1 Prerequisites

- Node.js 18 or later.
- npm or yarn.
- MongoDB:
  - Either a local MongoDB instance, or
  - MongoDB Atlas connection string.
- A mail SMTP account (for organizer provisioning and reset emails) or a dummy SMTP for local testing.

### 4.2 Backend Setup (`backend/`)

1. Navigate to backend folder:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment:

   ```bash
   cp .env.example .env
   # Edit .env to set:
   # - MONGODB_URI
   # - JWT_SECRET
   # - FRONTEND_URL
   # - SMTP_* values
   ```

4. Run development server:

   ```bash
   npm run dev
   ```

5. Backend base URL (default):

   - `http://localhost:5000`
   - API root: `http://localhost:5000/api`
   - Health check: `http://localhost:5000/health`

### 4.3 Frontend Setup (`frontend/`)

1. Navigate to frontend folder:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure API URL (if needed):

   - In `frontend/.env` (or `.env.local`), set:

   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. Run dev server:

   ```bash
   npm run dev
   ```

5. Frontend dev URL:

   - Typically `http://localhost:5173` or `http://localhost:5174` (reported by Vite).

### 4.4 Running Full System

1. Start backend (`npm run dev` in `backend/`).
2. Start frontend (`npm run dev` in `frontend/`).
3. Open the frontend URL in a browser and log in using:
   - Admin / organizer / participant seeded users (see `backend/scripts/seedUsers.js` and `frontend/README.md` for example credentials).

---

## 5. Role Overview

- **Participant**
  - Browse events, register (individual or via teams), manage tickets and merchandise purchases, provide feedback, participate in discussions.

- **Organizer**
  - Create and manage events and merchandise.
  - Approve registrations and payments.
  - Use QR scanner for attendance.
  - Moderate discussions and read analytics.

- **Admin**
  - Approve/reject events.
  - Manage clubs and organizer accounts.
  - Handle organizer password reset requests.
  - View system-wide metrics.

---

## 6. Notes

- UI is implemented using custom CSS (no external UI library), which was a deliberate choice to keep the project dependencies simple and the styling transparent for grading.
- All advanced features specified in the assignment (Tier A/B/C) are implemented as described above, with security and data consistency enforced at the backend level and validated at the frontend.

