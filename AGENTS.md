# Agent rules — `cv-builder-api.instif.id`

> Sumber kebenaran MUTLAK untuk SEMUA model AI (Claude, OpenAI GPT, Google Gemini, DeepSeek, dll.) serta SEMUA AI coding assistant (Claude Code, GitHub Copilot, Cursor, Antigravity, Windsurf, Roo Code, dll.) pada repo ini. Wajib dipatuhi tanpa terkecuali.

## Git Workflow — Check, Commit, and Push

After completing ANY requested change, always do the following:

1. **Check**: Run project checks locally (format:check / lint / type-check — see lefthook.yml). Fix every failure before continuing.
2. **Unit Testing Aman (MANDATORY)**: Perubahan logika wajib disertai/diperbarui unit test. Sebelum commit, unit test WAJIB dipastikan aman dan lulus 100% (hijau). Dilarang keras commit jika test rusak/gagal.
3. **Stage & Commit (MANDATORY)**: Stage only intended files (NEVER commit .env, \*.db, secrets, or local credentials) and commit with a clear, descriptive message (Conventional Commits). Every change MUST be committed immediately. Never leave uncommitted changes hanging under any condition.
4. **Push Policy (Depends on Instructions)**:
   - Do NOT auto-push to remote without user instructions.
   - This does NOT mean push is forbidden; IF the user instructs or commands to push (e.g. "push", "tolong push", "push ke main"), the agent MUST execute `git push origin <branch>`.
   - Without an explicit command to push, keep commits stored cleanly in the local repository.

5. **Auto-Redeploy on Push (MANDATORY)**:
   - Setiap kali `git push` dijalankan atas perintah user, agent WAJIB otomatis melakukan redeploy container docker aplikasi tersebut dan memastikan Cloudflare Tunnel tersinkronisasi / berjalan (`pwsh -File c:\Users\panha\Documents\GitHub\INSTIF\www.instif.id\scripts\redeploy-all.ps1 -Only cv-builder-api` atau script redeploy terkait). Tanpa perintah push, deploy tidak dijalankan.

## Kerapihan, Struktur File & Desain

- **File Rapi & Terstruktur**: 1 file = 1 tanggung jawab utama. Controller/route tipis, logic di service/lib, validasi Zod inline, target file tipis (< 200 baris).
- **Desain & Icon Natural (Bukan 'AI')**: Jika API/metadata menyajikan data icon/visual ke consumer, gunakan icon standar (Lucide) non-cliché AI (tanpa sparkles ✨, wand 🪄, robot 🤖).
- **Komponen Global (@instif/ui)**: UI components are **not built here**. If a screen is ever added, it comes from `@instif/ui` (`instif-fe-component`). Wajib gunakan komponen existing/global, tiap buat tampilan harus ada komponennya (modular), dan refactor temuan non-global (Boy Scout Rule).
