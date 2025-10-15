# 📖 Deployment Guide - Greek Floods Web Map

This guide provides step-by-step instructions for deploying the Greek Floods Web Map application.

## Table of Contents

- [Quick Start](#quick-start)
- [Local Development Setup](#local-development-setup)
- [GitHub Pages Deployment](#github-pages-deployment)
- [Configuration Reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

**Choose your deployment method:**

1. **[Local Development](#local-development-setup)** - For testing and development on your machine
2. **[GitHub Pages](#github-pages-deployment)** - For free production hosting with automatic deployments

---

## Local Development Setup

### Prerequisites

- A Supabase account and project
- The floods data migrated to Supabase (see [README.md](README.md#supabase-setup))
- A web browser
- (Optional) A local web server like Python's `http.server` or Node's `http-server`

### Step 1: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy these values:
   - **Project URL** - looks like `https://xxxxx.supabase.co`
   - **anon public key** - a long JWT token starting with `eyJ...`

⚠️ **Important**: Only use the `anon` key, never the `service_role` key in frontend code!

### Step 2: Configure the Application

1. **Navigate to the project directory:**
   ```bash
   cd GeoMap
   ```

2. **Create your configuration file:**
   ```bash
   cp static/config.example.js static/config.js
   ```

3. **Edit `static/config.js`:**
   ```bash
   # Use your preferred editor
   nano static/config.js
   # or
   code static/config.js
   # or
   vi static/config.js
   ```

4. **Replace the placeholder values:**
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
   ```

### Step 3: Run the Application

**Option A: Simple (using file:// protocol)**
```bash
# Open the HTML file directly in your browser
open static/index.html
# or on Linux
xdg-open static/index.html
# or on Windows
start static/index.html
```

**Option B: Local Server (recommended)**

Using Python 3:
```bash
cd static
python -m http.server 8000
# Open http://localhost:8000 in your browser
```

Using Node.js (if you have http-server installed):
```bash
cd static
npx http-server -p 8000
# Open http://localhost:8000 in your browser
```

### Step 4: Verify Everything Works

1. Open your browser's Developer Console (F12)
2. You should see: "✅ Supabase client initialized successfully"
3. The map should load with flood markers
4. Test the filters and clicking on markers
5. Navigate to the Submissions page and verify it loads

**If you see errors**, check the [Troubleshooting](#troubleshooting) section below.

---

## GitHub Pages Deployment

Deploy your application to GitHub Pages for free hosting with automatic deployments on every push.

### Prerequisites

- A GitHub account
- Your code in a GitHub repository
- Supabase project with migrated data
- GitHub Actions enabled in your repository

### Step 1: Prepare Your Repository

1. **Ensure your code is pushed to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for GitHub Pages deployment"
   git push origin main
   ```

2. **Verify the required files exist:**
   - ✅ `.github/workflows/deploy-gh-pages.yml` - Deployment workflow
   - ✅ `static/.nojekyll` - Disables Jekyll processing
   - ✅ `static/config.js` - Contains placeholders (no real credentials!)
   - ✅ `.gitignore` - Includes `static/config.js` to prevent committing real credentials

### Step 2: Configure GitHub Secrets

1. **Go to your GitHub repository**
2. **Click Settings** → **Secrets and variables** → **Actions**
3. **Add the following secrets:**

   **Secret 1:**
   - **Name**: `SUPABASE_URL`
   - **Value**: Your Supabase project URL
     - Example: `https://abcdefghijklmnop.supabase.co`
     - Find in: Supabase Dashboard → Project Settings → API → Project URL

   **Secret 2:**
   - **Name**: `SUPABASE_ANON_KEY`
   - **Value**: Your Supabase anonymous/public key
     - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBh...`
     - Find in: Supabase Dashboard → Project Settings → API → anon public

4. **Click "Add secret" for each one**

### Step 3: Enable GitHub Pages

1. **Go to Settings** → **Pages**
2. **Under "Source"**, select: **GitHub Actions**
3. **Save the settings**

### Step 4: Deploy

**Automatic Deployment** (on every push):
```bash
git add .
git commit -m "Update application"
git push origin main
```

The GitHub Actions workflow will automatically:
1. Checkout the code
2. Inject your Supabase credentials from secrets
3. Deploy to GitHub Pages
4. Make your site available at: `https://your-username.github.io/your-repo-name/`

**Manual Deployment**:
1. Go to the **Actions** tab in your repository
2. Select "Deploy to GitHub Pages" workflow
3. Click **Run workflow**
4. Select the branch (usually `main`)
5. Click **Run workflow**

### Step 5: Verify Deployment

1. **Check workflow status:**
   - Go to **Actions** tab
   - Wait for the green checkmark ✓
   - If it fails, click on the workflow run to see error details

2. **Visit your site:**
   - Go to: `https://your-username.github.io/your-repo-name/`
   - The map should load with flood data

3. **Check browser console:**
   - Press F12 to open Developer Tools
   - Look for: "✅ Supabase client initialized successfully"
   - Verify no error messages appear

4. **Test functionality:**
   - Zoom and pan the map
   - Click on flood markers
   - Use the filters
   - Navigate to Submissions page
   - Try submitting a test contribution

### Step 6: Custom Domain (Optional)

To use your own domain name:

1. **Add CNAME file:**
   ```bash
   echo "yourdomain.com" > static/CNAME
   git add static/CNAME
   git commit -m "Add custom domain"
   git push origin main
   ```

2. **Configure DNS at your domain registrar:**
   - Add a CNAME record: `www` → `your-username.github.io`
   - Or add A records to GitHub's IPs (see [GitHub docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site))

3. **Configure in GitHub:**
   - Go to **Settings** → **Pages**
   - Enter your custom domain in the "Custom domain" field
   - Wait for DNS check to complete
   - Enable "Enforce HTTPS" (recommended)

---

## Configuration Reference

### Environment-Specific Configuration

| Environment | Configuration Method | File Used |
|-------------|---------------------|-----------|
| Local Development | Edit `static/config.js` manually | `static/config.js` |
| GitHub Pages | Set repository secrets | Auto-generated during deployment |
| Other Hosting | Environment variables or config file | `static/config.js` |

### Required Configuration Values

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous key | Supabase Dashboard → Settings → API → anon public |

### Security Best Practices

✅ **DO:**
- Use only the `anon` (anonymous/public) key in frontend code
- Set up Row Level Security (RLS) policies in Supabase
- Keep the `service_role` key secret and use only in backend code
- Add `static/config.js` to `.gitignore` for local development
- Use GitHub Secrets for production deployments
- Enable HTTPS for your deployed site

❌ **DON'T:**
- Never commit real credentials to version control
- Never use the `service_role` key in client-side code
- Never expose credentials in public repositories
- Don't share your `service_role` key with anyone

---

## Troubleshooting

### Local Development Issues

#### "Supabase credentials not configured"

**Problem:** Console shows "⚠️ Supabase credentials not configured!"

**Solution:**
1. Verify `static/config.js` exists (not `config.example.js`)
2. Check that you replaced `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`
3. Ensure there are no extra spaces or quotes around the values
4. Verify you're using the `anon` key, not the `service_role` key

#### "Supabase library not loaded"

**Problem:** Console shows "❌ Supabase library not loaded"

**Solution:**
1. Check internet connection (CDN needs to be accessible)
2. Verify `index.html` includes the Supabase CDN script
3. Try a different browser or clear cache
4. Check browser console for any blocked resources

#### Map not loading or shows empty

**Problem:** Map displays but no flood markers appear

**Solution:**
1. Verify data was migrated to Supabase (check Supabase Table Editor)
2. Check browser console for API errors
3. Ensure RLS policies are set up correctly
4. Verify the `floods` table exists and has data
5. Test the Supabase connection using the browser console:
   ```javascript
   await window.supabaseClient.from('floods').select('count')
   ```

#### CORS errors in local development

**Problem:** Browser shows CORS policy errors

**Solution:**
1. Use a local web server instead of `file://` protocol
2. Run `python -m http.server` or `npx http-server`
3. Access via `http://localhost:8000` instead of opening file directly

### GitHub Pages Deployment Issues

#### Workflow fails with "secrets not found"

**Problem:** GitHub Actions workflow fails during deployment

**Solution:**
1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Verify both secrets exist: `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. Check the secret names are exactly correct (case-sensitive)
4. Ensure there are no extra spaces in the secret values
5. Re-create the secrets if needed
6. Re-run the workflow

#### 404 Page Not Found

**Problem:** GitHub Pages URL shows 404 error

**Solution:**
1. Go to **Settings** → **Pages**
2. Verify "Source" is set to "GitHub Actions" (not "Deploy from a branch")
3. Check the workflow completed successfully (green checkmark in Actions tab)
4. Wait 5-10 minutes for GitHub's CDN to propagate changes
5. Try a hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
6. Check repository visibility (must be public, or have GitHub Pro for private)

#### Site loads but no map data

**Problem:** GitHub Pages site loads but map is empty

**Solution:**
1. Check browser console for errors
2. Verify secrets are set correctly in repository settings
3. Check the deployed `config.js` has real credentials (view page source)
4. Ensure RLS policies are configured in Supabase
5. Verify the anon key has permission to read from the floods table
6. Re-run the deployment workflow

#### Custom domain not working

**Problem:** Custom domain shows error or doesn't resolve

**Solution:**
1. Verify DNS records are set correctly at your domain registrar
2. Wait for DNS propagation (can take up to 48 hours, usually much faster)
3. Check CNAME file exists in `static/` directory
4. Verify domain is configured in GitHub **Settings** → **Pages**
5. Enable "Enforce HTTPS" after DNS propagation completes
6. Use [DNS Checker](https://dnschecker.org) to verify propagation

### Application Issues

#### Rate limiting errors

**Problem:** "Rate limit exceeded" when submitting contributions

**Solution:**
1. This is expected behavior - users can submit 10 contributions per week
2. Wait for the specified time period
3. Use a different email address
4. For testing, administrators can reset rate limits in Supabase

#### Submissions not appearing

**Problem:** Submitted contributions don't show up in the list

**Solution:**
1. Refresh the page (submissions are added in real-time)
2. Check if filters are hiding the submission
3. Verify the submission was successful (check browser console)
4. Check the `submissions` table in Supabase Table Editor
5. Ensure RLS policies allow reading submissions

#### Search not working

**Problem:** Search functionality doesn't filter submissions

**Solution:**
1. Check browser console for JavaScript errors
2. Verify submissions have title/description content
3. Try different search terms
4. Clear any active filters that might conflict
5. Refresh the page and try again

---

## Additional Resources

- **[README.md](README.md)** - Full project documentation
- **[Supabase Documentation](https://supabase.com/docs)** - Database and API reference
- **[GitHub Pages Documentation](https://docs.github.com/en/pages)** - Hosting information
- **[Leaflet.js Documentation](https://leafletjs.com/)** - Map library reference

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the browser console for specific error messages
2. Review the [Troubleshooting](#troubleshooting) section above
3. Check GitHub Actions logs for deployment errors
4. Verify all prerequisites are met
5. Ensure Supabase data migration completed successfully
6. Review the RLS policies in Supabase

For project-specific issues, check the GitHub repository issues page.

---

## Deployment Checklist

Use this checklist to ensure proper setup:

### Local Development
- [ ] Supabase project created
- [ ] Data migrated to Supabase
- [ ] `static/config.js` created from `config.example.js`
- [ ] Credentials added to `config.js`
- [ ] Application runs locally without errors
- [ ] Map loads and displays flood data
- [ ] Filters work correctly
- [ ] Submissions page accessible

### GitHub Pages
- [ ] Code pushed to GitHub repository
- [ ] GitHub Actions enabled
- [ ] Repository secrets configured (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
- [ ] GitHub Pages enabled with "GitHub Actions" source
- [ ] Workflow runs successfully
- [ ] Site accessible at GitHub Pages URL
- [ ] Map loads with data
- [ ] All features work in production
- [ ] (Optional) Custom domain configured

---

**Last Updated:** 2024-10-15