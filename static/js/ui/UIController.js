/**
 * UIController - General UI interaction and state management
 *
 * Handles tab navigation, button states, loading indicators,
 * and other general UI interactions not specific to modals or mobile.
 *
 * @example
 * const uiController = new UIController(eventBus, stateManager);
 * uiController.init();
 */

class UIController {
    constructor(eventBus, stateManager) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;

        this.isLoading = false;
        this.visiblePointsCount = 0;
    }

    /**
     * Initialize UI controller
     */
    init() {
        this.initTabNavigation();
        this.initButtonHandlers();
        this.initLoadingIndicator();
        this.initEventListeners();

        if (window.DEBUG_MODE) {
            console.log('✅ UIController: Initialized');
        }
    }

    /**
     * Initialize tab navigation
     * @private
     */
    initTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        if (tabButtons.length === 0) {
            return;
        }

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active class to clicked
                button.classList.add('active');
                const tabId = button.dataset.tab + '-tab';
                const tabContent = document.getElementById(tabId);

                if (tabContent) {
                    tabContent.classList.add('active');

                    // Emit event
                    this.eventBus.emit('ui:tabChanged', {
                        tab: button.dataset.tab
                    });
                }
            });
        });

        if (window.DEBUG_MODE) {
            console.log('📑 UIController: Tab navigation initialized');
        }
    }

    /**
     * Initialize general button handlers
     * @private
     */
    initButtonHandlers() {
        // About button
        const aboutBtn = document.getElementById('about-btn');
        if (aboutBtn) {
            aboutBtn.addEventListener('click', () => {
                this.eventBus.emit('ui:aboutClicked');
            });
        }

        // References button
        const referencesBtn = document.getElementById('references-btn');
        if (referencesBtn) {
            referencesBtn.addEventListener('click', () => {
                this.eventBus.emit('ui:referencesClicked');
            });
        }

        // Submit Data button
        const submitDataBtn = document.getElementById('submit-data-btn');
        if (submitDataBtn) {
            submitDataBtn.addEventListener('click', () => {
                this.eventBus.emit('ui:submitDataClicked');
            });
        }

        // Report Bug button
        const reportBugBtn = document.getElementById('report-bug-btn');
        if (reportBugBtn) {
            reportBugBtn.addEventListener('click', () => {
                this.eventBus.emit('ui:reportBugClicked');
            });
        }

        // Submit Suggestion button
        const submitSuggestionBtn = document.getElementById('submit-suggestion-btn');
        if (submitSuggestionBtn) {
            submitSuggestionBtn.addEventListener('click', () => {
                this.eventBus.emit('ui:submitSuggestionClicked');
            });
        }

        // SQL Filter button
        const sqlFilterBtn = document.getElementById('sql-filter-btn');
        if (sqlFilterBtn) {
            sqlFilterBtn.addEventListener('click', () => {
                this.eventBus.emit('ui:sqlFilterClicked');
            });
        }

        // Error banner close button
        const errorBannerClose = document.getElementById('error-banner-close');
        if (errorBannerClose) {
            errorBannerClose.addEventListener('click', () => {
                this.hideErrorBanner();
            });
        }
    }

    /**
     * Initialize loading indicator
     * @private
     */
    initLoadingIndicator() {
        // Subscribe to loading state changes
        this.stateManager.subscribe('isLoading', (isLoading) => {
            this.setLoading(isLoading);
        });
    }

    /**
     * Initialize event listeners from other modules
     * @private
     */
    initEventListeners() {
        // Listen for data updates to update visible points count
        this.eventBus.on('markers:updated', (data) => {
            this.updateVisiblePointsCount(data.count);
        });

        // Listen for filter changes
        this.eventBus.on('filters:applied', () => {
            // Could show a brief notification or update UI
            if (window.DEBUG_MODE) {
                console.log('🔍 UIController: Filters applied');
            }
        });
    }

    /**
     * Set loading state
     * @param {boolean} loading - Loading state
     */
    setLoading(loading) {
        this.isLoading = loading;

        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            if (loading) {
                loadingIndicator.classList.add('active');
            } else {
                loadingIndicator.classList.remove('active');
            }
        }

        // Update state
        this.stateManager.set('isLoading', loading);

        if (window.DEBUG_MODE) {
            console.log(`⏳ UIController: Loading ${loading ? 'started' : 'finished'}`);
        }
    }

    /**
     * Show loading indicator
     */
    showLoading() {
        this.setLoading(true);
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        this.setLoading(false);
    }

    /**
     * Update visible points count display
     * @param {number} count - Number of visible points
     */
    updateVisiblePointsCount(count) {
        this.visiblePointsCount = count;

        const countElement = document.getElementById('visible-points-count');
        if (countElement) {
            countElement.textContent = count.toLocaleString();
        }

        // Emit event
        this.eventBus.emit('ui:visibleCountUpdated', { count });
    }

    /**
     * Show error message using the static error banner
     * @param {string} message - Error message
     * @param {number} duration - Duration in ms (0 for persistent)
     */
    showError(message, duration = 0) {
        const errorBanner = document.getElementById('error-banner');
        const errorMessage = document.getElementById('error-banner-message');

        if (errorBanner && errorMessage) {
            errorMessage.textContent = message;
            errorBanner.classList.remove('hidden');

            if (duration > 0) {
                setTimeout(() => {
                    this.hideErrorBanner();
                }, duration);
            }
        }

        this.eventBus.emit('ui:errorShown', { message });

        if (window.DEBUG_MODE) {
            console.error('❌ UIController: Error shown:', message);
        }
    }

    /**
     * Hide error banner
     */
    hideErrorBanner() {
        const errorBanner = document.getElementById('error-banner');
        if (errorBanner) {
            errorBanner.classList.add('hidden');
        }
    }

    /**
     * Hide error message (alias for hideErrorBanner)
     */
    hideError() {
        this.hideErrorBanner();
    }

    /**
     * Show success message
     * @param {string} message - Success message
     * @param {number} duration - Duration in ms
     */
    showSuccess(message, duration = 3000) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.textContent = message;

        document.body.appendChild(successDiv);

        setTimeout(() => {
            successDiv.remove();
        }, duration);

        // Emit event
        this.eventBus.emit('ui:successShown', { message });

        if (window.DEBUG_MODE) {
            console.log('✅ UIController: Success shown:', message);
        }
    }

    /**
     * Update stats display
     * @param {Object} stats - Statistics object
     */
    updateStatsDisplay(stats) {
        if (!stats) return;

        // Update each stat if element exists
        const statMappings = {
            'total-floods': stats.total_floods,
            'total-deaths': stats.total_deaths,
            'avg-deaths': stats.avg_deaths_per_event,
            'date-range': stats.date_range
        };

        Object.entries(statMappings).forEach(([elementId, value]) => {
            const element = document.getElementById(elementId);
            if (element && value !== undefined && value !== null) {
                element.textContent = value;
            }
        });

        if (window.DEBUG_MODE) {
            console.log('📊 UIController: Stats updated', stats);
        }
    }

    /**
     * Disable a button
     * @param {string} buttonId - Button element ID
     */
    disableButton(buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = true;
            button.classList.add('disabled');
        }
    }

    /**
     * Enable a button
     * @param {string} buttonId - Button element ID
     */
    enableButton(buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = false;
            button.classList.remove('disabled');
        }
    }

    /**
     * Toggle button state
     * @param {string} buttonId - Button element ID
     * @param {boolean} active - Active state
     */
    toggleButton(buttonId, active) {
        const button = document.getElementById(buttonId);
        if (button) {
            if (active) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }
    }

    /**
     * Get current tab
     * @returns {string|null} Current active tab ID
     */
    getCurrentTab() {
        const activeTab = document.querySelector('.tab-button.active');
        return activeTab ? activeTab.dataset.tab : null;
    }

    /**
     * Switch to a specific tab
     * @param {string} tabId - Tab ID to switch to
     */
    switchTab(tabId) {
        const button = document.querySelector(`[data-tab="${tabId}"]`);
        if (button) {
            button.click();
        }
    }
}

// Export for ES modules
export default UIController;
