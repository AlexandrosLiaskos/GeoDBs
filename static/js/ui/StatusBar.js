/**
 * StatusBar - Full-width status bar at the bottom of the map
 * 
 * Displays scale, statistics and connection status.
 * Black background, white text, professional appearance.
 */

import { formatNumber } from '../utils/helpers.js';

class StatusBar {
    constructor(eventBus, stateManager) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;
        this.container = null;
        this.scaleControl = null;
        this.elements = {
            totalEvents: null,
            filteredEvents: null,
            connectionDot: null,
            scaleContainer: null
        };
        this.isOnline = navigator.onLine;
        this.globalTotal = null;
    }

    init(map) {
        this.map = map;
        this.removeDefaultAttribution();
        this.createStatusBar();
        this.createScaleBar();
        this.setupEventListeners();
        this.setupConnectionMonitor();
        this.fetchGlobalTotal();

        if (window.DEBUG_MODE) {
            console.log('✅ StatusBar: Initialized');
        }
    }

    removeDefaultAttribution() {
        this.map.attributionControl.remove();
    }

    async fetchGlobalTotal() {
        const supabase = window.supabaseClient;
        if (!supabase) return;

        try {
            const { count, error } = await supabase
                .from('floods')
                .select('*', { count: 'exact', head: true });

            if (!error && count !== null) {
                this.globalTotal = count;
                this.updateTotalEvents(count);
            }
        } catch (error) {
            console.error('StatusBar: Error fetching global total', error);
        }
    }

    createStatusBar() {
        const mapContainer = this.map.getContainer();
        
        this.container = document.createElement('div');
        this.container.className = 'map-status-bar';
        
        this.container.innerHTML = `
            <div class="status-bar-left">
                <div class="status-scale" id="status-scale"></div>
            </div>
            <div class="status-bar-right">
                <div class="status-item">
                    <span class="status-label">Total</span>
                    <span class="status-value" id="status-total-events">-</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Showing</span>
                    <span class="status-value" id="status-filtered-events">-</span>
                </div>
                <div class="status-item status-connection">
                    <span class="status-dot online" id="status-connection-dot"></span>
                </div>
            </div>
        `;

        mapContainer.appendChild(this.container);

        this.elements.totalEvents = this.container.querySelector('#status-total-events');
        this.elements.filteredEvents = this.container.querySelector('#status-filtered-events');
        this.elements.connectionDot = this.container.querySelector('#status-connection-dot');
        this.elements.scaleContainer = this.container.querySelector('#status-scale');
    }

    createScaleBar() {
        this.scaleControl = L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false,
            maxWidth: 100
        });
        this.scaleControl.addTo(this.map);

        const scaleElement = document.querySelector('.leaflet-control-scale');
        if (scaleElement && this.elements.scaleContainer) {
            this.elements.scaleContainer.appendChild(scaleElement);
        }
    }

    setupEventListeners() {
        this.eventBus.on('data:loaded', ({ count }) => {
            this.updateFilteredEvents(count);
        });
    }

    setupConnectionMonitor() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateConnectionStatus(true);
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateConnectionStatus(false);
        });
    }

    updateTotalEvents(count) {
        if (this.elements.totalEvents) {
            this.elements.totalEvents.textContent = formatNumber(count);
        }
    }

    updateFilteredEvents(count) {
        if (this.elements.filteredEvents) {
            this.elements.filteredEvents.textContent = formatNumber(count);
        }
    }

    updateConnectionStatus(isOnline) {
        if (this.elements.connectionDot) {
            this.elements.connectionDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
        }
    }
}

export default StatusBar;
