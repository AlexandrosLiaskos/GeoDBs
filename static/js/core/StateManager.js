/**
 * StateManager - Centralized application state management
 *
 * Provides a single source of truth for application state with change notifications.
 * Modules can subscribe to state changes and react accordingly.
 * Prevents state inconsistencies and makes debugging easier.
 *
 * @example
 * // Subscribe to state changes
 * stateManager.subscribe('activeFilters', (filters) => {
 *   console.log('Filters changed:', filters);
 * });
 *
 * // Update state
 * stateManager.set('activeFilters', { year: 2020 });
 *
 * // Get state
 * const filters = stateManager.get('activeFilters');
 */

import EventBus from './EventBus.js';

class StateManager {
    constructor(eventBus) {
        this.eventBus = eventBus;

        // Application state
        this.state = {
            // Data state
            currentData: [],
            filterOptions: {
                years: [],
                locations: [],
                deathsToll: [],
                eventNames: [],
                causeOfFlood: []
            },

            // Filter state
            activeFilters: {
                year: null,
                location: null,
                deathsToll: null,
                eventName: null
            },
            activeSqlFilter: null,

            // UI state
            isLoading: false,
            visiblePoints: 0,
            isMobileSidebarOpen: false,
            activeTab: 'filters',
            activeModal: null,

            // Map state
            mapInstance: null,
            mapBounds: null,

            // Modal state
            selectedFloodId: null
        };

        // Subscribers map: key -> array of callbacks
        this.subscribers = new Map();
    }

    /**
     * Get a state value by key
     * @param {string} key - State key (supports dot notation for nested values)
     * @returns {*} State value
     */
    get(key) {
        if (!key) return this.state;

        // Support dot notation for nested values
        const keys = key.split('.');
        let value = this.state;

        for (const k of keys) {
            if (value === null || value === undefined) {
                return undefined;
            }
            value = value[k];
        }

        return value;
    }

    /**
     * Set a state value by key
     * @param {string} key - State key (supports dot notation for nested values)
     * @param {*} value - New value
     * @param {boolean} silent - If true, don't emit events (default: false)
     */
    set(key, value, silent = false) {
        if (!key) {
            console.error('StateManager.set: Key is required');
            return;
        }

        const oldValue = this.get(key);

        // Don't update if value hasn't changed (shallow comparison)
        if (oldValue === value) {
            return;
        }

        // Support dot notation for nested values
        const keys = key.split('.');
        const lastKey = keys.pop();
        let target = this.state;

        for (const k of keys) {
            if (!(k in target)) {
                target[k] = {};
            }
            target = target[k];
        }

        target[lastKey] = value;

        if (window.DEBUG_MODE) {
            console.log(`🔄 StateManager: "${key}" changed`, {
                oldValue,
                newValue: value
            });
        }

        // Notify subscribers
        if (!silent) {
            this._notifySubscribers(key, value, oldValue);

            // Emit state:changed event
            this.eventBus.emit('state:changed', {
                key,
                oldValue,
                newValue: value
            });
        }
    }

    /**
     * Update state using an updater function
     * Useful for complex updates or when you need access to current state
     * @param {Function} updater - Function that receives current state and modifies it
     */
    update(updater) {
        if (typeof updater !== 'function') {
            console.error('StateManager.update: Updater must be a function');
            return;
        }

        const oldState = JSON.parse(JSON.stringify(this.state));
        updater(this.state);

        if (window.DEBUG_MODE) {
            console.log('🔄 StateManager: Bulk update', {
                oldState,
                newState: this.state
            });
        }

        // Emit general state:changed event
        this.eventBus.emit('state:changed', {
            key: null,
            oldValue: oldState,
            newValue: this.state
        });
    }

    /**
     * Subscribe to changes for a specific state key
     * @param {string} key - State key to watch
     * @param {Function} callback - Function to call when key changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!key || typeof callback !== 'function') {
            console.error('StateManager.subscribe: Invalid arguments', { key, callback });
            return () => {};
        }

        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }

        this.subscribers.get(key).push(callback);

        if (window.DEBUG_MODE) {
            console.log(`📡 StateManager: Subscribed to "${key}"`, callback.name || 'anonymous');
        }

        // Return unsubscribe function
        return () => this.unsubscribe(key, callback);
    }

    /**
     * Unsubscribe from state changes
     * @param {string} key - State key
     * @param {Function} callback - Callback function to remove
     */
    unsubscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            return;
        }

        const callbacks = this.subscribers.get(key);
        const index = callbacks.indexOf(callback);

        if (index !== -1) {
            callbacks.splice(index, 1);

            if (window.DEBUG_MODE) {
                console.log(`📡 StateManager: Unsubscribed from "${key}"`);
            }
        }

        // Clean up empty subscriber arrays
        if (callbacks.length === 0) {
            this.subscribers.delete(key);
        }
    }

    /**
     * Notify all subscribers of a state change
     * @private
     * @param {string} key - State key that changed
     * @param {*} newValue - New value
     * @param {*} oldValue - Previous value
     */
    _notifySubscribers(key, newValue, oldValue) {
        if (!this.subscribers.has(key)) {
            return;
        }

        const callbacks = this.subscribers.get(key);

        callbacks.slice().forEach(callback => {
            try {
                callback(newValue, oldValue);
            } catch (error) {
                console.error(`StateManager: Error in subscriber for "${key}"`, error);
            }
        });
    }

    /**
     * Reset state to initial values
     * @param {boolean} silent - If true, don't emit events
     */
    reset(silent = false) {
        const oldState = { ...this.state };

        this.state = {
            currentData: [],
            filterOptions: {
                years: [],
                locations: [],
                deathsToll: [],
                eventNames: [],
                causeOfFlood: []
            },
            activeFilters: {
                year: null,
                location: null,
                deathsToll: null,
                eventName: null
            },
            activeSqlFilter: null,
            isLoading: false,
            visiblePoints: 0,
            isMobileSidebarOpen: false,
            activeTab: 'filters',
            activeModal: null,
            mapInstance: null,
            mapBounds: null,
            selectedFloodId: null
        };

        if (window.DEBUG_MODE) {
            console.log('🔄 StateManager: State reset');
        }

        if (!silent) {
            this.eventBus.emit('state:reset', { oldState, newState: this.state });
        }
    }

    /**
     * Get the entire state object (read-only copy)
     * @returns {Object} Copy of current state
     */
    getState() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Get subscriber count for a key
     * @param {string} key - State key
     * @returns {number} Number of subscribers
     */
    subscriberCount(key) {
        return this.subscribers.has(key) ? this.subscribers.get(key).length : 0;
    }
}

// Export for ES modules
export default StateManager;
