/**
 * Greek Floods Web Map Atlas - Frontend Application
 * Handles map visualization, filtering, and user interactions
 */

class FloodMapApp {
    constructor() {
        this.map = null;
        this.floodLayer = null;
        this.markerCluster = null;
        this.currentData = [];
        this.filterOptions = {};
        this.isLoading = false;
        this.filterDebounceTimer = null;
        this.filterUpdateTimer = null; // For filter change debouncing
        this.isUpdatingFilters = false; // Prevent concurrent filter updates
        this.floodDetailsCache = new Map(); // Cache for flood details
        this.modalElements = null; // Cache modal DOM elements
        this.popupTemplate = null; // Cache popup template
        this.filterOptionsCache = null; // Cache for filter options
        this.filterOptionsCacheTimestamp = null; // Timestamp for cache validity
        this.FILTER_CACHE_TTL = 5 * 60 * 1000; // Cache TTL: 5 minutes
        
        this.init();
    }
    
    async init() {
        this.cacheModalElements();
        this.initMap();
        this.initEventListeners();
        await this.checkDatabaseConnection();
        await this.loadFilterOptions();
        await this.loadStats({});
        await this.loadFloodData();
    }
    
    initMap() {
        // Initialize Leaflet map centered on Greece with SVG for cleaner rendering
        this.map = L.map('map', {
            preferCanvas: false, // Use SVG for cleaner circles
            zoomControl: true,
            attributionControl: true,
            renderer: L.svg({ padding: 0.5 }), // SVG renderer for crisp edges
            zoomAnimation: true,
            zoomAnimationThreshold: 4,
            fadeAnimation: true,
            markerZoomAnimation: true
        }).setView([39.0742, 21.8243], 7);
        
        // Define multiple basemap options
        const baseMaps = {
            "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }),
            "OpenTopoMap": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenTopoMap contributors',
                maxZoom: 17
            }),
            "Satellite (ESRI)": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri',
                maxZoom: 19
            }),
            "CartoDB Positron": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap, © CartoDB',
                maxZoom: 19
            }),
            "CartoDB Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap, © CartoDB',
                maxZoom: 19
            })
        };
        
        // Add default basemap (OpenStreetMap)
        baseMaps["OpenStreetMap"].addTo(this.map);
        
        // Add layer control for basemap selection (top-right position)
        L.control.layers(baseMaps, null, {
            position: 'topright',
            collapsed: true
        }).addTo(this.map);
        
        // Add scale control (bottom-left position)
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false,
            maxWidth: 150
        }).addTo(this.map);
        
        // Add north arrow control
        this.addNorthArrow();

        // Add custom measurement tool
        this.measurementTool = new MeasurementTool(this.map);
        
        // Initialize marker cluster without spider connections
        this.markerCluster = L.markerClusterGroup({
            chunkedLoading: true,
            spiderfyOnMaxZoom: false, // Disable spider connections
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 40,
            disableClusteringAtZoom: 11,
            animate: false,
            animateAddingMarkers: false,
            removeOutsideVisibleBounds: false,
            iconCreateFunction: function(cluster) {
                // Each flood point has 2 layers (marker + clickArea), so divide by 2 to get actual count
                const count = Math.round(cluster.getChildCount() / 2);
                return new L.DivIcon({
                    html: '<div style="background: #000; color: #fff; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; font-family: Inter, sans-serif;">' + count + '</div>',
                    className: 'minimal-cluster',
                    iconSize: new L.Point(36, 36)
                });
            }
        });
        
        this.map.addLayer(this.markerCluster);
    }
    
    initEventListeners() {
        // Tab navigation - only for desktop
        if (window.innerWidth > 768) {
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');
            
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Remove active class from all
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));
                    
                    // Add active class to clicked
                    button.classList.add('active');
                    const tabId = button.dataset.tab + '-tab';
                    document.getElementById(tabId).classList.add('active');
                });
            });
        }
        
        // Single handler for all filter changes to avoid redundancy
        const handleFilterChange = async () => {
            // Skip if we're already updating
            if (this.isUpdatingFilters) return;
            this.isUpdatingFilters = true;

            const yearValue = document.getElementById('year-filter').value;
            const selectedFilters = {
                year: yearValue ? parseInt(yearValue, 10) : null,
                location: document.getElementById('location-filter').value,
                deathsToll: document.getElementById('deaths-toll-filter').value,
                eventName: document.getElementById('event-name-filter').value
            };
            
            try {
                // Update available options in other filters
                await this.loadFilterOptions(selectedFilters);
                // Apply the filter to the map
                this.applyFilters();
            } finally {
                this.isUpdatingFilters = false;
            }
        };

        // Store handler for use in custom dropdowns
        this.handleFilterChange = handleFilterChange;
        
        // Attach change event listeners to all filter dropdowns
        document.getElementById('year-filter').addEventListener('change', handleFilterChange);
        document.getElementById('location-filter').addEventListener('change', handleFilterChange);
        document.getElementById('deaths-toll-filter').addEventListener('change', handleFilterChange);
        document.getElementById('event-name-filter').addEventListener('change', handleFilterChange);
        
        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearFilters();
        });
        
        // Modal controls with event delegation
        const modal = document.getElementById('flood-modal');
        const closeBtn = document.querySelector('.close');
        
        closeBtn.addEventListener('click', () => {
            this.closeModal();
        });
        
        // Use event delegation for better performance
        document.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeModal();
            }
            // Handle popup button clicks
            if (event.target.classList.contains('popup-button')) {
                const floodId = event.target.dataset.floodId;
                if (floodId) {
                    this.showFloodDetails(parseInt(floodId));
                }
            }
        });
        
        // ESC key to close modal
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.classList.contains('active')) {
                this.closeModal();
            }
        });
        
        // Welcome modal controls
        const welcomeModal = document.getElementById('welcome-modal');
        const closeWelcome = document.getElementById('close-welcome');
        const enterWebGIS = document.getElementById('enter-webgis');
        const aboutBtn = document.getElementById('about-btn');

        // Function to close welcome modal and set localStorage flag
        const closeWelcomeModal = () => {
            if (welcomeModal) {
                welcomeModal.classList.remove('active');
            }
        };

        // Show welcome modal on every visit
        if (welcomeModal) {
            // Show welcome modal with a small delay
            setTimeout(() => {
                welcomeModal.classList.add('active');
            }, 300);

            // Close button event listener
            if (closeWelcome) {
                closeWelcome.addEventListener('click', closeWelcomeModal);
            }

            // Enter WebGIS button event listener
            if (enterWebGIS) {
                enterWebGIS.addEventListener('click', closeWelcomeModal);
            }

            // Close when clicking outside modal content
            welcomeModal.addEventListener('click', (event) => {
                if (event.target === welcomeModal) {
                    closeWelcomeModal();
                }
            });

            // ESC key to close welcome modal
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && welcomeModal.classList.contains('active')) {
                    closeWelcomeModal();
                }
            });
        }

        // Manual trigger for welcome modal (About button)
        if (aboutBtn && welcomeModal) {
            aboutBtn.addEventListener('click', () => {
                welcomeModal.classList.add('active');
            });
        }

        // References modal controls
        const referencesBtn = document.getElementById('references-btn');
        const referencesModal = document.getElementById('references-modal');
        const closeReferences = document.getElementById('close-references');

        if (referencesBtn && referencesModal) {
            referencesBtn.addEventListener('click', () => {
                referencesModal.classList.add('active');
            });

            if (closeReferences) {
                closeReferences.addEventListener('click', () => {
                    referencesModal.classList.remove('active');
                });
            }

            // Close when clicking outside modal content
            referencesModal.addEventListener('click', (event) => {
                if (event.target === referencesModal) {
                    referencesModal.classList.remove('active');
                }
            });

            // ESC key to close references modal
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && referencesModal.classList.contains('active')) {
                    referencesModal.classList.remove('active');
                }
            });
        }

        // SQL Filter modal controls
        const sqlFilterBtn = document.getElementById('sql-filter-btn');
        const sqlFilterModal = document.getElementById('sql-filter-modal');
        const closeSqlFilter = document.getElementById('close-sql-filter');
        const applySqlFilter = document.getElementById('apply-sql-filter');
        const clearSqlFilter = document.getElementById('clear-sql-filter');

        if (sqlFilterBtn && sqlFilterModal) {
            // Initialize query builder
            this.initQueryBuilder();

            sqlFilterBtn.addEventListener('click', () => {
                sqlFilterModal.classList.add('active');
                document.body.classList.add('modal-open');
            });

            const closeSqlModal = () => {
                sqlFilterModal.classList.remove('active');
                document.body.classList.remove('modal-open');
            };

            if (closeSqlFilter) {
                closeSqlFilter.addEventListener('click', closeSqlModal);
            }

            sqlFilterModal.addEventListener('click', (event) => {
                if (event.target === sqlFilterModal) {
                    closeSqlModal();
                }
            });

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && sqlFilterModal.classList.contains('active')) {
                    closeSqlModal();
                }
            });

            if (applySqlFilter) {
                applySqlFilter.addEventListener('click', () => this.applySqlFilter());
            }

            if (clearSqlFilter) {
                clearSqlFilter.addEventListener('click', () => this.clearSqlFilter());
            }
        }
    }

    async loadFilterOptions(selectedFilters = {}) {
        if (window.DEBUG_MODE) console.log('Loading filter options with filters:', selectedFilters);
        
        // Check if Supabase client exists
        if (!window.supabaseClient) {
            console.error('❌ Database connection not initialized. Please check Supabase configuration.');
            this.showError('Database connection not initialized. Please check Supabase configuration.');
            this.showFilterError('Unable to load filter options. Database connection not configured.');
            this.disableFilterDropdowns();
            return;
        }
        
        // Check cache validity before making database queries
        if (this.isFilterCacheValid() && Object.keys(selectedFilters).length === 0) {
            if (window.DEBUG_MODE) console.log('✅ Using cached filter options');
            this.filterOptions = this.filterOptionsCache;
            this.populateFilterDropdowns(selectedFilters);
            return;
        }
        
        try {
            // Show loading state on filter dropdowns
            const selects = document.querySelectorAll('#year-filter, #location-filter, #deaths-toll-filter, #event-name-filter');
            selects.forEach(s => s.style.opacity = '0.6');
            this.showFilterLoading(true);
            
            // Use pagination to fetch all records in batches of 1,000 to overcome Supabase's default 1,000-row limit
            // Each query fetches only the relevant column and applies filters from other dimensions
            // This creates a cross-filtering effect where each dropdown shows only valid options
            
            if (window.DEBUG_MODE) {
                console.log('Fetching all filter options with pagination (batch size: 1000)');
            }
            
            // Years query - DISTINCT
            let yearsQuery = window.supabaseClient.from('floods').select('year').not('year', 'is', null);
            if (selectedFilters.location) yearsQuery = yearsQuery.eq('location_name', selectedFilters.location);
            if (selectedFilters.deathsToll) yearsQuery = yearsQuery.eq('deaths_toll', selectedFilters.deathsToll);
            if (selectedFilters.tagFilters && selectedFilters.tagFilters.length > 0) {
                selectedFilters.tagFilters.forEach(tagFilter => {
                    yearsQuery = yearsQuery.eq(tagFilter.field, tagFilter.value);
                });
            }
            const yearsData = await this._fetchAllRecords(yearsQuery);
            const years = this._getUniqueValuesWithCount(yearsData, 'year');
            
            // Locations query - DISTINCT
            let locationsQuery = window.supabaseClient.from('floods').select('location_name').not('location_name', 'is', null);
            if (selectedFilters.year) locationsQuery = locationsQuery.eq('year', selectedFilters.year);
            if (selectedFilters.deathsToll) locationsQuery = locationsQuery.eq('deaths_toll', selectedFilters.deathsToll);
            if (selectedFilters.tagFilters && selectedFilters.tagFilters.length > 0) {
                selectedFilters.tagFilters.forEach(tagFilter => {
                    locationsQuery = locationsQuery.eq(tagFilter.field, tagFilter.value);
                });
            }
            const locationsData = await this._fetchAllRecords(locationsQuery);
            const locations = this._getUniqueValuesWithCount(locationsData, 'location_name');
            
            // Death Toll query - DISTINCT
            let deathsTollQuery = window.supabaseClient.from('floods').select('deaths_toll').not('deaths_toll', 'is', null).not('deaths_toll', 'eq', '').not('deaths_toll', 'eq', ' ');
            if (selectedFilters.year) deathsTollQuery = deathsTollQuery.eq('year', selectedFilters.year);
            if (selectedFilters.location) deathsTollQuery = deathsTollQuery.eq('location_name', selectedFilters.location);
            if (selectedFilters.tagFilters && selectedFilters.tagFilters.length > 0) {
                selectedFilters.tagFilters.forEach(tagFilter => {
                    deathsTollQuery = deathsTollQuery.eq(tagFilter.field, tagFilter.value);
                });
            }
            const deathsTollData = await this._fetchAllRecords(deathsTollQuery);
            const deathsToll = this._getUniqueValuesWithCount(deathsTollData, 'deaths_toll');
            
            // Event Names query - DISTINCT
            let eventNamesQuery = window.supabaseClient.from('floods').select('flood_event_name').not('flood_event_name', 'is', null).not('flood_event_name', 'eq', '');
            if (selectedFilters.year) eventNamesQuery = eventNamesQuery.eq('year', selectedFilters.year);
            if (selectedFilters.location) eventNamesQuery = eventNamesQuery.eq('location_name', selectedFilters.location);
            if (selectedFilters.deathsToll) eventNamesQuery = eventNamesQuery.eq('deaths_toll', selectedFilters.deathsToll);
            const eventNamesData = await this._fetchAllRecords(eventNamesQuery);
            const eventNames = this._getUniqueValuesWithCount(eventNamesData, 'flood_event_name');
            
            this.filterOptions = { years, locations, deathsToll, eventNames };
            
            // Cache the results if no filters are applied
            if (Object.keys(selectedFilters).length === 0) {
                this.filterOptionsCache = this.filterOptions;
                this.filterOptionsCacheTimestamp = Date.now();
                if (window.DEBUG_MODE) console.log('✅ Filter options cached');
            }
            
            this.populateFilterDropdowns(selectedFilters);
            
            // Restore opacity and hide loading
            selects.forEach(s => s.style.opacity = '1');
            this.showFilterLoading(false);
            this.hideFilterError();
            
        } catch (error) {
            console.error('❌ Error loading filter options:', error);
            console.error('Error message:', error.message);
            console.error('Error details:', error.details || 'No additional details');
            console.error('Current filter state:', selectedFilters);
            
            // Restore opacity and hide loading on error
            const selects = document.querySelectorAll('#year-filter, #location-filter, #deaths-toll-filter, #event-name-filter');
            selects.forEach(s => s.style.opacity = '1');
            this.showFilterLoading(false);
            
            // Show user-visible error
            this.showError('Failed to load filter options. Please check your database connection and try again.');
            this.showFilterError('Unable to load filter options. Please check your connection.');
            this.addFilterErrorState();
        }
    }
    
    isFilterCacheValid() {
        if (!this.filterOptionsCache || !this.filterOptionsCacheTimestamp) {
            return false;
        }
        const now = Date.now();
        const cacheAge = now - this.filterOptionsCacheTimestamp;
        return cacheAge < this.FILTER_CACHE_TTL;
    }
    
    invalidateFilterCache() {
        this.filterOptionsCache = null;
        this.filterOptionsCacheTimestamp = null;
        if (window.DEBUG_MODE) console.log('🗑️ Filter cache invalidated');
    }
    
    _getUniqueValuesWithCount(data, fieldName) {
        // Use a Set for efficient unique value extraction, handling both strings and numbers
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

        // Convert the Set to an array and sort it
        const sortedValues = Array.from(uniqueValues);
        sortedValues.sort((a, b) => {
            // Special handling for deaths_toll field: numeric sorting in ascending order
            if (fieldName === 'deaths_toll') {
                const numA = parseFloat(String(a).trim()) || 0;
                const numB = parseFloat(String(b).trim()) || 0;
                return numA - numB; // Sort numerically in ascending order (0, 1, 2, 5, 10, etc.)
            }
            // Ensure consistent sorting for strings and numbers
            if (typeof a === 'number' && typeof b === 'number') {
                return b - a; // Sort numbers in descending order (e.g., years)
            }
            return String(a).localeCompare(String(b)); // Sort strings alphabetically
        });

        // console.log('🔧 _getUniqueValuesWithCount() processing field:', fieldName);
        // console.log('📊 First 20 sorted values:', sortedValues.slice(0, 20));
        // console.log('📊 Last 20 sorted values:', sortedValues.slice(-20));
        // console.log('🔍 Type of first sorted value:', typeof sortedValues[0], '| Value:', sortedValues[0]);
        // console.log('📈 Total unique values for', fieldName + ':', sortedValues.length);
        // if (fieldName === 'year') { console.log('📅 Year-specific debug - All years:', sortedValues); }

        return sortedValues;
    }
    
    async _fetchAllRecords(query) {
        // Helper method to fetch all records using pagination to overcome Supabase's 1000-row default limit
        const allRecords = [];
        const batchSize = 1000;
        let offset = 0;
        
        try {
            while (true) {
                if (window.DEBUG_MODE) {
                    console.log(`Fetching batch: offset ${offset}, size ${batchSize}`);
                }
                
                const { data, error } = await query.range(offset, offset + batchSize - 1);
                
                if (error) {
                    throw error;
                }
                
                if (!data || data.length === 0) {
                    break;
                }
                
                allRecords.push(...data);
                
                if (window.DEBUG_MODE) {
                    console.log(`Fetched ${data.length} records, total so far: ${allRecords.length}`);
                }
                
                // If we got fewer records than batchSize, we've reached the end
                if (data.length < batchSize) {
                    break;
                }
                
                offset += batchSize;
            }
            
            if (window.DEBUG_MODE) {
                console.log(`Pagination complete: ${allRecords.length} total records fetched`);
            }
            
            return allRecords;
        } catch (error) {
            console.error('Error fetching records with pagination:', error);
            throw error;
        }
    }
    
    populateFilterDropdowns(selectedFilters = {}) {
        // Store current selections
        const currentYear = selectedFilters.year || document.getElementById('year-filter')?.value;
        const currentLocation = selectedFilters.location || document.getElementById('location-filter')?.value;
        const currentDeathsToll = selectedFilters.deathsToll || document.getElementById('deaths-toll-filter')?.value;
        const currentEventName = selectedFilters.eventName || document.getElementById('event-name-filter')?.value;
        
        // Update each filter
        this.populateDropdown('year', this.filterOptions.years, currentYear);
        this.populateDropdown('location', this.filterOptions.locations, currentLocation);
        this.populateDropdown('deaths-toll', this.filterOptions.deathsToll, currentDeathsToll);
        this.populateDropdown('event-name', this.filterOptions.eventNames, currentEventName);
    }
    
    populateDropdown(filterName, options, currentValue) {
        const select = document.getElementById(`${filterName}-filter`);
        if (!select) return;

        // Keep the first option ("All ...") and remove the rest
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Add new options
        options.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            
            // Special display for death toll
            if (filterName === 'deaths-toll' && value === '0') {
                option.textContent = '0 (None)';
            } else {
                option.textContent = value;
            }
            
            select.appendChild(option);
        });

        // Set selected value - use loose equality to handle number/string comparison
        if (currentValue != null && currentValue !== '') {
            const valueToSet = String(currentValue);
            const matchFound = options.some(opt => String(opt) === valueToSet);
            if (matchFound) {
                select.value = valueToSet;
                select.classList.add('has-value');
            } else {
                select.value = '';
                select.classList.remove('has-value');
            }
        } else {
            select.value = '';
            select.classList.remove('has-value');
        }

        // Refresh dropdown limiter if available
        if (window.refreshDropdown) {
            window.refreshDropdown(`${filterName}-filter`);
        }
    }
    
    async loadStats(filters = {}) {
        try {
            // Total count
            let totalQuery = window.supabaseClient.from('floods').select('*', { count: 'exact', head: true });
            if (filters.year) totalQuery = totalQuery.eq('year', filters.year);
            if (filters.location) totalQuery = totalQuery.eq('location_name', filters.location);
            if (filters.deathsToll) totalQuery = totalQuery.eq('deaths_toll', filters.deathsToll);
            if (filters.eventName) totalQuery = totalQuery.eq('flood_event_name', filters.eventName);
            const { count: totalCount, error: totalError } = await totalQuery;
            if (totalError) throw totalError;
            
            // Min year
            let minQuery = window.supabaseClient.from('floods').select('year').not('year', 'is', null).order('year', { ascending: true }).limit(1);
            if (filters.location) minQuery = minQuery.eq('location_name', filters.location);
            if (filters.deathsToll) minQuery = minQuery.eq('deaths_toll', filters.deathsToll);
            if (filters.eventName) minQuery = minQuery.eq('flood_event_name', filters.eventName);
            const { data: minData, error: minError } = await minQuery;
            if (minError) throw minError;
            let minYear = minData && minData.length > 0 ? minData[0].year : 'N/A';
            
            // Max year
            let maxQuery = window.supabaseClient.from('floods').select('year').not('year', 'is', null).order('year', { ascending: false }).limit(1);
            if (filters.location) maxQuery = maxQuery.eq('location_name', filters.location);
            if (filters.deathsToll) maxQuery = maxQuery.eq('deaths_toll', filters.deathsToll);
            if (filters.eventName) maxQuery = maxQuery.eq('flood_event_name', filters.eventName);
            const { data: maxData, error: maxError } = await maxQuery;
            if (maxError) throw maxError;
            let maxYear = maxData && maxData.length > 0 ? maxData[0].year : 'N/A';
            
            // Events with casualties
            let casualtiesQuery = window.supabaseClient.from('floods').select('*', { count: 'exact', head: true }).not('deaths_toll', 'is', null).not('deaths_toll', 'eq', '').not('deaths_toll', 'eq', '0').not('deaths_toll', 'eq', ' ').not('deaths_toll', 'eq', ' 0').not('deaths_toll', 'eq', '0 ');
            if (filters.year) casualtiesQuery = casualtiesQuery.eq('year', filters.year);
            if (filters.location) casualtiesQuery = casualtiesQuery.eq('location_name', filters.location);
            if (filters.eventName) casualtiesQuery = casualtiesQuery.eq('flood_event_name', filters.eventName);
            // Note: casualties filter is NOT applied here so this stat always shows events with casualties within other selected filters
            const { count: casualtiesCount, error: casualtiesError } = await casualtiesQuery;
            if (casualtiesError) throw casualtiesError;
            
            const stats = {
                total_events: totalCount,
                year_range: { min: minYear, max: maxYear },
                events_with_deaths: casualtiesCount
            };
            
            document.getElementById('total-events').textContent = stats.total_events.toLocaleString();
            let yearRangeText;
            if (minYear === 'N/A' && maxYear === 'N/A') {
                yearRangeText = 'No data';
            } else {
                yearRangeText = `${stats.year_range.min} - ${stats.year_range.max}`;
            }
            document.getElementById('year-range').textContent = yearRangeText;
            document.getElementById('events-deaths').textContent = 
                stats.events_with_deaths.toLocaleString();
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    async loadFloodData(filters = {}) {
        if (this.isLoading) return;

        this.showLoading(true);
        this.isLoading = true;

        try {
            // Build base query - include deaths_toll for tooltip
            let baseQuery = window.supabaseClient.from('floods').select('id, latitude, longitude, year, location_name, deaths_toll, cause_of_flood').not('latitude', 'is', null).not('longitude', 'is', null);

            if (filters.year) baseQuery = baseQuery.eq('year', filters.year);
            if (filters.location) baseQuery = baseQuery.eq('location_name', filters.location);
            if (filters.deathsToll) baseQuery = baseQuery.eq('deaths_toll', filters.deathsToll);
            if (filters.eventName) baseQuery = baseQuery.eq('flood_event_name', filters.eventName);

            // Use pagination to fetch all records (Supabase default limit is 1000)
            const data = await this._fetchAllRecords(baseQuery);

            if (window.DEBUG_MODE) console.log(`Successfully loaded ${data.length} flood records`);
            this.currentData = data;
            this.updateMap();
            this.updateVisiblePointsCount();

        } catch (error) {
            console.error('❌ Error loading flood data:', error);
            console.error('Error message:', error.message);
            console.error('Query filters:', filters);
            this.showError('Failed to load flood data. Please try again.');
        } finally {
            this.showLoading(false);
            this.isLoading = false;
        }
    }
    
    updateMap() {
        // Clear existing markers
        this.markerCluster.clearLayers();
        
        // Create all markers at once for better performance
        const markers = this.currentData.map(flood => {
            // Larger, cleaner markers for better visibility and clickability
            const marker = L.circleMarker([flood.latitude, flood.longitude], {
                radius: 10, // Even larger for easier clicking
                fillColor: this.getMarkerColor(flood),
                color: '#000000',
                weight: 2, // Thicker border for cleaner rendering
                opacity: 1,
                fillOpacity: 0.95, // Slight transparency for overlapping markers
                renderer: L.svg(), // Use SVG for cleaner rendering
                bubblingMouseEvents: false, // Prevent event bubbling
                pane: 'markerPane' // Ensure proper layering
            });
            
            // Add larger invisible click area
            const clickArea = L.circleMarker([flood.latitude, flood.longitude], {
                radius: 16, // Invisible larger click area
                fillColor: 'transparent',
                color: 'transparent',
                weight: 0,
                fillOpacity: 0,
                interactive: true,
                bubblingMouseEvents: false
            });
            
            // Direct click to show details - no popup
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.showFloodDetails(flood.id);
            });
            
            clickArea.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.showFloodDetails(flood.id);
            });
            
            // Add enhanced tooltip on hover with more info
            const deathsToll = flood.deaths_toll && flood.deaths_toll !== '0' ? flood.deaths_toll : 'None';
            const cause = flood.cause_of_flood ? this.escapeHtml(flood.cause_of_flood) : 'N/A';
            
            const tooltipContent = `
                <div style="font-size: 12px; padding: 6px; line-height: 1.4;">
                    <strong style="font-size: 13px;">${this.escapeHtml(flood.location_name || 'Unknown')}</strong><br>
                    <span style="color: #666;">Year:</span> <strong>${flood.year || 'N/A'}</strong><br>
                    <span style="color: #666;">Death Toll:</span> <strong>${deathsToll}</strong><br>
                    <span style="color: #666;">Cause:</span> ${cause}
                </div>
            `;
            
            marker.bindTooltip(tooltipContent, {
                direction: 'top',
                offset: [0, -10],
                opacity: 0.9,
                className: 'minimal-tooltip'
            });
            
            // Sync hover effects
            clickArea.on('mouseover', () => {
                marker.setStyle({ weight: 3, fillOpacity: 1 });
                marker.openTooltip();
            });
            
            clickArea.on('mouseout', () => {
                marker.setStyle({ weight: 2, fillOpacity: 0.95 });
                marker.closeTooltip();
            });
            
            marker.on('mouseover', () => {
                marker.setStyle({ weight: 3, fillOpacity: 1 });
            });
            
            marker.on('mouseout', () => {
                marker.setStyle({ weight: 2, fillOpacity: 0.95 });
            });
            
            // Return both as a layer group
            return L.layerGroup([marker, clickArea]);
        });
        
        // Add all markers at once
        if (markers.length > 0) {
            this.markerCluster.addLayers(markers);
            
            // Fit bounds without animation
            const bounds = this.markerCluster.getBounds();
            if (bounds.isValid()) {
                this.map.fitBounds(bounds.pad(0.05));
            }
        }
        
        this.updateVisiblePointsCount();
    }
    
    getMarkerColor(flood) {
        // High contrast color scheme for better visibility
        const year = parseInt(flood.year);
        if (!year) return '#cccccc'; // Light gray for unknown
        
        if (year < 2000) return '#888888'; // Medium gray for old
        if (year < 2010) return '#444444'; // Dark gray for recent
        return '#000000'; // Black for most recent
    }
    
    async showFloodDetails(floodId) {
        // Check cache first
        if (this.floodDetailsCache.has(floodId)) {
            this.displayFloodModal(this.floodDetailsCache.get(floodId));
            return;
        }
        
        try {
            const { data: flood, error } = await window.supabaseClient.from('floods').select('id, date_of_commencement, year, latitude, longitude, location_name, flood_event_name, deaths_toll, rainfall_duration, cause_of_flood, rainfall_height, relevant_information, source').eq('id', floodId).single();
            if (error) throw error;
            
            // Add default reference if not present in database
            if (!flood.reference) {
                flood.reference = 'https://doi.org/10.3390/cli11110226';
            }
            
            // Cache the result
            this.floodDetailsCache.set(floodId, flood);
            
            this.displayFloodModal(flood);
        } catch (error) {
            console.error('Error loading flood details:', error);
            this.showError('Failed to load flood details.');
        }
    }
    
    displayFloodModal(flood) {
        // Use cached modal elements
        if (!this.modalElements) {
            this.cacheModalElements();
        }
        
        const fields = [
            { key: 'id', label: 'Event ID', highlight: true },
            { key: 'date_of_commencement', label: 'Date' },
            { key: 'year', label: 'Year' },
            { key: 'location_name', label: 'Location' },
            { key: 'flood_event_name', label: 'Event Name' },
            { key: 'deaths_toll', label: 'Death Toll' },
            { key: 'cause_of_flood', label: 'Cause' },
            { key: 'source', label: 'Source' },
            { key: 'reference', label: 'Reference', isLink: true }
        ];
        
        // Simple HTML string for better performance
        let html = '';
        fields.forEach(field => {
            const value = flood[field.key];
            const displayValue = value && value.toString().trim() ? value : '-';
            const highlightClass = field.highlight ? 'detail-item-highlighted' : '';
            
            let valueHtml;
            if (field.isLink && value && value.toString().trim() && value !== '-') {
                // Make reference field a clickable link
                valueHtml = `<a href="${this.escapeHtml(value)}" target="_blank" rel="noopener noreferrer" style="color: #0066ff; text-decoration: underline;">${this.escapeHtml(value)}</a>`;
            } else if (field.key === 'id') {
                valueHtml = `#${displayValue}`;
            } else {
                valueHtml = this.escapeHtml(displayValue);
            }
            
            html += `
                <div class="detail-item ${highlightClass}">
                    <div class="detail-label">${field.label}</div>
                    <div class="detail-value">${valueHtml}</div>
                </div>
            `;
        });
        
        // Add report issue button at the bottom - COMMENTED OUT
        /*
        html += `
            <div class="community-actions">
                <button class="btn-report" onclick="app.openReportForm(${flood.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7L2 17L12 22L22 17L22 7L12 2Z"></path>
                        <path d="M12 8L12 12"></path>
                        <path d="M12 16L12.01 16"></path>
                    </svg>
                    Report Issue or Request Change
                </button>
            </div>
        `;
        */
        
        // Update modal content
        this.modalElements.detailsContainer.innerHTML = html;
        
        // Show modal - CSS handles centering
        this.modalElements.modal.classList.add('active');
        
        // Prevent background scrolling
        document.body.classList.add('modal-open');
    }
    
    async applyFilters() {
        const yearValue = document.getElementById('year-filter').value;
        const filters = {
            year: yearValue ? parseInt(yearValue, 10) : null,
            location: document.getElementById('location-filter').value,
            deathsToll: document.getElementById('deaths-toll-filter').value,
            eventName: document.getElementById('event-name-filter').value
        };
        
        // Count active filters
        let activeCount = 0;
        
        Object.keys(filters).forEach(key => {
            if (!filters[key]) {
                delete filters[key];
            } else {
                activeCount++;
            }
        });
        
        // Update active filters display
        this.updateActiveFiltersDisplay(filters);
        
        // Update mobile toggle to show filter count
        this.updateFilterIndicator(activeCount, filters);
        
        // Close sidebar on mobile after applying filters
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            const toggleBtn = document.getElementById('mobile-filters-toggle');
            if (sidebar && toggleBtn) {
                sidebar.classList.remove('active');
                toggleBtn.classList.remove('active');
            }
        }
        
        await this.loadFloodData(filters);
        await this.loadStats(filters);
    }
    
    updateFilterIndicator(count, filters = {}) {
        const toggleBtn = document.getElementById('mobile-filters-toggle');
        if (!toggleBtn) return;
        
        if (count > 0) {
            // Show count only on very narrow screens (480px and below)
            if (window.innerWidth <= 480) {
                toggleBtn.textContent = `Filters (${count})`;
            } else {
                // Show specific filter names on wider mobile screens
                const filterNames = [];
                if (filters.year) filterNames.push('Year');
                if (filters.location) filterNames.push('Location');
                if (filters.deathsToll) filterNames.push('Deaths');
                if (filters.eventName) filterNames.push('Event Name');
                
                const filterText = filterNames.join(', ');
                toggleBtn.textContent = `Filters: ${filterText}`;
            }
            toggleBtn.style.borderColor = 'var(--accent-blue)';
        } else {
            toggleBtn.textContent = 'Filters';
            toggleBtn.style.borderColor = '';
        }
    }
    
    
    async checkDatabaseConnection() {
        // console.log('🔍 Checking database connection...');
        
        if (!window.supabaseClient) {
            console.error('❌ Supabase client not initialized');
            this.showError('Database connection not initialized. Please configure Supabase credentials.');
            this.showFilterError('Database not configured. Filters unavailable.');
            this.disableFilterDropdowns();
            return false;
        }
        
        try {
            // Perform a simple test query
            const { count, error } = await window.supabaseClient
                .from('floods')
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                console.error('❌ Database connection test failed:', error);
                this.showError('Failed to connect to database. Please check your Supabase configuration.');
                this.showFilterError('Unable to connect to database.');
                this.disableFilterDropdowns();
                return false;
            }
            
            // console.log('✅ Database connection successful');
            // console.log(`📊 Database contains ${count} flood records`);
            return true;
            
        } catch (error) {
            console.error('❌ Database connection exception:', error);
            this.showError('An error occurred while connecting to the database.');
            this.showFilterError('Database connection error.');
            this.disableFilterDropdowns();
            return false;
        }
    }
    
    showFilterLoading(show) {
        const filterLoading = document.getElementById('filter-loading');
        if (filterLoading) {
            if (show) {
                filterLoading.classList.remove('hidden');
            } else {
                filterLoading.classList.add('hidden');
            }
        }
    }
    
    showFilterError(message) {
        const filterError = document.getElementById('filter-error');
        if (filterError) {
            filterError.textContent = message;
            filterError.classList.remove('hidden');
        }
    }
    
    hideFilterError() {
        const filterError = document.getElementById('filter-error');
        if (filterError) {
            filterError.classList.add('hidden');
        }
    }
    
    addFilterErrorState() {
        const selects = document.querySelectorAll('#year-filter, #location-filter, #deaths-toll-filter');
        selects.forEach(select => {
            select.classList.add('filter-error-state');
        });
    }
    
    disableFilterDropdowns() {
        const selects = document.querySelectorAll('#year-filter, #location-filter, #deaths-toll-filter');
        selects.forEach(select => {
            select.disabled = true;
            select.classList.add('filter-error-state');
        });
    }
    async clearFilters() {
        const yearInput = document.getElementById('year-filter');
        const locationInput = document.getElementById('location-filter');
        const deathsTollInput = document.getElementById('deaths-toll-filter');
        const eventNameInput = document.getElementById('event-name-filter');
        
        // Clear all select values
        if (yearInput) yearInput.value = '';
        if (locationInput) locationInput.value = '';
        if (deathsTollInput) deathsTollInput.value = '';
        if (eventNameInput) eventNameInput.value = '';
        
        // Remove has-value classes
        yearInput?.classList.remove('has-value');
        locationInput?.classList.remove('has-value');
        deathsTollInput?.classList.remove('has-value');
        eventNameInput?.classList.remove('has-value');
        
        // Hide active filters summary
        const activeFiltersSummary = document.getElementById('active-filters-summary');
        if (activeFiltersSummary) {
            activeFiltersSummary.classList.add('hidden');
        }

        // Invalidate cache to refresh filter options
        this.invalidateFilterCache();

        // Reload all filter options without any filters
        await this.loadFilterOptions({});

        this.updateFilterIndicator(0, {});

        // Also clear SQL filter
        this.clearSqlFilter(false);

        this.applyFilters();
    }

    // Query Builder configuration
    queryBuilderFields = [
        { value: 'year', label: 'Year', type: 'number' },
        { value: 'location_name', label: 'Location', type: 'text' },
        { value: 'deaths_toll', label: 'Death Toll', type: 'text' }, // Database stores as text
        { value: 'cause_of_flood', label: 'Cause of Flood', type: 'text' },
        { value: 'flood_event_name', label: 'Event Name', type: 'text' }
    ];

    queryBuilderOperators = {
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
            { value: 'ilike', label: 'Contains' },
            { value: 'not_ilike', label: 'Does Not Contain' },
            { value: 'starts', label: 'Starts With' },
            { value: 'ends', label: 'Ends With' },
            { value: 'is_null', label: 'Is Empty' },
            { value: 'is_not_null', label: 'Is Not Empty' }
        ]
    };

    queryConditions = [];
    queryConditionId = 0;

    initQueryBuilder() {
        const addConditionBtn = document.getElementById('add-condition');
        const addGroupBtn = document.getElementById('add-group');

        if (addConditionBtn) {
            addConditionBtn.addEventListener('click', () => this.addQueryCondition());
        }
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', () => this.addQueryGroup());
        }

        // Add initial condition
        this.addQueryCondition();
    }

    addQueryCondition(parentId = null) {
        const id = ++this.queryConditionId;
        const condition = { id, parentId, logic: 'AND', field: 'year', operator: 'eq', value: '' };
        this.queryConditions.push(condition);
        this.renderQueryConditions();
        this.updateQueryPreview();
        return id;
    }

    addQueryGroup() {
        const groupId = ++this.queryConditionId;
        const group = { id: groupId, isGroup: true, logic: 'AND', conditions: [] };
        this.queryConditions.push(group);

        // Add first condition to group
        const conditionId = ++this.queryConditionId;
        group.conditions.push({ id: conditionId, logic: 'AND', field: 'year', operator: 'eq', value: '' });

        this.renderQueryConditions();
        this.updateQueryPreview();
    }

    removeQueryCondition(id) {
        // Remove from top level
        this.queryConditions = this.queryConditions.filter(c => c.id !== id);

        // Remove from groups
        this.queryConditions.forEach(item => {
            if (item.isGroup && item.conditions) {
                item.conditions = item.conditions.filter(c => c.id !== id);
            }
        });

        // Remove empty groups
        this.queryConditions = this.queryConditions.filter(item =>
            !item.isGroup || (item.conditions && item.conditions.length > 0)
        );

        this.renderQueryConditions();
        this.updateQueryPreview();
    }

    addConditionToGroup(groupId) {
        const group = this.queryConditions.find(c => c.id === groupId && c.isGroup);
        if (group) {
            const conditionId = ++this.queryConditionId;
            group.conditions.push({ id: conditionId, logic: 'AND', field: 'year', operator: 'eq', value: '' });
            this.renderQueryConditions();
            this.updateQueryPreview();
        }
    }

    updateQueryCondition(id, property, value) {
        // Check top level
        let condition = this.queryConditions.find(c => c.id === id);

        // Check in groups
        if (!condition) {
            for (const item of this.queryConditions) {
                if (item.isGroup && item.conditions) {
                    condition = item.conditions.find(c => c.id === id);
                    if (condition) break;
                }
            }
        }

        if (condition) {
            condition[property] = value;

            // If field changed, reset operator to first valid option
            if (property === 'field') {
                const fieldDef = this.queryBuilderFields.find(f => f.value === value);
                const operators = this.queryBuilderOperators[fieldDef?.type || 'text'];
                condition.operator = operators[0].value;
                this.renderQueryConditions();
            }

            this.updateQueryPreview();
        }
    }

    renderQueryConditions() {
        const container = document.getElementById('query-conditions');
        if (!container) return;

        container.innerHTML = '';

        this.queryConditions.forEach((item, index) => {
            if (item.isGroup) {
                container.appendChild(this.renderGroup(item, index));
            } else {
                container.appendChild(this.renderConditionRow(item, index));
            }
        });
    }

    getFieldValues(fieldName) {
        // Get available values for a field from filterOptions
        if (!this.filterOptions) return [];

        const fieldMap = {
            'year': 'years',
            'location_name': 'locations',
            'deaths_toll': 'deathsToll',
            'flood_event_name': 'eventNames',
            'cause_of_flood': 'causeOfFlood'
        };

        const optionKey = fieldMap[fieldName];
        if (optionKey && this.filterOptions[optionKey]) {
            return this.filterOptions[optionKey];
        }

        // For cause_of_flood, extract from all data if available
        if (fieldName === 'cause_of_flood' && this.allData) {
            const causes = new Set();
            this.allData.forEach(item => {
                if (item.cause_of_flood) {
                    causes.add(item.cause_of_flood.trim());
                }
            });
            return Array.from(causes).sort();
        }

        return [];
    }

    renderConditionRow(condition, index, isInGroup = false) {
        const row = document.createElement('div');
        row.className = 'query-condition-row' + (isInGroup ? ' grouped' : '');
        row.dataset.id = condition.id;

        const fieldDef = this.queryBuilderFields.find(f => f.value === condition.field);
        const operators = this.queryBuilderOperators[fieldDef?.type || 'text'];
        const needsValue = !['is_null', 'is_not_null'].includes(condition.operator);
        const fieldValues = this.getFieldValues(condition.field);

        // Build value dropdown options
        const valueOptions = fieldValues.map(v =>
            `<option value="${this.escapeHtml(String(v))}" ${String(condition.value) === String(v) ? 'selected' : ''}>${this.escapeHtml(String(v))}</option>`
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
                    ${this.queryBuilderFields.map(f =>
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

        // Add event listeners
        row.querySelectorAll('select').forEach(el => {
            el.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                const prop = e.target.dataset.prop;
                this.updateQueryCondition(id, prop, e.target.value);
            });
        });

        row.querySelector('.condition-remove')?.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.remove);
            this.removeQueryCondition(id);
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

        // Event listeners
        groupEl.querySelector('[data-add-to-group]')?.addEventListener('click', (e) => {
            const gid = parseInt(e.currentTarget.dataset.addToGroup);
            this.addConditionToGroup(gid);
        });

        groupEl.querySelector('.query-group-header > .condition-logic select')?.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            this.updateQueryCondition(id, 'logic', e.target.value);
        });

        groupEl.querySelector('.query-group-header .condition-remove')?.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.remove);
            this.removeQueryCondition(id);
        });

        return groupEl;
    }

    updateQueryPreview() {
        const previewEl = document.getElementById('query-preview-text');
        if (!previewEl) return;

        const queryStr = this.buildQueryString(this.queryConditions);

        if (!queryStr) {
            previewEl.innerHTML = '<em>No conditions added</em>';
        } else {
            previewEl.innerHTML = queryStr;
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
                const fieldDef = this.queryBuilderFields.find(f => f.value === item.field);
                const operators = this.queryBuilderOperators[fieldDef?.type || 'text'];
                const opDef = operators.find(o => o.value === item.operator);

                if (item.operator === 'is_null') {
                    part = `<span class="query-field">${fieldDef?.label || item.field}</span> <span class="query-operator">Is Empty</span>`;
                } else if (item.operator === 'is_not_null') {
                    part = `<span class="query-field">${fieldDef?.label || item.field}</span> <span class="query-operator">Is Not Empty</span>`;
                } else if (item.value !== undefined && item.value !== '') {
                    const displayValue = fieldDef?.type === 'number' ? item.value : `"${item.value}"`;
                    part = `<span class="query-field">${fieldDef?.label || item.field}</span> <span class="query-operator">${opDef?.label || item.operator}</span> <span class="query-value">${this.escapeHtml(displayValue)}</span>`;
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

    // SQL Filter methods
    async applySqlFilter() {
        const errorDiv = document.getElementById('sql-filter-error');
        const activeDiv = document.getElementById('sql-filter-active');
        const activeQuery = document.getElementById('sql-active-query');

        // Clear previous error
        errorDiv?.classList.add('hidden');

        // Check if we have any valid conditions
        const validConditions = this.getValidConditions(this.queryConditions);
        if (validConditions.length === 0) {
            this.showSqlError('Please add at least one complete condition');
            return;
        }

        try {
            this.showLoading(true);

            // Build the Supabase query for map data
            let query = window.supabaseClient
                .from('floods')
                .select('id, latitude, longitude, year, location_name, deaths_toll, cause_of_flood')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null);

            // Apply conditions
            query = this.applyQueryConditions(query, this.queryConditions);

            // Fetch all records
            const data = await this._fetchAllRecordsFromQuery(query);

            if (window.DEBUG_MODE) console.log(`Query builder returned ${data.length} records`);

            // Store active filter and deep copy conditions
            this.activeSqlFilter = JSON.parse(JSON.stringify(this.queryConditions));

            // Update map data
            this.currentData = data;
            this.updateMap();
            this.updateVisiblePointsCount();

            // Update stats based on SQL filter results
            await this.updateStatsFromSqlFilter(data);

            // Update active filters display (will include SQL filter)
            this.updateActiveFiltersDisplay({});

            // Update mobile filter indicator
            this.updateFilterIndicator(1, { sqlFilter: 'Query' });

            // Show active filter indicator in modal
            if (activeDiv && activeQuery) {
                activeQuery.innerHTML = this.buildQueryString(this.queryConditions);
                activeDiv.classList.remove('hidden');
            }

            // Close modal
            document.getElementById('sql-filter-modal')?.classList.remove('active');
            document.body.classList.remove('modal-open');

        } catch (error) {
            console.error('Query builder error:', error);
            this.showSqlError(error.message || 'Query failed');
        } finally {
            this.showLoading(false);
        }
    }

    async updateStatsFromSqlFilter(data) {
        // Calculate stats from the filtered data
        const totalCount = data.length;

        // Get year range
        const years = data.map(d => d.year).filter(y => y != null);
        const minYear = years.length > 0 ? Math.min(...years) : 'N/A';
        const maxYear = years.length > 0 ? Math.max(...years) : 'N/A';

        // Count events with casualties
        const casualtiesCount = data.filter(d => {
            const toll = d.deaths_toll;
            if (toll === null || toll === undefined) return false;
            const tollStr = String(toll).trim();
            return tollStr !== '' && tollStr !== '0';
        }).length;

        // Update stats display (use optional chaining for safety)
        const totalEl = document.getElementById('total-events');
        if (totalEl) totalEl.textContent = totalCount.toLocaleString();

        let yearRangeText;
        if (minYear === 'N/A' && maxYear === 'N/A') {
            yearRangeText = 'No data';
        } else {
            yearRangeText = `${minYear} - ${maxYear}`;
        }
        const yearRangeEl = document.getElementById('year-range');
        if (yearRangeEl) yearRangeEl.textContent = yearRangeText;

        // Note: the HTML uses 'events-deaths' not 'events-with-deaths'
        const eventsDeathsEl = document.getElementById('events-deaths');
        if (eventsDeathsEl) eventsDeathsEl.textContent = casualtiesCount.toLocaleString();
    }

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
        conditions.forEach((item, index) => {
            if (item.isGroup && item.conditions?.length > 0) {
                // Build OR string for group if logic is OR
                const orParts = [];
                item.conditions.forEach(cond => {
                    const condStr = this.buildConditionString(cond);
                    if (condStr) orParts.push(condStr);
                });
                if (orParts.length > 0) {
                    if (item.logic === 'OR' && index > 0) {
                        query = query.or(orParts.join(','));
                    } else {
                        // Apply each condition with AND
                        item.conditions.forEach(cond => {
                            query = this.applySingleCondition(query, cond);
                        });
                    }
                }
            } else if (!item.isGroup) {
                query = this.applySingleCondition(query, item);
            }
        });
        return query;
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

        // Skip invalid conditions
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

    async _fetchAllRecordsFromQuery(baseQuery) {
        const pageSize = 1000;
        let allRecords = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await baseQuery.range(offset, offset + pageSize - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allRecords = allRecords.concat(data);
                offset += data.length;
                hasMore = data.length === pageSize;
            } else {
                hasMore = false;
            }
        }

        return allRecords;
    }

    clearSqlFilter(reloadData = true) {
        const errorDiv = document.getElementById('sql-filter-error');
        const activeDiv = document.getElementById('sql-filter-active');

        this.queryConditions = [];
        this.queryConditionId = 0;
        this.addQueryCondition(); // Add initial empty condition

        errorDiv?.classList.add('hidden');
        activeDiv?.classList.add('hidden');

        this.activeSqlFilter = null;

        if (reloadData) {
            this.applyFilters();
        }
    }

    showSqlError(message) {
        const errorDiv = document.getElementById('sql-filter-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
    }

    updateActiveFiltersDisplay(filters) {
        const activeFiltersSummary = document.getElementById('active-filters-summary');
        const activeFiltersList = document.getElementById('active-filters-list');

        if (!activeFiltersSummary || !activeFiltersList) return;

        // Clear existing badges
        activeFiltersList.innerHTML = '';

        // Create filter name mapping for display
        const filterLabels = {
            year: 'Year',
            location: 'Location',
            deathsToll: 'Death Toll',
            eventName: 'Event Name'
        };

        // Count active filters
        let activeCount = Object.keys(filters).length;

        // Check if SQL filter is active
        const hasSqlFilter = this.activeSqlFilter && this.getValidConditions(this.activeSqlFilter).length > 0;
        if (hasSqlFilter) {
            activeCount++;
        }

        if (activeCount === 0) {
            // Hide summary if no filters active
            activeFiltersSummary.classList.add('hidden');
            return;
        }

        // Show summary and create badges
        activeFiltersSummary.classList.remove('hidden');

        // Add SQL filter badge first if active
        if (hasSqlFilter) {
            const sqlBadge = document.createElement('div');
            sqlBadge.className = 'filter-badge filter-badge-sql';

            const labelSpan = document.createElement('span');
            labelSpan.className = 'filter-badge-label';
            labelSpan.textContent = 'Query:';

            const valueSpan = document.createElement('span');
            valueSpan.className = 'filter-badge-value';
            valueSpan.textContent = `${this.getValidConditions(this.activeSqlFilter).length} condition(s)`;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'filter-badge-remove';
            removeBtn.innerHTML = '×';
            removeBtn.title = 'Remove SQL filter';
            removeBtn.addEventListener('click', () => this.clearSqlFilter(true));

            sqlBadge.appendChild(labelSpan);
            sqlBadge.appendChild(valueSpan);
            sqlBadge.appendChild(removeBtn);

            activeFiltersList.appendChild(sqlBadge);
        }

        // Create badges for classic filters
        Object.keys(filters).forEach(filterKey => {

            const filterValue = filters[filterKey];
            const filterLabel = filterLabels[filterKey] || filterKey;

            // Create badge element
            const badge = document.createElement('div');
            badge.className = 'filter-badge';

            // Create badge content
            const labelSpan = document.createElement('span');
            labelSpan.className = 'filter-badge-label';
            labelSpan.textContent = `${filterLabel}:`;

            const valueSpan = document.createElement('span');
            valueSpan.className = 'filter-badge-value';
            valueSpan.textContent = this.escapeHtml(filterValue);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'filter-badge-remove';
            removeBtn.innerHTML = '×';
            removeBtn.title = `Remove ${filterLabel} filter`;
            removeBtn.setAttribute('aria-label', `Remove ${filterLabel} filter`);
            removeBtn.addEventListener('click', () => this.clearIndividualFilter(filterKey));

            badge.appendChild(labelSpan);
            badge.appendChild(valueSpan);
            badge.appendChild(removeBtn);

            activeFiltersList.appendChild(badge);
        });
    }
    
    async clearIndividualFilter(filterName) {
        // Map filter names to select element IDs
        const filterIds = {
            year: 'year-filter',
            location: 'location-filter',
            deathsToll: 'deaths-toll-filter',
            eventName: 'event-name-filter'
        };
        
        const filterId = filterIds[filterName];
        if (!filterId) return;
        
        // Clear the select value
        const select = document.getElementById(filterId);
        if (select) {
            select.value = '';
            select.classList.remove('has-value');
        }
        
        // Trigger filter update
        this.applyFilters();
    }
    
    updateVisiblePointsCount() {
        document.getElementById('visible-points').textContent = 
            this.currentData.length.toLocaleString();
    }
    
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }
    
    showError(message) {
        console.error('Error:', message);
        
        // Create or get error banner
        let errorBanner = document.getElementById('error-banner');
        if (!errorBanner) {
            errorBanner = document.createElement('div');
            errorBanner.id = 'error-banner';
            errorBanner.className = 'error-banner';
            document.body.insertBefore(errorBanner, document.body.firstChild);
        }
        
        // Build error banner HTML
        const errorHTML = `
            <div class="error-banner-content">
                <div class="error-banner-icon">⚠️</div>
                <div class="error-banner-message">${message}</div>
                <button class="error-banner-close" aria-label="Close error banner">×</button>
            </div>
        `;
        
        errorBanner.innerHTML = errorHTML;
        errorBanner.classList.remove('hidden');
        
        // Add close button functionality
        const closeButton = errorBanner.querySelector('.error-banner-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                errorBanner.classList.add('hidden');
            });
        }
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            errorBanner.classList.add('hidden');
        }, 10000);
    }
    
    // Debounced filter application for better performance
    debouncedApplyFilters() {
        clearTimeout(this.filterDebounceTimer);
        this.filterDebounceTimer = setTimeout(() => {
            this.applyFilters();
        }, 300);
    }
    
    // Close modal helper - instant close
    closeModal() {
        if (!this.modalElements) {
            this.cacheModalElements();
        }
        
        this.modalElements.modal.classList.remove('active');
        // Re-enable background scrolling
        document.body.classList.remove('modal-open');
    }
    
    // Cache modal DOM elements to avoid repeated queries
    cacheModalElements() {
        this.modalElements = {
            modal: document.getElementById('flood-modal'),
            detailsContainer: document.getElementById('flood-details'),
            closeBtn: document.querySelector('.close')
        };
    }
    
    // Create popup content
    createPopupContent(flood) {
        return `
            <div class="popup-title">${this.escapeHtml(flood.location_name || 'Unknown Location')}</div>
            <div class="popup-info"><strong>Year:</strong> ${flood.year || 'Unknown'}</div>
            <div class="popup-info"><strong>ID:</strong> ${flood.id}</div>
            <button class="popup-button" data-flood-id="${flood.id}">
                View Details
            </button>
        `;
    }
    
    // HTML escape helper for security
    escapeHtml(text) {
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
    

    
    // Add north arrow to the map
    addNorthArrow() {
        const NorthArrowControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-north-arrow');
                container.style.backgroundColor = 'white';
                container.style.width = '40px';
                container.style.height = '40px';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.style.cursor = 'default';
                container.style.fontSize = '24px';
                container.style.fontWeight = 'bold';
                container.style.color = '#000';
                container.style.userSelect = 'none';
                container.innerHTML = '⬆<div style="position:absolute;bottom:2px;font-size:10px;font-weight:600;">N</div>';
                container.title = 'North';
                
                // Prevent map interactions on the control
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                
                return container;
            }
        });
        
        this.map.addControl(new NorthArrowControl());
    }
    
    // Open report form for a specific event
    openReportForm(eventId) {
        // Store event ID in session storage and redirect to submissions page
        sessionStorage.setItem('reportEventId', eventId);
        window.open('/submissions', '_blank');
    }
}

// Initialize the application when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    // Check if all required elements are present
    if (document.getElementById('map')) {
        app = new FloodMapApp();
        // Make app globally available for debugging
        window.app = app;
        
        // Initialize mobile controls
        initializeMobileControls();
    } else {
        console.error('Required DOM elements not found');
    }
});

// Mobile controls initialization
function initializeMobileControls() {
    const filtersToggle = document.getElementById('mobile-filters-toggle');
    const statsToggle = document.getElementById('mobile-stats-toggle');
    const sidebar = document.getElementById('sidebar');
    const closeButton = document.getElementById('mobile-sidebar-close');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Helper function to close sidebar
    function closeSidebar() {
        sidebar.classList.remove('active');
        filtersToggle.classList.remove('active');
        statsToggle.classList.remove('active');
        
        // Show map when closing sidebar on mobile
        if (window.innerWidth <= 768) {
            const mapContainer = document.querySelector('.map-container');
            if (mapContainer) {
                mapContainer.style.display = 'block';
            }
        }
    }
    
    // Helper function to open sidebar
    function openSidebar() {
        sidebar.classList.add('active');
        
        // Hide map when opening sidebar on mobile
        if (window.innerWidth <= 768) {
            const mapContainer = document.querySelector('.map-container');
            if (mapContainer) {
                mapContainer.style.display = 'none';
            }
        }
    }
    
    if (filtersToggle && statsToggle && sidebar) {
        // Filters button click
        filtersToggle.addEventListener('click', () => {
            const isActive = sidebar.classList.contains('active');
            
            if (isActive && filtersToggle.classList.contains('active')) {
                // Close if clicking active button
                closeSidebar();
            } else {
                // Open sidebar and show filters tab
                openSidebar();
                filtersToggle.classList.add('active');
                statsToggle.classList.remove('active');
                
                // Switch to filters tab content directly
                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById('filters-tab').classList.add('active');
            }
        });
        
        // Stats button click
        statsToggle.addEventListener('click', () => {
            const isActive = sidebar.classList.contains('active');
            
            if (isActive && statsToggle.classList.contains('active')) {
                // Close if clicking active button
                closeSidebar();
            } else {
                // Open sidebar and show stats tab
                openSidebar();
                statsToggle.classList.add('active');
                filtersToggle.classList.remove('active');
                
                // Switch to stats tab content directly
                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById('stats-tab').classList.add('active');
            }
        });
        
        // Close button click
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                closeSidebar();
            });
        }
        
        // Close dropdown when clicking outside on mobile
        document.addEventListener('click', (event) => {
            if (window.innerWidth <= 768) {
                const isClickInside = sidebar.contains(event.target) || 
                                     filtersToggle.contains(event.target) ||
                                     statsToggle.contains(event.target);
                
                if (!isClickInside && sidebar.classList.contains('active')) {
                    closeSidebar();
                }
            }
        });
        
        // Handle window resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (window.innerWidth > 768) {
                    // Reset mobile states on desktop
                    closeSidebar();
                }
            }, 250);
        });
    }
}