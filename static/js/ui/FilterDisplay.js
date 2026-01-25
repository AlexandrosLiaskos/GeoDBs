/**
 * FilterDisplay - Active filter badges and visual feedback
 *
 * Manages the display of active filter badges, SQL filter indicators,
 * and mobile filter indicators. Separates UI concerns from FilterManager logic.
 */

import { escapeHtml } from '../utils/helpers.js';

class FilterDisplay {
    constructor(eventBus, stateManager) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;

        this.elements = {
            activeFiltersSummary: null,
            activeFiltersList: null,
            mobileToggle: null
        };

        this.filterLabels = {
            year: 'Year',
            location: 'Location',
            deathsToll: 'Death Toll',
            eventName: 'Event Name'
        };

        this.queryBuilderFields = [
            { value: 'year', label: 'Year', type: 'number' },
            { value: 'location_name', label: 'Location', type: 'text' },
            { value: 'deaths_toll_int', label: 'Death Toll', type: 'number' },
            { value: 'cause_of_flood', label: 'Cause of Flood', type: 'text' },
            { value: 'flood_event_name', label: 'Event Name', type: 'text' }
        ];

        this.queryBuilderOperators = {
            number: [
                { value: 'eq', label: '=' },
                { value: 'neq', label: '≠' },
                { value: 'gt', label: '>' },
                { value: 'gte', label: '≥' },
                { value: 'lt', label: '<' },
                { value: 'lte', label: '≤' },
                { value: 'is_null', label: 'Is Empty' },
                { value: 'is_not_null', label: 'Is Not Empty' }
            ],
            text: [
                { value: 'eq', label: 'Equals' },
                { value: 'neq', label: 'Not Equals' },
                { value: 'is_null', label: 'Is Empty' },
                { value: 'is_not_null', label: 'Is Not Empty' }
            ]
        };
    }

    init() {
        this.cacheElements();
        this.initEventListeners();

        if (window.DEBUG_MODE) {
            console.log('✅ FilterDisplay: Initialized');
        }
    }

    cacheElements() {
        this.elements = {
            activeFiltersSummary: document.getElementById('active-filters-summary'),
            activeFiltersList: document.getElementById('active-filters-list'),
            mobileToggle: document.getElementById('mobile-filters-toggle')
        };
    }

    initEventListeners() {
        this.eventBus.on('filters:apply', ({ filters }) => {
            this.updateDisplay(filters);
        });

        this.eventBus.on('sqlFilter:applied', ({ conditions }) => {
            const filters = {};
            this.updateDisplay(filters);
        });

        this.eventBus.on('sqlFilter:cleared', () => {
            this.updateDisplay({});
        });
    }

    updateDisplay(filters) {
        this.updateActiveFiltersBadges(filters);
        this.updateMobileIndicator(filters);
    }

    updateActiveFiltersBadges(filters) {
        const { activeFiltersSummary, activeFiltersList } = this.elements;
        if (!activeFiltersSummary || !activeFiltersList) return;

        activeFiltersList.innerHTML = '';

        const activeSqlFilter = this.stateManager.get('activeSqlFilter');
        let activeCount = Object.keys(filters).length;

        if (activeSqlFilter && this.getValidConditions(activeSqlFilter).length > 0) {
            activeCount++;
            this.addSqlFilterBadges(activeFiltersList, activeSqlFilter);
        }

        if (activeCount === 0) {
            activeFiltersSummary.classList.add('hidden');
            return;
        }

        activeFiltersSummary.classList.remove('hidden');

        Object.entries(filters).forEach(([filterKey, filterValue]) => {
            if (filterValue !== null && filterValue !== '') {
                const filterLabel = this.filterLabels[filterKey] || filterKey;
                const badge = this.createFilterBadge(filterLabel, filterValue, filterKey);
                activeFiltersList.appendChild(badge);
            }
        });
    }

    createFilterBadge(label, value, filterKey) {
        const badge = document.createElement('div');
        badge.className = 'filter-badge';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'filter-badge-label';
        labelSpan.textContent = `${label}:`;

        const valueSpan = document.createElement('span');
        valueSpan.className = 'filter-badge-value';
        valueSpan.textContent = escapeHtml(String(value));

        const removeBtn = document.createElement('button');
        removeBtn.className = 'filter-badge-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = `Remove ${label} filter`;
        removeBtn.setAttribute('aria-label', `Remove ${label} filter`);
        removeBtn.addEventListener('click', () => {
            this.eventBus.emit('filter:removeIndividual', { filterKey });
        });

        badge.appendChild(labelSpan);
        badge.appendChild(valueSpan);
        badge.appendChild(removeBtn);

        return badge;
    }

    addSqlFilterBadges(container, sqlFilter) {
        const validConditions = this.getValidConditions(sqlFilter);

        validConditions.forEach((condition) => {
            const badge = document.createElement('div');
            badge.className = 'filter-badge filter-badge-sql';

            const fieldDef = this.queryBuilderFields.find(f => f.value === condition.field);
            const fieldLabel = fieldDef?.label || condition.field;

            const operators = this.queryBuilderOperators[fieldDef?.type || 'text'];
            const opDef = operators?.find(o => o.value === condition.operator);
            const opLabel = opDef?.label || condition.operator;

            const labelSpan = document.createElement('span');
            labelSpan.className = 'filter-badge-label';
            labelSpan.textContent = fieldLabel;

            const valueSpan = document.createElement('span');
            valueSpan.className = 'filter-badge-value';

            if (condition.operator === 'is_null') {
                valueSpan.textContent = 'Is Empty';
            } else if (condition.operator === 'is_not_null') {
                valueSpan.textContent = 'Is Not Empty';
            } else {
                valueSpan.textContent = `${opLabel} ${condition.value}`;
            }

            const removeBtn = document.createElement('button');
            removeBtn.className = 'filter-badge-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'Clear all query filters';
            removeBtn.addEventListener('click', () => {
                this.eventBus.emit('sqlFilter:clear');
            });

            badge.appendChild(labelSpan);
            badge.appendChild(valueSpan);
            badge.appendChild(removeBtn);

            container.appendChild(badge);
        });
    }

    getValidConditions(conditions) {
        const valid = [];
        conditions.forEach(item => {
            if (item.isGroup && item.conditions) {
                valid.push(...this.getValidConditions(item.conditions));
            } else if (['is_null', 'is_not_null'].includes(item.operator) ||
                       (item.value !== undefined && item.value !== '')) {
                valid.push(item);
            }
        });
        return valid;
    }

    updateMobileIndicator(filters) {
        const { mobileToggle } = this.elements;
        if (!mobileToggle) return;

        const activeCount = Object.keys(filters).filter(k =>
            filters[k] !== null && filters[k] !== ''
        ).length;

        const activeSqlFilter = this.stateManager.get('activeSqlFilter');
        const hasSqlFilter = activeSqlFilter && this.getValidConditions(activeSqlFilter).length > 0;
        const totalCount = activeCount + (hasSqlFilter ? 1 : 0);

        if (totalCount > 0) {
            if (window.innerWidth <= 480) {
                mobileToggle.textContent = `Filters (${totalCount})`;
            } else {
                const filterNames = [];
                if (filters.year) filterNames.push('Year');
                if (filters.location) filterNames.push('Location');
                if (filters.deathsToll) filterNames.push('Deaths');
                if (filters.eventName) filterNames.push('Event');
                if (hasSqlFilter) filterNames.push('Query');

                mobileToggle.textContent = `Filters: ${filterNames.join(', ')}`;
            }
            // Keep mobile styling consistent with desktop (no accent-blue outline)
            mobileToggle.style.borderColor = '';
        } else {
            mobileToggle.textContent = 'Filters';
            mobileToggle.style.borderColor = '';
        }
    }

    clearDisplay() {
        const { activeFiltersSummary, activeFiltersList } = this.elements;
        if (activeFiltersList) {
            activeFiltersList.innerHTML = '';
        }
        if (activeFiltersSummary) {
            activeFiltersSummary.classList.add('hidden');
        }
        this.updateMobileIndicator({});
    }
}

export default FilterDisplay;
