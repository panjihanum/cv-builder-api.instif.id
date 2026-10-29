# GitHub Copilot Instructions — cv-builder-api.instif.id

Instruksi ini WAJIB dipatuhi oleh SEMUA model AI pada GitHub Copilot. Sumber kebenaran lengkap ada di [AGENTS.md](../AGENTS.md).

## Aturan Utama:

1. **Komponen Reusable Backend & Global**: Gunakan helper di src/common/ atau shared package (guards, decorators, filters, pipes, utils). Dilarang duplikasi helper. Jika ada UI/view, wajib ambil dari @instif/ui (instif-fe-component) dengan container standar (Container, PageBody, DashboardShell).
2. **Standar Endpoint List & Tabel (Search + Filter + Urutkan)**: Setiap endpoint yang menyajikan list/tabel data wajib mendukung pencarian (q), filter kustom, paginasi, dan pengurutan (sort).
3. **Kerapihan & Struktur**: File rapi dan terstruktur (target controller/route < 200 baris, fungsi < 50 baris). Validasi DTO/Zod inline/modular. Icon non-AI.
4. **Unit Testing Aman**: Sebelum commit, unit test WAJIB dipastikan aman dan lulus 100% (hijau). Dilarang commit jika test gagal/rusak.
5. **Git Workflow**: Wajib commit setiap perubahan (Conventional Commits). Push hanya bila diperintahkan user.
