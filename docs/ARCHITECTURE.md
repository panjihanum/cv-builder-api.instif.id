# Arsitektur Sistem cv-builder-api.instif.id (Backend)

Dokumen arsitektur backend REST API untuk platform CV Builder.

---

## 1. Tech Stack Utama
- **Runtime**: Node.js
- **Framework**: Express / NestJS
- **Bahasa**: TypeScript
- **Database**: PostgreSQL / Prisma
- **Storage**: S3-compatible cloud storage / local storage
- **Auth**: JWT Authentication

---

## 2. Struktur Modul & Endpoint
- `/auth`: Registrasi, Login, Profile
- `/cv`: CRUD Template CV, data profil, generate PDF
- `/templates`: Katalog template CV
- `/analytics`: Tracking pengunjung CV

---

## 3. Environment Variables
- `DATABASE_URL`: URL Database PostgreSQL
- `JWT_SECRET`: Kunci rahasia token JWT
- `PORT`: Port server backend
