# StudyX — Multi-Tenant School ERP & Academic Intelligence

A production-grade multi-tenant SaaS platform serving **Super Admin (Platform Owner)**, **School Admin**, **Faculty**, **Student**, and **Parent** roles with strict database-level tenant isolation and subscription kill-switch controls.

## Tech Stack
- **Frontend (`/client`)**: React (Vite), Tailwind CSS v4, React Router, TanStack Query, React Hook Form + Zod, Recharts, Axios
- **Backend (`/server`)**: Node.js, Express, Mongoose (MongoDB), JWT (access + refresh), bcrypt, RBAC, Zod, PDFKit, node-cron, OpenAPI/Swagger (`/api/docs`)
- **Multi-Tenancy**: `AsyncLocalStorage` tenant context + Mongoose `tenantPlugin` automatically scoping all queries & writes by `schoolId`.

## Quick Start

### 1. Environment Setup
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### 2. Install Dependencies
```bash
npm --prefix server install
npm --prefix client install
```

### 3. Migrate Existing Data & Seed SaaS Demo Data
```bash
npm --prefix server run migrate
npm run seed
```
Demo accounts (password `Password@123`):
- **Super Admin**: `superadmin@schoolcloud.io`
- **School Admin (Active — `GREENFIELD`)**: `admin@greenfield.edu`
- **School Admin (Suspended — `OAKRIDGE`)**: `admin@oakridge.edu`
- **Faculty (`GREENFIELD`)**: `marcus.gf@greenfield.edu`
- **Student (`GREENFIELD`)**: `liam.gf@greenfield.edu`
- **Parent (`GREENFIELD`)**: `parent.gf@greenfield.edu`

### 4. Create a Super Admin via Protected CLI
Super Admin accounts cannot be created via public API:
```bash
npm --prefix server run create-superadmin owner@yourdomain.com StrongPass@123 "Platform Owner"
```

### 5. Run Development Servers & Tests
```bash
npm run dev:server
npm run dev:client
npm run test:server
```

## How Multi-Tenancy & Suspension Work
- **Tenant Isolation**: Every school-owned collection has a required, indexed `schoolId` and compound indexes. `tenantMiddleware` + `tenantPlugin` enforce `schoolId` from the authenticated JWT on every query and mutation.
- **Subscription Kill Switch**: `subscriptionGuard` evaluates live school status (`active`, `trial`, `grace`, `suspended`, `expired`) on every API request:
  - **Active / Trial**: Full access.
  - **Grace Period**: Full access with warning headers and non-dismissible banner.
  - **Suspended / Expired**: Takes effect **immediately** for already-logged-in users (`402 SCHOOL_SUSPENDED` / `SUBSCRIPTION_EXPIRED`). Faculty, students, and parents are blocked; School Admin can access only the read-only `/admin/subscription` billing & support page. Reactivation restores all data and access instantly.
