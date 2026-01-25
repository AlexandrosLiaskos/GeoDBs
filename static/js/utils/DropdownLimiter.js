/**
 * DropdownLimiter - Limits dropdown height for long option lists
 *
 * Prevents native select dropdowns from becoming too tall by setting
 * a maximum visible size. Watches for DOM changes and reprocesses automatically.
 */

class DropdownLimiter {
    constructor() {
        this.config = {
            defaultSize: 6,
            debounceDelay: 150,
            excludeSelectors: [
                '#year-filter',
                '#location-filter',
                '#deaths-toll-filter',
                '#event-name-filter',
                '.query-condition-row select',
                '.query-group select',
                '.condition-logic select',
                '.condition-field select',
                '.condition-operator select',
                '.condition-value select',
                '[data-prop="field"]',
                '[data-prop="operator"]',
                '[data-prop="value"]',
                '[data-prop="logic"]'
            ]
        };

        this.processedSelects = new WeakSet();
        this.debounceTimer = null;
        this.observer = null;
    }

    init() {
        this.limitDropdowns();
        this.setupMutationObserver();
        this.setupDelayedCheck();
        this.exposeGlobalAPI();

        if (window.DEBUG_MODE) {
            console.log('✅ DropdownLimiter: Initialized');
        }
    }

    limitDropdowns(selectId = null) {
        try {
            let selects;
            if (selectId) {
                const select = document.getElementById(selectId);
                if (!select) return;
                selects = [select];
            } else {
                selects = document.querySelectorAll('select');
            }

            if (selects.length === 0) return;

            selects.forEach(select => {
                this.processSelect(select);
            });

        } catch (error) {
            console.error('DropdownLimiter: Error limiting dropdowns', error);
        }
    }

    processSelect(select) {
        try {
            const shouldExclude = this.config.excludeSelectors.some(selector =>
                select.matches(selector)
            );

            if (shouldExclude) return;

            const customSize = select.dataset.dropdownLimit;
            const sizeLimit = customSize ? parseInt(customSize, 10) : this.config.defaultSize;

            const shouldLimit = select.options.length > sizeLimit;

            if (shouldLimit) {
                const currentSize = parseInt(select.getAttribute('size'), 10);
                if (currentSize === sizeLimit && select.style.overflow === 'auto') {
                    if (!this.processedSelects.has(select)) {
                        this.processedSelects.add(select);
                    }
                    return;
                }

                select.setAttribute('size', sizeLimit.toString());
                select.style.overflow = 'auto';
                select.dataset.limited = 'true';

                if (!select.dataset.focusHandlerAdded) {
                    select.addEventListener('focus', function() {
                        if (!this.hasAttribute('size')) {
                            this.setAttribute('size', sizeLimit.toString());
                        }
                    });
                    select.dataset.focusHandlerAdded = 'true';
                }

                this.processedSelects.add(select);

                if (window.DEBUG_MODE) {
                    console.log(`DropdownLimiter: Limited ${select.id || 'unnamed'} (${select.options.length} options)`);
                }
            }
        } catch (error) {
            console.error('DropdownLimiter: Error processing select', error);
        }
    }

    debouncedLimitDropdowns() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.limitDropdowns();
        }, this.config.debounceDelay);
    }

    refreshDropdown(selectId) {
        const select = document.getElementById(selectId);
        if (select) {
            this.processedSelects.delete(select);
            this.limitDropdowns(selectId);
        }
    }

    setupMutationObserver() {
        this.observer = new MutationObserver((mutations) => {
            let shouldReprocess = false;

            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.target.tagName === 'SELECT') {
                    shouldReprocess = true;
                }
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'SELECT' || node.querySelector?.('select')) {
                            shouldReprocess = true;
                        }
                    }
                });
            });

            if (shouldReprocess) {
                this.debouncedLimitDropdowns();
            }
        });

        if (document.body) {
            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    setupDelayedCheck() {
        setTimeout(() => {
            this.debouncedLimitDropdowns();
        }, 1000);
    }

    exposeGlobalAPI() {
        window.limitDropdowns = () => this.limitDropdowns();
        window.refreshDropdown = (selectId) => this.refreshDropdown(selectId);
        window.dropdownLimiterConfig = this.config;
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        clearTimeout(this.debounceTimer);
    }
}

export default DropdownLimiter;
