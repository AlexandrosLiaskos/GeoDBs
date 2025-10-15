-- SQLite Migration: Add Community Features
-- Date: 2025-09-26
-- Description: Adds community contribution tables to SQLite database

-- Note: This migration adds support for community contributions (corrections and additions)
-- Verification features have been removed as per requirements

-- 1. Create submissions table for community contributions (SQLite version)
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_type TEXT NOT NULL CHECK(submission_type IN ('correction', 'addition')),
    flood_event_id INTEGER,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'needs_info')),
    
    -- Submission details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    suggested_changes TEXT, -- JSON as text
    evidence_urls TEXT,
    
    -- Contributor information
    contributor_name TEXT,
    contributor_email TEXT NOT NULL,
    contributor_organization TEXT,
    
    -- Security and tracking
    submission_ip TEXT,
    submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Moderation fields
    reviewed_by TEXT,
    review_date TIMESTAMP,
    review_notes TEXT,
    
    -- Foreign key
    FOREIGN KEY (flood_event_id) REFERENCES floods(id) ON DELETE CASCADE
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(contributor_email);
CREATE INDEX IF NOT EXISTS idx_submissions_ip ON submissions(submission_ip);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_date ON submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_submissions_flood_event ON submissions(flood_event_id);

-- 3. Create rate limiting table
CREATE TABLE IF NOT EXISTS submission_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    identifier_type TEXT NOT NULL CHECK(identifier_type IN ('ip', 'email')),
    submission_count INTEGER DEFAULT 1,
    first_submission TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_submission TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP,
    UNIQUE(identifier, identifier_type)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON submission_rate_limits(blocked_until);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON submission_rate_limits(identifier, identifier_type);
