# Agent rules

## Git Workflow — Check, Commit, and Push

After completing ANY requested change, always do the following:

1. **Check**: Run project checks locally (format:check / lint / type-check — see lefthook.yml). Fix every failure before continuing.
2. **Stage & Commit (MANDATORY)**: Stage only intended files (NEVER commit .env, \*.db, secrets, or local credentials) and commit with a clear, descriptive message (Conventional Commits). Every change MUST be committed immediately. Never leave uncommitted changes hanging under any condition.
3. **Push Policy (Depends on Instructions)**:
   - Do NOT auto-push to remote without user instructions.
   - This does NOT mean push is forbidden; IF the user instructs or commands to push (e.g. "push", "tolong push", "push ke main"), the agent MUST execute `git push origin <branch>`.
   - Without an explicit command to push, keep commits stored cleanly in the local repository.

Deploy is strictly manual. Agents must never run deploy or redeploy scripts automatically.
