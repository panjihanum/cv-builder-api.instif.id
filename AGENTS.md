# Agent rules

## Git Workflow — Check, Commit, and Push

After completing ANY requested change or instruction, ALWAYS do the following (unless the user explicitly says not to):

1. **Check**: Run project checks locally (`format` / `lint` / `type-check` — see `lefthook.yml`). Do NOT run `test` on routine instructions; tests are only run during explicit QA testing and automatically upon commit. Fix every failure before continuing.
2. **Stage & Commit**: Stage only intended files (NEVER commit `.env`, `*.db`, secrets, or local credentials) and commit with a clear, descriptive message.
3. **Push**: Push to `main`. Every instruction/command MUST end with code pushed to `origin/main`. Never leave uncommitted or unpushed changes hanging under any condition.

Deploy is strictly manual. Agents must never run deploy or redeploy scripts automatically. The workflow stops after `push`.
