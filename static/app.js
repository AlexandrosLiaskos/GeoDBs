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
        
        // Custom dropdown state management
        this.dropdownStates = {};
        this.filteredOptions = {};
        this.highlightedIndex = {};
        this.dropdownElements = {};
        
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
        
        // Initialize custom dropdowns
        this.initCustomDropdowns();
        
        // Single handler for all filter changes to avoid redundancy
        const handleFilterChange = async () => {
            // Skip if we're already updating
            if (this.isUpdatingFilters) return;
            this.isUpdatingFilters = true;

            const selectedFilters = {
                year: document.getElementById('year-filter').value,
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
    }

    // Custom Dropdown Implementation
    initCustomDropdowns() {
        const dropdowns = [
            { name: 'year', id: 'year-dropdown' },
            { name: 'location', id: 'location-dropdown' },
            { name: 'deaths-toll', id: 'deaths-toll-dropdown' },
            { name: 'event-name', id: 'event-name-dropdown' }
        ];

        dropdowns.forEach(({ name, id }) => {
            const container = document.getElementById(id);
            if (!container) return;

            const elements = this.getDropdownElements(name);
            if (!elements.input) return;

            // Initialize state
            this.dropdownStates[name] = { isOpen: false, selectedValue: '' };
            this.filteredOptions[name] = [];
            this.highlightedIndex[name] = -1;

            // Setup event listeners
            this.setupDropdownListeners(name, elements);
        });

        // Global click handler to close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            Object.keys(this.dropdownStates).forEach(name => {
                const elements = this.getDropdownElements(name);
                const container = elements.input?.closest('.custom-dropdown');
                if (container && !container.contains(e.target)) {
                    this.closeDropdown(name);
                }
            });
        });

        // Close dropdowns on window resize
        window.addEventListener('resize', () => {
            this.closeAllDropdowns();
        });
    }

    getDropdownElements(filterName) {
        // Cache elements for performance
        if (this.dropdownElements[filterName]) {
            return this.dropdownElements[filterName];
        }

        const input = document.getElementById(`${filterName}-filter`);
        const toggleButton = input?.nextElementSibling;
        const dropdownMenu = document.getElementById(`${filterName}-dropdown-menu`);
        const optionsContainer = dropdownMenu?.querySelector('.dropdown-options');
        const hiddenSelect = document.getElementById(`${filterName}-filter-hidden`);

        const elements = {
            input,
            toggleButton,
            dropdownMenu,
            optionsContainer,
            hiddenSelect
        };

        this.dropdownElements[filterName] = elements;
        return elements;
    }

    setupDropdownListeners(filterName, elements) {
        const { input, toggleButton, dropdownMenu } = elements;

        // Toggle button click
        toggleButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(filterName);
        });

        // Input click - open dropdown
        input?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.dropdownStates[filterName].isOpen) {
                this.openDropdown(filterName);
            }
        });

        // Input focus - open dropdown and select text
        input?.addEventListener('focus', () => {
            this.openDropdown(filterName);
            input.select();
        });

        // Input typing - filter options
        input?.addEventListener('input', () => {
            const searchText = input.value.trim();
            const filtered = this.filterDropdownOptions(filterName, searchText);
            this.renderDropdownOptions(filterName, filtered);
            
            // Keep dropdown open while typing
            if (!this.dropdownStates[filterName].isOpen) {
                this.openDropdown(filterName);
            }
        });

        // Keyboard navigation
        input?.addEventListener('keydown', (e) => {
            const state = this.dropdownStates[filterName];
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!state.isOpen) {
                    this.openDropdown(filterName);
                } else {
                    this.highlightOption(filterName, 'down');
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (state.isOpen) {
                    this.highlightOption(filterName, 'up');
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (state.isOpen && this.highlightedIndex[filterName] >= 0) {
                    const options = this.filteredOptions[filterName];
                    const selectedValue = options[this.highlightedIndex[filterName]];
                    if (selectedValue) {
                        this.selectDropdownOption(filterName, selectedValue);
                    }
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (state.isOpen) {
                    this.closeDropdown(filterName);
                } else if (!state.selectedValue) {
                    input.value = '';
                }
            } else if (e.key === 'Tab') {
                this.closeDropdown(filterName);
            }
        });
    }

    openDropdown(filterName) {
        const elements = this.getDropdownElements(filterName);
        if (!elements.dropdownMenu) return;

        // Close other dropdowns first
        Object.keys(this.dropdownStates).forEach(name => {
            if (name !== filterName && this.dropdownStates[name].isOpen) {
                this.closeDropdown(name);
            }
        });

        this.dropdownStates[filterName].isOpen = true;
        elements.dropdownMenu.classList.add('show');
        elements.input?.classList.add('dropdown-open');
        elements.toggleButton?.classList.add('open');
        elements.input?.setAttribute('aria-expanded', 'true');
        this.highlightedIndex[filterName] = -1;

        // Render all options if input is empty, or filtered options if there's text
        const searchText = elements.input?.value.trim() || '';
        const options = this.filterDropdownOptions(filterName, searchText);
        this.renderDropdownOptions(filterName, options);

        // Scroll selected option into view
        setTimeout(() => {
            const selectedOption = elements.dropdownMenu.querySelector('.dropdown-option.selected');
            if (selectedOption) {
                this.scrollOptionIntoView(selectedOption);
            }
        }, 50);
    }

    closeDropdown(filterName) {
        const elements = this.getDropdownElements(filterName);
        if (!elements.dropdownMenu) return;

        this.dropdownStates[filterName].isOpen = false;
        elements.dropdownMenu.classList.remove('show');
        elements.input?.classList.remove('dropdown-open');
        elements.toggleButton?.classList.remove('open');
        elements.input?.setAttribute('aria-expanded', 'false');
        this.highlightedIndex[filterName] = -1;
    }

    closeAllDropdowns() {
        Object.keys(this.dropdownStates).forEach(name => {
            this.closeDropdown(name);
        });
    }

    toggleDropdown(filterName) {
        if (this.dropdownStates[filterName].isOpen) {
            this.closeDropdown(filterName);
        } else {
            this.openDropdown(filterName);
        }
    }

    filterDropdownOptions(filterName, searchText) {
        const allOptions = this.filterOptions[this.getFilterOptionsKey(filterName)] || [];
        
        if (!searchText) {
            this.filteredOptions[filterName] = allOptions;
            return allOptions;
        }

        const filtered = allOptions.filter(option => 
            String(option).toLowerCase().includes(searchText.toLowerCase())
        );
        
        this.filteredOptions[filterName] = filtered;
        return filtered;
    }

    getFilterOptionsKey(filterName) {
        const mapping = {
            'year': 'years',
            'location': 'locations',
            'deaths-toll': 'deathsToll',
            'event-name': 'eventNames'
        };
        return mapping[filterName] || filterName;
    }

    renderDropdownOptions(filterName, options) {
        const elements = this.getDropdownElements(filterName);
        if (!elements.optionsContainer) return;

        elements.optionsContainer.innerHTML = '';

        if (!options || options.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'dropdown-empty';
            emptyDiv.textContent = 'No results found';
            elements.optionsContainer.appendChild(emptyDiv);
            return;
        }

        const currentValue = this.dropdownStates[filterName].selectedValue;

        options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'dropdown-option';
            optionDiv.setAttribute('role', 'option');
            
            // Special handling for death toll display
            let displayValue = option;
            if (filterName === 'deaths-toll' && option === '0') {
                displayValue = '0 (None)';
            }
            
            optionDiv.textContent = displayValue;

            if (String(option) === String(currentValue)) {
                optionDiv.classList.add('selected');
                optionDiv.setAttribute('aria-selected', 'true');
            }

            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectDropdownOption(filterName, option);
            });

            optionDiv.addEventListener('mouseenter', () => {
                this.highlightedIndex[filterName] = index;
                this.updateHighlight(filterName);
            });

            elements.optionsContainer.appendChild(optionDiv);
        });
    }

    selectDropdownOption(filterName, value) {
        const elements = this.getDropdownElements(filterName);
        if (!elements.input) return;

        // Update input with display value
        let displayValue = value;
        if (filterName === 'deaths-toll' && value === '0') {
            displayValue = '0 (None)';
        }
        
        elements.input.value = displayValue;
        elements.input.classList.add('has-value');

        // Update hidden select
        if (elements.hiddenSelect) {
            elements.hiddenSelect.value = value;
        }

        // Update state
        this.dropdownStates[filterName].selectedValue = value;

        // Close dropdown
        this.closeDropdown(filterName);

        // Trigger filter change
        if (this.handleFilterChange) {
            clearTimeout(this.filterUpdateTimer);
            this.filterUpdateTimer = setTimeout(() => this.handleFilterChange(), 300);
        }
    }

    clearDropdownSelection(filterName) {
        const elements = this.getDropdownElements(filterName);
        if (!elements.input) return;

        elements.input.value = '';
        elements.input.classList.remove('has-value');

        if (elements.hiddenSelect) {
            elements.hiddenSelect.value = '';
        }

        this.dropdownStates[filterName].selectedValue = '';

        // Trigger filter change
        if (this.handleFilterChange) {
            clearTimeout(this.filterUpdateTimer);
            this.filterUpdateTimer = setTimeout(() => this.handleFilterChange(), 300);
        }
    }

    highlightOption(filterName, direction) {
        const options = this.filteredOptions[filterName] || [];
        if (options.length === 0) return;

        let newIndex = this.highlightedIndex[filterName];

        if (direction === 'down') {
            newIndex = newIndex < options.length - 1 ? newIndex + 1 : 0;
        } else if (direction === 'up') {
            newIndex = newIndex > 0 ? newIndex - 1 : options.length - 1;
        }

        this.highlightedIndex[filterName] = newIndex;
        this.updateHighlight(filterName);

        // Scroll into view
        const elements = this.getDropdownElements(filterName);
        const optionElements = elements.optionsContainer?.querySelectorAll('.dropdown-option');
        if (optionElements && optionElements[newIndex]) {
            this.scrollOptionIntoView(optionElements[newIndex]);
        }
    }

    updateHighlight(filterName) {
        const elements = this.getDropdownElements(filterName);
        const optionElements = elements.optionsContainer?.querySelectorAll('.dropdown-option');
        if (!optionElements) return;

        optionElements.forEach((el, index) => {
            if (index === this.highlightedIndex[filterName]) {
                el.classList.add('highlighted');
            } else {
                el.classList.remove('highlighted');
            }
        });
    }

    scrollOptionIntoView(optionElement) {
        if (optionElement && optionElement.scrollIntoView) {
            optionElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    // Searchable filter initialization (old method - removed)
    initSearchableFilters(searchInput, hiddenSelect, datalistId) {
        // This method is no longer used with custom dropdowns
        // Keeping stub for backwards compatibility
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
        // console.log('Populating dropdowns with:', this.filterOptions);
        
        // Validate filter options
        if (window.DEBUG_MODE) {
            if (!this.filterOptions.years || this.filterOptions.years.length === 0) {
                console.warn('⚠️ No years available - check database connection');
            }
            if (!this.filterOptions.locations || this.filterOptions.locations.length === 0) {
                console.warn('⚠️ No locations available - check database connection');
            }
        }
        
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
        const elements = this.getDropdownElements(filterName);
        if (!elements.input) return;

        // Update hidden select for form compatibility
        if (elements.hiddenSelect) {
            const existingOptions = elements.hiddenSelect.querySelectorAll('option:not(:first-child)');
            existingOptions.forEach(opt => opt.remove());

            options.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                
                // Special display for death toll
                if (filterName === 'deaths-toll' && value === '0') {
                    option.textContent = '0 (None)';
                } else {
                    option.textContent = value;
                }
                
                if (String(value) === String(currentValue)) {
                    option.selected = true;
                }
                elements.hiddenSelect.appendChild(option);
            });
        }

        // Update input value and state
        if (currentValue && options.includes(currentValue)) {
            let displayValue = currentValue;
            if (filterName === 'deaths-toll' && currentValue === '0') {
                displayValue = '0 (None)';
            }
            
            elements.input.value = displayValue;
            elements.input.classList.add('has-value');
            this.dropdownStates[filterName].selectedValue = currentValue;
        } else {
            elements.input.value = '';
            elements.input.classList.remove('has-value');
            this.dropdownStates[filterName].selectedValue = '';
        }

        // Render dropdown options
        this.renderDropdownOptions(filterName, options);
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
            // console.log('Loading flood data with filters:', filters);
            
            // Build query - include deaths_toll for tooltip
            let query = window.supabaseClient.from('floods').select('id, latitude, longitude, year, location_name, deaths_toll, cause_of_flood').not('latitude', 'is', null).not('longitude', 'is', null);

            if (filters.year) query = query.eq('year', filters.year);
            if (filters.location) query = query.eq('location_name', filters.location);
            if (filters.deathsToll) query = query.eq('deaths_toll', filters.deathsToll);
            if (filters.eventName) query = query.eq('flood_event_name', filters.eventName);
            
            query = query.limit(2000);
            
            // console.log('Executing flood data query...');
            const { data, error } = await query;
            if (error) {
                console.error('Query failed:', error);
                throw error;
            }
            
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
        const filters = {
            year: document.getElementById('year-filter').value,
            location: document.getElementById('location-filter').value,
            deathsToll: document.getElementById('deaths-toll-filter').value,
            eventName: document.getElementById('event-name-filter').value
        };

        // Get filter inputs
        const yearInput = document.getElementById('year-filter');
        const locationInput = document.getElementById('location-filter');
        const deathsTollInput = document.getElementById('deaths-toll-filter');
        const eventNameInput = document.getElementById('event-name-filter');
        
        // Count active filters
        let activeCount = 0;
        
        Object.keys(filters).forEach(key => {
            if (!filters[key]) {
                delete filters[key];
            } else {
                activeCount++;
            }
        });
        
        // Apply/remove has-value classes
        if (filters.year) {
            yearInput?.classList.add('has-value');
        } else {
            yearInput?.classList.remove('has-value');
        }
        if (filters.location) {
            locationInput?.classList.add('has-value');
        } else {
            locationInput?.classList.remove('has-value');
        }
        if (filters.deathsToll) {
            deathsTollInput?.classList.add('has-value');
        } else {
            deathsTollInput?.classList.remove('has-value');
        }
        if (filters.eventName) {
            eventNameInput?.classList.add('has-value');
        } else {
            eventNameInput?.classList.remove('has-value');
        }
        
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
        
        // Clear all input values
        if (yearInput) yearInput.value = '';
        if (locationInput) locationInput.value = '';
        if (deathsTollInput) deathsTollInput.value = '';
        if (eventNameInput) eventNameInput.value = '';
        
        // Clear hidden selects
        const yearHidden = document.getElementById('year-filter-hidden');
        const locationHidden = document.getElementById('location-filter-hidden');
        const deathsTollHidden = document.getElementById('deaths-toll-filter-hidden');
        const eventNameHidden = document.getElementById('event-name-filter-hidden');
        
        if (yearHidden) yearHidden.value = '';
        if (locationHidden) locationHidden.value = '';
        if (deathsTollHidden) deathsTollHidden.value = '';
        if (eventNameHidden) eventNameHidden.value = '';
        
        // Remove has-value classes
        yearInput?.classList.remove('has-value');
        locationInput?.classList.remove('has-value');
        deathsTollInput?.classList.remove('has-value');
        eventNameInput?.classList.remove('has-value');
        
        // Reset dropdown states
        ['year', 'location', 'deaths-toll', 'event-name'].forEach(name => {
            if (this.dropdownStates[name]) {
                this.dropdownStates[name].selectedValue = '';
            }
            this.closeDropdown(name);
        });
        
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
        this.applyFilters();
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
        
        if (activeCount === 0) {
            // Hide summary if no filters active
            activeFiltersSummary.classList.add('hidden');
            return;
        }
        
        // Show summary and create badges
        activeFiltersSummary.classList.remove('hidden');
        
        // Create badges for all filters
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
        // Map filter names to dropdown names
        const dropdownNames = {
            year: 'year',
            location: 'location',
            deathsToll: 'deaths-toll',
            eventName: 'event-name'
        };
        
        const dropdownName = dropdownNames[filterName];
        if (!dropdownName) return;
        
        // Clear the dropdown selection
        this.clearDropdownSelection(dropdownName);
        
        // Close dropdown if open
        this.closeDropdown(dropdownName);
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
