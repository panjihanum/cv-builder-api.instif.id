# Agent rules

## Git Workflow — Check, Commit, Push, AND Redeploy (Mandatory)

After completing ANY requested change or instruction, ALWAYS do the following (unless the user explicitly says not to):

1. **Check**: Run project checks locally (`format` / `lint` / `type-check` / `test` — see `lefthook.yml`). Fix every failure before continuing.
2. **Stage & Commit**: Stage only intended files (NEVER commit `.env`, `*.db`, secrets, or local credentials) and commit with a clear, descriptive message.
3. **Push**: Push to `main`.
4. **Redeploy & Verify**: Run `pwsh -File scripts/redeploy.ps1` to rebuild, restart, and verify the container application in Docker.
