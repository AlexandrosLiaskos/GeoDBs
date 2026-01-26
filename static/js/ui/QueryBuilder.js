/**
 * QueryBuilder - SQL-like filter query builder UI
 *
 * Provides a visual query builder for creating complex filter conditions.
 * Generates Supabase-compatible queries from user-defined conditions.
 */

import { escapeHtml } from '../utils/helpers.js';

class QueryBuilder {
    constructor(eventBus, stateManager, dataManager) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;
        this.dataManager = dataManager;

        this.conditions = [];
        this.conditionId = 0;
        this.filterOptions = {};

        this.fields = [
            { value: 'year', label: 'Year', type: 'number' },
            { value: 'location_name', label: 'Location', type: 'text' },
            { value: 'deaths_toll_int', label: 'Death Toll', type: 'number' },
            { value: 'cause_of_flood', label: 'Cause of Flood', type: 'text' },
            { value: 'flood_event_name', label: 'Event Name', type: 'text' }
        ];

        this.operators = {
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

        this.elements = {};
    }

    init() {
        this.cacheElements();
        this.initEventListeners();
        this.addCondition();

        if (window.DEBUG_MODE) {
            console.log('✅ QueryBuilder: Initialized');
        }
    }

    cacheElements() {
        this.elements = {
            container: document.getElementById('query-conditions'),
            previewText: document.getElementById('query-preview-text'),
            addConditionBtn: document.getElementById('add-condition'),
            addGroupBtn: document.getElementById('add-group'),
            applyBtn: document.getElementById('apply-sql-filter'),
            clearBtn: document.getElementById('clear-sql-filter'),
            errorDiv: document.getElementById('sql-filter-error'),
            activeDiv: document.getElementById('sql-filter-active'),
            activeQuery: document.getElementById('sql-active-query'),
            modal: document.getElementById('sql-filter-modal')
        };
    }

    initEventListeners() {
        if (this.elements.addConditionBtn) {
            this.elements.addConditionBtn.addEventListener('click', () => this.addCondition());
        }

        if (this.elements.addGroupBtn) {
            this.elements.addGroupBtn.addEventListener('click', () => this.addGroup());
        }

        if (this.elements.applyBtn) {
            this.elements.applyBtn.addEventListener('click', () => this.applyFilter());
        }

        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => this.clearFilter());
        }

        this.eventBus.on('filterOptions:loaded', ({ options }) => {
            this.filterOptions = options;
            this.renderConditions();
        });

        this.eventBus.on('sqlFilter:clear', () => {
            this.clearFilter(true);
        });

        this.eventBus.on('ui:sqlFilterClicked', () => {
            this.renderConditions();
        });
    }

    setFilterOptions(options) {
        this.filterOptions = options;
    }

    addCondition(parentId = null) {
        const id = ++this.conditionId;
        const condition = {
            id,
            parentId,
            logic: 'AND',
            field: 'year',
            operator: 'eq',
            value: ''
        };
        this.conditions.push(condition);
        this.renderConditions();
        this.updatePreview();
        return id;
    }

    addGroup() {
        const groupId = ++this.conditionId;
        const group = {
            id: groupId,
            isGroup: true,
            logic: 'AND',
            conditions: []
        };
        this.conditions.push(group);

        const conditionId = ++this.conditionId;
        group.conditions.push({
            id: conditionId,
            logic: 'AND',
            field: 'year',
            operator: 'eq',
            value: ''
        });

        this.renderConditions();
        this.updatePreview();
    }

    removeCondition(id) {
        this.conditions = this.conditions.filter(c => c.id !== id);

        this.conditions.forEach(item => {
            if (item.isGroup && item.conditions) {
                item.conditions = item.conditions.filter(c => c.id !== id);
            }
        });

        this.conditions = this.conditions.filter(item =>
            !item.isGroup || (item.conditions && item.conditions.length > 0)
        );

        this.renderConditions();
        this.updatePreview();
    }

    addConditionToGroup(groupId) {
        const group = this.conditions.find(c => c.id === groupId && c.isGroup);
        if (group) {
            const conditionId = ++this.conditionId;
            group.conditions.push({
                id: conditionId,
                logic: 'AND',
                field: 'year',
                operator: 'eq',
                value: ''
            });
            this.renderConditions();
            this.updatePreview();
        }
    }

    updateCondition(id, property, value) {
        let condition = this.conditions.find(c => c.id === id);

        if (!condition) {
            for (const item of this.conditions) {
                if (item.isGroup && item.conditions) {
                    condition = item.conditions.find(c => c.id === id);
                    if (condition) break;
                }
            }
        }

        if (condition) {
            condition[property] = value;

            if (property === 'field') {
                const fieldDef = this.fields.find(f => f.value === value);
                const operators = this.operators[fieldDef?.type || 'text'];
                condition.operator = operators[0].value;
                this.renderConditions();
            }

            this.updatePreview();
        }
    }

    renderConditions() {
        const { container } = this.elements;
        if (!container) return;

        container.innerHTML = '';

        this.conditions.forEach((item, index) => {
            if (item.isGroup) {
                container.appendChild(this.renderGroup(item, index));
            } else {
                container.appendChild(this.renderConditionRow(item, index));
            }
        });
    }

    getFieldValues(fieldName) {
        if (!this.filterOptions) return [];

        const fieldMap = {
            'year': 'years',
            'location_name': 'locations',
            'deaths_toll_int': 'deathsToll',
            'flood_event_name': 'eventNames',
            'cause_of_flood': 'causeOfFlood'
        };

        const optionKey = fieldMap[fieldName];
        if (optionKey && this.filterOptions[optionKey]) {
            return this.filterOptions[optionKey];
        }

        return [];
    }

    renderConditionRow(condition, index, isInGroup = false) {
        const row = document.createElement('div');
        row.className = 'query-condition-row' + (isInGroup ? ' grouped' : '');
        row.dataset.id = condition.id;

        const fieldDef = this.fields.find(f => f.value === condition.field);
        const operators = this.operators[fieldDef?.type || 'text'];
        const needsValue = !['is_null', 'is_not_null'].includes(condition.operator);
        const fieldValues = this.getFieldValues(condition.field);

        const valueOptions = fieldValues.map(v =>
            `<option value="${escapeHtml(String(v))}" ${String(condition.value) === String(v) ? 'selected' : ''}>${escapeHtml(String(v))}</option>`
        ).join('');

        row.innerHTML = `
            ${index > 0 ? `
            <div class="condition-logic">
                <select data-id="${condition.id}" data-prop="logic">
                    <option value="AND" ${condition.logic === 'AND' ? 'selected' : ''}>AND</option>
                    <option value="OR" ${condition.logic === 'OR' ? 'selected' : ''}>OR</option>
                </select>
            </div>` : '<div class="condition-logic"><span class="condition-where">WHERE</span></div>'}
            <div class="condition-field">
                <select data-id="${condition.id}" data-prop="field">
                    ${this.fields.map(f =>
                        `<option value="${f.value}" ${condition.field === f.value ? 'selected' : ''}>${f.label}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="condition-operator">
                <select data-id="${condition.id}" data-prop="operator">
                    ${operators.map(op =>
                        `<option value="${op.value}" ${condition.operator === op.value ? 'selected' : ''}>${op.label}</option>`
                    ).join('')}
                </select>
            </div>
            ${needsValue ? `
            <div class="condition-value">
                <select data-id="${condition.id}" data-prop="value">
                    <option value="">-- Select Value --</option>
                    ${valueOptions}
                </select>
            </div>` : '<div class="condition-value"></div>'}
            <button class="condition-remove" data-remove="${condition.id}" title="Remove">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        row.querySelectorAll('select').forEach(el => {
            el.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                const prop = e.target.dataset.prop;
                this.updateCondition(id, prop, e.target.value);
            });
        });

        row.querySelector('.condition-remove')?.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.remove);
            this.removeCondition(id);
        });

        return row;
    }

    renderGroup(group, index) {
        const groupEl = document.createElement('div');
        groupEl.className = 'query-group';
        groupEl.dataset.id = group.id;

        groupEl.innerHTML = `
            <div class="query-group-header">
                ${index > 0 ? `
                <div class="condition-logic">
                    <select data-id="${group.id}" data-prop="logic">
                        <option value="AND" ${group.logic === 'AND' ? 'selected' : ''}>AND</option>
                        <option value="OR" ${group.logic === 'OR' ? 'selected' : ''}>OR</option>
                    </select>
                </div>` : ''}
                <span class="query-group-label">( Group )</span>
                <div class="query-group-actions">
                    <button class="btn-add-condition" data-add-to-group="${group.id}">+ Add</button>
                    <button class="condition-remove" data-remove="${group.id}" title="Remove group">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="query-group-conditions"></div>
        `;

        const conditionsContainer = groupEl.querySelector('.query-group-conditions');
        group.conditions.forEach((cond, i) => {
            conditionsContainer.appendChild(this.renderConditionRow(cond, i, true));
        });

        groupEl.querySelector('[data-add-to-group]')?.addEventListener('click', (e) => {
            const gid = parseInt(e.currentTarget.dataset.addToGroup);
            this.addConditionToGroup(gid);
        });

        groupEl.querySelector('.query-group-header > .condition-logic select')?.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            this.updateCondition(id, 'logic', e.target.value);
        });

        groupEl.querySelector('.query-group-header .condition-remove')?.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.remove);
            this.removeCondition(id);
        });

        return groupEl;
    }

    updatePreview() {
        const { previewText } = this.elements;
        if (!previewText) return;

        const queryStr = this.buildQueryString(this.conditions);

        if (!queryStr) {
            previewText.innerHTML = '<em>No conditions added</em>';
        } else {
            previewText.innerHTML = queryStr;
        }
    }

    buildQueryString(conditions, isNested = false) {
        const parts = [];

        conditions.forEach((item, index) => {
            let part = '';

            if (item.isGroup) {
                const groupStr = this.buildQueryString(item.conditions, true);
                if (groupStr) {
                    part = `<span class="query-logic">(</span>${groupStr}<span class="query-logic">)</span>`;
                }
            } else {
                const fieldDef = this.fields.find(f => f.value === item.field);
                const operators = this.operators[fieldDef?.type || 'text'];
                const opDef = operators.find(o => o.value === item.operator);

                if (item.operator === 'is_null') {
                    part = `<span class="query-field">${fieldDef?.label || item.field}</span> <span class="query-operator">Is Empty</span>`;
                } else if (item.operator === 'is_not_null') {
                    part = `<span class="query-field">${fieldDef?.label || item.field}</span> <span class="query-operator">Is Not Empty</span>`;
                } else if (item.value !== undefined && item.value !== '') {
                    const displayValue = fieldDef?.type === 'number' ? item.value : `"${item.value}"`;
                    part = `<span class="query-field">${fieldDef?.label || item.field}</span> <span class="query-operator">${opDef?.label || item.operator}</span> <span class="query-value">${escapeHtml(displayValue)}</span>`;
                }
            }

            if (part) {
                if (parts.length > 0) {
                    parts.push(`<span class="query-logic"> ${item.logic} </span>${part}`);
                } else {
                    parts.push(part);
                }
            }
        });

        return parts.join('');
    }

    async applyFilter() {
        const { errorDiv, activeDiv, activeQuery, modal } = this.elements;

        errorDiv?.classList.add('hidden');

        const validConditions = this.getValidConditions(this.conditions);
        if (validConditions.length === 0) {
            this.showError('Please add at least one complete condition');
            return;
        }

        try {
            this.eventBus.emit('ui:showLoading');

            // Apply SQL-like conditions on the already-loaded dataset (no direct DB access)
            const baseData = this.stateManager.get('currentData') || [];
            const data = this.filterData(baseData, this.conditions);

            this.stateManager.set('activeSqlFilter', JSON.parse(JSON.stringify(this.conditions)));

            this.eventBus.emit('sqlFilter:applied', {
                data,
                conditions: this.conditions
            });

            if (activeDiv && activeQuery) {
                activeQuery.innerHTML = this.buildQueryString(this.conditions);
                activeDiv.classList.remove('hidden');
            }

            if (modal) {
                modal.classList.remove('active');
                document.body.classList.remove('modal-open');
            }

        } catch (error) {
            console.error('QueryBuilder error:', error);
            this.showError(error.message || 'Query failed');
        } finally {
            this.eventBus.emit('ui:hideLoading');
        }
    }

    async executeQuery() {
        // Legacy hook (used by main.js): filter already-loaded data
        const baseData = this.stateManager.get('currentData') || [];
        return this.filterData(baseData, this.conditions);
    }

    /**
     * Filter an array of records using the query-builder condition tree.
     * This runs fully client-side to avoid direct database access.
     */
    filterData(data, conditions) {
        if (!Array.isArray(data) || data.length === 0) {
            return [];
        }

        const validConditions = this.getValidConditions(conditions);
        if (validConditions.length === 0) {
            return data;
        }

        return data.filter((row) => this.evaluateConditionList(row, conditions));
    }

    evaluateConditionList(row, conditions) {
        let result = null;

        for (const item of conditions) {
            const itemResult = item.isGroup
                ? this.evaluateConditionList(row, item.conditions || [])
                : this.evaluateSingleCondition(row, item);

            if (result === null) {
                result = itemResult;
                continue;
            }

            result = item.logic === 'OR' ? (result || itemResult) : (result && itemResult);
        }

        return result ?? true;
    }

    evaluateSingleCondition(row, cond) {
        const field = cond.field;
        const operator = cond.operator;
        const value = cond.value;
        const fieldValue = row?.[field];

        if (operator === 'is_null') {
            return fieldValue === null || fieldValue === undefined || fieldValue === '';
        }

        if (operator === 'is_not_null') {
            return !(fieldValue === null || fieldValue === undefined || fieldValue === '');
        }

        // For other operators, empty value means "not a real condition"
        if (value === undefined || value === '') {
            return true;
        }

        const isNumberField = typeof fieldValue === 'number' || (typeof fieldValue === 'string' && fieldValue !== '' && !Number.isNaN(Number(fieldValue)));

        const left = isNumberField ? Number(fieldValue) : String(fieldValue ?? '');
        const right = isNumberField ? Number(value) : String(value);

        switch (operator) {
            case 'eq':
                return left === right;
            case 'neq':
                return left !== right;
            case 'gt':
                return left > right;
            case 'gte':
                return left >= right;
            case 'lt':
                return left < right;
            case 'lte':
                return left <= right;
            case 'ilike':
                return String(left).toLowerCase().includes(String(right).toLowerCase());
            case 'not_ilike':
                return !String(left).toLowerCase().includes(String(right).toLowerCase());
            case 'starts':
                return String(left).toLowerCase().startsWith(String(right).toLowerCase());
            case 'ends':
                return String(left).toLowerCase().endsWith(String(right).toLowerCase());
            default:
                return true;
        }
    }

    /**
     * Get active regular filters from the DOM
     */
    getActiveRegularFilters() {
        const yearEl = document.getElementById('year-filter');
        const locationEl = document.getElementById('location-filter');
        const deathsTollEl = document.getElementById('deaths-toll-filter');
        const eventNameEl = document.getElementById('event-name-filter');

        const yearValue = yearEl?.value;
        return {
            year: yearValue ? parseInt(yearValue, 10) : null,
            location: locationEl?.value || null,
            deathsToll: deathsTollEl?.value || null,
            eventName: eventNameEl?.value || null
        };
    }

    // fetchAllRecords removed: queries are now client-side

    getValidConditions(conditions) {
        const valid = [];
        conditions.forEach(item => {
            if (item.isGroup) {
                valid.push(...this.getValidConditions(item.conditions));
            } else if (['is_null', 'is_not_null'].includes(item.operator) ||
                       (item.value !== undefined && item.value !== '')) {
                valid.push(item);
            }
        });
        return valid;
    }

    applyQueryConditions(query, conditions) {
        const validItems = conditions.filter(item => {
            if (item.isGroup) return item.conditions?.length > 0;
            if (['is_null', 'is_not_null'].includes(item.operator)) return true;
            return item.value !== undefined && item.value !== '';
        });

        if (validItems.length === 0) return query;

        const hasOrLogic = validItems.some((item, index) => index > 0 && item.logic === 'OR');

        if (!hasOrLogic) {
            validItems.forEach(item => {
                if (item.isGroup && item.conditions?.length > 0) {
                    item.conditions.forEach(cond => {
                        query = this.applySingleCondition(query, cond);
                    });
                } else if (!item.isGroup) {
                    query = this.applySingleCondition(query, item);
                }
            });
            return query;
        }

        const orGroups = [];
        let currentGroup = [];

        validItems.forEach((item, index) => {
            if (index > 0 && item.logic === 'OR') {
                if (currentGroup.length > 0) {
                    orGroups.push([...currentGroup]);
                }
                currentGroup = [item];
            } else {
                currentGroup.push(item);
            }
        });

        if (currentGroup.length > 0) {
            orGroups.push(currentGroup);
        }

        const orParts = orGroups.map(group => {
            const condStrings = [];

            group.forEach(item => {
                if (item.isGroup && item.conditions?.length > 0) {
                    item.conditions.forEach(cond => {
                        const str = this.buildConditionString(cond);
                        if (str) condStrings.push(str);
                    });
                } else if (!item.isGroup) {
                    const str = this.buildConditionString(item);
                    if (str) condStrings.push(str);
                }
            });

            if (condStrings.length === 0) return null;
            if (condStrings.length === 1) return condStrings[0];

            return `and(${condStrings.join(',')})`;
        }).filter(Boolean);

        if (orParts.length === 0) return query;

        return query.or(orParts.join(','));
    }

    buildConditionString(cond) {
        const { field, operator, value } = cond;

        switch (operator) {
            case 'eq': return `${field}.eq.${value}`;
            case 'neq': return `${field}.neq.${value}`;
            case 'gt': return `${field}.gt.${value}`;
            case 'gte': return `${field}.gte.${value}`;
            case 'lt': return `${field}.lt.${value}`;
            case 'lte': return `${field}.lte.${value}`;
            case 'ilike': return `${field}.ilike.%${value}%`;
            case 'not_ilike': return `${field}.not.ilike.%${value}%`;
            case 'starts': return `${field}.ilike.${value}%`;
            case 'ends': return `${field}.ilike.%${value}`;
            case 'is_null': return `${field}.is.null`;
            case 'is_not_null': return `${field}.not.is.null`;
            default: return null;
        }
    }

    applySingleCondition(query, cond) {
        const { field, operator, value } = cond;

        if (!['is_null', 'is_not_null'].includes(operator) && (value === undefined || value === '')) {
            return query;
        }

        switch (operator) {
            case 'eq': return query.eq(field, value);
            case 'neq': return query.neq(field, value);
            case 'gt': return query.gt(field, value);
            case 'gte': return query.gte(field, value);
            case 'lt': return query.lt(field, value);
            case 'lte': return query.lte(field, value);
            case 'ilike': return query.ilike(field, `%${value}%`);
            case 'not_ilike': return query.not(field, 'ilike', `%${value}%`);
            case 'starts': return query.ilike(field, `${value}%`);
            case 'ends': return query.ilike(field, `%${value}`);
            case 'is_null': return query.is(field, null);
            case 'is_not_null': return query.not(field, 'is', null);
            default: return query;
        }
    }

    clearFilter(reloadData = true) {
        const { errorDiv, activeDiv } = this.elements;

        this.conditions = [];
        this.conditionId = 0;
        this.addCondition();

        errorDiv?.classList.add('hidden');
        activeDiv?.classList.add('hidden');

        this.stateManager.set('activeSqlFilter', null);

        if (reloadData) {
            this.eventBus.emit('sqlFilter:cleared');
        }
    }

    showError(message) {
        const { errorDiv } = this.elements;
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
    }

    getConditions() {
        return this.conditions;
    }
}

export default QueryBuilder;
