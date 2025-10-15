// Simple dropdown limiting solution
(function() {
    'use strict';
    
    // Function to limit dropdown heights
    function limitDropdowns() {
        const selects = document.querySelectorAll('select');
        
        selects.forEach(select => {
            // Skip if already processed
            if (select.dataset.limited === 'true') return;
            
            // Only modify selects with more than 6 options OR if they might get more options later
            if (select.options.length > 6 || select.id.includes('filter')) {
                // Add size attribute to show limited items
                select.setAttribute('size', '6');
                select.style.overflow = 'auto';
                select.dataset.limited = 'true';
                
                // On focus, ensure it's properly styled
                select.addEventListener('focus', function() {
                    if (!this.hasAttribute('size')) {
                        this.setAttribute('size', '6');
                    }
                });
            }
        });
    }
    
    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', limitDropdowns);
    } else {
        limitDropdowns();
    }
    
    // Run again after delays to catch dynamically loaded content
    setTimeout(limitDropdowns, 500);
    setTimeout(limitDropdowns, 1000);
    setTimeout(limitDropdowns, 2000);
    
    // Also watch for any AJAX loads that might add options
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).then(response => {
            // After any fetch completes, check dropdowns again
            setTimeout(limitDropdowns, 100);
            return response;
        });
    };
    
    // Export the function globally so other scripts can call it
    window.limitDropdowns = limitDropdowns;
})();
