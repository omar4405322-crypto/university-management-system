# University Management System

A full-stack university management system built with React, Node.js, and PostgreSQL.

## Features
- User Authentication (JWT + bcrypt)
- Role-based Access Control (Admin, Doctor, Student)
- Student and Doctor Profiles
- Dashboard for viewing profile information

## Tech Stack
- **Frontend:** React 18, Vite, Tailwind CSS, React Router v6, Axios
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL with Prisma ORM

## Prerequisites
- Node.js (v16 or higher)
- PostgreSQL database

## Setup Instructions

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Rename `.env` or create one with the following:
     ```env
     DATABASE_URL="postgresql://user:password@localhost:5432/university_db"
     JWT_SECRET="your-super-secret-key"
     JWT_EXPIRES_IN="7d"
     PORT=5000
     ```
4. Generate Prisma Client:
   ```bash
   npm run prisma:generate
   ```
5. Run migrations:
   ```bash
   npm run prisma:migrate
   ```
6. Seed the database:
   ```bash
   npm run seed
   ```
7. Start the development server:
   ```bash
   npm run dev
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`.

## Default Accounts (from seed)
- **Super Admin:** `superadmin@university.com` / `SuperAdmin123!`
- **Admin:** `admin@university.com` / `Admin123!`
- **Doctor:** `doctor@university.com` / `Password123!`
- **Student:** `student@university.com` / `Password123!`

If login is locked after failed attempts, use **"Unlock and try again"** on the login page or clear browser storage keys starting with `login_`.
