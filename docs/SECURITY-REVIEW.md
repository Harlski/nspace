# Security Review Checklist for Public Repository

## ✅ Safe to Make Public

### Protected by .gitignore
- ✅ `.env` files (local environment variables)
- ✅ `client/.env.development` (gitignored; create locally from `client/.env.example` — not tracked)
- ✅ `server/data/` (world state, event logs, signboards)
- ✅ `node_modules/` (dependencies)
- ✅ `dist/` (build outputs)
- ✅ `*.log` (log files)

### Example Files Created
- ✅ `client/.env.example` - Template for client configuration
- ✅ `server/.env.example` - Template for server configuration
- ✅ Both contain safe default values for development

### Configuration Files Reviewed
- ✅ `server/src/config.ts` - Contains admin wallet addresses (public info, okay to share)
- ✅ No API keys, secrets, or private keys found in tracked files

## ⚠️ Actions Required Before Making Public

### 1. Review Recent Commits for Secrets
Check git history for any accidentally committed secrets:

```bash
git log --all --full-history --source -- '*/.env*'
```

If secrets are found in history, consider using `git filter-branch` or BFG Repo-Cleaner to remove them.

### 2. Update Admin Addresses (Optional)
The admin wallet address in `server/src/config.ts` is visible. This is generally okay (it's just a public wallet address), but you may want to:
- Remove it and document how to add admin addresses
- Or keep it if it's meant to be public information

### 3. Document Security Best Practices
- ✅ Already added security notes to docs/getting-started.md (and root README pointer)
- ✅ Created .env.example files with safe defaults
- ✅ Updated .gitignore to prevent future .env commits

## 🔒 Production Deployment Reminders

Users deploying this should:
1. Set a strong random `JWT_SECRET` (not the dev default). In production (`NODE_ENV=production`), the server **exits** if `JWT_SECRET` is missing or left as `dev-insecure-change-me` — see `server/src/index.ts` and [JWT-SECURITY-ISSUE.md](JWT-SECURITY-ISSUE.md).
2. Never enable `DEV_AUTH_BYPASS=1` in production
3. Disable `VITE_ADMIN_ENABLED` in production (unauthenticated admin API)
4. Review and customize admin addresses in `server/src/config.ts`
5. Secure the admin HTTP endpoints before public deployment

## 📋 Final Checklist

Before making the repository public:

- [ ] Review git log for any historical secrets
- [ ] Update GitHub repository settings (visibility)
- [ ] Add LICENSE file if not already present
- [ ] Consider expanding docs/CONTRIBUTING.md guidelines
- [ ] Update repository description and topics on GitHub
- [ ] Add screenshot/demo GIF to README

## 🎯 Summary

The repository keeps secrets out of tracked files via `.gitignore` and `.env.example` templates. Before going public, still review git history for leaked credentials, tighten production config (`JWT_SECRET`, no `DEV_AUTH_BYPASS`, admin HTTP exposure), and follow the checklist above.
