-- Change year column from TEXT to INTEGER for proper numeric sorting
-- This migration fixes the sorting issue where years were being sorted lexicographically
-- instead of numerically (e.g., "1995" appearing after "2022")

-- First, clean any invalid year data (non-numeric values)
UPDATE floods
SET year = NULL
WHERE year IS NOT NULL
  AND year != ''
  AND year !~ '^[0-9]+$';

-- Trim any whitespace from year values
UPDATE floods
SET year = TRIM(year)
WHERE year IS NOT NULL
  AND year != '';

-- Convert the year column from TEXT to INTEGER
ALTER TABLE floods
ALTER COLUMN year TYPE INTEGER
USING CASE
  WHEN year IS NULL OR year = '' THEN NULL
  ELSE year::INTEGER
END;

-- Verify the column type change
-- This query should show data_type = 'integer'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'floods' AND column_name = 'year';