# GitHub Copilot Instructions — cv-builder-api.instif.id

Instruksi ini WAJIB dipatuhi oleh SEMUA model AI pada GitHub Copilot. Sumber kebenaran lengkap ada di [AGENTS.md](../AGENTS.md).

## Aturan Utama:
1. **Komponen Global (@instif/ui)**: UI tidak dibuat di sini. Jika ada kebutuhan UI/layar, wajib ambil dari `@instif/ui` (tiap tampilan modular/terpisah, dan refactor temuan non-global).
2. **Kerapihan & Struktur File**: 1 file = 1 tanggung jawab utama. Controller/route tipis, logic di service/lib, validasi Zod, target file tipis (< 200 baris). Jika menyediakan metadata icon/visual, gunakan icon standar (Lucide) non-cliché AI.
3. **Unit Testing Aman**: Sebelum commit, unit test WAJIB dipastikan aman dan lulus 100% (hijau). Dilarang commit jika test gagal/rusak.
4. **Git Workflow**: Wajib commit setiap perubahan (Conventional Commits). Push hanya bila diperintahkan user.
