/**
 * ModalManager - Centralized modal management
 *
 * Handles opening, closing, and lifecycle of all modals in the application.
 * Provides consistent behavior across different modal types.
 *
 * @example
 * const modalManager = new ModalManager(eventBus);
 * modalManager.init();
 * modalManager.openModal('flood-modal', content);
 */

import { escapeHtml } from '../utils/helpers.js';

class ModalManager {
    constructor(eventBus, cacheManager) {
        this.eventBus = eventBus;
        this.cacheManager = cacheManager;

        this.modals = new Map(); // Cache of modal elements
        this.activeModal = null;

        this.MODAL_IDS = {
            FLOOD_DETAILS: 'flood-modal',
            WELCOME: 'welcome-modal',
            REFERENCES: 'references-modal',
            SUBMIT_DATA: 'submit-data-modal',
            REPORT_BUG: 'report-bug-modal',
            SUBMIT_SUGGESTION: 'submit-suggestion-modal',
            SQL_FILTER: 'sql-filter-modal'
        };
    }

    /**
     * Initialize modal manager and setup global event listeners
     */
    init() {
        // Setup ESC key handler
        document.addEventListener('keydown', (e) => this.handleEscapeKey(e));

        // Cache modal elements
        this.cacheModalElements();

        // Setup close buttons and overlay clicks for all modals
        this.setupModalCloseHandlers();

        // Setup welcome modal auto-show
        this.setupWelcomeModal();

        if (window.DEBUG_MODE) {
            console.log('✅ ModalManager: Initialized');
        }
    }

    /**
     * Cache all modal DOM elements
     * @private
     */
    cacheModalElements() {
        Object.values(this.MODAL_IDS).forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                this.modals.set(modalId, {
                    element: modal,
                    closeBtn: modal.querySelector('[id^="close-"]'),
                    content: modal.querySelector('.modal-content') || modal
                });
            }
        });
    }

    /**
     * Setup close handlers for all modals
     * @private
     */
    setupModalCloseHandlers() {
        this.modals.forEach((modalData, modalId) => {
            const { element, closeBtn } = modalData;

            // Close button handler
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal(modalId));
            }

            // Click outside to close
            element.addEventListener('click', (e) => {
                if (e.target === element) {
                    this.closeModal(modalId);
                }
            });
        });
    }

    /**
     * Setup welcome modal to show on page load
     * @private
     */
    setupWelcomeModal() {
        const welcomeModal = this.modals.get(this.MODAL_IDS.WELCOME);
        if (welcomeModal) {
            // Skip the splash when embedded (?embed=1) so the map is visible
            // immediately inside an iframe preview.
            const isEmbedded = new URLSearchParams(window.location.search).get('embed') === '1';

            if (!isEmbedded) {
                // Show welcome modal with delay
                setTimeout(() => {
                    this.openModal(this.MODAL_IDS.WELCOME);
                }, 300);
            }

            // Setup "Enter Map" button to close welcome modal
            const enterBtn = document.getElementById('enter-webgis');
            if (enterBtn) {
                enterBtn.addEventListener('click', () => {
                    this.closeModal(this.MODAL_IDS.WELCOME);
                });
            }

            // Setup welcome modal's submit data link
            const submitDataLink = document.getElementById('welcome-submit-data-link');
            if (submitDataLink) {
                submitDataLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeModal(this.MODAL_IDS.WELCOME);
                    this.openModal(this.MODAL_IDS.SUBMIT_DATA);
                });
            }
        }
    }

    /**
     * Handle ESC key press to close active modal
     * @param {KeyboardEvent} e - Keyboard event
     * @private
     */
    handleEscapeKey(e) {
        if (e.key === 'Escape' && this.activeModal) {
            this.closeModal(this.activeModal);
        }
    }

    /**
     * Open a modal
     * @param {string} modalId - Modal ID to open
     * @param {Object} options - Modal options
     */
    openModal(modalId, options = {}) {
        const modalData = this.modals.get(modalId);
        if (!modalData) {
            console.warn(`ModalManager: Modal "${modalId}" not found`);
            return;
        }

        // Close any active modal first
        if (this.activeModal && this.activeModal !== modalId) {
            this.closeModal(this.activeModal, { silent: true });
        }

        // Show modal
        modalData.element.classList.add('active');
        document.body.classList.add('modal-open');
        this.activeModal = modalId;

        // Emit event
        this.eventBus.emit('modal:opened', { modalId });

        if (window.DEBUG_MODE) {
            console.log(`📂 ModalManager: Opened modal "${modalId}"`);
        }
    }

    /**
     * Close a modal
     * @param {string} modalId - Modal ID to close
     * @param {Object} options - Close options
     */
    closeModal(modalId, options = {}) {
        const { silent = false } = options;

        const modalData = this.modals.get(modalId);
        if (!modalData) {
            console.warn(`ModalManager: Modal "${modalId}" not found`);
            return;
        }

        // Hide modal
        modalData.element.classList.remove('active');
        document.body.classList.remove('modal-open');

        if (this.activeModal === modalId) {
            this.activeModal = null;
        }

        // Emit event
        if (!silent) {
            this.eventBus.emit('modal:closed', { modalId });
        }

        if (window.DEBUG_MODE) {
            console.log(`📂 ModalManager: Closed modal "${modalId}"`);
        }
    }

    /**
     * Close all modals
     */
    closeAll() {
        this.modals.forEach((_, modalId) => {
            this.closeModal(modalId, { silent: true });
        });
        this.activeModal = null;
    }

    /**
     * Show flood details in modal
     * @param {Object} flood - Flood data object
     */
    showFloodDetails(flood) {
        const html = this.generateFloodDetailsHTML(flood);

        // Get modal elements
        const modalData = this.modals.get(this.MODAL_IDS.FLOOD_DETAILS);
        if (!modalData) {
            console.error('ModalManager: Flood details modal not found');
            return;
        }

        // Update content
        const detailsContainer = document.getElementById('flood-details');
        if (detailsContainer) {
            detailsContainer.innerHTML = html;
        }

        // Open modal
        this.openModal(this.MODAL_IDS.FLOOD_DETAILS);

        // Cache the flood data
        if (this.cacheManager) {
            this.cacheManager.set(`flood-details-${flood.id}`, flood);
        }
    }

    /**
     * Generate HTML for flood details modal
     * @param {Object} flood - Flood data
     * @returns {string} HTML string
     * @private
     */
    generateFloodDetailsHTML(flood) {
        const eventId = flood?.event_id ?? flood?.eventId ?? flood?.id;
        const fields = [
            { key: 'id', label: 'Event ID', highlight: true },
            { key: 'date_of_commencement', label: 'Date' },
            { key: 'year', label: 'Year' },
            { key: 'location_name', label: 'Location' },
            { key: 'flood_event_name', label: 'Event Name' },
            { key: 'deaths_toll_int', label: 'Death Toll' },
            { key: 'cause_of_flood', label: 'Cause' },
            { key: 'source', label: 'Source' },
            { key: 'reference', label: 'Reference', isLink: true }
        ];

        let html = '';
        fields.forEach(field => {
            const rawValue = field.key === 'id' ? eventId : flood[field.key];
            const hasValue = rawValue !== null && rawValue !== undefined && rawValue.toString().trim() !== '';
            const displayValue = hasValue ? rawValue : '-';
            const highlightClass = field.highlight ? 'detail-item-highlighted' : '';

            let valueHtml;
            if (field.isLink && rawValue && rawValue.toString().trim() && rawValue !== '-') {
                // Make reference field a clickable link
                valueHtml = `<a href="${escapeHtml(rawValue)}" target="_blank" rel="noopener noreferrer" style="color: #0066ff; text-decoration: underline;">${escapeHtml(rawValue)}</a>`;
            } else if (field.key === 'id') {
                valueHtml = escapeHtml(displayValue);
            } else {
                valueHtml = escapeHtml(displayValue);
            }

            html += `
                <div class="detail-item ${highlightClass}">
                    <div class="detail-label">${field.label}</div>
                    <div class="detail-value">${valueHtml}</div>
                </div>
            `;
        });

        return html;
    }

    /**
     * Check if a modal is currently open
     * @param {string} modalId - Optional modal ID to check
     * @returns {boolean} True if modal is open
     */
    isModalOpen(modalId = null) {
        if (modalId) {
            return this.activeModal === modalId;
        }
        return this.activeModal !== null;
    }

    /**
     * Get active modal ID
     * @returns {string|null} Active modal ID or null
     */
    getActiveModal() {
        return this.activeModal;
    }

    /**
     * Get modal element
     * @param {string} modalId - Modal ID
     * @returns {HTMLElement|null} Modal element or null
     */
    getModalElement(modalId) {
        const modalData = this.modals.get(modalId);
        return modalData ? modalData.element : null;
    }
}

// Export for ES modules
export default ModalManager;
