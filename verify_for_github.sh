#!/bin/bash

# Verification Script for GitHub Upload
# This script checks that no sensitive files will be uploaded

echo "🔍 Verifying repository for GitHub upload..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Checking for sensitive files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for .env files
if [ -f ".env" ]; then
    echo -e "${RED}❌ FAIL: .env file exists${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ PASS: No .env file${NC}"
fi

# Check for database files
DB_FILES=$(find . -name "*.db" -type f 2>/dev/null | wc -l)
if [ $DB_FILES -gt 0 ]; then
    echo -e "${RED}❌ FAIL: Found $DB_FILES database file(s)${NC}"
    find . -name "*.db" -type f
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ PASS: No database files${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Checking configuration files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if config.js has placeholders
if [ -f "static/config.js" ]; then
    if grep -q "YOUR_SUPABASE_URL" "static/config.js" && grep -q "YOUR_SUPABASE_ANON_KEY" "static/config.js"; then
        echo -e "${GREEN}✅ PASS: config.js has placeholders${NC}"
    else
        echo -e "${RED}❌ FAIL: config.js contains real credentials!${NC}"
        echo "   Fix: Replace with placeholders YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  WARNING: static/config.js not found (will be gitignored anyway)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check if config.example.js exists
if [ -f "static/config.example.js" ]; then
    echo -e "${GREEN}✅ PASS: config.example.js exists${NC}"
else
    echo -e "${RED}❌ FAIL: config.example.js not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Checking required files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check required files
REQUIRED_FILES=(
    ".github/workflows/deploy-gh-pages.yml"
    ".gitignore"
    "static/.nojekyll"
    "static/index.html"
    "static/submissions.html"
    "static/app.js"
    "static/submissions.js"
    "static/styles.css"
    "README.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file MISSING${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Checking git status..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if git is initialized
if [ -d ".git" ]; then
    echo -e "${GREEN}✅ Git repository initialized${NC}"
    
    # Show what will be committed
    echo ""
    echo "Files that will be tracked by git:"
    git status --short 2>/dev/null || echo "Run: git add . to stage files"
    
else
    echo -e "${YELLOW}⚠️  Git not initialized${NC}"
    echo "   Run: git init"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Checking for large files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Find files larger than 10MB
LARGE_FILES=$(find . -type f -size +10M ! -path "*/\.*" 2>/dev/null)
if [ -z "$LARGE_FILES" ]; then
    echo -e "${GREEN}✅ No large files found${NC}"
else
    echo -e "${YELLOW}⚠️  Large files detected:${NC}"
    echo "$LARGE_FILES"
    echo "   Consider adding these to .gitignore"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Ready to upload to GitHub! 🚀"
    echo ""
    echo "Next steps:"
    echo "1. git add ."
    echo "2. git commit -m \"Initial commit: Supabase-based frontend\""
    echo "3. git push origin main"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
    echo "Review warnings above, but you can proceed with caution."
else
    echo -e "${RED}❌ $ERRORS error(s) found${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
    fi
    echo ""
    echo "Please fix the errors above before uploading to GitHub."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"