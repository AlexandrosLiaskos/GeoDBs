/**
 * MobileControls - Mobile-specific UI behavior
 *
 * Handles mobile sidebar toggle, responsive behavior, and touch interactions.
 * Manages the filters/stats toggle buttons and sidebar visibility on mobile.
 */

class MobileControls {
    constructor(eventBus, stateManager) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;

        this.elements = {
            filtersToggle: null,
            searchToggle: null,
            statsToggle: null,
            sidebar: null,
            closeButton: null,
            mapContainer: null
        };

        this.resizeTimer = null;
    }

    init() {
        this.cacheElements();

        if (!this.elements.sidebar) {
            if (window.DEBUG_MODE) {
                console.log('📱 MobileControls: No sidebar found, skipping initialization');
            }
            return;
        }

        this.initEventListeners();
        this.initResizeHandler();

        if (window.DEBUG_MODE) {
            console.log('✅ MobileControls: Initialized');
        }
    }

    cacheElements() {
        this.elements = {
            filtersToggle: document.getElementById('mobile-filters-toggle'),
            searchToggle: document.getElementById('mobile-search-toggle'),
            statsToggle: document.getElementById('mobile-stats-toggle'),
            sidebar: document.getElementById('sidebar'),
            closeButton: document.getElementById('mobile-sidebar-close'),
            mapContainer: document.querySelector('.map-container')
        };
    }

    initEventListeners() {
        const { filtersToggle, searchToggle, statsToggle, sidebar, closeButton } = this.elements;

        if (filtersToggle) {
            filtersToggle.addEventListener('click', () => this.handleFiltersToggle());
        }

        if (searchToggle) {
            searchToggle.addEventListener('click', () => this.handleSearchToggle());
        }

        if (statsToggle) {
            statsToggle.addEventListener('click', () => this.handleStatsToggle());
        }

        if (closeButton) {
            closeButton.addEventListener('click', () => this.closeSidebar());
        }

        document.addEventListener('click', (event) => this.handleOutsideClick(event));
    }

    initResizeHandler() {
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimer);
            this.resizeTimer = setTimeout(() => {
                if (window.innerWidth > 768) {
                    this.closeSidebar();
                }
            }, 250);
        });
    }

    handleFiltersToggle() {
        const { filtersToggle, searchToggle, statsToggle, sidebar } = this.elements;
        const isActive = sidebar.classList.contains('active');

        if (isActive && filtersToggle.classList.contains('active')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
            filtersToggle.classList.add('active');
            searchToggle?.classList.remove('active');
            statsToggle?.classList.remove('active');
            this.switchToTab('filters');
        }
    }

    handleSearchToggle() {
        const { filtersToggle, searchToggle, statsToggle, sidebar } = this.elements;
        const isActive = sidebar.classList.contains('active');

        if (isActive && searchToggle?.classList.contains('active')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
            searchToggle?.classList.add('active');
            filtersToggle?.classList.remove('active');
            statsToggle?.classList.remove('active');
            this.switchToTab('search');
        }
    }

    handleStatsToggle() {
        const { filtersToggle, searchToggle, statsToggle, sidebar } = this.elements;
        const isActive = sidebar.classList.contains('active');

        if (isActive && statsToggle.classList.contains('active')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
            statsToggle.classList.add('active');
            filtersToggle?.classList.remove('active');
            searchToggle?.classList.remove('active');
            this.switchToTab('stats');
        }
    }

    switchToTab(tabName) {
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => content.classList.remove('active'));

        const targetTab = document.getElementById(`${tabName}-tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
    }

    handleOutsideClick(event) {
        if (window.innerWidth > 768) return;

        const { filtersToggle, searchToggle, statsToggle, sidebar } = this.elements;

        const isClickInside = sidebar?.contains(event.target) ||
                             filtersToggle?.contains(event.target) ||
                             searchToggle?.contains(event.target) ||
                             statsToggle?.contains(event.target);

        if (!isClickInside && sidebar?.classList.contains('active')) {
            this.closeSidebar();
        }
    }

    openSidebar() {
        const { sidebar, mapContainer } = this.elements;

        sidebar?.classList.add('active');
        this.stateManager.set('isMobileSidebarOpen', true);

        if (window.innerWidth <= 768 && mapContainer) {
            mapContainer.style.display = 'none';
        }

        this.eventBus.emit('mobile:sidebarOpened');
    }

    closeSidebar() {
        const { filtersToggle, searchToggle, statsToggle, sidebar, mapContainer } = this.elements;

        sidebar?.classList.remove('active');
        filtersToggle?.classList.remove('active');
        searchToggle?.classList.remove('active');
        statsToggle?.classList.remove('active');

        this.stateManager.set('isMobileSidebarOpen', false);

        if (window.innerWidth <= 768 && mapContainer) {
            mapContainer.style.display = 'block';
        }

        this.eventBus.emit('mobile:sidebarClosed');
    }

    isSidebarOpen() {
        return this.elements.sidebar?.classList.contains('active') || false;
    }

    isMobile() {
        return window.innerWidth <= 768;
    }
}

export default MobileControls;
