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
        
        this.init();
    }
    
    async init() {
        this.cacheModalElements();
        this.initMap();
        this.initEventListeners();
        await this.checkDatabaseConnection();
        await this.loadFilterOptions();
        await this.loadStats();
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
        
        // Add OpenStreetMap tiles with optimized settings
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
            updateWhenZooming: false,
            updateWhenIdle: true,
            keepBuffer: 2
        }).addTo(this.map);
        
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
                const count = cluster.getChildCount();
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
        
        // Filter controls with interactive filtering
        const yearFilter = document.getElementById('year-filter');
        const locationFilter = document.getElementById('location-filter');
        const causeFilter = document.getElementById('cause-filter');
        
        // Single handler for all filter changes to avoid redundancy
        const handleFilterChange = async () => {
            // Skip if we're already updating
            if (this.isUpdatingFilters) return;
            this.isUpdatingFilters = true;
            
            const selectedFilters = {
                year: yearFilter.value,
                location: locationFilter.value,
                cause: causeFilter.value
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
        
        // Add change listeners with debouncing
        yearFilter.addEventListener('change', () => {
            clearTimeout(this.filterUpdateTimer);
            this.filterUpdateTimer = setTimeout(handleFilterChange, 300);
        });
        
        locationFilter.addEventListener('change', () => {
            clearTimeout(this.filterUpdateTimer);
            this.filterUpdateTimer = setTimeout(handleFilterChange, 300);
        });
        
        causeFilter.addEventListener('change', () => {
            clearTimeout(this.filterUpdateTimer);
            this.filterUpdateTimer = setTimeout(handleFilterChange, 300);
        });
        
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
            if (event.key === 'Escape' && modal.style.display === 'block') {
                this.closeModal();
            }
        });
        
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
    }
    
    async loadFilterOptions(selectedFilters = {}) {
        console.log('Loading filter options with filters:', selectedFilters);
        
        // Check if Supabase client exists
        if (!window.supabaseClient) {
            console.error('❌ Database connection not initialized. Please check Supabase configuration.');
            this.showError('Database connection not initialized. Please check Supabase configuration.');
            this.showFilterError('Unable to load filter options. Database connection not configured.');
            this.disableFilterDropdowns();
            return;
        }
        
        try {
            // Show loading state on filter dropdowns
            const selects = document.querySelectorAll('#year-filter, #location-filter, #cause-filter');
            selects.forEach(s => s.style.opacity = '0.6');
            this.showFilterLoading(true);
            
            // Fetch all values instead of using aggregates to avoid PostgREST PGRST123 error. Process in JS for efficiency with ~2000 records.
            
            // Years query
            console.log('Querying years...');
            let yearsQuery = window.supabaseClient.from('floods').select('year').limit(10000);
            if (selectedFilters.location) yearsQuery = yearsQuery.eq('location_name', selectedFilters.location);
            if (selectedFilters.cause) yearsQuery = yearsQuery.eq('cause_of_flood', selectedFilters.cause);
            const { data: yearsData, error: yearsError } = await yearsQuery;
            if (yearsError) throw yearsError;
            console.log('📊 Raw yearsData sample (first 10):', yearsData.slice(0, 10));
            console.log('🔍 Type of first year value:', typeof yearsData[0]?.year, '| Value:', yearsData[0]?.year);
            console.log('📈 Total year records fetched:', yearsData.length);
            console.log('📅 Sample of 20 year values:', yearsData.slice(0, 20).map(d => d.year));
            console.log('📊 Year range in raw data - Min:', Math.min(...yearsData.map(d => d.year)), 'Max:', Math.max(...yearsData.map(d => d.year)));
            const years = this._getUniqueValuesWithCount(yearsData, 'year');
            console.log(`Processing ${yearsData.length} year values, found ${years.length} unique years`);
            
            // Locations query
            console.log('Querying locations...');
            let locationsQuery = window.supabaseClient.from('floods').select('location_name').limit(10000);
            if (selectedFilters.year) locationsQuery = locationsQuery.eq('year', selectedFilters.year);
            if (selectedFilters.cause) locationsQuery = locationsQuery.eq('cause_of_flood', selectedFilters.cause);
            const { data: locationsData, error: locationsError } = await locationsQuery;
            if (locationsError) throw locationsError;
            const locations = this._getUniqueValuesWithCount(locationsData, 'location_name');
            locations.splice(100);
            console.log(`Processing ${locationsData.length} location values, found ${locations.length} unique locations (showing top 100)`);
            
            // Causes query
            console.log('Querying causes...');
            let causesQuery = window.supabaseClient.from('floods').select('cause_of_flood').limit(10000);
            if (selectedFilters.year) causesQuery = causesQuery.eq('year', selectedFilters.year);
            if (selectedFilters.location) causesQuery = causesQuery.eq('location_name', selectedFilters.location);
            const { data: causesData, error: causesError } = await causesQuery;
            if (causesError) throw causesError;
            const causes = this._getUniqueValuesWithCount(causesData, 'cause_of_flood');
            console.log(`Processing ${causesData.length} cause values, found ${causes.length} unique causes`);
            
            this.filterOptions = { years, locations, causes };
            
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
            const selects = document.querySelectorAll('#year-filter, #location-filter, #cause-filter');
            selects.forEach(s => s.style.opacity = '1');
            this.showFilterLoading(false);
            
            // Show user-visible error
            this.showError('Failed to load filter options. Please check your database connection and try again.');
            this.showFilterError('Unable to load filter options. Please check your connection.');
            this.addFilterErrorState();
        }
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
            // Ensure consistent sorting for strings and numbers
            if (typeof a === 'number' && typeof b === 'number') {
                return b - a; // Sort numbers in descending order (e.g., years)
            }
            return String(a).localeCompare(String(b)); // Sort strings alphabetically
        });

        console.log('🔧 _getUniqueValuesWithCount() processing field:', fieldName);
        console.log('📊 First 20 sorted values:', sortedValues.slice(0, 20));
        console.log('📊 Last 20 sorted values:', sortedValues.slice(-20));
        console.log('🔍 Type of first sorted value:', typeof sortedValues[0], '| Value:', sortedValues[0]);
        console.log('📈 Total unique values for', fieldName + ':', sortedValues.length);
        if (fieldName === 'year') { console.log('📅 Year-specific debug - All years:', sortedValues); }

        return sortedValues;
    }
    
    populateFilterDropdowns(selectedFilters = {}) {
        console.log('Populating dropdowns with:', this.filterOptions);
        
        // Validate filter options
        if (!this.filterOptions.years || this.filterOptions.years.length === 0) {
            console.warn('⚠️ No years available - check database connection');
        }
        if (!this.filterOptions.locations || this.filterOptions.locations.length === 0) {
            console.warn('⚠️ No locations available - check database connection');
        }
        if (!this.filterOptions.causes || this.filterOptions.causes.length === 0) {
            console.warn('⚠️ No causes available - check database connection');
        }
        
        // Store current selections
        const yearSelect = document.getElementById('year-filter');
        const locationSelect = document.getElementById('location-filter');
        const causeSelect = document.getElementById('cause-filter');
        
        const currentYear = selectedFilters.year || yearSelect.value;
        const currentLocation = selectedFilters.location || locationSelect.value;
        const currentCause = selectedFilters.cause || causeSelect.value;
        
        // Clear and repopulate year filter
        const yearOptions = yearSelect.querySelectorAll('option:not(:first-child)');
        yearOptions.forEach(opt => opt.remove());
        this.filterOptions.years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        });
        console.log(`Added ${this.filterOptions.years.length} year options`);
        console.log('📅 First 20 years added to dropdown:', this.filterOptions.years.slice(0, 20));
        console.log('📅 Last 20 years added to dropdown:', this.filterOptions.years.slice(-20));
        console.log('📅 All years in dropdown:', this.filterOptions.years);
        console.log('🔍 Actual <option> elements in year dropdown:', yearSelect.querySelectorAll('option').length - 1);
        console.log('🔍 Type of first year in filterOptions:', typeof this.filterOptions.years[0], '| Value:', this.filterOptions.years[0]);
        console.log('📊 Year range in dropdown - First:', this.filterOptions.years[0], 'Last:', this.filterOptions.years[this.filterOptions.years.length - 1]);
        console.log('🔧 limitDropdowns function available:', typeof limitDropdowns === 'function');

        // Clear and repopulate location filter
        const locationOptions = locationSelect.querySelectorAll('option:not(:first-child)');
        locationOptions.forEach(opt => opt.remove());
        this.filterOptions.locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            if (location === currentLocation) option.selected = true;
            locationSelect.appendChild(option);
        });
        console.log(`Added ${this.filterOptions.locations.length} location options`);
        
        // Clear and repopulate cause filter
        const causeOptions = causeSelect.querySelectorAll('option:not(:first-child)');
        causeOptions.forEach(opt => opt.remove());
        this.filterOptions.causes.forEach(cause => {
            const option = document.createElement('option');
            option.value = cause;
            option.textContent = cause;
            if (cause === currentCause) option.selected = true;
            causeSelect.appendChild(option);
        });
        console.log(`Added ${this.filterOptions.causes.length} cause options`);
        
        // Re-apply the dropdown limiting after repopulating
        if (typeof limitDropdowns === 'function') {
            console.log('Calling limitDropdowns()...');
            setTimeout(limitDropdowns, 100);
        }
    }
    
    async loadStats() {
        try {
            // Total count
            const { count: totalCount, error: totalError } = await window.supabaseClient.from('floods').select('*', { count: 'exact', head: true });
            if (totalError) throw totalError;
            
            // Min year
            const { data: minData, error: minError } = await window.supabaseClient.from('floods').select('year').not('year', 'is', null).not('year', 'eq', '').order('year', { ascending: true }).limit(1);
            if (minError) throw minError;
            const minYear = minData[0]?.year;
            
            // Max year
            const { data: maxData, error: maxError } = await window.supabaseClient.from('floods').select('year').not('year', 'is', null).not('year', 'eq', '').order('year', { ascending: false }).limit(1);
            if (maxError) throw maxError;
            const maxYear = maxData[0]?.year;
            
            // Events with casualties
            const { count: casualtiesCount, error: casualtiesError } = await window.supabaseClient.from('floods').select('*', { count: 'exact', head: true }).not('deaths_toll', 'is', null).not('deaths_toll', 'eq', '').not('deaths_toll', 'eq', '0');
            if (casualtiesError) throw casualtiesError;
            
            const stats = {
                total_events: totalCount,
                year_range: { min: minYear, max: maxYear },
                events_with_casualties: casualtiesCount
            };
            
            document.getElementById('total-events').textContent = stats.total_events.toLocaleString();
            document.getElementById('year-range').textContent = 
                `${stats.year_range.min} - ${stats.year_range.max}`;
            document.getElementById('events-casualties').textContent = 
                stats.events_with_casualties.toLocaleString();
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    async loadFloodData(filters = {}) {
        if (this.isLoading) return;
        
        this.showLoading(true);
        this.isLoading = true;
        
        try {
            console.log('Loading flood data with filters:', filters);
            
            // Build query
            let query = window.supabaseClient.from('floods').select('id, latitude, longitude, year, location_name').not('latitude', 'is', null).not('longitude', 'is', null);
            
            if (filters.year) query = query.eq('year', filters.year);
            if (filters.location) query = query.eq('location_name', filters.location);
            if (filters.cause) query = query.eq('cause_of_flood', filters.cause);
            
            query = query.limit(2000);
            
            console.log('Executing flood data query...');
            const { data, error } = await query;
            if (error) {
                console.error('Query failed:', error);
                throw error;
            }
            
            console.log(`Successfully loaded ${data.length} flood records`);
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
            
            // Add tooltip on hover instead of popup
            const tooltipContent = `
                <div style="font-size: 12px; padding: 4px;">
                    <strong>${this.escapeHtml(flood.location_name || 'Unknown')}</strong><br>
                    Year: ${flood.year || 'N/A'}
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
            
            flood.added_by = 'Niki Evelpidou Team';
            
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
            { key: 'id', label: 'Event ID', highlight: true },  // Add ID field with highlight
            { key: 'date_of_commencement', label: 'Date' },
            { key: 'year', label: 'Year' },
            { key: 'location_name', label: 'Location' },
            { key: 'flood_event_name', label: 'Event Name' },
            { key: 'deaths_toll', label: 'Deaths' },
            { key: 'cause_of_flood', label: 'Cause' },
            { key: 'source', label: 'Source' },
            { key: 'added_by', label: 'Added by' }
        ];
        
        // Simple HTML string for better performance
        let html = '';
        fields.forEach(field => {
            const value = flood[field.key];
            const displayValue = value && value.toString().trim() ? value : '-';
            const highlightClass = field.highlight ? 'detail-item-highlighted' : '';
            html += `
                <div class="detail-item ${highlightClass}">
                    <div class="detail-label">${field.label}</div>
                    <div class="detail-value">${field.key === 'id' ? `#${displayValue}` : this.escapeHtml(displayValue)}</div>
                </div>
            `;
        });
        
        // Add report issue button at the bottom
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
        
        // Update modal content
        this.modalElements.detailsContainer.innerHTML = html;
        
        // Show modal - CSS handles centering
        this.modalElements.modal.style.display = 'flex';
        
        // Prevent background scrolling
        document.body.classList.add('modal-open');
    }
    
    applyFilters() {
        const filters = {
            year: document.getElementById('year-filter').value,
            location: document.getElementById('location-filter').value,
            cause: document.getElementById('cause-filter').value
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
        
        // Update mobile toggle to show filter count
        this.updateFilterIndicator(activeCount);
        
        // Close sidebar on mobile after applying filters
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            const toggleBtn = document.getElementById('mobile-filters-toggle');
            if (sidebar && toggleBtn) {
                sidebar.classList.remove('active');
                toggleBtn.classList.remove('active');
            }
        }
        
        this.loadFloodData(filters);
    }
    
    updateFilterIndicator(count) {
        const toggleBtn = document.getElementById('mobile-filters-toggle');
        if (!toggleBtn) return;
        
        if (count > 0) {
            toggleBtn.textContent = `Filters (${count})`;
            toggleBtn.style.borderColor = 'var(--accent-blue)';
        } else {
            toggleBtn.textContent = 'Filters';
            toggleBtn.style.borderColor = '';
        }
    }
    
    
    async checkDatabaseConnection() {
        console.log('🔍 Checking database connection...');
        
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
            
            console.log('✅ Database connection successful');
            console.log(`📊 Database contains ${count} flood records`);
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
        const selects = document.querySelectorAll('#year-filter, #location-filter, #cause-filter');
        selects.forEach(select => {
            select.classList.add('filter-error-state');
        });
    }
    
    disableFilterDropdowns() {
        const selects = document.querySelectorAll('#year-filter, #location-filter, #cause-filter');
        selects.forEach(select => {
            select.disabled = true;
            select.classList.add('filter-error-state');
        });
    }
    async clearFilters() {
        document.getElementById('year-filter').value = '';
        document.getElementById('location-filter').value = '';
        document.getElementById('cause-filter').value = '';
        
        // Reload all filter options without any filters
        await this.loadFilterOptions({});
        
        this.updateFilterIndicator(0);
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
        
        this.modalElements.modal.style.display = 'none';
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
        return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
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
