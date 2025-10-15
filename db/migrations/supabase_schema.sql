-- Supabase PostgreSQL Schema for GeoMap
-- This schema creates the core tables for flood data and community features
-- Compatible with Supabase PostgreSQL database

-- Drop tables if they exist for idempotency
DROP TABLE IF EXISTS submission_rate_limits;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS floods;

-- 1. Floods table: Stores historical flood event data
-- Based on shapefile processing with converted coordinates
CREATE TABLE floods (
    id BIGSERIAL PRIMARY KEY,
    date_of_commencement TEXT,
    year TEXT,
    x_original DOUBLE PRECISION,
    y_original DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_name TEXT,
    flood_event_name TEXT,
    deaths_toll TEXT,
    rainfall_duration TEXT,
    cause_of_flood TEXT,
    rainfall_height TEXT,
    relevant_information TEXT,
    source TEXT,
    col_m TEXT,
    col_n TEXT,
    col_o TEXT,
    col_p TEXT
);

-- Performance indexes for floods table
CREATE INDEX idx_floods_location ON floods (latitude, longitude);
CREATE INDEX idx_floods_year ON floods (year);
CREATE INDEX idx_floods_location_name ON floods (location_name);
CREATE INDEX idx_floods_cause ON floods (cause_of_flood);

-- 2. Submissions table: Handles community contributions (corrections and additions)
-- Allows users to submit changes or new flood events for moderation
CREATE TABLE submissions (
    id BIGSERIAL PRIMARY KEY,
    submission_type VARCHAR(20) NOT NULL CHECK (submission_type IN ('correction', 'addition')),
    flood_event_id BIGINT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_info')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    suggested_changes JSONB,
    evidence_urls TEXT,
    contributor_name VARCHAR(100),
    contributor_email VARCHAR(255) NOT NULL,
    contributor_organization VARCHAR(255),
    submission_ip VARCHAR(45),
    submission_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by VARCHAR(100),
    review_date TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    FOREIGN KEY (flood_event_id) REFERENCES floods(id) ON DELETE CASCADE
);

-- Performance indexes for submissions table
CREATE INDEX idx_submissions_email ON submissions (contributor_email);
CREATE INDEX idx_submissions_ip ON submissions (submission_ip);
CREATE INDEX idx_submissions_status ON submissions (status);
CREATE INDEX idx_submissions_date ON submissions (submission_date);
CREATE INDEX idx_submissions_type ON submissions (submission_type);
CREATE INDEX idx_submissions_flood_event ON submissions (flood_event_id);

-- 3. Submission rate limits table: Prevents spam submissions
-- Tracks submission frequency by IP or email to enforce rate limiting
CREATE TABLE submission_rate_limits (
    id BIGSERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    identifier_type VARCHAR(10) NOT NULL CHECK (identifier_type IN ('ip', 'email')),
    submission_count INTEGER DEFAULT 1,
    first_submission TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_submission TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    blocked_until TIMESTAMP WITH TIME ZONE,
    UNIQUE (identifier, identifier_type)
);

-- Performance indexes for submission_rate_limits table
CREATE INDEX idx_rate_limits_blocked ON submission_rate_limits (blocked_until);
CREATE INDEX idx_rate_limits_identifier ON submission_rate_limits (identifier, identifier_type);