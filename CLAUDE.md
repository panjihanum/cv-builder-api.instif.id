# CLAUDE.md — Aturan Kerja Agent (Backend `cv-builder-api.instif.id`)

Aturan ini WAJIB dipatuhi setiap kali bekerja di repo ini. Spesifikasi fitur ada di `task.md`.

## Auto-commit & Auto-push (WAJIB)

Setelah **setiap** unit pekerjaan selesai (satu perintah / satu task tuntas), **langsung buat commit**, lalu **langsung push** ke remote. Jangan menumpuk banyak perubahan dalam satu commit.

Urutan wajib tiap selesai perintah:

1. Pastikan lint/format/type-check/test hijau (lefthook akan memverifikasi).
2. `git add` + `git commit` dengan format di bawah.
3. `git push origin main` — otomatis, tanpa menunggu diminta.
4. Jika push ditolak (remote lebih baru): `git pull --rebase origin main` lalu push ulang. **Dilarang** `git push --force`.

Format pesan commit — selalu persis seperti ini:

```
["Tipe Pekerjaan"] "Deskripsi Pekerjaan"
```

Contoh:
- `[feat] tambah endpoint parse-cv dengan claude structured output`
- `[fix] perbaiki verifikasi signature callback duitku`
- `[test] tambah unit test untuk credit.service`
- `[refactor] pisahkan parser docx ke service terpisah`
- `[chore] setup prisma schema dan seed admin default`

Tipe Pekerjaan yang dipakai: `feat` · `fix` · `refactor` · `test` · `chore` · `docs` · `style`.

Aturan commit:
- Deskripsi singkat, jelas, bahasa Indonesia, huruf kecil di awal kata pertama.
- Satu commit = satu perubahan logis.
- Commit langsung di branch `main` lalu **push otomatis** setiap selesai perintah — ini instruksi tetap dari user, tidak perlu konfirmasi ulang.

## Lefthook & Linter (WAJIB lolos sebelum commit)

- Setiap commit **harus lolos lefthook** (pre-commit). Jangan pernah pakai `--no-verify`.
- Pre-commit menjalankan: `eslint`, `prettier --check`, `tsc --noEmit` (type-check), dan `vitest` terkait.
- Jika hook gagal → perbaiki dulu akar masalahnya, lalu commit ulang. Jangan bypass.
- Pastikan `lefthook.yml` ada dan `lefthook install` sudah jalan (`npm run prepare`).
- **Lefthook sekarang satu-satunya gerbang kualitas.** Repo ini tidak punya CI/CD
  sama sekali — tidak ada GitHub Actions. Kalau lefthook dilewati, tidak ada
  apa pun lagi di belakang yang akan menangkap error.

## Deploy — Docker di server sendiri (push TIDAK men-deploy)

Repo ini **tidak punya CI/CD**. `git push` hanya mengirim kode ke remote dan
**tidak men-deploy apa pun**. Production jalan di server sendiri pakai Docker
Compose, dan deploy adalah langkah manual yang dilakukan di server.

Public traffic masuk lewat **Cloudflare Tunnel** (container `cloudflared`) yang
menjangkau service ini lewat Docker network eksternal `my_network` memakai nama
service. Tidak ada port yang terbuka ke internet; port yang dipublish di-bind ke
`127.0.0.1` hanya untuk debugging di server.

| | |
| --- | --- |
| Service compose | `ph_instif_cv_builder_api` |
| Port | `3011` |
| Origin tunnel | `http://ph_instif_cv_builder_api:3011` |
| Health check | `GET /health` |

Deploy (dijalankan manusia, di server):

```sh
cd /home/instif/apps/cv-builder-api.instif.id
git pull
docker compose up -d --build
docker compose logs -f --tail=50   # verifikasi
```

- **Jangan pernah menjalankan deploy atas inisiatif sendiri** — itu menyentuh
  production. Aturan auto-push di atas tetap berlaku, tapi berhenti sampai push
  saja; deploy diserahkan ke user kecuali user meminta eksplisit.
- `.env` hanya ada di server dan tidak pernah di-commit. Sisa konfigurasi
  (Duitku, Anthropic, WhatsApp, harga) tersimpan terenkripsi di database dan
  diatur lewat dashboard admin — bukan lewat env.
- Postgres **di luar** compose ini — `DATABASE_URL` di `.env` menunjuk ke
  database yang sudah ada di server.
- Migrasi jalan otomatis saat start lewat `prisma migrate deploy`. **Jangan**
  ganti ke `prisma db push` — perintah itu menyamakan schema dengan cara
  men-drop kolom tanpa konfirmasi, dan repo ini punya migrasi asli di
  `prisma/migrations/`.
- Service ini **stateful dan harus tetap satu instance**: memegang browser
  Puppeteer (export PDF) dan session WhatsApp. Jangan di-scale.
- Chromium diinstall di image dan dipakai lewat `PUPPETEER_EXECUTABLE_PATH`.
  Puppeteer sudah jalan dengan `--no-sandbox` + `--disable-dev-shm-usage`, jadi
  tidak butuh `shm_size` atau capability tambahan.
- Volume `cv_uploads`, `cv_wwebjs_auth`, `cv_wwebjs_cache` menyimpan data user
  dan session WhatsApp. Menghapusnya = user logout dari WhatsApp dan file hilang.
  Hindari `docker compose down -v`.
- Nama service, port, dan network adalah kontrak dengan config tunnel. Mengubah
  salah satunya membuat API mati sampai tunnel ikut diupdate.

## Kualitas Kode (WAJIB)

- **TANPA komentar di kode.** Kode harus jelas lewat penamaan, bukan komentar. Hapus komentar yang tidak perlu (kecuali wajib seperti `eslint-disable` beralasan).
- **Pakai library yang sudah ditetapkan di `task.md` §1.A** (hono, prisma, @anthropic-ai/sdk, mammoth, pdf-parse, csv-parse, puppeteer, whatsapp-web.js, dll). Jangan reinvent.
- **Modular & reusable.** `routes/` tipis → logic di `services/` → akses DB via Prisma. Jangan duplikasi logic.
- **Satu file = satu tanggung jawab.** Target < 200 baris/file; pecah bila lebih.
- **Hanya `ENCRYPTION_KEY` + infra dasar (DB, JWT, port) di env.** Semua konfigurasi yang bisa berubah — **Duitku, Anthropic API key & model, WhatsApp, rekening, harga** — WAJIB dibaca dari `settings.service` (terenkripsi di DB, diatur dari dashboard admin). Dilarang menambah env baru untuk config semacam ini; user tidak mau sentuh server/env tiap ada perubahan.
- Validasi input pakai `zod` di setiap endpoint.
- Penamaan deskriptif (Inggris), fungsi kecil & murni bila bisa.
- Setiap service/util non-trivial wajib punya **unit test** (Vitest).
- TypeScript strict, tanpa `any` kecuali benar-benar terpaksa.

## Alur Kerja Tiap Task

1. Implementasi sesuai `task.md` (modular, file kecil, tanpa komentar).
2. Tulis/Update unit test.
3. Jalankan `npm run lint && npm run type-check && npm test`.
4. Commit dengan format di atas (lefthook harus hijau).
