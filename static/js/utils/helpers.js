/**
 * Utility Functions - Common helpers used throughout the application
 *
 * Pure utility functions with no dependencies.
 * Can be used by any module without creating circular dependencies.
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {*} text - Text to escape (will be converted to string)
 * @returns {string} Escaped HTML string
 */
export function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    // Convert to string first to handle numbers and other types
    return text != null ? String(text).replace(/[&<>"']/g, m => map[m]) : '';
}

/**
 * Debounce a function - delays execution until after wait milliseconds have elapsed
 * since the last time it was invoked
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;

    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle a function - ensures it's not called more than once in a specified time period
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;

    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Format a number with thousands separators
 * @param {number} num - Number to format
 * @param {string} [locale='en-US'] - Locale for formatting
 * @returns {string} Formatted number
 */
export function formatNumber(num, locale = 'en-US') {
    if (num === null || num === undefined || isNaN(num)) {
        return '-';
    }
    return num.toLocaleString(locale);
}

/**
 * Format a date string to localized format
 * @param {string|Date} date - Date to format
 * @param {string} [locale='en-US'] - Locale for formatting
 * @returns {string} Formatted date
 */
export function formatDate(date, locale = 'en-US') {
    if (!date) return '-';

    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (e) {
        return String(date);
    }
}

/**
 * Format a date to YYYY-MM-DD format (for database/API use)
 * @param {Date} date - Date object
 * @returns {string} Date in YYYY-MM-DD format
 */
export function formatDateISO(date) {
    if (!date) return null;

    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Deep clone an object (simple implementation using JSON)
 * Note: This won't work for functions, undefined, symbols, etc.
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        console.error('deepClone: Failed to clone object', e);
        return obj;
    }
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * @param {*} value - Value to check
 * @returns {boolean} True if empty
 */
export function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}

/**
 * Wait for a specified number of milliseconds (async)
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after delay
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique ID
 * @param {string} [prefix=''] - Optional prefix for the ID
 * @returns {string} Unique ID
 */
export function generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Safely parse JSON with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {*} [fallback=null] - Fallback value if parsing fails
 * @returns {*} Parsed object or fallback
 */
export function safeJsonParse(jsonString, fallback = null) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        if (window.DEBUG_MODE) {
            console.warn('safeJsonParse: Failed to parse JSON', e);
        }
        return fallback;
    }
}

/**
 * Get a nested property from an object using dot notation
 * @param {Object} obj - Object to query
 * @param {string} path - Dot-notation path (e.g., 'user.profile.name')
 * @param {*} [defaultValue=undefined] - Default value if path doesn't exist
 * @returns {*} Value at path or default value
 */
export function getNestedProperty(obj, path, defaultValue = undefined) {
    if (!obj || !path) return defaultValue;

    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
        if (value === null || value === undefined) {
            return defaultValue;
        }
        value = value[key];
    }

    return value !== undefined ? value : defaultValue;
}

/**
 * Set a nested property in an object using dot notation
 * @param {Object} obj - Object to modify
 * @param {string} path - Dot-notation path
 * @param {*} value - Value to set
 */
export function setNestedProperty(obj, path, value) {
    if (!obj || !path) return;

    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = obj;

    for (const key of keys) {
        if (!(key in target)) {
            target[key] = {};
        }
        target = target[key];
    }

    target[lastKey] = value;
}

/**
 * Remove duplicates from an array
 * @param {Array} arr - Array with potential duplicates
 * @returns {Array} Array with duplicates removed
 */
export function unique(arr) {
    return [...new Set(arr)];
}

/**
 * Group array items by a key
 * @param {Array} arr - Array to group
 * @param {string|Function} key - Key to group by (property name or function)
 * @returns {Object} Object with grouped items
 */
export function groupBy(arr, key) {
    const keyFn = typeof key === 'function' ? key : item => item[key];

    return arr.reduce((groups, item) => {
        const groupKey = keyFn(item);
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(item);
        return groups;
    }, {});
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate string to specified length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} [suffix='...'] - Suffix to add
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength, suffix = '...') {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
}
