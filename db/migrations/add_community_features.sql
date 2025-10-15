-- Migration: Add Community Features
-- Date: 2025-09-26
-- Description: Adds community contribution system tables and fields

-- 1. Update floods table with maintainer and verification fields
ALTER TABLE floods 
ADD COLUMN maintainer VARCHAR(100) DEFAULT 'Niki Evelpidou Team',
ADD COLUMN verification_status ENUM('verified', 'unverified', 'disputed') DEFAULT 'unverified',
ADD COLUMN last_reviewed DATE,
ADD COLUMN review_notes TEXT,
ADD INDEX idx_verification_status (verification_status);

-- 2. Create submissions table for community contributions
CREATE TABLE IF NOT EXISTS submissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    submission_type ENUM('correction', 'addition', 'verification') NOT NULL,
    flood_event_id INT,
    status ENUM('pending', 'approved', 'rejected', 'needs_info') DEFAULT 'pending',
    
    -- Submission details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    suggested_changes JSON,
    evidence_urls TEXT,
    
    -- Contributor information
    contributor_name VARCHAR(100),
    contributor_email VARCHAR(255) NOT NULL,
    contributor_organization VARCHAR(255),
    
    -- Security and tracking
    submission_ip VARCHAR(45),
    submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Moderation fields
    reviewed_by VARCHAR(100),
    review_date TIMESTAMP NULL,
    review_notes TEXT,
    
    -- Indexes for performance
    INDEX idx_email (contributor_email),
    INDEX idx_ip (submission_ip),
    INDEX idx_status (status),
    INDEX idx_submission_date (submission_date),
    INDEX idx_type (submission_type),
    
    -- Foreign key
    FOREIGN KEY (flood_event_id) REFERENCES floods(id) ON DELETE CASCADE
);

-- 3. Create rate limiting table
CREATE TABLE IF NOT EXISTS submission_rate_limits (
    id INT PRIMARY KEY AUTO_INCREMENT,
    identifier VARCHAR(255) NOT NULL,
    identifier_type ENUM('ip', 'email') NOT NULL,
    submission_count INT DEFAULT 1,
    first_submission TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_submission TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP NULL,
    UNIQUE KEY unique_identifier (identifier, identifier_type),
    INDEX idx_blocked (blocked_until)
);

-- 4. Create trusted contributors table (for future use)
CREATE TABLE IF NOT EXISTS trusted_contributors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    organization VARCHAR(255),
    verified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_by VARCHAR(100),
    total_approved INT DEFAULT 0,
    total_rejected INT DEFAULT 0,
    trust_score DECIMAL(3,2) DEFAULT 0.00,
    INDEX idx_trust_score (trust_score)
);

-- 5. Create moderation log table for audit trail
CREATE TABLE IF NOT EXISTS moderation_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    submission_id INT,
    action ENUM('approve', 'reject', 'request_info', 'edit') NOT NULL,
    moderator VARCHAR(100) NOT NULL,
    action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    INDEX idx_action_date (action_date)
);

-- 6. Update all existing flood records with maintainer info
UPDATE floods 
SET maintainer = 'Niki Evelpidou Team', 
    verification_status = 'verified',
    last_reviewed = CURDATE()
WHERE maintainer IS NULL OR maintainer = '';  -- Update all existing records

-- 7. Create view for submission statistics
CREATE OR REPLACE VIEW submission_stats AS
SELECT 
    DATE(submission_date) as date,
    submission_type,
    status,
    COUNT(*) as count
FROM submissions
GROUP BY DATE(submission_date), submission_type, status;

-- 8. Create view for contributor statistics
CREATE OR REPLACE VIEW contributor_stats AS
SELECT 
    contributor_email,
    contributor_name,
    contributor_organization,
    COUNT(*) as total_submissions,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
    MAX(submission_date) as last_submission
FROM submissions
GROUP BY contributor_email, contributor_name, contributor_organization;