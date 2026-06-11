# CV Builder — Backend (`cv-builder-api.instif.id`)

API untuk CV Builder: auth, CRUD CV, **parsing dokumen + auto-fill via Claude AI**, **generate PDF (Puppeteer) berbayar**, **sistem kredit + pembayaran (Duitku & transfer manual)**, **WhatsApp Web OTP**, dan **settings terenkripsi** (key Duitku di DB, bukan env).

> Dokumen ini hanya mencakup **Backend**. Frontend di `cv-builder.instif.id/task.md`.

---

## 1. Tech Stack & Konvensi

Mengikuti konvensi repo sibling (`tools-api.instif.id`):

| Aspek | Pilihan |
|---|---|
| Runtime | Node.js (ESM, `"type": "module"`) |
| Framework | **Hono** + `@hono/node-server` |
| Validasi | `zod` + `@hono/zod-validator` |
| ORM / DB | **Prisma** + PostgreSQL |
| Auth | JWT via `jose`, password `bcryptjs` |
| Testing | **Vitest** (+ coverage v8) |
| Lint/Format | ESLint + Prettier + lefthook |
| Port dev | `3011` |
| AI | `@anthropic-ai/sdk` — model **`claude-opus-4-8`** (atau `claude-sonnet-4-6` untuk hemat) |
| Parsing file | `mammoth` (docx) · `pdf-parse` (pdf) · `csv-parse` (csv) |
| PDF generate | `puppeteer` (render template HTML → PDF teks-parseable) |
| WhatsApp | `whatsapp-web.js` (+ `qrcode`) |
| Enkripsi | `crypto` Node — AES-256-GCM |

**Aturan keras:**
- ❌ **Jangan** commit `.env`. Sediakan `.env.example` (§10).
- ✅ **Hanya `ENCRYPTION_KEY` + infra dasar** (DB, JWT, port) yang ada di env. **Semua konfigurasi yang bisa berubah → tersimpan TERENKRIPSI di tabel `Setting` & diatur dari dashboard admin**, supaya tidak perlu sentuh server/env saat ubah:
  - Key Duitku (merchant code, API key, env sandbox/prod)
  - Rekening bank (transfer manual) & harga paket
  - **Anthropic API key & model** (mis. `claude-opus-4-8` / `claude-sonnet-4-6`)
  - **Konfigurasi WhatsApp** (status & lifecycle session diatur via QR di admin, bukan env)
- ✅ Modular: `routes/ ` tipis, logic di `services/`, akses DB di `repositories/` atau Prisma langsung di service. 1 file = 1 tanggung jawab.
- ✅ Setiap service & util punya **unit test** (Vitest).

---

## 1.A Library / Dependencies

Gunakan library berikut (jangan reinvent). Pasang versi terbaru yang kompatibel.

### Core
| Library | Kegunaan |
|---|---|
| `hono` + `@hono/node-server` | HTTP framework |
| `@hono/zod-validator` + `zod` | validasi request |
| `@prisma/client` + `prisma` (dev) | ORM + migration |
| `jose` | JWT |
| `bcryptjs` | hash password |

### AI & parsing dokumen
| Library | Kegunaan |
|---|---|
| `@anthropic-ai/sdk` | Claude API (key & model dari settings DB) |
| `mammoth` | `.docx` → teks |
| `pdf-parse` | `.pdf` → teks |
| `csv-parse` | `.csv` → teks |

### PDF & WhatsApp
| Library | Kegunaan |
|---|---|
| `puppeteer` | render template HTML → PDF (teks-parseable, ATS) |
| `whatsapp-web.js` | session WhatsApp Web (LocalAuth) |
| `qrcode` | QR string → data URL untuk admin scan |

### Util & testing
| Library | Kegunaan |
|---|---|
| `nanoid` / `cuid` | id (cuid sudah dari Prisma `@default(cuid())`) |
| `vitest` + `@vitest/coverage-v8` | unit test |
| `tsx` | dev runner |
| `tsc-alias` | resolve path alias saat build |

> Enkripsi pakai `crypto` bawaan Node (AES-256-GCM) — tidak perlu library tambahan.
> `puppeteer` dan `whatsapp-web.js` butuh Chromium; pastikan Dockerfile memasang dependensinya.

---

## 2. Struktur Folder

```
src/
├── index.ts                     # bootstrap Hono
├── routes/                      # definisi endpoint (tipis, panggil service)
│   ├── auth.ts
│   ├── cv.ts
│   ├── ai.ts
│   ├── billing.ts               # order, kredit, callback duitku, transfer manual
│   ├── export.ts                # generate PDF
│   ├── otp.ts                   # request/verify OTP
│   └── admin/
│       ├── payments.ts
│       ├── whatsapp.ts
│       └── settings.ts
├── services/
│   ├── auth.service.ts
│   ├── cv.service.ts
│   ├── ai/
│   │   ├── parser.service.ts    # docx/pdf/csv → teks mentah
│   │   └── claude.service.ts    # teks → CvData via Claude
│   ├── credit.service.ts        # ledger saldo & kuota AI
│   ├── payment/
│   │   ├── duitku.service.ts    # adaptasi dari instif.id/src/lib/duitku.ts
│   │   └── manual.service.ts    # order + bukti + approve admin
│   ├── pdf.service.ts           # Puppeteer render
│   ├── template.service.ts      # HTML 5 template (string/JSX-to-HTML)
│   ├── whatsapp.service.ts      # session, QR, kirim pesan
│   ├── otp.service.ts           # generate/verify, kirim via WA
│   └── settings.service.ts      # get/set setting terenkripsi
├── lib/
│   ├── db.ts                    # Prisma client
│   ├── jwt.ts
│   ├── crypto.ts                # encrypt()/decrypt() AES-256-GCM
│   └── env.ts                   # validasi env via zod
├── middleware/
│   ├── requireAuth.ts
│   └── requireRole.ts           # ADMIN guard
├── config/
│   └── pricing.ts               # default harga & kuota (fallback bila setting kosong)
└── __tests__/                   # cermin struktur
prisma/
├── schema.prisma
├── migrations/
└── seed.ts                      # admin default + harga default
```

---

## 3. Data Model (Prisma)

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  phone     String?  @unique
  password  String
  role      String   @default("USER")   // USER | ADMIN
  status    String   @default("ACTIVE")
  cvs       Cv[]
  orders    Order[]
  credit    Credit?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("users")
}

model Cv {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  title      String   @default("Untitled CV")
  templateId String   @default("classic-ats")
  data       Json     // CvData (selaras schema FE)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@map("cvs")
}

model Credit {
  id          String @id @default(cuid())
  userId      String @unique
  user        User   @relation(fields: [userId], references: [id])
  exportLeft  Int    @default(0)  // jatah export PDF tersisa
  aiUploadsLeft Int  @default(0)  // jatah auto-fill AI tersisa (3 / paket)
  @@map("credits")
}

model Order {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  method       String   // DUITKU | MANUAL
  amount       Int      // IDR
  packs        Int      @default(1)
  status       String   @default("PENDING") // PENDING | PAID | REJECTED | EXPIRED
  reference    String?  // ref Duitku
  proofUrl     String?  // bukti transfer manual
  paidAt       DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@map("orders")
}

model Setting {
  id        String  @id @default(cuid())
  key       String  @unique  // duitku.merchantCode, duitku.apiKey, anthropic.apiKey, anthropic.model, bank.accounts, pricing.packPrice...
  value     String           // TERENKRIPSI (AES-256-GCM) untuk field sensitif
  encrypted Boolean @default(true)
  updatedAt DateTime @updatedAt
  @@map("settings")
}

model OtpCode {
  id        String   @id @default(cuid())
  phone     String
  codeHash  String
  purpose   String   // VERIFY_PHONE | LOGIN
  expiresAt DateTime
  consumed  Boolean  @default(false)
  createdAt DateTime @default(now())
  @@map("otp_codes")
}

model WhatsAppSession {
  id        String   @id @default(cuid())
  status    String   @default("DISCONNECTED") // CONNECTED | DISCONNECTED | QR_PENDING
  sessionData Json?  // auth state whatsapp-web.js (atau path LocalAuth)
  updatedAt DateTime @updatedAt
  @@map("whatsapp_sessions")
}
```

---

## 4. Endpoint (ringkasan)

### Auth (`/auth`)
- `POST /register`, `POST /login`, `GET /me`, `POST /logout`.

### CV (`/cv`) — `requireAuth`
- `GET /` list, `POST /` create, `GET /:id`, `PATCH /:id` (autosave), `DELETE /:id`.

### AI (`/ai`) — `requireAuth`
- `POST /parse-cv` (multipart pdf/docx/csv) → ekstrak teks → Claude → `CvData`.
  - **Cek & decrement `aiUploadsLeft`** sebelum proses. 402 jika habis.

### Export (`/export`) — `requireAuth`
- `POST /pdf` `{ cvId, templateId }` → **cek & decrement `exportLeft`** → render Puppeteer → balikan PDF.
  - 402 jika `exportLeft = 0` (paywall).

### Billing (`/billing`) — `requireAuth`
- `GET /credit` saldo & kuota.
- `POST /order` `{ method, packs }` → DUITKU: buat invoice (`paymentUrl`); MANUAL: buat order PENDING + info rekening.
- `POST /order/:id/proof` (multipart) upload bukti transfer manual.
- `GET /order/:id` status (polling FE).
- `POST /callback/duitku` **(publik, verifikasi signature)** → set PAID + tambah kredit (`+1 export`, `+3 aiUploads` per pack).

### OTP (`/otp`)
- `POST /request` `{ phone, purpose }` → generate, kirim via WhatsApp.
- `POST /verify` `{ phone, code }`.

### Admin (`/admin`) — `requireRole('ADMIN')`
- `GET /payments?status=PENDING`, `POST /payments/:id/approve`, `POST /payments/:id/reject` (approve → tambah kredit).
- `GET /whatsapp/qr` (QR data URL), `GET /whatsapp/status`, `POST /whatsapp/logout`.
- `GET /settings`, `PUT /settings` (set key Duitku / **Anthropic API key & model** / **konfigurasi WhatsApp** / rekening / harga → **encrypt** sebelum simpan; balikan masked). Semua diubah dari dashboard tanpa sentuh env/server.

---

## 5. AI Auto-fill (Claude)

1. `parser.service` ekstrak teks:
   - `.docx` → `mammoth.extractRawText`
   - `.pdf` → `pdf-parse`
   - `.csv` → `csv-parse` → flatten jadi teks berlabel.
2. `claude.service`:
   - Pakai **`@anthropic-ai/sdk`**. **API key & model dibaca dari `settings.service`** (terenkripsi di DB, diatur admin) — default model `claude-opus-4-8`, alternatif `claude-sonnet-4-6`.
   - **Tool use / structured output**: paksa output JSON sesuai schema `CvData` (zod → JSON Schema). Validasi balik dengan zod; retry 1× bila gagal.
   - System prompt: ekstrak data CV terstruktur, jangan mengarang, kosongkan field tak diketahui.
   - Bila key belum diisi admin → balikan error jelas (jangan crash), arahkan admin ke halaman settings.
3. Catat penggunaan → decrement `aiUploadsLeft`.

> Lihat skill `claude-api` untuk model id, harga, dan pola structured output sebelum implement.

---

## 6. Generate PDF (Puppeteer)

- `template.service` menghasilkan **HTML + CSS** untuk 5 template (ATS-safe: teks asli, heading standar) dari `CvData`.
- `pdf.service`: launch Puppeteer (singleton browser, reuse), `setContent(html)`, `page.pdf({ format: 'A4', printBackground: true })`.
- Generate **hanya di BE** & **setelah cek kredit** → user tak bisa bypass paywall.
- Pastikan teks ter-select (jangan rasterize) demi ATS.
- Hindari memory leak: pool/limit halaman, tutup page setelah render.

---

## 7. Pembayaran

### 7.1 Duitku (`duitku.service`)
- Adaptasi `instif.id/src/lib/duitku.ts` (signature v2: invoice `MD5(merchantCode+orderId+amount+apiKey)`, callback `MD5(merchantCode+amount+orderId+apiKey)`).
- **Key dibaca dari `settings.service`** (terenkripsi di DB), **bukan** dari env.
- `isConfigured` = settings ada → kalau belum diisi admin, tampilkan error jelas, jangan crash.
- Callback: verifikasi `timingSafeEqual`, idempoten (cek order belum PAID), lalu tambah kredit.

### 7.2 Manual (`manual.service`)
- Order PENDING + tampilkan rekening (dari settings). User upload bukti → admin approve/reject. Approve = tambah kredit + set PAID + `paidAt`.

### 7.3 Kredit (`credit.service`)
- 1 pack (Rp10.000) = `+1 export`, `+3 aiUploads`. Operasi atomik (transaction) saat decrement & top-up.

---

## 8. WhatsApp Web OTP

- `whatsapp.service` pakai `whatsapp-web.js` (LocalAuth / session persist).
- Admin buka `/admin/whatsapp` → BE keluarkan **QR** (`qrcode` → data URL) → admin **scan via WhatsApp di HP**.
- Status disimpan di `WhatsAppSession`. Event `ready`/`disconnected` update status.
- `otp.service`: generate kode 6 digit, simpan **hash** + `expiresAt` (mis. 5 menit), kirim teks via WA client. Verify = cek hash + belum expired + belum consumed.
- **Konfigurasi WA diatur dari dashboard admin**, bukan env: path session default = konstanta di `config/`, sedangkan link/unlink session dilakukan via QR di `/admin/whatsapp`. Status & metadata di tabel `WhatsAppSession`.
- **Catatan infra:** `whatsapp-web.js` butuh proses Node long-lived + Chromium (Puppeteer). Jangan jalan di serverless; deploy sebagai service persisten (Docker). Satu instance pemegang session.

---

## 9. Enkripsi & Settings

- `lib/crypto.ts`: `encrypt(plain)` / `decrypt(cipher)` AES-256-GCM. Kunci dari `ENCRYPTION_KEY` (32 byte, base64) di env — **satu-satunya secret enkripsi di env**.
- `settings.service`: simpan field sensitif terenkripsi (Duitku, **Anthropic API key**, rekening); saat dibaca untuk dipakai → decrypt; saat dikirim ke admin UI → **mask** (mis. `••••1234`). Field non-sensitif (model, harga) boleh plaintext.
- Cache ringan settings di memori dengan invalidasi saat `PUT /settings` agar tidak query DB tiap request AI.
- `seed.ts`: buat admin default + isi `pricing.packPrice=10000`, `pricing.aiPerPack=3`, `anthropic.model=claude-opus-4-8` (default config, bukan secret).

---

## 10. Environment (`.env.example`)

`.env` **TIDAK** di-commit. `.gitignore` memuat `.env*` kecuali `.env.example`.

```dotenv
# .env.example
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cv_builder?schema=public"
JWT_SECRET="change-me"
PORT=3011
CORS_ORIGIN="http://localhost:3010"

# Satu-satunya secret enkripsi. SEMUA konfigurasi yang bisa berubah disimpan
# terenkripsi di DB & diatur dari dashboard admin — TIDAK di env.
ENCRYPTION_KEY="base64:GENERATE_32_BYTE_KEY"

# Diatur di ADMIN SETTINGS (terenkripsi di DB), TIDAK di env:
#   - Duitku: merchant code, API key, env
#   - Anthropic: API key & model
#   - WhatsApp: lifecycle session via QR di /admin/whatsapp
#   - Rekening bank & harga paket
```

---

## 11. Testing (Vitest)

Coverage acuan ≥ 80% pada `services/` & `lib/`. Wajib diuji:
- `lib/crypto` (encrypt/decrypt round-trip, tamper → gagal).
- `duitku.service` (signature invoice & callback, verifikasi, idempotensi callback).
- `credit.service` (decrement/top-up atomik, tolak saat saldo 0).
- `ai/claude.service` (mock SDK; validasi & retry schema).
- `ai/parser.service` (docx/pdf/csv → teks; tolak tipe tak didukung).
- `otp.service` (generate/hash/verify, expired, consumed).
- `settings.service` (encrypt saat set, mask saat get).
- Route guard `requireAuth` / `requireRole`.

---

## 12. Milestone / Urutan Kerja

- [ ] **M0 — Setup**: scaffold Hono, Prisma, env validation, lefthook, Vitest, `.env.example`, `.gitignore`, `lib/crypto`.
- [ ] **M1 — Auth**: register/login/me, JWT, guard middleware, seed admin.
- [ ] **M2 — CV CRUD**: schema CvData, endpoint, autosave.
- [ ] **M3 — Settings + crypto**: tabel Setting, encrypt/mask, admin settings endpoint.
- [ ] **M4 — Credit**: ledger, hubungkan ke order.
- [ ] **M5 — Payment**: Duitku (key dari settings) + callback + manual + approve.
- [ ] **M6 — AI parse**: parser + Claude structured output + kuota.
- [ ] **M7 — PDF**: 5 template HTML + Puppeteer + gating kredit.
- [ ] **M8 — WhatsApp + OTP**: session/QR, kirim OTP, verify.
- [ ] **M9 — Hardening**: rate limit, error handling, coverage, Dockerfile (Chromium deps).

---

## 13. Definition of Done

- Auth + CV CRUD + autosave jalan.
- Parse pdf/docx/csv → Claude → CvData valid, kuota 3×/paket ditegakkan.
- Export PDF (5 template, teks-parseable) hanya setelah kredit terpenuhi.
- Duitku & transfer manual menambah kredit dengan benar; callback aman & idempoten.
- Key Duitku/rekening/harga **terenkripsi di DB** via admin settings; **hanya `ENCRYPTION_KEY`** di env.
- WhatsApp Web QR + kirim/verify OTP berfungsi.
- Tidak ada `.env` ter-commit; `.env.example` tersedia.
- File modular, unit test hijau, lint & type-check bersih.
```
