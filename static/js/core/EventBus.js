/**
 * EventBus - Centralized event management for loose coupling between modules
 *
 * Provides a publish-subscribe pattern for module communication without tight coupling.
 * Modules can emit events and listen to events without directly referencing each other.
 *
 * @example
 * // Module A emits an event
 * eventBus.emit('data:loaded', { data: [...] });
 *
 * // Module B listens for the event
 * eventBus.on('data:loaded', (payload) => {
 *   console.log('Data loaded:', payload.data);
 * });
 */

class EventBus {
    constructor() {
        // Map of event names to arrays of handlers
        this.events = new Map();

        // Debug mode - set via window.DEBUG_MODE
        this.debug = false;
    }

    /**
     * Register an event listener
     * @param {string} eventName - Name of the event to listen for
     * @param {Function} handler - Callback function to execute when event fires
     * @returns {Function} Unsubscribe function
     */
    on(eventName, handler) {
        if (!eventName || typeof handler !== 'function') {
            console.error('EventBus.on: Invalid arguments', { eventName, handler });
            return () => {};
        }

        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }

        this.events.get(eventName).push(handler);

        if (this.debug || window.DEBUG_MODE) {
            console.log(`📡 EventBus: Registered listener for "${eventName}"`, handler.name || 'anonymous');
        }

        // Return unsubscribe function
        return () => this.off(eventName, handler);
    }

    /**
     * Remove an event listener
     * @param {string} eventName - Name of the event
     * @param {Function} handler - Handler function to remove
     */
    off(eventName, handler) {
        if (!this.events.has(eventName)) {
            return;
        }

        const handlers = this.events.get(eventName);
        const index = handlers.indexOf(handler);

        if (index !== -1) {
            handlers.splice(index, 1);

            if (this.debug || window.DEBUG_MODE) {
                console.log(`📡 EventBus: Removed listener for "${eventName}"`);
            }
        }

        // Clean up empty event arrays
        if (handlers.length === 0) {
            this.events.delete(eventName);
        }
    }

    /**
     * Register a one-time event listener (automatically removed after first trigger)
     * @param {string} eventName - Name of the event to listen for
     * @param {Function} handler - Callback function to execute when event fires
     * @returns {Function} Unsubscribe function
     */
    once(eventName, handler) {
        const onceHandler = (payload) => {
            handler(payload);
            this.off(eventName, onceHandler);
        };

        return this.on(eventName, onceHandler);
    }

    /**
     * Emit an event to all registered listeners
     * @param {string} eventName - Name of the event to emit
     * @param {*} payload - Data to pass to event handlers
     */
    emit(eventName, payload) {
        if (!this.events.has(eventName)) {
            if (this.debug || window.DEBUG_MODE) {
                console.log(`📡 EventBus: No listeners for "${eventName}"`);
            }
            return;
        }

        const handlers = this.events.get(eventName);

        if (this.debug || window.DEBUG_MODE) {
            console.log(`📡 EventBus: Emitting "${eventName}"`, {
                listeners: handlers.length,
                payload
            });
        }

        // Execute all handlers (use slice to avoid issues if handler modifies the array)
        handlers.slice().forEach(handler => {
            try {
                handler(payload);
            } catch (error) {
                console.error(`EventBus: Error in handler for "${eventName}"`, error);
            }
        });
    }

    /**
     * Remove all listeners for a specific event (or all events if no name provided)
     * @param {string} [eventName] - Optional event name to clear. If omitted, clears all events.
     */
    clear(eventName) {
        if (eventName) {
            this.events.delete(eventName);
            if (this.debug || window.DEBUG_MODE) {
                console.log(`📡 EventBus: Cleared all listeners for "${eventName}"`);
            }
        } else {
            this.events.clear();
            if (this.debug || window.DEBUG_MODE) {
                console.log('📡 EventBus: Cleared all event listeners');
            }
        }
    }

    /**
     * Get the number of listeners for an event
     * @param {string} eventName - Name of the event
     * @returns {number} Number of registered listeners
     */
    listenerCount(eventName) {
        return this.events.has(eventName) ? this.events.get(eventName).length : 0;
    }

    /**
     * Get all registered event names
     * @returns {Array<string>} Array of event names
     */
    eventNames() {
        return Array.from(this.events.keys());
    }

    /**
     * Enable debug logging
     */
    enableDebug() {
        this.debug = true;
    }

    /**
     * Disable debug logging
     */
    disableDebug() {
        this.debug = false;
    }
}

// Export for ES modules
export default EventBus;
