/**
 * SelectSearchEnhancer
 * Adds type-to-search functionality to native HTML select elements
 * 
 * Features:
 * - Shows typed characters in a floating overlay
 * - Filters and navigates through options as user types
 * - Highlights matching options without auto-selecting
 * - Non-intrusive overlay UI positioned near the select element
 * - Preserves native select behavior and accessibility
 */

class SelectSearchEnhancer {
    constructor(selector) {
        this.selector = selector;
        this.searchTerm = '';
        this.searchTimeout = null;
        this.activeSelect = null;
        this.overlayElement = null;
        this.enhancedSelects = new Set();
        this.originalSelection = null;
        
        // Configuration
        this.config = {
            searchDelay: 800,      // ms to clear search term after inactivity
            minChars: 1,           // minimum characters to start search
            overlayOffset: 5,      // pixels below/above select element
            hideDelay: 150         // ms delay before hiding overlay on blur
        };
        
        // Bind methods to preserve context
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleGlobalClick = this.handleGlobalClick.bind(this);
        this.handleGlobalEscape = this.handleGlobalEscape.bind(this);
    }
    
    /**
     * Initialize the search enhancement on all matching select elements
     */
    init() {
        if (window.DEBUG_MODE) console.log('🔍 Initializing SelectSearchEnhancer...');
        
        // Create overlay element
        this.overlayElement = this.createOverlayElement();
        
        // Find and enhance all select elements
        const selects = document.querySelectorAll(this.selector);
        if (selects.length === 0) {
            if (window.DEBUG_MODE) console.warn('⚠️ No select elements found for selector:', this.selector);
            return;
        }
        
        selects.forEach(select => this.enhanceSelect(select));
        
        // Set up global event listeners
        document.addEventListener('click', this.handleGlobalClick);
        document.addEventListener('keydown', this.handleGlobalEscape);
        
        if (window.DEBUG_MODE) {
            console.log(`✅ Enhanced ${selects.length} select element(s) with search capability`);
        }
    }
    
    /**
     * Enhance a single select element with search functionality
     */
    enhanceSelect(selectElement) {
        if (this.enhancedSelects.has(selectElement)) {
            return; // Already enhanced
        }
        
        selectElement.addEventListener('keydown', (e) => this.handleKeyDown(e, selectElement));
        selectElement.addEventListener('focus', (e) => this.handleFocus(e, selectElement));
        selectElement.addEventListener('blur', (e) => this.handleBlur(e, selectElement));
        
        this.enhancedSelects.add(selectElement);
        
        if (window.DEBUG_MODE) {
            console.log(`✓ Enhanced select: ${selectElement.id || 'unnamed'}`);
        }
    }
    
    /**
     * Handle keydown events on select elements
     */
    handleKeyDown(event, selectElement) {
        const key = event.key;
        
        // Handle special keys
        if (key === 'Enter') {
            if (this.searchTerm) {
                event.preventDefault();
                this.hideOverlay();
                return;
            }
            return; // Allow default Enter behavior if no search term
        }
        
        if (key === 'Escape') {
            if (this.searchTerm) {
                event.preventDefault();
                this.restoreOriginalSelection(selectElement);
                this.hideOverlay();
                return;
            }
            return; // Allow default Escape behavior if no search term
        }
        
        if (key === 'Backspace') {
            if (this.searchTerm) {
                event.preventDefault();
                this.searchTerm = this.searchTerm.slice(0, -1);
                if (this.searchTerm.length === 0) {
                    this.hideOverlay();
                } else {
                    this.filterAndNavigate(selectElement);
                }
                this.resetSearchTimeout();
                return;
            }
            return; // Allow default if no search term
        }
        
        // Handle arrow keys - allow default behavior but update overlay if searching
        if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
            if (this.searchTerm) {
                // Let the arrow key work, but keep search active
                this.resetSearchTimeout();
            }
            return; // Allow default arrow key behavior
        }
        
        // Handle printable characters
        if (this.isPrintableKey(event)) {
            event.preventDefault();
            
            // Store original selection on first character
            if (this.searchTerm.length === 0) {
                this.originalSelection = selectElement.selectedIndex;
            }
            
            this.searchTerm += key;
            this.showOverlay(selectElement);
            this.filterAndNavigate(selectElement);
            this.resetSearchTimeout();
            
            // Add searching class for visual feedback
            selectElement.classList.add('searching');
        }
    }
    
    /**
     * Handle focus event on select elements
     */
    handleFocus(event, selectElement) {
        this.activeSelect = selectElement;
    }
    
    /**
     * Handle blur event on select elements
     */
    handleBlur(event, selectElement) {
        // Delay hiding to allow for option selection
        setTimeout(() => {
            if (this.activeSelect === selectElement) {
                this.hideOverlay();
                selectElement.classList.remove('searching');
            }
        }, this.config.hideDelay);
    }
    
    /**
     * Handle global click events to hide overlay when clicking outside
     */
    handleGlobalClick(event) {
        if (this.activeSelect && !this.activeSelect.contains(event.target)) {
            this.hideOverlay();
        }
    }
    
    /**
     * Handle global escape key to hide overlay
     */
    handleGlobalEscape(event) {
        if (event.key === 'Escape' && this.overlayElement && this.overlayElement.classList.contains('active')) {
            if (this.activeSelect) {
                this.restoreOriginalSelection(this.activeSelect);
                this.hideOverlay();
            }
        }
    }
    
    /**
     * Filter options and navigate to first match
     */
    filterAndNavigate(selectElement) {
        const matchingOptions = this.getMatchingOptions(selectElement, this.searchTerm);
        
        if (matchingOptions.length > 0) {
            // Move to first matching option without triggering change event
            const firstMatch = matchingOptions[0];
            const firstMatchIndex = Array.from(selectElement.options).indexOf(firstMatch);
            selectElement.selectedIndex = firstMatchIndex;
            
            // Scroll option into view if needed
            this.scrollOptionIntoView(selectElement, firstMatchIndex);
            
            // Update overlay with match count
            this.updateOverlayContent(matchingOptions.length);
        } else {
            // No matches found
            this.updateOverlayContent(0);
        }
    }
    
    /**
     * Show the search overlay near the select element
     */
    showOverlay(selectElement) {
        if (!this.overlayElement) return;
        
        const rect = selectElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // Determine if there's more space below or above
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // Position overlay
        if (spaceBelow >= 60 || spaceBelow >= spaceAbove) {
            // Position below
            this.overlayElement.style.top = `${rect.bottom + this.config.overlayOffset}px`;
        } else {
            // Position above
            this.overlayElement.style.top = `${rect.top - this.overlayElement.offsetHeight - this.config.overlayOffset}px`;
        }
        
        this.overlayElement.style.left = `${rect.left}px`;
        this.overlayElement.style.width = `${rect.width}px`;
        
        this.overlayElement.classList.add('active');
        this.activeSelect = selectElement;
    }
    
    /**
     * Hide the search overlay
     */
    hideOverlay() {
        if (!this.overlayElement) return;
        
        this.overlayElement.classList.remove('active');
        
        // Clear search term after a short delay
        setTimeout(() => {
            this.clearSearchTerm();
        }, 100);
        
        // Remove searching class from active select
        if (this.activeSelect) {
            this.activeSelect.classList.remove('searching');
        }
        
        this.activeSelect = null;
        this.originalSelection = null;
    }
    
    /**
     * Update the overlay content with current search term and match count
     */
    updateOverlayContent(matchCount) {
        if (!this.overlayElement) return;
        
        if (this.searchTerm.length === 0) {
            this.overlayElement.innerHTML = '';
            return;
        }
        
        if (matchCount === 0) {
            this.overlayElement.innerHTML = `
                <span class="search-term">${this.escapeHtml(this.searchTerm)}</span>
                <span class="no-matches">No matches</span>
            `;
        } else {
            const matchText = matchCount === 1 ? 'match' : 'matches';
            this.overlayElement.innerHTML = `
                <span class="search-term">${this.escapeHtml(this.searchTerm)}</span>
                <span class="match-count">(${matchCount} ${matchText})</span>
            `;
        }
    }
    
    /**
     * Clear the search term
     */
    clearSearchTerm() {
        this.searchTerm = '';
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
    }
    
    /**
     * Reset the search timeout
     */
    resetSearchTimeout() {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        this.searchTimeout = setTimeout(() => {
            this.clearSearchTerm();
            this.hideOverlay();
        }, this.config.searchDelay);
    }
    
    /**
     * Restore the original selection before search started
     */
    restoreOriginalSelection(selectElement) {
        if (this.originalSelection !== null && selectElement) {
            selectElement.selectedIndex = this.originalSelection;
            this.originalSelection = null;
        }
    }
    
    /**
     * Create the overlay element
     */
    createOverlayElement() {
        const overlay = document.createElement('div');
        overlay.className = 'select-search-overlay';
        overlay.style.position = 'fixed';
        overlay.style.zIndex = '10000';
        document.body.appendChild(overlay);
        return overlay;
    }
    
    /**
     * Check if a key is printable (letters, numbers, space, etc.)
     */
    isPrintableKey(event) {
        const key = event.key;
        
        // Single printable characters
        if (key.length === 1) {
            // Allow letters, numbers, space, and common symbols
            return /^[a-zA-Z0-9 \-_.,;:!?@#$%&*()\[\]{}/<>+=]$/.test(key);
        }
        
        return false;
    }
    
    /**
     * Get all options that match the search term
     */
    getMatchingOptions(selectElement, searchTerm) {
        const normalizedSearch = searchTerm.toLowerCase();
        const matchingOptions = [];
        
        Array.from(selectElement.options).forEach(option => {
            // Skip the default/empty option (usually first option with empty value)
            if (option.value === '' && option.index === 0) {
                return;
            }
            
            const optionText = option.textContent.toLowerCase();
            if (optionText.includes(normalizedSearch)) {
                matchingOptions.push(option);
            }
        });
        
        return matchingOptions;
    }
    
    /**
     * Scroll an option into view within the select dropdown
     */
    scrollOptionIntoView(selectElement, optionIndex) {
        // Note: Native select elements handle scrolling automatically
        // This method is here for potential future enhancements
        // For now, the browser handles this natively
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Destroy the enhancer and clean up
     */
    destroy() {
        if (window.DEBUG_MODE) console.log('🗑️ Destroying SelectSearchEnhancer...');
        
        // Remove event listeners from all enhanced selects
        this.enhancedSelects.forEach(select => {
            select.removeEventListener('keydown', this.handleKeyDown);
            select.removeEventListener('focus', this.handleFocus);
            select.removeEventListener('blur', this.handleBlur);
            select.classList.remove('searching');
        });
        
        // Remove global event listeners
        document.removeEventListener('click', this.handleGlobalClick);
        document.removeEventListener('keydown', this.handleGlobalEscape);
        
        // Remove overlay element
        if (this.overlayElement && this.overlayElement.parentNode) {
            this.overlayElement.parentNode.removeChild(this.overlayElement);
        }
        
        // Clear references
        this.enhancedSelects.clear();
        this.overlayElement = null;
        this.activeSelect = null;
        this.clearSearchTerm();
        
        if (window.DEBUG_MODE) console.log('✅ SelectSearchEnhancer destroyed');
    }
}

// Export to global scope
window.SelectSearchEnhancer = SelectSearchEnhancer;
