## ⚠️ CRITICAL: JWT Secret Security Issue

### Current Status

**Development:** ✅ Using insecure default (acceptable for local dev)
- Set in `server/package.json` dev script: `JWT_SECRET=dev-insecure-change-me`

**Production:** ⚠️ **FALLS BACK TO INSECURE DEFAULT IF NOT SET**

### The Problem

In `server/src/index.ts` line 28:
```typescript
const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-change-me";
```

This fallback means if `JWT_SECRET` is not set in production, it will use the insecure default that is **publicly visible in your code**. This is a security vulnerability because:

1. Anyone can see your JWT secret in the code
2. Anyone can forge valid session tokens
3. Anyone can impersonate any user

### Required Fixes

#### 1. Update server/src/index.ts (Recommended)

Replace the fallback with an error:

```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("[FATAL] JWT_SECRET environment variable is required");
  process.exit(1);
}
```

This ensures the server won't start without a proper secret.

#### 2. Set JWT_SECRET in Production

**Docker Compose:**
```yaml
environment:
  - JWT_SECRET=${JWT_SECRET}
```

Then set it in your host environment or `.env` file (not committed to git).

**Systemd/Direct Deployment:**
```bash
export JWT_SECRET=$(openssl rand -base64 32)
# Or use a secrets manager
```

**GitHub Actions (if using):**
Add `JWT_SECRET` as a repository secret.

### Generate a Secure Secret

```bash
# Generate a secure random secret
openssl rand -base64 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Verification Steps

1. Update `server/src/index.ts` to require JWT_SECRET
2. Set JWT_SECRET in your production environment
3. Restart the server and verify it starts successfully
4. Test authentication works

### Additional Security Notes

- **Never commit** JWT_SECRET to git
- **Rotate the secret** periodically (invalidates all sessions)
- **Use different secrets** for dev and production
- Consider using a **secrets manager** (AWS Secrets Manager, HashiCorp Vault, etc.)

---

**Action Required Before Production Deployment:** Fix the JWT_SECRET fallback to prevent using insecure defaults.
