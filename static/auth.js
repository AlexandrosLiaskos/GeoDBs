// Authentication Module for GeoMap Application
// Handles Supabase Auth operations, session management, and role-based access control
// This module is framework-agnostic and works with vanilla JavaScript

class AuthManager {
    constructor() {
        this.currentSession = null;
        this.currentUser = null;
        this.callbacks = [];
        this.supabaseClient = null;
    }

    // Initialize authentication - called after Supabase client is ready
    async initializeAuth() {
        try {
            console.log('🔐 Initializing authentication...');
            
            // Get initial session
            const { data: { session }, error } = await this.supabaseClient.auth.getSession();
            if (error) {
                console.error('❌ Error getting initial session:', error);
                this._notifyCallbacks(null);
                return;
            }
            
            this._updateSession(session);
            
            // Set up auth state change listener
            this.supabaseClient.auth.onAuthStateChange((event, session) => {
                console.log('🔄 Auth state changed:', event, session ? 'session present' : 'no session');
                this._updateSession(session);
            });
            
            console.log('✅ Authentication initialized');
        } catch (error) {
            console.error('❌ Failed to initialize authentication:', error);
            this._notifyCallbacks(null);
        }
    }

    // Update internal session and user state
    _updateSession(session) {
        this.currentSession = session;
        this.currentUser = session ? session.user : null;
        this._notifyCallbacks(session);
    }

    // Notify all registered callbacks of auth state change
    _notifyCallbacks(session) {
        this.callbacks.forEach(callback => {
            try {
                callback(session);
            } catch (error) {
                console.error('❌ Error in auth callback:', error);
            }
        });
    }

    // Get current session
    getSession() {
        return this.currentSession;
    }

    // Get current user
    getUser() {
        return this.currentUser;
    }

    // Sign in with email and password
    async signIn(email, password) {
        try {
            console.log('🔐 Attempting sign in for:', email);
            
            const { data, error } = await this.supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) {
                console.error('❌ Sign in error:', error);
                return { success: false, error: this._getUserFriendlyError(error) };
            }
            
            console.log('✅ Sign in successful');
            return { success: true, user: data.user, session: data.session };
        } catch (error) {
            console.error('❌ Sign in exception:', error);
            return { success: false, error: 'An unexpected error occurred during sign in' };
        }
    }

    // Sign out
    async signOut() {
        try {
            console.log('🔐 Signing out...');
            
            const { error } = await this.supabaseClient.auth.signOut();
            if (error) {
                console.error('❌ Sign out error:', error);
                return { success: false, error: this._getUserFriendlyError(error) };
            }
            
            console.log('✅ Sign out successful');
            return { success: true };
        } catch (error) {
            console.error('❌ Sign out exception:', error);
            return { success: false, error: 'An unexpected error occurred during sign out' };
        }
    }

    // Check if current user is admin
    isAdmin() {
        if (!this.currentUser) return false;
        
        // Check user metadata
        if (this.currentUser.user_metadata?.is_admin === true || 
            this.currentUser.user_metadata?.is_admin === 'true') {
            return true;
        }
        
        // Check app metadata
        if (this.currentUser.app_metadata?.role === 'admin') {
            return true;
        }
        
        // Check JWT token claims if available
        if (this.currentSession?.access_token) {
            try {
                const claims = this.decodeToken(this.currentSession.access_token);
                if (claims?.is_admin === true || claims?.is_admin === 'true' || 
                    claims?.role === 'admin') {
                    return true;
                }
            } catch (error) {
                console.warn('⚠️ Could not decode token for admin check:', error);
            }
        }
        
        return false;
    }

    // Require admin access - redirect to login if not admin
    requireAdmin() {
        if (!this.isAdmin()) {
            console.log('🚫 Admin access required, redirecting to login');
            window.location.href = './admin-login.html';
            return false;
        }
        return true;
    }

    // Decode JWT token to extract claims
    decodeToken(token) {
        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
            return decoded;
        } catch (error) {
            console.error('❌ Error decoding token:', error);
            throw error;
        }
    }

    // Register callback for auth state changes
    onAuthChange(callback) {
        this.callbacks.push(callback);
        
        // Return unsubscribe function
        return () => {
            const index = this.callbacks.indexOf(callback);
            if (index > -1) {
                this.callbacks.splice(index, 1);
            }
        };
    }

    // Convert Supabase errors to user-friendly messages
    _getUserFriendlyError(error) {
        switch (error.message) {
            case 'Invalid login credentials':
                return 'Invalid email or password. Please check your credentials and try again.';
            case 'Email not confirmed':
                return 'Please check your email and click the confirmation link before signing in.';
            case 'Too many requests':
                return 'Too many sign-in attempts. Please wait a few minutes before trying again.';
            default:
                return error.message || 'An authentication error occurred. Please try again.';
        }
    }
}

// Auto-initialize when script loads
(function() {
    // Wait for Supabase client to be ready
    window.addEventListener('supabase-ready', (event) => {
        const authManager = new AuthManager();
        authManager.supabaseClient = event.detail.client;
        
        // Initialize auth
        authManager.initializeAuth();
        
        // Expose globally
        window.authManager = authManager;
        
        console.log('🔐 AuthManager initialized and exposed as window.authManager');
    });
})();