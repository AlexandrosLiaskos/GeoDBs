/**
 * MapManager - Leaflet map initialization and management
 *
 * Handles map creation, basemap layers, controls, and view management.
 * Provides the map instance to other modules that need to interact with it.
 *
 * @example
 * const mapManager = new MapManager(eventBus, stateManager);
 * mapManager.init('map');
 * const map = mapManager.getMap();
 */

class MapManager {
    constructor(eventBus, stateManager) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;

        this.map = null;
        this.baseMaps = {};
        this.currentBasemap = null;
    }

    /**
     * Initialize the Leaflet map
     * @param {string} elementId - DOM element ID for map container
     * @param {Object} options - Map initialization options
     */
    init(elementId = 'map', options = {}) {
        const defaultOptions = {
            center: [39.0742, 21.8243], // Greece
            zoom: 7,
            preferCanvas: false, // Use SVG for cleaner rendering
            zoomControl: true,
            attributionControl: true,
            renderer: L.svg({ padding: 0.5 }),
            zoomAnimation: true,
            zoomAnimationThreshold: 4,
            fadeAnimation: true,
            markerZoomAnimation: true
        };

        const mapOptions = { ...defaultOptions, ...options };

        // Initialize Leaflet map
        this.map = L.map(elementId, {
            preferCanvas: mapOptions.preferCanvas,
            zoomControl: mapOptions.zoomControl,
            attributionControl: mapOptions.attributionControl,
            renderer: mapOptions.renderer,
            zoomAnimation: mapOptions.zoomAnimation,
            zoomAnimationThreshold: mapOptions.zoomAnimationThreshold,
            fadeAnimation: mapOptions.fadeAnimation,
            markerZoomAnimation: mapOptions.markerZoomAnimation
        }).setView(mapOptions.center, mapOptions.zoom);

        // Setup basemaps
        this.initBasemaps();

        // Add controls
        this.addControls();

        // Store map instance in state
        this.stateManager.set('mapInstance', this.map);

        // Emit event
        this.eventBus.emit('map:ready', { map: this.map });

        if (window.DEBUG_MODE) {
            console.log('✅ MapManager: Map initialized');
        }

        return this.map;
    }

    /**
     * Initialize basemap layers
     * @private
     */
    initBasemaps() {
        // Define basemap options
        this.baseMaps = {
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
        this.baseMaps["OpenStreetMap"].addTo(this.map);
        this.currentBasemap = "OpenStreetMap";
    }

    /**
     * Add map controls (north arrow, measurement tool, layer control)
     * @private
     */
    addControls() {
        // North arrow control
        this.addNorthArrow();

        // Measurement tool (added after north arrow)
        if (window.MeasurementTool) {
            this.measurementTool = new window.MeasurementTool(this.map);
        }

        // Layer control (added last, appears at bottom)
        const layerControl = L.control.layers(this.baseMaps, null, {
            position: 'topleft',
            collapsed: true
        }).addTo(this.map);

        // Make layer control click-based instead of hover
        this.setupClickBasedLayerControl(layerControl);
    }

    /**
     * Setup click-based behavior for layer control
     * @private
     */
    setupClickBasedLayerControl(layerControl) {
        const container = layerControl.getContainer();
        const toggle = container.querySelector('.leaflet-control-layers-toggle');
        const list = container.querySelector('.leaflet-control-layers-list');

        if (!toggle || !list) return;

        // Add click-only class to disable hover
        container.classList.add('leaflet-control-layers-click');

        // Prevent the map from hijacking taps on the control (esp. mobile)
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        // Guard against "double toggle" on mobile where pointer/touch AND click both fire.
        let lastToggleAt = 0;

        const toggleExpanded = (e) => {
            const now = Date.now();
            lastToggleAt = now;

            e.preventDefault?.();
            e.stopPropagation?.();
            container.classList.toggle('leaflet-control-layers-expanded');
        };

        // Primary: pointerdown for modern mobile + desktop; prevents the follow-up click from toggling back.
        toggle.addEventListener('pointerdown', toggleExpanded);

        // Fallback: touchstart for older iOS that may not emit pointer events.
        toggle.addEventListener('touchstart', (e) => {
            // If pointerdown already handled recently, ignore.
            if (Date.now() - lastToggleAt < 400) return;
            toggleExpanded(e);
        }, { passive: false });

        // Click guard: ignore a click that immediately follows a pointer/touch toggle.
        toggle.addEventListener('click', (e) => {
            if (Date.now() - lastToggleAt < 400) {
                e.preventDefault?.();
                e.stopPropagation?.();
                return;
            }
            toggleExpanded(e);
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                container.classList.remove('leaflet-control-layers-expanded');
            }
        });

        // Close when selecting a layer
        list.addEventListener('click', () => {
            setTimeout(() => {
                container.classList.remove('leaflet-control-layers-expanded');
            }, 100);
        });

        list.addEventListener('touchstart', () => {
            setTimeout(() => {
                container.classList.remove('leaflet-control-layers-expanded');
            }, 100);
        }, { passive: true });
    }

    /**
     * Add north arrow control to map
     * @private
     */
    addNorthArrow() {
        const NorthArrowControl = L.Control.extend({
            options: {
                position: 'topleft'
            },

            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-north-arrow');
                container.style.backgroundColor = 'white';
                container.style.width = '34px';
                container.style.height = '34px';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.style.cursor = 'default';
                container.style.fontSize = '20px';
                container.style.fontWeight = 'bold';
                container.style.color = '#000';
                container.style.userSelect = 'none';
                container.innerHTML = '⬆<div style="position:absolute;bottom:1px;font-size:9px;font-weight:600;">N</div>';
                container.title = 'North';

                // Prevent map interactions on the control
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);

                return container;
            }
        });

        this.map.addControl(new NorthArrowControl());
    }

    /**
     * Get the map instance
     * @returns {L.Map} Leaflet map instance
     */
    getMap() {
        return this.map;
    }

    /**
     * Fit map to bounds
     * @param {L.LatLngBounds} bounds - Bounds to fit
     * @param {Object} options - Fit options
     */
    fitBounds(bounds, options = {}) {
        if (!this.map || !bounds || !bounds.isValid()) {
            return;
        }

        const defaultOptions = {
            padding: [50, 50],
            maxZoom: 16,
            animate: true
        };

        this.map.fitBounds(bounds, { ...defaultOptions, ...options });

        // Update state
        this.stateManager.set('mapBounds', bounds);

        // Emit event
        this.eventBus.emit('map:boundsChanged', { bounds });
    }

    /**
     * Set map view to specific coordinates
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} zoom - Zoom level
     */
    setView(lat, lng, zoom = 13) {
        if (!this.map) {
            return;
        }

        this.map.setView([lat, lng], zoom);
    }

    /**
     * Get current map center
     * @returns {L.LatLng} Map center
     */
    getCenter() {
        return this.map ? this.map.getCenter() : null;
    }

    /**
     * Get current zoom level
     * @returns {number} Zoom level
     */
    getZoom() {
        return this.map ? this.map.getZoom() : null;
    }

    /**
     * Get current map bounds
     * @returns {L.LatLngBounds} Map bounds
     */
    getBounds() {
        return this.map ? this.map.getBounds() : null;
    }

    /**
     * Switch basemap layer
     * @param {string} basemapName - Name of basemap to activate
     */
    switchBasemap(basemapName) {
        if (!this.baseMaps[basemapName]) {
            console.warn(`MapManager: Basemap "${basemapName}" not found`);
            return;
        }

        // Remove current basemap
        if (this.currentBasemap && this.baseMaps[this.currentBasemap]) {
            this.map.removeLayer(this.baseMaps[this.currentBasemap]);
        }

        // Add new basemap
        this.baseMaps[basemapName].addTo(this.map);
        this.currentBasemap = basemapName;

        if (window.DEBUG_MODE) {
            console.log(`🗺️ MapManager: Switched to basemap "${basemapName}"`);
        }
    }

    /**
     * Invalidate map size (call after container resize)
     */
    invalidateSize() {
        if (this.map) {
            this.map.invalidateSize();
        }
    }
}

// Export for ES modules
export default MapManager;
