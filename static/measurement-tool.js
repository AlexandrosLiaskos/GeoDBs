/**
 * Custom Measurement Tool for Leaflet Maps
 * Provides distance and area measurement with intuitive UI
 */

class MeasurementTool {
    constructor(map) {
        this.map = map;
        this.isActive = false;
        this.points = [];
        this.polyline = null;
        this.markers = [];
        this.totalDistance = 0;
        this.area = 0;
        this.infoDisplay = null;
        this.control = null;
        
        this.init();
    }
    
    init() {
        this.createControl();
        this.setupMapEvents();
    }
    
    createControl() {
        const MeasurementControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'measurement-control leaflet-bar');
                
                const toggleBtn = L.DomUtil.create('button', 'measurement-btn', container);
                toggleBtn.innerHTML = '📏';
                toggleBtn.title = 'Measure distances and areas';
                toggleBtn.setAttribute('aria-label', 'Measurement tool');
                
                const clearBtn = L.DomUtil.create('button', 'measurement-btn measurement-clear-btn', container);
                clearBtn.innerHTML = '✕';
                clearBtn.title = 'Clear measurements';
                clearBtn.setAttribute('aria-label', 'Clear measurements');
                clearBtn.style.display = 'none';
                
                toggleBtn.addEventListener('click', () => {
                    this.toggle();
                    toggleBtn.classList.toggle('active');
                    clearBtn.style.display = this.isActive ? 'block' : 'none';
                });
                
                clearBtn.addEventListener('click', () => {
                    this.clear();
                    toggleBtn.classList.remove('active');
                    clearBtn.style.display = 'none';
                });
                
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                
                this.toggleBtn = toggleBtn;
                this.clearBtn = clearBtn;
                
                return container;
            }
        });
        
        this.control = new MeasurementControl();
        this.control.addTo(this.map);
    }
    
    setupMapEvents() {
        this.map.on('click', (e) => {
            if (this.isActive) {
                this.addPoint(e.latlng);
            }
        });
    }
    
    toggle() {
        this.isActive = !this.isActive;
        if (!this.isActive) {
            this.map.dragging.enable();
        } else {
            this.map.dragging.disable();
        }
    }
    
    addPoint(latlng) {
        this.points.push(latlng);
        
        // Create marker
        const marker = L.circleMarker(latlng, {
            radius: 6,
            fillColor: '#0066ff',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(this.map);
        
        this.markers.push(marker);
        
        // Update polyline
        if (this.points.length > 1) {
            if (this.polyline) {
                this.polyline.setLatLngs(this.points);
            } else {
                this.polyline = L.polyline(this.points, {
                    color: '#0066ff',
                    weight: 2,
                    opacity: 0.7,
                    dashArray: '5, 5'
                }).addTo(this.map);
            }
        }
        
        this.updateMeasurements();
        this.showInfo();
    }
    
    updateMeasurements() {
        if (this.points.length < 2) {
            this.totalDistance = 0;
            this.area = 0;
            return;
        }
        
        // Calculate total distance
        this.totalDistance = 0;
        for (let i = 0; i < this.points.length - 1; i++) {
            this.totalDistance += this.getDistance(this.points[i], this.points[i + 1]);
        }
        
        // Calculate area if 3+ points
        if (this.points.length >= 3) {
            this.area = this.getArea(this.points);
        } else {
            this.area = 0;
        }
    }
    
    getDistance(latlng1, latlng2) {
        // Haversine formula for distance between two points
        const R = 6371; // Earth's radius in km
        const dLat = (latlng2.lat - latlng1.lat) * Math.PI / 180;
        const dLng = (latlng2.lng - latlng1.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(latlng1.lat * Math.PI / 180) * Math.cos(latlng2.lat * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    
    getArea(points) {
        // Shoelace formula for polygon area
        if (points.length < 3) return 0;
        
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].lng * points[j].lat;
            area -= points[j].lng * points[i].lat;
        }
        
        // Convert to km²
        const R = 6371;
        area = Math.abs(area) / 2;
        area = area * (Math.PI / 180) * R * R;
        
        return area;
    }
    
    showInfo() {
        if (!this.infoDisplay) {
            this.infoDisplay = L.control({ position: 'topright' });
            this.infoDisplay.onAdd = () => {
                const div = L.DomUtil.create('div', 'measurement-info');
                this.infoDiv = div;
                return div;
            };
            this.infoDisplay.addTo(this.map);
        }
        
        let html = '<div class="measurement-info-content">';
        html += `<div class="measurement-title">Measurement</div>`;
        html += `<div class="measurement-stat">Points: ${this.points.length}</div>`;
        
        if (this.totalDistance > 0) {
            const km = this.totalDistance.toFixed(2);
            const m = (this.totalDistance * 1000).toFixed(0);
            html += `<div class="measurement-stat">Distance: ${km} km (${m} m)</div>`;
        }
        
        if (this.area > 0) {
            const km2 = this.area.toFixed(2);
            const hectares = (this.area * 100).toFixed(2);
            html += `<div class="measurement-stat">Area: ${km2} km² (${hectares} ha)</div>`;
        }
        
        html += '<div class="measurement-hint">Click map to add points • Click ✕ to clear</div>';
        html += '</div>';
        
        this.infoDiv.innerHTML = html;
    }
    
    clear() {
        this.points = [];
        this.totalDistance = 0;
        this.area = 0;
        
        // Remove markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        
        // Remove polyline
        if (this.polyline) {
            this.map.removeLayer(this.polyline);
            this.polyline = null;
        }
        
        // Remove info display
        if (this.infoDisplay) {
            this.map.removeControl(this.infoDisplay);
            this.infoDisplay = null;
        }
        
        this.isActive = false;
        if (this.toggleBtn) {
            this.toggleBtn.classList.remove('active');
        }
        if (this.clearBtn) {
            this.clearBtn.style.display = 'none';
        }
        this.map.dragging.enable();
    }
}

