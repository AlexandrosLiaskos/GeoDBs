/**
 * StatsManager - Statistics calculation and display
 *
 * Handles statistics calculation from both database queries and data arrays.
 * Supports both regular filters and SQL query builder filters.
 * Emits events for StatusBar to display stats.
 *
 * @example
 * const statsManager = new StatsManager(eventBus, dataManager);
 * await statsManager.loadStats({ year: 2020 });
 */

class StatsManager {
    constructor(eventBus, dataManager) {
        this.eventBus = eventBus;
        this.dataManager = dataManager;

        this.supabase = null;
    }

    /**
     * Initialize the stats manager
     */
    init() {
        this.supabase = window.supabaseClient;

        if (window.DEBUG_MODE) {
            console.log('✅ StatsManager: Initialized');
        }
    }

    /**
     * Load statistics from database with filters
     * @param {Object} filters - Filter object
     * @returns {Promise<Object>} Statistics object
     */
    async loadStats(filters = {}) {
        if (!this.supabase) {
            console.error('❌ StatsManager: Database not initialized');
            return null;
        }

        try {
            // Fetch all stats in parallel for better performance
            const [totalCount, minYear, maxYear, casualtiesCount] = await Promise.all([
                this.fetchTotalCount(filters),
                this.fetchMinYear(filters),
                this.fetchMaxYear(filters),
                this.fetchCasualtiesCount(filters)
            ]);

            const stats = {
                total_events: totalCount,
                year_range: { min: minYear, max: maxYear },
                events_with_deaths: casualtiesCount
            };

            // Emit event
            this.eventBus.emit('stats:updated', { stats, filters });

            if (window.DEBUG_MODE) {
                console.log('✅ StatsManager: Stats loaded', stats);
            }

            return stats;
        } catch (error) {
            console.error('❌ StatsManager: Error loading stats', error);
            this.eventBus.emit('stats:error', { error, filters });
            return null;
        }
    }

    /**
     * Calculate statistics from a data array (for SQL filter results)
     * @param {Array} data - Array of flood records
     * @returns {Object} Statistics object
     */
    calculateFromData(data) {
        if (!data || data.length === 0) {
            const emptyStats = {
                total_events: 0,
                year_range: { min: 'N/A', max: 'N/A' },
                events_with_deaths: 0
            };
            this.eventBus.emit('stats:updated', { stats: emptyStats, source: 'data' });
            return emptyStats;
        }

        // Total count
        const total_events = data.length;

        // Year range
        const years = data
            .map(d => d.year)
            .filter(y => y != null);

        const minYear = years.length > 0 ? Math.min(...years) : 'N/A';
        const maxYear = years.length > 0 ? Math.max(...years) : 'N/A';

        // Events with casualties
        const events_with_deaths = data.filter(d => {
            const toll = d.deaths_toll_int;
            return toll !== null && toll !== undefined && toll > 0;
        }).length;

        const stats = {
            total_events,
            year_range: { min: minYear, max: maxYear },
            events_with_deaths
        };

        // Emit event
        this.eventBus.emit('stats:updated', { stats, source: 'data' });

        if (window.DEBUG_MODE) {
            console.log('✅ StatsManager: Stats calculated from data', stats);
        }

        return stats;
    }

    /**
     * Fetch total event count
     * @private
     */
    async fetchTotalCount(filters) {
        let query = this.supabase
            .from('floods')
            .select('*', { count: 'exact', head: true });

        // Apply filters
        if (filters.year) {
            query = query.eq('year', filters.year);
        }
        if (filters.location) {
            query = query.eq('location_name', filters.location);
        }
        if (filters.deathsToll !== null && filters.deathsToll !== undefined) {
            query = query.eq('deaths_toll_int', filters.deathsToll);
        }
        if (filters.eventName) {
            query = query.eq('flood_event_name', filters.eventName);
        }

        const { count, error } = await query;
        if (error) throw error;

        return count || 0;
    }

    /**
     * Fetch minimum year
     * @private
     */
    async fetchMinYear(filters) {
        let query = this.supabase
            .from('floods')
            .select('year')
            .not('year', 'is', null)
            .order('year', { ascending: true })
            .limit(1);

        // Apply filters (exclude year filter for year range)
        if (filters.location) {
            query = query.eq('location_name', filters.location);
        }
        if (filters.deathsToll !== null && filters.deathsToll !== undefined) {
            query = query.eq('deaths_toll_int', filters.deathsToll);
        }
        if (filters.eventName) {
            query = query.eq('flood_event_name', filters.eventName);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data && data.length > 0 ? data[0].year : 'N/A';
    }

    /**
     * Fetch maximum year
     * @private
     */
    async fetchMaxYear(filters) {
        let query = this.supabase
            .from('floods')
            .select('year')
            .not('year', 'is', null)
            .order('year', { ascending: false })
            .limit(1);

        // Apply filters (exclude year filter for year range)
        if (filters.location) {
            query = query.eq('location_name', filters.location);
        }
        if (filters.deathsToll !== null && filters.deathsToll !== undefined) {
            query = query.eq('deaths_toll_int', filters.deathsToll);
        }
        if (filters.eventName) {
            query = query.eq('flood_event_name', filters.eventName);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data && data.length > 0 ? data[0].year : 'N/A';
    }

    /**
     * Fetch count of events with casualties
     * @private
     */
    async fetchCasualtiesCount(filters) {
        let query = this.supabase
            .from('floods')
            .select('*', { count: 'exact', head: true })
            .not('deaths_toll_int', 'is', null)
            .gt('deaths_toll_int', 0);

        // Apply filters (Note: deathsToll filter NOT applied here)
        if (filters.year) {
            query = query.eq('year', filters.year);
        }
        if (filters.location) {
            query = query.eq('location_name', filters.location);
        }
        if (filters.eventName) {
            query = query.eq('flood_event_name', filters.eventName);
        }

        const { count, error } = await query;
        if (error) throw error;

        return count || 0;
    }
}

// Export for ES modules
export default StatsManager;
