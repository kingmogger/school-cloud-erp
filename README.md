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

## Firebase Storage, Quotas & Reconciliation
- **Per-School Path Layout**: All uploaded files are stored under `schools/{schoolId}/{category}/{filename}` (`profile-photos`, `study-materials`, `assignments`, `submissions`, `receipts`, `report-cards`, `other`) via the central `server/src/services/storage.service.js`.
- **Quota Enforcement & Tracking**:
  - Each school tracks `storageLimitBytes`, `storageUsedBytes`, `fileCount`, `storageUsageByCategory`, and `lastStorageSyncAt`.
  - Uploads atomically reserve quota (Firestore transaction in cloud mode, per-school lock in local mode) and reject over-quota uploads with `HTTP 413 STORAGE_LIMIT_EXCEEDED`.
  - Per-file limits: max `10 MB`, allowed types `PDF`, `JPG`, `PNG`, `DOCX`, `PPTX`, `XLSX`.
  - School Admins receive soft warnings at **80%** and **95%** usage and see a read-only storage meter on `/admin/subscription`.
- **Super Admin Storage Portal (`/superadmin/storage`)**:
  - View platform-wide storage totals, filter/sort schools, update per-school storage limits (presets or custom GB, audit-logged to `PlatformAuditLog`), inspect category breakdowns and 30/90-day usage trends, delete files with a required reason, and trigger manual recalculation.
- **Reconciliation & Migration**:
  - A nightly cron job (`server/src/jobs/nightly.js`) and the manual **Recalculate** action list all objects under `schools/{schoolId}/` and reconcile counters with physical storage.
  - To migrate legacy uploads into `schools/{schoolId}/{category}/...` (idempotent, with automatic backup):
    ```bash
    npm --prefix server run migrate:storage
    ```
- **Security**: `storage.rules` denies all direct client reads/writes; files are served only through backend-authenticated signed URLs (`/api/v1/storage/files/:id/url`).
