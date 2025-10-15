// Supabase Configuration - Example Template
// Copy this file to config.js and replace with your actual credentials
// This file shows the structure and provides helpful comments for configuration

// IMPORTANT: This is an example file. DO NOT commit your actual credentials to version control!

// =============================================================================
// CONFIGURATION FOR LOCAL DEVELOPMENT
// =============================================================================
// 1. Copy this file to config.js:
//    cp static/config.example.js static/config.js
//
// 2. Replace the placeholder values below with your actual Supabase credentials
//    Find these in: Supabase Dashboard → Settings → API
//
// 3. The config.js file is ignored by git, so your credentials stay private
//
// =============================================================================
// CONFIGURATION FOR GITHUB PAGES DEPLOYMENT
// =============================================================================
// GitHub Pages deployment uses repository secrets to inject credentials.
// You don't need to modify config.js for deployment - it's handled automatically.
//
// Set these secrets in: GitHub Repository → Settings → Secrets and variables → Actions
// - SUPABASE_URL: Your Supabase project URL
// - SUPABASE_ANON_KEY: Your Supabase anonymous/public key
//
// See README.md for detailed deployment instructions
// =============================================================================

// Your Supabase project URL
// Example: https://abcdefghijklmnop.supabase.co
const SUPABASE_URL = 'YOUR_SUPABASE_URL';

// Your Supabase anonymous (public) key
// Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY4ODEyMzQ1NiwiZXhwIjoyMDAzNjk5NDU2fQ.example_signature_here
// IMPORTANT: Use only the 'anon' key, NEVER the 'service_role' key
// The anon key is safe for client-side use and is protected by Row Level Security (RLS) policies
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// =============================================================================
// HOW TO GET YOUR CREDENTIALS
// =============================================================================
// 1. Go to your Supabase project dashboard (https://app.supabase.com)
// 2. Select your project
// 3. Click on Settings (gear icon in left sidebar)
// 4. Click on "API" in the settings menu
// 5. You'll see:
//    - Project URL (SUPABASE_URL)
//    - API Keys section with two keys:
//      * anon public - USE THIS ONE (SUPABASE_ANON_KEY)
//      * service_role - DO NOT USE in frontend code
//
// =============================================================================
// SECURITY NOTES
// =============================================================================
// ✅ The anon (public) key is SAFE to use in client-side code
// ✅ Row Level Security (RLS) policies protect your database from unauthorized access
// ✅ The anon key will be visible in the browser - this is expected and secure
// ❌ NEVER use the service_role key in frontend code
// ❌ NEVER commit actual credentials to version control
// ❌ Keep your service_role key secret and use it only in backend code
//
// =============================================================================
// VALIDATION AND INITIALIZATION
// =============================================================================
// The code below is the same as in config.js and handles:
// - Configuration validation
// - Supabase client initialization
// - Error handling and user-friendly messages
// =============================================================================

// Validate configuration
function validateConfig() {
    const isConfigured = SUPABASE_URL && 
                        SUPABASE_ANON_KEY && 
                        SUPABASE_URL !== 'YOUR_SUPABASE_URL' && 
                        SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
    
    if (!isConfigured) {
        console.error('⚠️ Supabase credentials not configured!');
        console.error('For local development: Edit static/config.js and replace placeholder values');
        console.error('For GitHub Pages: Set SUPABASE_URL and SUPABASE_ANON_KEY as repository secrets');
        console.error('See README.md for detailed configuration instructions');
        return false;
    }
    
    return true;
}

// Initialize Supabase client
(function initializeSupabase() {
    // Check if the Supabase library is loaded from CDN
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase library not loaded. Please check the CDN script in index.html.');
        return;
    }
    
    // Validate configuration
    if (!validateConfig()) {
        console.error('❌ Cannot initialize Supabase client without valid credentials');
        return;
    }
    
    try {
        // Destructure createClient from the global supabase object
        const { createClient } = supabase;
        
        // Initialize the Supabase client
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Expose the client globally for use by other scripts (e.g., app.js, submissions.js)
        window.supabaseClient = supabaseClient;
        
        // Log successful initialization
        console.log('✅ Supabase client initialized successfully');
        console.log('📍 Project URL:', SUPABASE_URL);
        
    } catch (error) {
        console.error('❌ Failed to initialize Supabase client:', error);
        console.error('Please verify your credentials are correct');
    }
})();