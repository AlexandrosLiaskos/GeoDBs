// Enhanced dropdown limiting solution with logging and error handling
(function() {
    'use strict';
    
    console.log('🔧 Initializing dropdown limiter...');
    
    // Configuration
    const config = {
        defaultSize: 6,
        debounceDelay: 150,
        excludeSelectors: [], // Selectors to exclude from limiting
    };
    
    // Cache for processed selects to avoid redundant operations
    const processedSelects = new WeakSet();
    
    // Debounce timer
    let debounceTimer = null;
    
    /**
     * Main function to limit dropdown heights
     * @param {string} selectId - Optional specific select ID to refresh
     */
    function limitDropdowns(selectId = null) {
        try {
            console.log('📋 Limiting dropdowns...', selectId ? `(specific: ${selectId})` : '(all)');
            
            let selects;
            if (selectId) {
                // Target specific select
                const select = document.getElementById(selectId);
                if (!select) {
                    console.warn(`⚠️ Select element with ID "${selectId}" not found`);
                    return;
                }
                selects = [select];
            } else {
                // Target all select elements
                selects = document.querySelectorAll('select');
            }
            
            if (selects.length === 0) {
                console.warn('⚠️ No select elements found to limit');
                return;
            }
            
            console.log(`Found ${selects.length} select element(s) to process`);
            
            let limitedCount = 0;
            
            selects.forEach(select => {
                try {
                    // Check if this select should be excluded
                    const shouldExclude = config.excludeSelectors.some(selector => 
                        select.matches(selector)
                    );
                    
                    if (shouldExclude) {
                        console.log(`⏭️ Skipping excluded select: ${select.id || 'unnamed'}`);
                        return;
                    }
                    
                    // Get custom size from data attribute or use default
                    const customSize = select.dataset.dropdownLimit;
                    const sizeLimit = customSize ? parseInt(customSize, 10) : config.defaultSize;
                    
                    // Only modify selects with more than sizeLimit options OR filter dropdowns
                    const shouldLimit = select.options.length > sizeLimit || 
                                       select.id.includes('filter');
                    
                    if (shouldLimit) {
                        // Check if already properly limited
                        const currentSize = parseInt(select.getAttribute('size'), 10);
                        if (currentSize === sizeLimit && select.style.overflow === 'auto') {
                            // Already limited correctly, skip
                            if (!processedSelects.has(select)) {
                                console.log(`✓ Select already limited: ${select.id || 'unnamed'} (${select.options.length} options, size: ${sizeLimit})`);
                                processedSelects.add(select);
                            }
                            return;
                        }
                        
                        // Apply limiting
                        select.setAttribute('size', sizeLimit.toString());
                        select.style.overflow = 'auto';
                        select.dataset.limited = 'true';
                        
                        // Add focus handler if not already added
                        if (!select.dataset.focusHandlerAdded) {
                            select.addEventListener('focus', function() {
                                if (!this.hasAttribute('size')) {
                                    this.setAttribute('size', sizeLimit.toString());
                                }
                            });
                            select.dataset.focusHandlerAdded = 'true';
                        }
                        
                        processedSelects.add(select);
                        limitedCount++;
                        
                        console.log(`✓ Limited dropdown: ${select.id || 'unnamed'} with ${select.options.length} options (size: ${sizeLimit})`);
                    }
                } catch (error) {
                    console.error(`❌ Error processing select ${select.id || 'unnamed'}:`, error);
                }
            });
            
            if (limitedCount > 0) {
                console.log(`✅ Successfully limited ${limitedCount} dropdown(s)`);
            } else {
                console.log('ℹ️ No dropdowns needed limiting');
            }
            
        } catch (error) {
            console.error('❌ Error in limitDropdowns:', error);
        }
    }
    
    /**
     * Debounced version of limitDropdowns for better performance
     */
    function debouncedLimitDropdowns() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            limitDropdowns();
        }, config.debounceDelay);
    }
    
    /**
     * Refresh a specific dropdown after options are updated
     * @param {string} selectId - The ID of the select element to refresh
     */
    function refreshDropdown(selectId) {
        console.log(`🔄 Refreshing dropdown: ${selectId}`);
        const select = document.getElementById(selectId);
        if (select) {
            // Remove from processed cache to force re-processing
            processedSelects.delete(select);
            limitDropdowns(selectId);
        } else {
            console.warn(`⚠️ Cannot refresh: select "${selectId}" not found`);
        }
    }
    
    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 DOM loaded, applying dropdown limits...');
            limitDropdowns();
        });
    } else {
        console.log('📄 DOM already loaded, applying dropdown limits...');
        limitDropdowns();
    }
    
    // Setup MutationObserver to watch for changes to select elements
    const observer = new MutationObserver((mutations) => {
        let shouldReprocess = false;
        
        mutations.forEach(mutation => {
            // Check if options were added/removed from a select
            if (mutation.type === 'childList' && mutation.target.tagName === 'SELECT') {
                shouldReprocess = true;
            }
            // Check if new select elements were added to the DOM
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'SELECT' || node.querySelector('select')) {
                        shouldReprocess = true;
                    }
                }
            });
        });
        
        if (shouldReprocess) {
            console.log('🔄 DOM mutation detected, re-processing dropdowns...');
            debouncedLimitDropdowns();
        }
    });
    
    // Start observing the document for changes
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        console.log('👁️ MutationObserver active, watching for dropdown changes');
    } else {
        // If body isn't ready, wait for it
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            console.log('👁️ MutationObserver active, watching for dropdown changes');
        });
    }
    
    // Run again after delays to catch dynamically loaded content
    setTimeout(() => {
        console.log('⏱️ Running delayed dropdown check (500ms)...');
        limitDropdowns();
    }, 500);
    
    setTimeout(() => {
        console.log('⏱️ Running delayed dropdown check (1000ms)...');
        limitDropdowns();
    }, 1000);
    
    setTimeout(() => {
        console.log('⏱️ Running delayed dropdown check (2000ms)...');
        limitDropdowns();
    }, 2000);
    
    // Monitor fetch calls to re-process after AJAX loads
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).then(response => {
            // After any fetch completes, check dropdowns again (debounced)
            console.log('🌐 Fetch completed, scheduling dropdown check...');
            debouncedLimitDropdowns();
            return response;
        }).catch(error => {
            console.error('❌ Fetch error:', error);
            throw error;
        });
    };
    
    // Export functions globally for use by other scripts
    window.limitDropdowns = limitDropdowns;
    window.refreshDropdown = refreshDropdown;
    
    // Export configuration for external modification if needed
    window.dropdownLimiterConfig = config;
    
    console.log('✅ Dropdown limiter initialized successfully');
    console.log('💡 Usage: Call window.limitDropdowns() to re-process all dropdowns');
    console.log('💡 Usage: Call window.refreshDropdown("select-id") to refresh a specific dropdown');
})();
