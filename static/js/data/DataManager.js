/**
 * DataManager - Centralized data layer for all Supabase operations
 *
 * Handles all database queries, pagination, caching, and error handling.
 * Provides methods for fetching flood data, filter options, and statistics.
 *
 * @example
 * const dataManager = new DataManager(eventBus, cacheManager, stateManager);
 * const data = await dataManager.fetchFloodData({ year: 2020 });
 */

import { escapeHtml } from '../utils/helpers.js';

class DataManager {
    constructor(eventBus, cacheManager, stateManager) {
        this.eventBus = eventBus;
        this.cacheManager = cacheManager;
        this.stateManager = stateManager;

        // Supabase client reference (global)
        this.supabase = null;

        // Configuration
        this.BATCH_SIZE = 1000; // Supabase pagination size
        this.FILTER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        this.DETAILS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

        // Store all options (unfiltered) for comparison
        this.allOptions = null;
    }

    /**
     * Initialize the data manager and validate database connection
     * @returns {Promise<boolean>} True if connection is valid
     */
    async init() {
        // Get Supabase client from global scope
        this.supabase = window.supabaseClient;

        if (!this.supabase) {
            console.error('❌ DataManager: Supabase client not initialized');
            this.eventBus.emit('data:error', {
                error: new Error('Database not configured'),
                context: 'initialization'
            });
            return false;
        }

        // Test connection
        const isConnected = await this.testConnection();

        if (isConnected) {
            if (window.DEBUG_MODE) {
                console.log('✅ DataManager: Initialized successfully');
            }
        }

        return isConnected;
    }

    /**
     * Test database connection
     * @returns {Promise<boolean>} True if connection successful
     */
    async testConnection() {
        if (!this.supabase) {
            return false;
        }

        try {
            const { data: count, error } = await this.supabase.rpc('api_floods_count');

            if (error) {
                console.error('❌ DataManager: Connection test failed', error);
                this.eventBus.emit('data:error', {
                    error,
                    context: 'connection_test'
                });
                return false;
            }

            if (window.DEBUG_MODE) {
                console.log(`✅ DataManager: Connected to database (${count} records)`);
            }

            return true;
        } catch (error) {
            console.error('❌ DataManager: Connection test exception', error);
            this.eventBus.emit('data:error', {
                error,
                context: 'connection_test'
            });
            return false;
        }
    }

    /**
     * Fetch flood data with optional filters
     * @param {Object} filters - Filter object
     * @param {number} [filters.year] - Year filter
     * @param {string} [filters.location] - Location filter
     * @param {number} [filters.deathsToll] - Deaths toll filter
     * @param {string} [filters.eventName] - Event name filter
     * @returns {Promise<Array>} Array of flood records
     */
    async fetchFloodData(filters = {}) {
        if (!this.supabase) {
            throw new Error('Database not initialized');
        }

        try {
            const params = {
                p_year: filters.year ?? null,
                p_location_name: filters.location ?? null,
                p_deaths_toll_int:
                    filters.deathsToll !== null &&
                    filters.deathsToll !== undefined &&
                    filters.deathsToll !== ''
                        ? parseInt(filters.deathsToll, 10)
                        : null,
                p_flood_event_name: filters.eventName ?? null
            };

            const query = this.supabase.rpc('api_floods_markers', params);
            const rows = await this.fetchAllRecords(query);

            if (window.DEBUG_MODE) {
                console.log(`✅ DataManager: Loaded ${rows.length} flood records`, filters);
            }

            // Update state
            this.stateManager.set('currentData', rows);

            // Emit event
            this.eventBus.emit('data:loaded', {
                data: rows,
                filters,
                count: rows.length
            });

            return rows;
        } catch (error) {
            console.error('❌ DataManager: Error fetching flood data', error);
            this.eventBus.emit('data:error', {
                error,
                context: 'fetchFloodData',
                filters
            });
            throw error;
        }
    }

    /**
     * Fetch filter options with cross-filtering support
     * @param {Object} selectedFilters - Currently selected filters
     * @returns {Promise<Object>} Object with filter options
     */
    async fetchFilterOptions(selectedFilters = {}) {
        if (!this.supabase) {
            throw new Error('Database not initialized');
        }

        // First, fetch all options (unfiltered) if not already cached
        if (!this.allOptions) {
            const cached = this.cacheManager.get('allFilterOptions');
            if (cached) {
                this.allOptions = cached;
            } else {
                // Fetch all options without any filters
                const [allYears, allLocations, allDeathsToll, allEventNames, allCauseOfFlood] = await Promise.all([
                    this.fetchYears({}),
                    this.fetchLocations({}),
                    this.fetchDeathsToll({}),
                    this.fetchEventNames({}),
                    this.fetchCauseOfFlood({})
                ]);

                this.allOptions = {
                    years: allYears,
                    locations: allLocations,
                    deathsToll: allDeathsToll,
                    eventNames: allEventNames,
                    causeOfFlood: allCauseOfFlood
                };

                this.cacheManager.set('allFilterOptions', this.allOptions, this.FILTER_CACHE_TTL);
            }
        }

        // Check cache if no filters are selected
        if (Object.keys(selectedFilters).length === 0 ||
            Object.values(selectedFilters).every(v => v === null || v === '')) {
            const cached = this.cacheManager.get('filterOptions');
            if (cached) {
                if (window.DEBUG_MODE) {
                    console.log('✅ DataManager: Using cached filter options');
                }
                // Return both filtered and all options
                this.eventBus.emit('filterOptions:loaded', {
                    options: cached,
                    allOptions: this.allOptions,
                    selectedFilters
                });
                return cached;
            }
        }

        try {
            if (window.DEBUG_MODE) {
                console.log('📊 DataManager: Fetching filter options', selectedFilters);
            }

            // Fetch all filter options in parallel
            const [years, locations, deathsToll, eventNames, causeOfFlood] = await Promise.all([
                this.fetchYears(selectedFilters),
                this.fetchLocations(selectedFilters),
                this.fetchDeathsToll(selectedFilters),
                this.fetchEventNames(selectedFilters),
                this.fetchCauseOfFlood(selectedFilters)
            ]);

            const options = {
                years,
                locations,
                deathsToll,
                eventNames,
                causeOfFlood
            };

            // Cache if no filters (full dataset)
            if (Object.keys(selectedFilters).length === 0 ||
                Object.values(selectedFilters).every(v => v === null || v === '')) {
                this.cacheManager.set('filterOptions', options, this.FILTER_CACHE_TTL);
            }

            if (window.DEBUG_MODE) {
                console.log('✅ DataManager: Filter options loaded', {
                    years: years.length,
                    locations: locations.length,
                    deathsToll: deathsToll.length,
                    eventNames: eventNames.length,
                    causeOfFlood: causeOfFlood.length
                });
            }

            // Emit event with both filtered and all options
            this.eventBus.emit('filterOptions:loaded', {
                options,
                allOptions: this.allOptions,
                selectedFilters
            });

            return options;
        } catch (error) {
            console.error('❌ DataManager: Error fetching filter options', error);
            this.eventBus.emit('data:error', {
                error,
                context: 'fetchFilterOptions',
                filters: selectedFilters
            });
            throw error;
        }
    }

    /**
     * Fetch years for filter dropdown
     * @private
     */
    async fetchYears(selectedFilters) {
        const params = {
            p_location_name: selectedFilters.location ?? null,
            p_deaths_toll_int:
                selectedFilters.deathsToll !== null &&
                selectedFilters.deathsToll !== undefined &&
                selectedFilters.deathsToll !== ''
                    ? parseInt(selectedFilters.deathsToll, 10)
                    : null,
            p_flood_event_name: selectedFilters.eventName ?? null
        };

        const query = this.supabase.rpc('api_floods_filter_years', params);
        const rows = await this.fetchAllRecords(query);

        return this.getUniqueValues(rows, 'year');
    }

    /**
     * Fetch locations for filter dropdown
     * @private
     */
    async fetchLocations(selectedFilters) {
        const params = {
            p_year: selectedFilters.year ?? null,
            p_deaths_toll_int:
                selectedFilters.deathsToll !== null &&
                selectedFilters.deathsToll !== undefined &&
                selectedFilters.deathsToll !== ''
                    ? parseInt(selectedFilters.deathsToll, 10)
                    : null,
            p_flood_event_name: selectedFilters.eventName ?? null
        };

        const query = this.supabase.rpc('api_floods_filter_locations', params);
        const rows = await this.fetchAllRecords(query);

        return this.getUniqueValues(rows, 'location_name');
    }

    /**
     * Fetch death tolls for filter dropdown
     * @private
     */
    async fetchDeathsToll(selectedFilters) {
        const params = {
            p_year: selectedFilters.year ?? null,
            p_location_name: selectedFilters.location ?? null,
            p_flood_event_name: selectedFilters.eventName ?? null
        };

        const query = this.supabase.rpc('api_floods_filter_deaths_toll', params);
        const rows = await this.fetchAllRecords(query);

        return this.getUniqueValues(rows, 'deaths_toll_int');
    }

    /**
     * Fetch event names for filter dropdown
     * @private
     */
    async fetchEventNames(selectedFilters) {
        const params = {
            p_year: selectedFilters.year ?? null,
            p_location_name: selectedFilters.location ?? null,
            p_deaths_toll_int:
                selectedFilters.deathsToll !== null &&
                selectedFilters.deathsToll !== undefined &&
                selectedFilters.deathsToll !== ''
                    ? parseInt(selectedFilters.deathsToll, 10)
                    : null
        };

        const query = this.supabase.rpc('api_floods_filter_event_names', params);
        const rows = await this.fetchAllRecords(query);

        return this.getUniqueValues(rows, 'flood_event_name');
    }

    /**
     * Fetch causes of flood for filter dropdown
     * @private
     */
    async fetchCauseOfFlood(selectedFilters) {
        const params = {
            p_year: selectedFilters.year ?? null,
            p_location_name: selectedFilters.location ?? null,
            p_deaths_toll_int:
                selectedFilters.deathsToll !== null &&
                selectedFilters.deathsToll !== undefined &&
                selectedFilters.deathsToll !== ''
                    ? parseInt(selectedFilters.deathsToll, 10)
                    : null
        };

        const query = this.supabase.rpc('api_floods_filter_causes', params);
        const rows = await this.fetchAllRecords(query);

        return this.getUniqueValues(rows, 'cause_of_flood');
    }

    /**
     * Fetch details for a single flood event
     * @param {number} id - Flood event ID
     * @returns {Promise<Object>} Flood details
     */
    async fetchFloodDetails(id) {
        if (!this.supabase) {
            throw new Error('Database not initialized');
        }

        // Check cache
        const cacheKey = `floodDetails:${id}`;
        const cached = this.cacheManager.get(cacheKey);
        if (cached) {
            if (window.DEBUG_MODE) {
                console.log(`✅ DataManager: Using cached flood details for #${id}`);
            }
            return cached;
        }

        try {
            const { data, error } = await this.supabase.rpc('api_floods_details', { p_id: id });
            if (error) throw error;

            const row = Array.isArray(data) ? data[0] : data;
            if (!row) {
                throw new Error(`Flood event not found (#${id})`);
            }

            // Add default reference if not present
            if (!row.reference) {
                row.reference = 'https://doi.org/10.3390/cli11110226';
            }

            // Cache the result
            this.cacheManager.set(cacheKey, row, this.DETAILS_CACHE_TTL);

            if (window.DEBUG_MODE) {
                console.log(`✅ DataManager: Loaded flood details for #${id}`);
            }

            return row;
        } catch (error) {
            console.error(`❌ DataManager: Error fetching flood details for #${id}`, error);
            this.eventBus.emit('data:error', {
                error,
                context: 'fetchFloodDetails',
                id
            });
            throw error;
        }
    }

    /**
     * Fetch all records using pagination (overcomes 1000-record limit)
     * @param {Object} query - Supabase query object
     * @returns {Promise<Array>} All records
     */
    async fetchAllRecords(query) {
        const allRecords = [];
        let offset = 0;

        try {
            while (true) {
                const { data, error } = await query.range(offset, offset + this.BATCH_SIZE - 1);

                if (error) {
                    throw error;
                }

                if (!data || data.length === 0) {
                    break;
                }

                allRecords.push(...data);

                if (window.DEBUG_MODE) {
                    console.log(`📊 Pagination: Fetched ${data.length} records (total: ${allRecords.length})`);
                }

                // If we got fewer records than batch size, we've reached the end
                if (data.length < this.BATCH_SIZE) {
                    break;
                }

                offset += this.BATCH_SIZE;
            }

            return allRecords;
        } catch (error) {
            console.error('❌ DataManager: Pagination error', error);
            throw error;
        }
    }

    /**
     * Get unique values from data array and sort them
     * @private
     * @param {Array} data - Array of records
     * @param {string} fieldName - Field to extract unique values from
     * @returns {Array} Sorted unique values
     */
    getUniqueValues(data, fieldName) {
        const uniqueValues = new Set();

        data.forEach(item => {
            const value = item[fieldName];
            if (value !== null && value !== undefined) {
                const processedValue = typeof value === 'string' ? value.trim() : value;
                if (processedValue !== '') {
                    uniqueValues.add(processedValue);
                }
            }
        });

        // Convert to array and sort
        const sortedValues = Array.from(uniqueValues);

        sortedValues.sort((a, b) => {
            // Special handling for deaths_toll_int: numeric ascending
            if (fieldName === 'deaths_toll_int') {
                return (a || 0) - (b || 0);
            }

            // Numbers in descending order (e.g., years: 2023, 2022, 2021...)
            if (typeof a === 'number' && typeof b === 'number') {
                return b - a;
            }

            // Strings alphabetically
            return String(a).localeCompare(String(b));
        });

        return sortedValues;
    }

    /**
     * Invalidate all cached data
     */
    invalidateCache() {
        this.cacheManager.invalidatePattern(/^(filterOptions|allFilterOptions|floodDetails:)/);
        this.allOptions = null;

        if (window.DEBUG_MODE) {
            console.log('🗑️ DataManager: Cache invalidated');
        }
    }

    /**
     * Get all options (unfiltered)
     */
    getAllOptions() {
        return this.allOptions;
    }

    /**
     * Calculate filter options from a given dataset
     * Used when SQL query filter is applied to show available options from filtered data
     * @param {Array} data - Array of flood records
     * @returns {Object} Filter options derived from the data
     */
    calculateOptionsFromData(data) {
        if (!data || data.length === 0) {
            return {
                years: [],
                locations: [],
                deathsToll: [],
                eventNames: [],
                causeOfFlood: []
            };
        }

        const options = {
            years: this.getUniqueValues(data, 'year'),
            locations: this.getUniqueValues(data, 'location_name'),
            deathsToll: this.getUniqueValues(data, 'deaths_toll_int'),
            eventNames: this.getUniqueValues(data, 'flood_event_name'),
            causeOfFlood: this.getUniqueValues(data, 'cause_of_flood')
        };

        if (window.DEBUG_MODE) {
            console.log('📊 DataManager: Calculated options from data', {
                years: options.years.length,
                locations: options.locations.length,
                deathsToll: options.deathsToll.length,
                eventNames: options.eventNames.length,
                causeOfFlood: options.causeOfFlood.length
            });
        }

        return options;
    }

    /**
     * Emit filter options based on SQL-filtered data
     * @param {Array} data - SQL-filtered flood records
     */
    emitFilterOptionsFromData(data) {
        const options = this.calculateOptionsFromData(data);

        // Emit event with both filtered options and all options
        this.eventBus.emit('filterOptions:loaded', {
            options,
            allOptions: this.allOptions,
            selectedFilters: {},
            isSqlFiltered: true
        });

        return options;
    }
}

// Export for ES modules
export default DataManager;
