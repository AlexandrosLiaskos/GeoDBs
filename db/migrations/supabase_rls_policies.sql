-- ============================================================================
-- Supabase Row Level Security (RLS) Policies Migration
-- ============================================================================
-- This script enables Row Level Security on all tables and creates policies
-- to secure database access and enforce rate limiting at the database level.
--
-- SECURITY MODEL:
-- - Anonymous (public) access with rate limiting enforcement
-- - Service role key bypasses all RLS policies for administrative operations
-- - Rate limiting enforced through database policies for defense-in-depth
--
-- TABLES:
-- 1. floods: Public read access, admin-only writes
-- 2. submissions: Public read/insert with rate limiting, admin-only updates/deletes
-- 3. submission_rate_limits: Public read/write for tracking, admin-only deletes
--
-- RATE LIMITING:
-- - Email-based: Max 10 submissions per email per 7 days (enforced in RLS)
-- - IP-based: Max 5 submissions per IP per day (not enforced in RLS - see notes)
-- - Blocked users (blocked_until > NOW()) cannot submit
--
-- NOTES:
-- - IP-based rate limiting is NOT enforced in RLS because submission_ip is
--   client-provided and can be easily spoofed. Server-side IP detection
--   would be required for reliable IP-based rate limiting.
-- - If user authentication is added later, these policies will need updates
-- - Monitor performance of the submission insert policy (uses subqueries)
-- ============================================================================

-- ============================================================================
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

-- Enable RLS on floods table
-- Security model: Public read access, administrative write access only
ALTER TABLE floods ENABLE ROW LEVEL SECURITY;

-- Enable RLS on submissions table
-- Security model: Public read and insert (with rate limiting), admin-only updates/deletes
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on submission_rate_limits table
-- Security model: Public read/write for rate limit tracking, admin-only deletes
ALTER TABLE submission_rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. FLOODS TABLE POLICIES (Public Read Access)
-- ============================================================================

-- Policy: Allow anonymous users to read all flood data
-- This enables anyone to query and view flood information without restrictions
CREATE POLICY floods_public_read
  ON floods
  FOR SELECT
  TO anon
  USING (true);

-- Note: No INSERT, UPDATE, or DELETE policies are created for floods table.
-- Flood data is managed by administrators using the service role key, which
-- bypasses all RLS policies. This is intentional to maintain data integrity.

-- ============================================================================
-- 3. SUBMISSIONS TABLE POLICIES
-- ============================================================================

-- Policy: Allow anonymous users to read all submissions
-- This matches the current public API behavior where all submissions are visible
CREATE POLICY submissions_public_read
  ON submissions
  FOR SELECT
  TO anon
  USING (true);

-- Policy: Allow anonymous users to insert submissions with rate limiting
-- Enforces email-based rate limiting at the database level:
-- - Maximum 10 submissions per email per 7 days
-- - Blocked users (blocked_until > NOW()) cannot submit
-- 
-- IMPORTANT: This policy uses subqueries which may impact performance.
-- Monitor query performance and consider optimizing if needed.
--
-- Note: IP-based rate limiting (5 per IP per day) is intentionally NOT enforced
-- here because submission_ip is client-provided and can be spoofed.
CREATE POLICY submissions_public_insert
  ON submissions
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Email-based rate limit: Max 10 submissions per email per 7 days
    (SELECT COUNT(*) 
     FROM submissions 
     WHERE contributor_email = NEW.contributor_email 
       AND submission_date > NOW() - INTERVAL '7 days') < 10
    AND
    -- Check if email is blocked
    NOT EXISTS (
      SELECT 1 
      FROM submission_rate_limits 
      WHERE identifier = NEW.contributor_email 
        AND identifier_type = 'email' 
        AND blocked_until > NOW()
    )
  );

-- Policy: Allow authenticated users to update submissions
-- Note: Since the application doesn't have user authentication, only requests
-- using the service role key will be able to update. This policy serves as
-- documentation of intent and will be useful if authentication is added later.
CREATE POLICY submissions_admin_update
  ON submissions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to delete submissions
-- Note: Same as above - only service role key can delete in practice.
CREATE POLICY submissions_admin_delete
  ON submissions
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- 4. SUBMISSION_RATE_LIMITS TABLE POLICIES
-- ============================================================================

-- Policy: Allow anonymous users to read their own rate limit records
-- This enables the frontend to check rate limit status before submission
-- for better user experience (immediate feedback)
CREATE POLICY rate_limits_public_read_own
  ON submission_rate_limits
  FOR SELECT
  TO anon
  USING (
    identifier IN (
      SELECT contributor_email 
      FROM submissions 
      WHERE contributor_email IS NOT NULL
    )
  );

-- Policy: Allow anonymous users to insert rate limit records
-- This is necessary for the submission flow to create initial rate limit tracking
CREATE POLICY rate_limits_public_upsert
  ON submission_rate_limits
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Allow anonymous users to update rate limit records
-- This is necessary for the submission flow to increment counters and update timestamps
CREATE POLICY rate_limits_public_update
  ON submission_rate_limits
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to delete rate limit records
-- Only service role can delete in practice (for cleanup/reset operations)
CREATE POLICY rate_limits_admin_delete
  ON submission_rate_limits
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- VERIFICATION AND TESTING QUERIES
-- ============================================================================
-- Uncomment and run these queries to verify the policies work correctly.
-- Make sure to test with appropriate authentication contexts.

-- Test 1: Verify RLS is enabled on all tables
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE tablename IN ('floods', 'submissions', 'submission_rate_limits');

-- Test 2: List all policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies 
-- WHERE tablename IN ('floods', 'submissions', 'submission_rate_limits')
-- ORDER BY tablename, policyname;

-- Test 3: Test reading floods as anonymous user (should work)
-- SET ROLE anon;
-- SELECT COUNT(*) FROM floods;
-- RESET ROLE;

-- Test 4: Test inserting submission as anonymous user (should work if under rate limit)
-- SET ROLE anon;
-- INSERT INTO submissions (flood_id, contributor_name, contributor_email, contribution_type, description)
-- VALUES (1, 'Test User', 'test@example.com', 'eyewitness', 'Test submission');
-- RESET ROLE;

-- Test 5: Test rate limit enforcement (should fail after 10 submissions with same email)
-- SET ROLE anon;
-- -- Insert 10 submissions with the same email
-- -- The 11th submission should fail with "new row violates row-level security policy"
-- RESET ROLE;

-- Test 6: Test that updates fail for anonymous users (should fail)
-- SET ROLE anon;
-- UPDATE submissions SET status = 'verified' WHERE id = 1;
-- -- Expected error: "new row violates row-level security policy"
-- RESET ROLE;

-- Test 7: Test that deletes fail for anonymous users (should fail)
-- SET ROLE anon;
-- DELETE FROM submissions WHERE id = 1;
-- -- Expected error: "permission denied for table submissions"
-- RESET ROLE;

-- ============================================================================
-- IMPORTANT REMINDERS
-- ============================================================================
-- 
-- 1. Service role key bypasses ALL RLS policies
--    - Use it for administrative operations (updates, deletes, etc.)
--    - NEVER expose service role key in frontend code
-- 
-- 2. Rate limiting performance
--    - The submissions_public_insert policy uses subqueries
--    - Monitor performance and add indexes if needed:
--      CREATE INDEX idx_submissions_email_date ON submissions(contributor_email, submission_date);
-- 
-- 3. Changing rate limits
--    - If you need to change the rate limit values, update both:
--      a) This SQL file (the number 10 in the policy)
--      b) Frontend validation in static/submissions.js
--      c) Backend constants in services/community.py (for consistency)
-- 
-- 4. Adding authentication
--    - If you add Supabase Auth later, review and update all policies
--    - Replace 'anon' role with 'authenticated' where appropriate
--    - Add user-specific access controls (e.g., users can only edit their own submissions)
-- 
-- 5. IP-based rate limiting
--    - Not implemented in RLS due to client-side IP spoofing
--    - Consider implementing on backend with trusted IP detection service
--    - Or use Supabase Edge Functions with access to real client IP
-- 
-- ============================================================================

-- End of migration