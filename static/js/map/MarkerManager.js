/**
 * MarkerManager - Manages flood markers and clustering on the map
 *
 * Handles marker creation, clustering, tooltips, interactions, and visibility.
 * Uses Leaflet.markercluster for efficient display of many markers.
 *
 * @example
 * const markerManager = new MarkerManager(map, eventBus, stateManager);
 * markerManager.init();
 * markerManager.updateMarkers(floodData);
 */

import { escapeHtml } from '../utils/helpers.js';

class MarkerManager {
    constructor(map, eventBus, stateManager) {
        if (!map) {
            throw new Error('MarkerManager: Map instance is required');
        }

        this.map = map;
        this.eventBus = eventBus;
        this.stateManager = stateManager;

        this.markerCluster = null;
        this.currentMarkers = [];
        this.currentData = [];
    }

    /**
     * Initialize marker cluster group and add to map
     */
    init() {
        // Initialize marker cluster with custom styling
        this.markerCluster = L.markerClusterGroup({
            chunkedLoading: true,
            spiderfyOnMaxZoom: true,
            spiderLegPolylineOptions: {
                weight: 1.5,
                color: '#333',
                opacity: 0.5
            },
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 40,
            disableClusteringAtZoom: 19,
            singleMarkerMode: false,
            animate: false,
            animateAddingMarkers: false,
            removeOutsideVisibleBounds: false,
            iconCreateFunction: this.createClusterIcon.bind(this)
        });

        // Add cluster to map
        this.map.addLayer(this.markerCluster);

        // Store reference in state
        this.stateManager.set('markerCluster', this.markerCluster);

        if (window.DEBUG_MODE) {
            console.log('✅ MarkerManager: Initialized with clustering');
        }
    }

    /**
     * Create custom cluster icon
     * @param {L.MarkerCluster} cluster - Marker cluster
     * @returns {L.DivIcon} Custom icon for cluster
     * @private
     */
    createClusterIcon(cluster) {
        const count = cluster.getChildCount();
        const displayText = count === 1 ? '' : count;
        const size = count === 1 ? 12 : 36;
        const anchor = size / 2;

        return new L.DivIcon({
            html: `<div style="background: #000; color: #fff; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; font-family: Inter, sans-serif;">${displayText}</div>`,
            className: 'minimal-cluster',
            iconSize: new L.Point(size, size),
            iconAnchor: new L.Point(anchor, anchor)
        });
    }

    /**
     * Create custom marker icon (looks like a single-count cluster)
     * @returns {L.DivIcon} Custom icon for single marker
     * @private
     */
    createMarkerIcon() {
        return L.divIcon({
            html: '<div style="background: #000; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border-radius: 50%; width: 18px; height: 18px;"></div>',
            className: 'single-marker-cluster',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });
    }

    /**
     * Create tooltip content for a flood marker
     * @param {Object} flood - Flood data object
     * @returns {string} HTML content for tooltip
     * @private
     */
    createTooltipContent(flood) {
        const deathsToll = flood.deaths_toll ? flood.deaths_toll : 'None';
        const cause = flood.cause_of_flood ? escapeHtml(flood.cause_of_flood) : 'N/A';
        const location = escapeHtml(flood.location_name || 'Unknown');

        return `
            <div style="font-size: 12px; padding: 6px; line-height: 1.4;">
                <strong style="font-size: 13px;">${location}</strong><br>
                <span style="color: #666;">Year:</span> <strong>${flood.year || 'N/A'}</strong><br>
                <span style="color: #666;">Death Toll:</span> <strong>${deathsToll}</strong><br>
                <span style="color: #666;">Cause:</span> ${cause}
            </div>
        `;
    }

    /**
     * Create a marker for a single flood event
     * @param {Object} flood - Flood data object
     * @returns {L.Marker} Leaflet marker
     * @private
     */
    createMarker(flood) {
        // Validate coordinates
        if (!flood.latitude || !flood.longitude) {
            console.warn('MarkerManager: Skipping flood with invalid coordinates', flood.id);
            return null;
        }

        // Create marker with custom icon
        const icon = this.createMarkerIcon();
        const marker = L.marker([flood.latitude, flood.longitude], { icon });

        // Store flood data in marker for reference
        marker.floodData = flood;

        // Add click handler - emit event instead of direct modal call
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            this.eventBus.emit('marker:clicked', { floodId: flood.id, flood });

            if (window.DEBUG_MODE) {
                console.log('🖱️ MarkerManager: Marker clicked for flood ID', flood.id);
            }
        });

        // Add tooltip
        const tooltipContent = this.createTooltipContent(flood);
        marker.bindTooltip(tooltipContent, {
            direction: 'top',
            offset: [0, -14],
            opacity: 0.95,
            className: 'minimal-tooltip'
        });

        return marker;
    }

    /**
     * Update markers on the map with new flood data
     * @param {Array<Object>} floodData - Array of flood objects
     * @param {Object} options - Update options
     * @param {boolean} options.fitBounds - Whether to fit map bounds to markers
     * @param {boolean} options.animate - Whether to animate bounds change
     */
    updateMarkers(floodData = [], options = {}) {
        const { fitBounds = true, animate = false } = options;

        // Clear existing markers
        this.clearMarkers();

        // Store current data
        this.currentData = floodData;

        // Create markers from flood data
        const markers = floodData
            .map(flood => this.createMarker(flood))
            .filter(marker => marker !== null); // Filter out invalid markers

        this.currentMarkers = markers;

        // Add all markers to cluster at once for better performance
        if (markers.length > 0) {
            this.markerCluster.addLayers(markers);

            // Fit bounds if requested
            if (fitBounds) {
                const bounds = this.markerCluster.getBounds();
                if (bounds.isValid()) {
                    this.map.fitBounds(bounds.pad(0.05), {
                        animate,
                        duration: 0.5
                    });
                }
            }
        }

        // Update state
        this.stateManager.set('markerCount', markers.length);
        this.stateManager.set('visibleFloodData', floodData);

        // Emit event
        this.eventBus.emit('markers:updated', {
            count: markers.length,
            bounds: this.markerCluster.getBounds()
        });

        if (window.DEBUG_MODE) {
            console.log(`🗺️ MarkerManager: Updated ${markers.length} markers`);
        }
    }

    /**
     * Clear all markers from the map
     */
    clearMarkers() {
        if (this.markerCluster) {
            this.markerCluster.clearLayers();
        }
        this.currentMarkers = [];
        this.currentData = [];

        this.stateManager.set('markerCount', 0);
        this.stateManager.set('visibleFloodData', []);

        if (window.DEBUG_MODE) {
            console.log('🗑️ MarkerManager: Cleared all markers');
        }
    }

    /**
     * Get current markers
     * @returns {Array<L.Marker>} Array of current markers
     */
    getMarkers() {
        return this.currentMarkers;
    }

    /**
     * Get current flood data
     * @returns {Array<Object>} Array of flood data objects
     */
    getData() {
        return this.currentData;
    }

    /**
     * Get marker count
     * @returns {number} Number of markers on map
     */
    getMarkerCount() {
        return this.currentMarkers.length;
    }

    /**
     * Get bounds of all markers
     * @returns {L.LatLngBounds|null} Bounds of markers or null if no markers
     */
    getBounds() {
        if (!this.markerCluster || this.currentMarkers.length === 0) {
            return null;
        }
        return this.markerCluster.getBounds();
    }

    /**
     * Fit map to marker bounds
     * @param {Object} options - Fit bounds options
     */
    fitBounds(options = {}) {
        const bounds = this.getBounds();
        if (bounds && bounds.isValid()) {
            this.map.fitBounds(bounds.pad(0.05), {
                animate: true,
                duration: 0.5,
                ...options
            });
        }
    }

    /**
     * Find marker by flood ID
     * @param {number} floodId - Flood ID
     * @returns {L.Marker|null} Marker or null if not found
     */
    findMarkerById(floodId) {
        return this.currentMarkers.find(marker =>
            marker.floodData && marker.floodData.id === floodId
        ) || null;
    }

    /**
     * Highlight a specific marker (e.g., when selected)
     * @param {number} floodId - Flood ID to highlight
     */
    highlightMarker(floodId) {
        const marker = this.findMarkerById(floodId);
        if (marker) {
            // Zoom to marker
            this.map.setView(marker.getLatLng(), 13, { animate: true });

            // Open tooltip
            marker.openTooltip();

            // Emit event
            this.eventBus.emit('marker:highlighted', { floodId, marker });
        }
    }

    /**
     * Remove highlight from all markers
     */
    clearHighlight() {
        this.currentMarkers.forEach(marker => {
            marker.closeTooltip();
        });
    }

    /**
     * Get cluster at specific location
     * @param {L.LatLng} latlng - Location
     * @returns {L.MarkerCluster|null} Cluster or null
     */
    getClusterAt(latlng) {
        if (!this.markerCluster) {
            return null;
        }
        return this.markerCluster.getVisibleParent(latlng);
    }

    /**
     * Refresh clusters (useful after zoom or pan)
     */
    refreshClusters() {
        if (this.markerCluster) {
            this.markerCluster.refreshClusters();
        }
    }

    /**
     * Destroy marker manager and clean up
     */
    destroy() {
        this.clearMarkers();

        if (this.markerCluster && this.map) {
            this.map.removeLayer(this.markerCluster);
        }

        this.markerCluster = null;
        this.map = null;

        if (window.DEBUG_MODE) {
            console.log('🗑️ MarkerManager: Destroyed');
        }
    }
}

// Export for ES modules
export default MarkerManager;
