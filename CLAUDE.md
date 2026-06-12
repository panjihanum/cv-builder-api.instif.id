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
