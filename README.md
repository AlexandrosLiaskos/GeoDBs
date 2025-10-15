# 🌊 Greek Floods Web Map Atlas

A secure, interactive web application for visualizing Greek flood data without exposing the raw dataset to users.

## 🎯 Features

- **Interactive Map**: Leaflet.js-powered map with OpenStreetMap tiles
- **Secure Data Access**: API-only access, no direct shapefile downloads
- **Advanced Filtering**: Filter by year, location, and cause of flood
- **Click-to-View Details**: Detailed information for each flood event
- **Responsive Design**: Works on desktop and mobile devices
- **Performance Optimized**: Spatial indexing and efficient data loading

## 🏗️ Architecture

### Backend (FastAPI + SQLite)
- **Database**: SQLite with spatial indexing for performance
- **API**: RESTful endpoints serving filtered GeoJSON data
- **Security**: No raw data exposure, coordinate transformation
- **Projection**: Converts from Greek Grid (EPSG:2100) to WGS84 (EPSG:4326)

### Frontend (HTML5 + Leaflet.js)
- **Map Library**: Leaflet.js for interactive mapping
- **Styling**: Modern CSS with responsive design
- **Interactivity**: Click events, filtering, modal dialogs
- **Performance**: Efficient marker rendering and clustering

## 📊 Dataset

- **Source**: Greek floods shapefile (Floods_GR.shp)
- **Records**: 1,992 flood events processed
- **Fields**: Date, location, casualties, rainfall data, causes
- **Coverage**: Historical flood events across Greece

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Docker (optional)

### Local Development

1. **Clone and setup**:
   ```bash
   cd /path/to/GeoMap
   pip install -r requirements.txt
   ```

2. **Process shapefile** (if not already done):
   ```bash
   python process_shapefile.py
   ```

3. **Run the application**:
   ```bash
   python main.py
   ```

4. **Access the application**:
   Open http://localhost:8000 in your browser

### Docker Deployment

1. **Build and run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

2. **Access the application**:
   Open http://localhost:8000 in your browser

## 🔧 API Endpoints

### GET `/api/floods/points`
Get simplified flood points for map display
- **Query Parameters**: `year`, `location`, `cause`, `limit`
- **Response**: Array of flood points with coordinates

### GET `/api/floods/{flood_id}`
Get detailed information for a specific flood event
- **Response**: Complete flood event details

### GET `/api/floods/filters`
Get available filter options
- **Response**: Lists of years, locations, and causes

### GET `/api/floods/stats`
Get dataset statistics
- **Response**: Total events, year range, casualty statistics

## 🛡️ Security Features

- **No Raw Data Access**: Shapefile is processed and secured in database
- **API Rate Limiting**: Built-in FastAPI protections
- **Coordinate Validation**: Ensures data integrity
- **Input Sanitization**: Prevents injection attacks
- **CORS Configuration**: Controlled cross-origin access

## Supabase Setup

### Data Migration

1. **Prerequisites**: Ensure the Supabase schema has been created by running `supabase_schema.sql` in the Supabase SQL Editor, and that `.env` file exists with valid Supabase credentials.

2. **Installation**: Install required Python dependencies by running `pip install -r requirements.txt` to get the `supabase` and `python-dotenv` libraries.

3. **Running the Migration**: Execute the migration script from the project root directory:
   - Command: `python .utils/scripts/migrate_to_supabase.py`
   - The script will read all flood records from `floods_greece.db` SQLite database
   - Records will be inserted into Supabase PostgreSQL in batches
   - Progress will be displayed in the console

4. **Verification**: After migration completes, verify the data in Supabase:
   - Go to Supabase Dashboard > Table Editor > floods table
   - Check that the record count matches the SQLite database
   - Verify a few sample records to ensure data integrity

5. **Troubleshooting**: Common issues and solutions:
   - "Database not found" error: Ensure `floods_greece.db` exists in the project root
   - "Missing environment variables" error: Check that `.env` file exists and contains `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - "Connection error": Verify Supabase credentials are correct and project is active
   - Duplicate key errors: The floods table may already contain data; drop and recreate the table using `supabase_schema.sql` if you want to re-migrate

6. **Note**: This migration only handles the floods table. The submissions and submission_rate_limits tables will be populated by the application during normal operation.

Reference the migration script location: `.utils/scripts/migrate_to_supabase.py`

## Frontend Configuration

### Overview
The frontend now connects directly to Supabase instead of using the FastAPI backend for map data, filters, statistics, and flood details. This change improves performance and simplifies the architecture by leveraging Supabase's PostgreSQL database and real-time capabilities.

### Configuration Steps
1. Open `static/config.js`
2. Replace the placeholder values:
   - `'YOUR_SUPABASE_URL'` with your actual Supabase project URL (from Project Settings > API)
   - `'YOUR_SUPABASE_ANON_KEY'` with your actual anonymous/public API key (from Project Settings > API > Project API keys > anon public)
3. Save the file

### Security Notes
- Emphasize that only the ANON key should be used in the frontend (never the service role key)
- Explain that the anon key is safe to expose in client-side code
- Note that Row Level Security policies (to be added in a later phase) will control data access

### Testing
- Open `static/index.html` in a browser or serve it with a local web server
- The map should load flood data from Supabase
- Check the browser console for any errors
- Verify that filters, statistics, and detail views work correctly

### Troubleshooting
- "supabaseClient is not defined" error: Check that `config.js` is loaded before `app.js` in `index.html`
- "Failed to load flood data" error: Verify Supabase credentials are correct and the floods table has data
- CORS errors: Ensure your Supabase project allows requests from your domain (Supabase allows all origins by default for the anon key)
- Empty map: Check that the migration script successfully populated the floods table

### Next Steps
- Reference the upcoming phases: community submissions migration and Row Level Security setup
- Note that the FastAPI backend is no longer needed for the main map functionality (but is still used for community submissions until the next phase)

## Community Submissions Configuration

### Overview
The community submissions page now connects directly to Supabase instead of using the FastAPI backend, similar to the main map page.

### Configuration
The submissions page uses the same Supabase configuration from `static/config.js` that was set up for the main map, so no additional configuration is needed.

### Features
- List submissions with filtering by status and type
- Search submissions by title or description
- View detailed submission information
- Submit new corrections or additions to flood events
- View statistics about submissions and contributors
- Client-side rate limiting (email-based, 10 submissions per week)

### Rate Limiting Notes
- Rate limiting is currently email-based only (IP-based limiting requires server-side implementation)
- Users can submit up to 10 contributions per week per email address
- Rate limit checks are performed before submission to provide immediate feedback
- Full rate limiting enforcement will be implemented with Row Level Security policies in the next phase

### Search Functionality
- The search feature performs case-insensitive matching across submission titles and descriptions
- Search is performed using Supabase's `.ilike()` operator for simple substring matching
- For more advanced search capabilities (stemming, relevance ranking), consider implementing PostgreSQL full-text search in the future

### Data Structure
- Submissions are automatically enriched with location and year information from the related flood event (if applicable)
- The page displays submissions in reverse chronological order (newest first)
- Pagination is supported with 20 submissions per page

### Testing
- Open `static/submissions.html` in a browser or navigate to `/submissions` on your deployed site
- The page should load submissions from Supabase
- Test filtering, searching, and pagination
- Try submitting a new contribution (requires valid email)
- Check the browser console for any errors

### Troubleshooting
- "supabaseClient is not defined" error: Check that `config.js` is loaded before `submissions.js` in `submissions.html`
- "Failed to load submissions" error: Verify Supabase credentials are correct and the submissions table exists
- "Rate limit exceeded" error: Wait for the specified time period or use a different email address
- Empty submissions list: Check that the submissions table has data (it will be empty initially until users submit contributions)
- Search not working: Verify that the search input is properly connected and that submissions have title/description content

### Next Steps
- Reference the upcoming Row Level Security phase that will add proper access control and security policies
- Note that the FastAPI backend is no longer needed for community submissions functionality
## Row Level Security (RLS) Setup

### Overview
Row Level Security policies have been implemented to secure database access and enforce rate limiting at the database level. RLS provides defense-in-depth security by enforcing access rules directly in PostgreSQL, ensuring that even if frontend code is bypassed, the database will still enforce proper access controls.

### Applying RLS Policies

1. **Navigate to Supabase Dashboard**:
   - Go to your Supabase project dashboard
   - Select **SQL Editor** from the left sidebar

2. **Execute the RLS policies script**:
   - Open the file [`db/migrations/supabase_rls_policies.sql`](db/migrations/supabase_rls_policies.sql:1) in your project
   - Copy the entire contents of the file
   - Paste it into the SQL Editor
   - Click **Run** to execute the script

3. **Verify RLS is enabled**:
   - Go to **Table Editor** in the Supabase dashboard
   - Check that the [`floods`](db/migrations/supabase_rls_policies.sql:35), [`submissions`](db/migrations/supabase_rls_policies.sql:40), and [`submission_rate_limits`](db/migrations/supabase_rls_policies.sql:45) tables show a lock icon
   - This indicates that RLS is enabled on these tables
   - You can also view the policies by clicking on each table and selecting the **Policies** tab

### Security Model

The RLS policies implement the following security model:

- **Floods table**: Public read access for all users, administrative write access only (via service role key)
- **Submissions table**: Public read and insert access with rate limiting enforced at database level; updates and deletes restricted to service role
- **Submission_rate_limits table**: Public read/write for rate limit tracking, delete operations restricted to service role

This model ensures that:
- Anyone can view flood data and submissions (public read access)
- Anyone can submit contributions, but only up to the defined rate limits
- Only administrators (using service role key) can modify submission status or delete records
- Rate limiting is enforced at the database level, preventing circumvention

### Rate Limiting Enforcement

RLS policies enforce rate limiting directly in the database through the [`submissions_public_insert`](db/migrations/supabase_rls_policies.sql:72) policy:

- **Email-based rate limiting**: Maximum 10 submissions per email address per 7 days
  - Enforced through database-level constraints in the INSERT policy
  - Each submission attempt counts submissions from the same email in the last 7 days
  - If count >= 10, the insert is rejected with a policy violation error

- **Blocked users**: Users with active blocks (blocked_until > NOW()) cannot submit
  - Checked in the [`submission_rate_limits`](db/migrations/supabase_schema.sql:1) table
  - Blocks are typically set by administrators for abuse prevention

- **Client-side checks**: [`static/submissions.js`](static/submissions.js:1) provides immediate feedback
  - Frontend checks rate limits before submission for better UX
  - Database policies provide authoritative enforcement (defense-in-depth)
  - Users see friendly error messages when rate limited

- **IP-based rate limiting**: Not enforced in RLS
  - The [`submission_ip`](db/migrations/supabase_schema.sql:1) field is client-provided and can be spoofed
  - Consider implementing IP-based limiting on the backend with a trusted IP detection service
  - Or use Supabase Edge Functions which have access to real client IP addresses

### Testing RLS Policies

To verify that the policies are working correctly:

1. **Test reading flood data** (should work for all users):
   - Open your application in a browser
   - The map should load flood points without errors
   - Check browser console for any policy violation errors

2. **Test submitting a contribution** (should work up to rate limit):
   - Navigate to the submissions page
   - Submit a contribution with a test email
   - Submission should succeed
   - Repeat with the same email to test rate limiting

3. **Test rate limit enforcement**:
   - Submit 10 contributions with the same email address within 7 days
   - Attempt an 11th submission with the same email
   - Should be rejected with error: "new row violates row-level security policy"
   - Check browser Network tab for the 403/400 error response

4. **Verify error messages are user-friendly**:
   - Rate limit errors should display helpful messages to users
   - Check [`static/submissions.js`](static/submissions.js:1) error handling
   - Ensure users understand why their submission was rejected

5. **Test admin operations** (requires service role key):
   - Updating submission status requires service role key
   - Frontend cannot perform these operations (as expected)
   - Consider building a separate admin panel for moderation

### Administrative Operations

Administrative operations require the service role key, which bypasses all RLS policies:

- **Service role key usage**:
  - The service role key has full database access
  - Use it for updating submission status, deleting records, and resetting rate limits
  - **NEVER expose the service role key in frontend code**
  - Store it securely in backend environment variables only

- **Example admin operations**:
  - Update submission status: `UPDATE submissions SET status = 'verified' WHERE id = ?`
  - Delete submission: `DELETE FROM submissions WHERE id = ?`
  - Reset rate limits: `DELETE FROM submission_rate_limits WHERE identifier = ?`
  - Block user: `INSERT INTO submission_rate_limits (identifier, identifier_type, blocked_until) VALUES (?, 'email', ?)`

- **Admin panel considerations**:
  - Build a separate admin panel that uses the service role key on the backend
  - Implement proper authentication for admin users
  - Create tools for moderating submissions, managing rate limits, and viewing statistics
  - Consider using Supabase Auth with role-based access control

### Troubleshooting

Common issues and solutions:

1. **"new row violates row-level security policy" error**:
   - **Cause**: User has exceeded the rate limit or is blocked
   - **Solution**: Wait for the rate limit period to expire or use a different email
   - **Admin action**: Reset rate limits or remove block from [`submission_rate_limits`](db/migrations/supabase_schema.sql:1) table

2. **"permission denied for table" error**:
   - **Cause**: Attempting an operation not allowed by RLS policies (e.g., UPDATE or DELETE as anonymous user)
   - **Solution**: These operations require service role key authentication
   - **Note**: This is expected behavior for non-admin users

3. **Rate limit not working**:
   - **Verify**: Check that RLS policies are enabled on all tables
   - **Verify**: Check that the [`submissions_public_insert`](db/migrations/supabase_rls_policies.sql:72) policy exists
   - **Test**: Run the verification queries in [`supabase_rls_policies.sql`](db/migrations/supabase_rls_policies.sql:203)
   - **Check**: Ensure submission_date values are being set correctly

4. **Can't update submission status**:
   - **Expected**: Updates require service role key (not available in frontend)
   - **Solution**: Build backend admin tools or use Supabase Dashboard for manual updates
   - **Note**: The [`submissions_admin_update`](db/migrations/supabase_rls_policies.sql:98) policy is for service role only

5. **Performance issues**:
   - **Monitor**: The INSERT policy uses subqueries which may impact performance
   - **Optimize**: Consider adding index: `CREATE INDEX idx_submissions_email_date ON submissions(contributor_email, submission_date)`
   - **Check**: Review query performance in Supabase Dashboard > Database > Query Performance

### Future Enhancements

Consider these improvements for enhanced security and functionality:

1. **Implement Supabase Auth**:
   - Add user authentication with email/password or social login
   - Enable user-specific features (e.g., users can edit their own submissions)
   - Update RLS policies to distinguish between authenticated and anonymous users
   - Add user profiles and contribution history

2. **Advanced rate limiting**:
   - Implement exponential backoff for repeat offenders
   - Add different rate limits for verified vs. unverified users
   - Track and analyze abuse patterns
   - Implement automatic blocking for suspicious behavior

3. **IP-based rate limiting**:
   - Implement on backend with trusted IP detection service (e.g., Cloudflare, MaxMind)
   - Use Supabase Edge Functions to access real client IP addresses
   - Combine IP and email rate limiting for stronger protection
   - Consider geographic rate limiting (e.g., limit submissions per region)

4. **Admin dashboard**:
   - Create a separate admin interface with proper authentication
   - Tools for moderating submissions and managing rate limits
   - Statistics and analytics for monitoring submissions
   - Bulk operations for managing multiple submissions

5. **Monitoring and alerts**:
   - Set up monitoring for rate limit violations
   - Alert administrators of potential abuse
   - Track submission trends and patterns
   - Generate reports on contribution quality

### Security Notes

Important security considerations:

- **Defense-in-depth**: RLS policies provide database-level security that cannot be bypassed by frontend code
- **Rate limiting**: Prevents spam and abuse by enforcing submission limits at the database level
- **Anonymous access**: The application uses anonymous (public) access without user authentication
- **Service role key**: Has full database access and bypasses all RLS policies - keep it secure
- **Policy enforcement**: All policies are evaluated before data reaches the application layer
- **Monitoring**: Regularly review the [`submission_rate_limits`](db/migrations/supabase_schema.sql:1) table to identify abuse patterns
- **Updates**: If changing rate limit values, update both the RLS policy and frontend validation code
- **Testing**: Always test policies in a development environment before applying to production


## 🚀 GitHub Pages Deployment

The application can be deployed to GitHub Pages for free hosting. The frontend is fully static and connects directly to Supabase, making it perfect for GitHub Pages deployment.

### Prerequisites

1. **Supabase Project**: You must have a Supabase project with the floods data migrated (see [Supabase Setup](#supabase-setup))
2. **GitHub Repository**: Your code must be in a GitHub repository
3. **GitHub Actions Enabled**: Ensure Actions are enabled in your repository settings

### Deployment Steps

#### Step 1: Configure Repository Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add the following secrets:

   - **Name**: `SUPABASE_URL`
     - **Value**: Your Supabase project URL (e.g., `https://your-project.supabase.co`)
     - Find this in: Supabase Dashboard → Project Settings → API → Project URL

   - **Name**: `SUPABASE_ANON_KEY`
     - **Value**: Your Supabase anonymous/public key
     - Find this in: Supabase Dashboard → Project Settings → API → Project API keys → anon public

**Security Note**: Only use the `anon` (public) key, NEVER the `service_role` key. The anon key is safe for client-side use and is protected by Row Level Security policies.

#### Step 2: Enable GitHub Pages

1. Go to **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save the settings

#### Step 3: Deploy

The deployment is automatic! The GitHub Actions workflow ([`.github/workflows/deploy-gh-pages.yml`](.github/workflows/deploy-gh-pages.yml:1)) will:

1. **Trigger** on every push to the `main` branch (or manually via workflow dispatch)
2. **Inject** your Supabase credentials from secrets into [`static/config.js`](static/config.js:1)
3. **Deploy** the `static` folder to GitHub Pages
4. **Publish** your site at `https://your-username.github.io/your-repo-name/`

To trigger the first deployment:
```bash
git add .
git commit -m "Configure GitHub Pages deployment"
git push origin main
```

#### Step 4: Verify Deployment

1. Go to **Actions** tab in your GitHub repository
2. Watch the "Deploy to GitHub Pages" workflow run
3. Once complete (green checkmark), visit your site at:
   - `https://your-username.github.io/your-repo-name/`
4. Check the browser console for successful Supabase initialization:
   - Should see: "✅ Supabase client initialized successfully"
5. Verify the map loads flood data from Supabase

### Manual Deployment

You can also trigger deployment manually:

1. Go to **Actions** tab
2. Select "Deploy to GitHub Pages" workflow
3. Click **Run workflow**
4. Select the branch to deploy (usually `main`)
5. Click **Run workflow**

### Troubleshooting

#### Map not loading / Supabase errors

**Problem**: Console shows "⚠️ Supabase credentials not configured!"

**Solution**:
1. Verify secrets are set correctly in repository settings
2. Check secret names are exactly: `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. Ensure you're using the anon key, not the service role key
4. Re-run the deployment workflow after fixing secrets

#### 404 Page Not Found

**Problem**: Site shows GitHub 404 page

**Solution**:
1. Verify GitHub Pages is enabled and set to "GitHub Actions" source
2. Check the Actions workflow completed successfully
3. Wait a few minutes for DNS propagation
4. Ensure the repository is public (or you have GitHub Pro for private repos)

#### CORS Errors

**Problem**: Browser console shows CORS errors

**Solution**:
- Supabase allows all origins by default for the anon key
- If you've restricted origins, add your GitHub Pages URL to allowed origins in Supabase Dashboard → Authentication → URL Configuration

#### Workflow Fails

**Problem**: GitHub Actions workflow fails

**Solution**:
1. Check the Actions logs for specific error messages
2. Verify the [`deploy-gh-pages.yml`](.github/workflows/deploy-gh-pages.yml:1) file is in the correct location
3. Ensure permissions are set correctly in the workflow file
4. Try re-running the workflow

### Custom Domain (Optional)

To use a custom domain with GitHub Pages:

1. Add a `CNAME` file to the `static` folder:
   ```bash
   echo "yourdomain.com" > static/CNAME
   ```
2. Configure DNS with your domain provider:
   - Add a CNAME record pointing to `your-username.github.io`
   - Or add A records pointing to GitHub's IPs (see [GitHub docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site))
3. In GitHub Settings → Pages, enter your custom domain
4. Enable "Enforce HTTPS" (recommended)
5. Redeploy by pushing changes

### Files Created for GitHub Pages

The deployment configuration consists of:

- **[`.github/workflows/deploy-gh-pages.yml`](.github/workflows/deploy-gh-pages.yml:1)**: GitHub Actions workflow that handles deployment
- **[`static/.nojekyll`](static/.nojekyll:1)**: Tells GitHub Pages not to use Jekyll processing
- **[`static/config.js`](static/config.js:1)**: Configuration file that receives injected credentials during deployment

### Local Development vs Production

**Local Development**:
- Edit [`static/config.js`](static/config.js:1) directly with your Supabase credentials
- Open `static/index.html` in a browser or use a local server
- Changes are immediate, no deployment needed

**Production (GitHub Pages)**:
- Credentials are injected automatically from repository secrets
- Never commit real credentials to [`config.js`](static/config.js:1)
- Keep placeholders (`YOUR_SUPABASE_URL`) in the file
- The workflow replaces them during deployment

### Deployment Architecture

```
┌─────────────────┐
│   GitHub Repo   │
│   (main branch) │
└────────┬────────┘
         │ git push
         ▼
┌─────────────────┐
│ GitHub Actions  │
│   Workflow      │
│  - Checkout     │
│  - Inject Creds │
│  - Build        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GitHub Pages   │
│   Static Site   │
│  (your-user.    │
│   github.io)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Supabase     │
│  PostgreSQL DB  │
│  (floods data)  │
└─────────────────┘
```

### Benefits of GitHub Pages Deployment

✅ **Free Hosting**: No hosting costs for static content
✅ **Automatic SSL**: HTTPS enabled by default
✅ **Global CDN**: Fast loading worldwide via GitHub's CDN
✅ **Version Control**: Full deployment history in Git
✅ **No Backend Needed**: Direct Supabase connection from browser
✅ **Easy Updates**: Push to main = automatic deployment
✅ **Custom Domains**: Support for your own domain names

### Security Considerations

- ✅ Only the anon key is used (safe for client-side)
- ✅ Row Level Security policies protect the database
- ✅ Credentials stored as repository secrets (encrypted)
- ✅ No service role key exposed anywhere
- ⚠️ The anon key will be visible in the deployed JavaScript (this is expected and safe)
- ⚠️ RLS policies are critical - ensure they're properly configured

## 🌐 Alternative Deployment Options

If you prefer not to use GitHub Pages, or need backend functionality:

### Cloud Platforms (Full-Stack)
- **Railway**: `railway up` (with Dockerfile)
- **Render**: Connect GitHub repo, auto-deploy
- **Heroku**: `git push heroku main`
- **DigitalOcean App Platform**: GitHub integration
- **AWS/GCP/Azure**: Container deployment

### VPS Deployment (Full-Stack)
```bash
# Clone repository
git clone <your-repo-url>
cd GeoMap

# Install dependencies
pip install -r requirements.txt

# Process data
python process_shapefile.py

# Run with production server
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Note**: Full-stack deployments include the FastAPI backend, but it's no longer required for the map and submissions functionality since the frontend connects directly to Supabase.

## 📁 Project Structure

```
GeoMap/
├── Floods_GR.*              # Original shapefile components
├── process_shapefile.py     # Data processing script
├── floods_greece.db         # Processed SQLite database
├── main.py                  # FastAPI backend application
├── requirements.txt         # Python dependencies
├── Dockerfile              # Container configuration
├── docker-compose.yml      # Docker Compose setup
├── static/                 # Frontend files
│   ├── index.html          # Main HTML page
│   ├── styles.css          # CSS styling
│   └── app.js              # JavaScript application
└── README.md               # This documentation
```

## 🎨 Customization

### Styling
- Modify `static/styles.css` for visual customization
- Update color schemes in CSS variables
- Adjust responsive breakpoints

### Map Configuration
- Change base map tiles in `static/app.js`
- Modify marker styling and clustering
- Add additional map layers

### Data Fields
- Update `process_shapefile.py` for new data fields
- Modify API models in `main.py`
- Adjust frontend display in `static/app.js`

## 🔍 Performance Optimization

- **Database Indexing**: Spatial and attribute indexes
- **API Pagination**: Configurable result limits
- **Frontend Caching**: Browser caching for static assets
- **Marker Clustering**: Efficient rendering of large datasets
- **Lazy Loading**: On-demand data fetching

## 🐛 Troubleshooting

### Common Issues

1. **Database not found**: Run `python process_shapefile.py`
2. **Port already in use**: Change port in `main.py` or stop conflicting service
3. **CORS errors**: Check CORS configuration in `main.py`
4. **Slow loading**: Reduce `limit` parameter in API calls

### Development Tips

- Use browser developer tools for debugging
- Check FastAPI automatic docs at `/docs`
- Monitor API responses in Network tab
- Test filters with different combinations

## 📄 License

This project is provided as-is for educational and research purposes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review API documentation at `/docs`
- Examine browser console for errors
- Verify database integrity
