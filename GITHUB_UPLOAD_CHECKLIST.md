# 📋 GitHub Upload Checklist

This document lists exactly what should be uploaded to GitHub for the Supabase-based frontend application.

## ✅ Files to Upload (Frontend Application)

### Configuration Files
- ✅ `.github/workflows/deploy-gh-pages.yml` - GitHub Actions deployment workflow
- ✅ `.gitignore` - Prevents uploading sensitive files
- ✅ `static/.nojekyll` - GitHub Pages configuration

### Frontend Application Files
- ✅ `static/index.html` - Main map page
- ✅ `static/submissions.html` - Community submissions page
- ✅ `static/app.js` - Main application JavaScript
- ✅ `static/submissions.js` - Submissions page JavaScript
- ✅ `static/config.example.js` - Configuration template (with placeholders only)
- ✅ `static/styles.css` - Main styles
- ✅ `static/submissions_unified.css` - Submissions page styles
- ✅ `static/submissions.css` - Additional submissions styles
- ✅ `static/simple-dropdown-limit.js` - Dropdown utility

### Database Schema (for reference)
- ✅ `db/migrations/supabase_schema.sql` - Supabase database schema
- ✅ `db/migrations/supabase_rls_policies.sql` - Row Level Security policies

### Documentation
- ✅ `README.md` - Main project documentation
- ✅ `DEPLOYMENT_GUIDE.md` - Deployment instructions
- ✅ `GITHUB_UPLOAD_CHECKLIST.md` - This file

### Utilities (for reference)
- ✅ `.utils/scripts/migrate_to_supabase.py` - Migration script (for documentation)

## ❌ Files to EXCLUDE (Not Needed for Supabase Frontend)

### Backend Files (FastAPI - No Longer Used)
- ❌ `main.py` - FastAPI backend
- ❌ `database.py` - SQLite database handler
- ❌ `requirements.txt` - Python dependencies
- ❌ `models/` - Backend data models
- ❌ `routers/` - API route handlers
- ❌ `services/` - Backend services

### Database Files (Data is in Supabase)
- ❌ `floods_greece.db` - SQLite database
- ❌ `*.db` - Any database files
- ❌ `Floods_GR.*` - Raw shapefile data

### Sensitive Files (Contains Credentials)
- ❌ `.env` - Environment variables
- ❌ `static/config.js` - File with real Supabase credentials

### Backup Files
- ❌ `GeoMap_backup_*.tar.gz` - Backup archives
- ❌ Any `.zip` or `.tar.gz` files

### IDE and System Files
- ❌ `.vscode/` - VS Code settings
- ❌ `.DS_Store` - macOS files
- ❌ `__pycache__/` - Python cache

## 🔒 Security Verification

Before uploading, verify:

1. **No credentials in code**
   ```bash
   # Check for hardcoded credentials
   grep -r "supabase" static/ --exclude="*.example.js" --exclude-dir=node_modules
   ```

2. **config.js has placeholders only**
   ```bash
   # Should see YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY
   grep "YOUR_SUPABASE" static/config.js
   ```

3. **No database files**
   ```bash
   # Should return nothing
   find . -name "*.db" -type f
   ```

4. **No environment files**
   ```bash
   # Should return nothing
   find . -name ".env*" -type f
   ```

## 📦 What Gets Deployed

When you push to GitHub:

### Repository Contains:
- Static frontend files (HTML, CSS, JS)
- Configuration template (with placeholders)
- Documentation
- GitHub Actions workflow
- Database schema (for reference)

### GitHub Actions Injects:
- Real Supabase credentials from repository secrets
- Builds and deploys to GitHub Pages

### Result:
- Live application at: `https://your-username.github.io/your-repo-name/`
- No backend needed
- Direct Supabase connection from browser

## 🚀 Upload Commands

### First-time Setup

```bash
# 1. Initialize git (if not already done)
git init

# 2. Add remote
git remote add origin https://github.com/your-username/your-repo-name.git

# 3. Check what will be committed (verify nothing sensitive)
git status

# 4. Review files to be added
git add -n .  # Dry run to see what would be added

# 5. Stage files
git add .

# 6. Verify staged files (check the list carefully)
git status

# 7. Commit
git commit -m "Initial commit: Supabase-based frontend application"

# 8. Push to GitHub
git push -u origin main
```

### Updating Existing Repository

```bash
# 1. Check current status
git status

# 2. Stage changes
git add .

# 3. Commit
git commit -m "Update frontend application"

# 4. Push
git push origin main
```

## ⚙️ Post-Upload Configuration

After uploading to GitHub:

1. **Set Repository Secrets**
   - Go to: Repository → Settings → Secrets and variables → Actions
   - Add secret: `SUPABASE_URL` (your Supabase project URL)
   - Add secret: `SUPABASE_ANON_KEY` (your Supabase anon key)

2. **Enable GitHub Pages**
   - Go to: Repository → Settings → Pages
   - Source: Select "GitHub Actions"

3. **Trigger Deployment**
   - Push any change to main branch
   - Or manually trigger workflow in Actions tab

4. **Verify Deployment**
   - Check Actions tab for workflow status
   - Visit: `https://your-username.github.io/your-repo-name/`

## 📝 Important Notes

### About Backend Files

The Python backend files (main.py, database.py, etc.) are excluded because:
- ✅ Frontend now connects directly to Supabase
- ✅ No FastAPI backend needed
- ✅ Reduces complexity
- ✅ Makes deployment simpler
- ✅ GitHub Pages only serves static files

### About Database Files

The SQLite database (floods_greece.db) is excluded because:
- ✅ Data has been migrated to Supabase
- ✅ Frontend reads from Supabase PostgreSQL
- ✅ Prevents uploading large database files
- ✅ Database is managed in Supabase cloud

### About Configuration

The `static/config.js` file:
- ❌ Should NOT be uploaded with real credentials
- ✅ Upload only `static/config.example.js` as a template
- ✅ Real credentials injected by GitHub Actions during deployment
- ✅ Local developers copy example and add their own credentials

## 🔍 Final Verification

Before pushing to GitHub, run these checks:

```bash
# 1. Ensure .gitignore is working
git status --ignored

# 2. Check for any .env files
find . -name ".env*" -not -path "*/node_modules/*"

# 3. Check for database files
find . -name "*.db" -type f

# 4. Verify config.js has placeholders
cat static/config.js | grep "YOUR_SUPABASE"

# 5. List what will be committed
git ls-files

# 6. Check file sizes (nothing should be huge)
du -sh * | sort -h

# 7. Verify no secrets in git history
git log --all --full-history --source --grep="password\|secret\|key" -i
```

## ✨ Success Criteria

You're ready to push when:
- ✅ `.gitignore` excludes all backend and sensitive files
- ✅ `static/config.js` has placeholders only
- ✅ No `.env` files in repository
- ✅ No database files (`.db`)
- ✅ No shapefile data
- ✅ All frontend files are present
- ✅ Documentation is complete
- ✅ GitHub Actions workflow is configured

---

**Ready to push?** Follow the [Upload Commands](#-upload-commands) section above!