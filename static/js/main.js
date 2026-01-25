/**
 * Greek Floods Web Map Atlas - Main Entry Point
 *
 * Initializes and wires together all application modules using ES6 imports.
 * This is the main application orchestrator.
 */

import EventBus from './core/EventBus.js';
import StateManager from './core/StateManager.js';
import CacheManager from './core/CacheManager.js';
import DataManager from './data/DataManager.js';
import StatsManager from './data/StatsManager.js';
import MapManager from './map/MapManager.js';
import MarkerManager from './map/MarkerManager.js';
import ModalManager from './ui/ModalManager.js';
import UIController from './ui/UIController.js';
import FilterManager from './ui/FilterManager.js';
import FilterDisplay from './ui/FilterDisplay.js';
import GlobalSearch from './ui/GlobalSearch.js';
import QueryBuilder from './ui/QueryBuilder.js';
import MobileControls from './ui/MobileControls.js';
import StatusBar from './ui/StatusBar.js';
import EmailHelper from './utils/EmailHelper.js';
import DropdownLimiter from './utils/DropdownLimiter.js';

class FloodMapApplication {
    constructor() {
        this.eventBus = new EventBus();
        this.cacheManager = new CacheManager();
        this.stateManager = new StateManager(this.eventBus);

        this.dataManager = null;
        this.statsManager = null;
        this.mapManager = null;
        this.markerManager = null;
        this.modalManager = null;
        this.uiController = null;
        this.filterManager = null;
        this.filterDisplay = null;
        this.globalSearch = null;
        this.queryBuilder = null;
        this.mobileControls = null;
        this.statusBar = null;
        this.emailHelper = null;
        this.dropdownLimiter = null;
    }

    async init() {
        try {
            if (window.DEBUG_MODE) {
                console.log('🚀 FloodMapApplication: Starting initialization...');
            }

            this.dataManager = new DataManager(this.eventBus, this.cacheManager, this.stateManager);
            this.statsManager = new StatsManager(this.eventBus, this.dataManager);
            this.mapManager = new MapManager(this.eventBus, this.stateManager);
            this.modalManager = new ModalManager(this.eventBus, this.cacheManager);
            this.uiController = new UIController(this.eventBus, this.stateManager);
            this.filterManager = new FilterManager(this.eventBus, this.stateManager, this.dataManager);
            this.filterDisplay = new FilterDisplay(this.eventBus, this.stateManager);
            this.globalSearch = new GlobalSearch(this.eventBus, this.stateManager, this.filterManager);
            this.queryBuilder = new QueryBuilder(this.eventBus, this.stateManager, this.dataManager);
            this.mobileControls = new MobileControls(this.eventBus, this.stateManager);
            this.emailHelper = new EmailHelper();
            this.dropdownLimiter = new DropdownLimiter();

            this.mapManager.init('map');

            const map = this.mapManager.getMap();
            this.markerManager = new MarkerManager(map, this.eventBus, this.stateManager);
            this.markerManager.init();

            this.statusBar = new StatusBar(this.eventBus, this.stateManager);
            this.statusBar.init(map);

            this.modalManager.init();
            this.uiController.init();
            this.filterManager.init();
            this.filterDisplay.init();
            this.globalSearch.init();
            this.queryBuilder.init();
            this.statsManager.init();
            this.mobileControls.init();
            this.dropdownLimiter.init();

            this.setupEventHandlers();
            this.setupModalButtonHandlers();

            const isConnected = await this.dataManager.init();
            if (!isConnected) {
                this.uiController.showError('Failed to connect to database. Please check your configuration.');
                this.filterManager.disableFilters();
                return;
            }

            await this.loadInitialData();

            if (window.DEBUG_MODE) {
                console.log('✅ FloodMapApplication: Initialization complete');
            }

            window.app = this;

        } catch (error) {
            console.error('❌ FloodMapApplication: Initialization failed', error);
            this.uiController?.showError('Application failed to initialize. Please refresh the page.');
        }
    }

    setupEventHandlers() {
        this.eventBus.on('filters:apply', async ({ filters }) => {
            this.stateManager.set('isLoading', true);
            try {
                // Check if there's an active SQL filter
                const activeSqlFilter = this.stateManager.get('activeSqlFilter');

                if (activeSqlFilter && activeSqlFilter.length > 0) {
                    // Re-execute the SQL query with the new regular filters
                    // The QueryBuilder.executeQuery() will pick up current filter values from DOM
                    const data = await this.queryBuilder.executeQuery();
                    this.markerManager.updateMarkers(data);
                    this.eventBus.emit('data:loaded', { count: data.length });
                    this.statsManager.calculateFromData(data);
                    // Update filter options based on combined filtered data
                    this.dataManager.emitFilterOptionsFromData(data);
                } else {
                    // No SQL filter active, just use regular filters
                    const data = await this.dataManager.fetchFloodData(filters);
                    this.markerManager.updateMarkers(data);
                    this.eventBus.emit('data:loaded', { count: data.length });
                    await this.statsManager.loadStats(filters);
                }
            } finally {
                this.stateManager.set('isLoading', false);
            }
        });

        this.eventBus.on('sqlFilter:applied', async ({ data, conditions }) => {
            this.markerManager.updateMarkers(data);
            this.eventBus.emit('data:loaded', { count: data.length });
            this.statsManager.calculateFromData(data);
            // Update filter options based on SQL-filtered data
            this.dataManager.emitFilterOptionsFromData(data);
        });

        this.eventBus.on('sqlFilter:cleared', async () => {
            const filters = this.filterManager.getActiveFilters();
            const cleanFilters = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== null && value !== '') {
                    cleanFilters[key] = value;
                }
            });

            this.stateManager.set('isLoading', true);
            try {
                const data = await this.dataManager.fetchFloodData(cleanFilters);
                this.markerManager.updateMarkers(data);
                this.eventBus.emit('data:loaded', { count: data.length });
                await this.statsManager.loadStats(cleanFilters);
                // Refresh filter options when SQL filter is cleared
                await this.dataManager.fetchFilterOptions(cleanFilters);
                // Update the active filters display to show remaining regular filters
                this.filterManager.updateActiveFiltersDisplay(cleanFilters);
            } finally {
                this.stateManager.set('isLoading', false);
            }
        });

        this.eventBus.on('marker:clicked', async ({ floodId }) => {
            try {
                const flood = await this.dataManager.fetchFloodDetails(floodId);
                this.modalManager.showFloodDetails(flood);
            } catch (error) {
                console.error('Error loading flood details:', error);
                this.uiController.showError('Failed to load flood details.');
            }
        });

        this.eventBus.on('ui:showLoading', () => {
            this.stateManager.set('isLoading', true);
        });

        this.eventBus.on('ui:hideLoading', () => {
            this.stateManager.set('isLoading', false);
        });

        this.eventBus.on('ui:aboutClicked', () => {
            this.modalManager.openModal('welcome-modal');
        });

        this.eventBus.on('ui:referencesClicked', () => {
            this.modalManager.openModal('references-modal');
        });

        this.eventBus.on('ui:submitDataClicked', () => {
            this.modalManager.openModal('submit-data-modal');
        });

        this.eventBus.on('ui:reportBugClicked', () => {
            this.modalManager.openModal('report-bug-modal');
        });

        this.eventBus.on('ui:submitSuggestionClicked', () => {
            this.modalManager.openModal('submit-suggestion-modal');
        });

        this.eventBus.on('ui:sqlFilterClicked', () => {
            this.modalManager.openModal('sql-filter-modal');
        });

        this.stateManager.subscribe('isLoading', (isLoading) => {
            this.showLoading(isLoading);
        });
    }

    async loadInitialData() {
        this.stateManager.set('isLoading', true);

        try {
            const filterOptions = await this.dataManager.fetchFilterOptions({});
            this.queryBuilder.setFilterOptions(filterOptions);

            await this.statsManager.loadStats({});

            const data = await this.dataManager.fetchFloodData({});
            this.markerManager.updateMarkers(data);
            this.eventBus.emit('data:loaded', { count: data.length });

        } finally {
            this.stateManager.set('isLoading', false);
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            if (show) {
                loading.classList.remove('hidden');
            } else {
                loading.classList.add('hidden');
            }
        }
    }

    setupModalButtonHandlers() {
        const downloadTemplateBtn = document.getElementById('download-template-btn');
        const sendEmailBtn = document.getElementById('send-email-btn');
        const sendBugReportBtn = document.getElementById('send-bug-report-btn');
        const sendSuggestionBtn = document.getElementById('send-suggestion-btn');

        if (downloadTemplateBtn) {
            downloadTemplateBtn.addEventListener('click', () => {
                this.emailHelper.downloadCSVTemplate();
            });
        }

        if (sendEmailBtn) {
            sendEmailBtn.addEventListener('click', () => {
                this.emailHelper.openSubmitDataEmail();
            });
        }

        if (sendBugReportBtn) {
            sendBugReportBtn.addEventListener('click', () => {
                this.emailHelper.openReportBugEmail();
            });
        }

        if (sendSuggestionBtn) {
            sendSuggestionBtn.addEventListener('click', () => {
                this.emailHelper.openSuggestionEmail();
            });
        }
    }
}

function initApp() {
    if (document.getElementById('map')) {
        const app = new FloodMapApplication();
        app.init();
    } else {
        console.error('Required DOM elements not found');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

export default FloodMapApplication;
