/**
 * GlobalSearch - Sidebar Search tab
 *
 * Provides a global search input that searches across Location + Event Name
 * options (similar matching behavior to the filter modal search).
 *
 * Selecting a result applies the corresponding filter.
 */

import { debounce, escapeHtml } from '../utils/helpers.js';

class GlobalSearch {
    constructor(eventBus, stateManager, filterManager) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;
        this.filterManager = filterManager;

        this.elements = {
            input: null,
            results: null,
            selected: null
        };

        this.options = {
            locations: [],
            eventNames: []
        };

        // Track what was last applied *via the Search UI* so we can clear the
        // input if that selection is later removed from the Filters UI.
        this.lastAppliedValues = {
            location: null,
            eventName: null
        };

        this.maxResultsPerSection = 20;
    }

    init() {
        this.cacheElements();
        this.initEventListeners();

        if (window.DEBUG_MODE) {
            console.log('✅ GlobalSearch: Initialized');
        }
    }

    cacheElements() {
        this.elements = {
            input: document.getElementById('global-search-input'),
            results: document.getElementById('global-search-results'),
            selected: document.getElementById('global-search-selected')
        };
    }

    initEventListeners() {
        // Keep our search corpus up to date with current filter options.
        this.eventBus.on('filterOptions:loaded', ({ options }) => {
            this.options.locations = Array.isArray(options?.locations) ? options.locations : [];
            this.options.eventNames = Array.isArray(options?.eventNames) ? options.eventNames : [];
            this.render();
        });

        // Keep selected badges in sync with current filter state.
        this.eventBus.on('filters:apply', () => {
            this.renderSelected();
            // Also re-render results to avoid showing stale UI when the input
            // is programmatically cleared.
            this.render();
        });

        if (!this.elements.input) return;

        this.elements.input.addEventListener(
            'input',
            debounce(() => this.render(), 150)
        );

        this.elements.input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clear();
            }
        });

        // Initial render of selected state (in case filters are pre-set).
        this.renderSelected();
    }

    clear() {
        if (this.elements.input) this.elements.input.value = '';
        this.render();
    }

    renderSelected() {
        const { input, selected } = this.elements;
        if (!input || !selected) return;
        if (!this.filterManager?.getActiveFilters) return;

        const active = this.filterManager.getActiveFilters();

        // If a value was applied via Search but later cleared elsewhere (e.g.
        // via filter badges), clear the input too so it doesn't look "stuck".
        const activeLocation = active?.location ? String(active.location) : '';
        const activeEventName = active?.eventName ? String(active.eventName) : '';

        const lastLocation = this.lastAppliedValues.location ? String(this.lastAppliedValues.location) : '';
        const lastEventName = this.lastAppliedValues.eventName ? String(this.lastAppliedValues.eventName) : '';

        const inputValue = String(input.value || '').trim();
        if (!activeLocation && lastLocation && inputValue === lastLocation) {
            input.value = '';
            this.lastAppliedValues.location = null;
        }
        if (!activeEventName && lastEventName && inputValue === lastEventName) {
            input.value = '';
            this.lastAppliedValues.eventName = null;
        }

        const selections = [
            { key: 'location', label: 'Location', value: active?.location },
            { key: 'eventName', label: 'Event Name', value: active?.eventName }
        ].filter(s => s.value !== null && s.value !== undefined && String(s.value).trim() !== '');

        if (!selections.length) {
            selected.innerHTML = '';
            selected.classList.add('hidden');
            return;
        }

        selected.classList.remove('hidden');
        selected.innerHTML = selections
            .map(s => {
                const safeLabel = escapeHtml(s.label);
                const safeValue = escapeHtml(String(s.value));
                return `
                    <div class="filter-badge" data-filter="${escapeHtml(s.key)}">
                        <span class="filter-badge-label">${safeLabel}:</span>
                        <span class="filter-badge-value">${safeValue}</span>
                        <button class="filter-badge-remove" type="button" aria-label="Remove ${safeLabel}">&times;</button>
                    </div>
                `;
            })
            .join('');

        selected.querySelectorAll('.filter-badge').forEach((badge) => {
            const filterKey = badge.getAttribute('data-filter');
            const removeBtn = badge.querySelector('.filter-badge-remove');
            if (!filterKey || !removeBtn) return;

            removeBtn.addEventListener('click', async () => {
                await this.filterManager.applyFilterValue(filterKey, '');
                // If the input currently shows the cleared value, clear it too.
                const nextActive = this.filterManager.getActiveFilters();
                const remainingValue = filterKey === 'location' ? nextActive?.location : nextActive?.eventName;
                if (!remainingValue && input.value) {
                    input.value = '';
                }
                this.render();
            });
        });
    }

    matchList(values, term) {
        if (!term) return [];
        const t = term.toLowerCase();
        return values
            .map(v => String(v))
            .filter(v => v.toLowerCase().includes(t))
            .slice(0, this.maxResultsPerSection);
    }

    renderSection(title, filterKey, values) {
        if (!values.length) return '';

        const items = values
            .map(v => {
                const safe = escapeHtml(v);
                return `
                    <button class="search-result" data-filter="${filterKey}" data-value="${safe}" type="button">
                        <span class="search-result-title">${safe}</span>
                    </button>
                `;
            })
            .join('');

        return `
            <div class="search-section">
                <div class="search-section-title">${escapeHtml(title)}</div>
                <div class="search-section-list">
                    ${items}
                </div>
            </div>
        `;
    }

    render() {
        const { input, results } = this.elements;
        if (!input || !results) return;

        const term = (input.value || '').trim();
        if (!term) {
            results.innerHTML = '';
            results.classList.add('hidden');
            return;
        }

        const locations = this.matchList(this.options.locations, term);
        const events = this.matchList(this.options.eventNames, term);

        if (!locations.length && !events.length) {
            results.innerHTML = '<div class="search-empty">No matches</div>';
            results.classList.remove('hidden');
            return;
        }

        results.innerHTML = [
            this.renderSection('Locations', 'location', locations),
            this.renderSection('Event Names', 'eventName', events)
        ].join('');
        results.classList.remove('hidden');

        // Wire click handlers (event delegation)
        results.querySelectorAll('.search-result').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const filterKey = btn.dataset.filter;
                const value = btn.dataset.value;
                if (!filterKey || value === undefined) return;

                await this.filterManager.applyFilterValue(filterKey, value);

                // Autocomplete the text to the selected value.
                input.value = value;

                // Remember that this value was applied via Search.
                if (filterKey === 'location' || filterKey === 'eventName') {
                    this.lastAppliedValues[filterKey] = value;
                }

                // Update selected badges UI.
                this.renderSelected();

                // Keep the query in the box (so users see what they searched)
                // but collapse the results to reduce clutter.
                results.classList.add('hidden');
            });
        });
    }
}

export default GlobalSearch;
