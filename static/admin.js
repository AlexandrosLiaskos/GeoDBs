/**
 * Admin Dashboard JavaScript Module
 * Handles admin-only submission management with approval/rejection/review functionality
 */

class AdminSubmissionsManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.totalItems = 0;
        this.submissions = [];
        this.stats = {};
        this.currentSubmission = null;
        
        this.init();
    }
    
    async init() {
        // Check admin authentication
        if (!window.authManager || !window.authManager.isAdmin()) {
            window.location.href = './admin-login.html';
            return;
        }
        
        this.attachEventListeners();
        await this.loadStats();
        await this.loadSubmissions();
    }
    
    attachEventListeners() {
        // Tab switching functionality
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                this.switchTab(targetTab);
            });
        });
        
        // Mobile sidebar toggle
        const mobileToggle = document.getElementById('mobile-filters-toggle');
        const sidebar = document.getElementById('sidebar-filters');
        const mobileClose = document.getElementById('mobile-sidebar-close');
        
        if (mobileToggle && sidebar) {
            mobileToggle.addEventListener('click', () => {
                sidebar.classList.add('active');
            });
        }
        
        if (mobileClose && sidebar) {
            mobileClose.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        }
        
        // Filter changes - auto-apply
        const statusFilter = document.getElementById('status-filter');
        const typeFilter = document.getElementById('type-filter');
        const searchInput = document.getElementById('search-input');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.currentPage = 1;
                this.loadSubmissions();
            });
        }
        
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.currentPage = 1;
                this.loadSubmissions();
            });
        }
        
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.currentPage = 1;
                    this.loadSubmissions();
                }, 500);
            });
        }
        
        // Pagination
        const prevButton = document.getElementById('prev-page');
        const nextButton = document.getElementById('next-page');
        
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.loadSubmissions();
                }
            });
        }
        
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.loadSubmissions();
                }
            });
        }
        
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        // Review modal close buttons
        const reviewModalClose = document.getElementById('review-modal-close');
        const reviewCancel = document.getElementById('review-cancel');
        
        if (reviewModalClose) {
            reviewModalClose.addEventListener('click', () => this.closeReviewModal());
        }
        
        if (reviewCancel) {
            reviewCancel.addEventListener('click', () => this.closeReviewModal());
        }
        
        // Review form submission
        const reviewForm = document.getElementById('review-form');
        if (reviewForm) {
            reviewForm.addEventListener('submit', (e) => this.submitReview(e));
        }
        
        // Confirm modal buttons
        const confirmOk = document.getElementById('confirm-ok');
        const confirmCancel = document.getElementById('confirm-cancel');
        const confirmModalClose = document.getElementById('confirm-modal-close');
        
        if (confirmOk) {
            confirmOk.addEventListener('click', () => {
                // Handled in showConfirmation method
            });
        }
        
        if (confirmCancel) {
            confirmCancel.addEventListener('click', () => {
                // Handled in showConfirmation method
            });
        }
        
        if (confirmModalClose) {
            confirmModalClose.addEventListener('click', () => {
                // Handled in showConfirmation method
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
    
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            if (button.dataset.tab === tabName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const targetContent = document.getElementById(`${tabName}-tab`);
        if (targetContent) {
            targetContent.style.display = 'block';
        }
    }
    
    async loadStats() {
        try {
            // Overall stats query
            const { data: overallData, error: overallError, count: totalCount } = await window.supabaseClient
                .from('submissions')
                .select('status, contributor_email', { count: 'exact' });
            if (overallError) throw overallError;
            const approved = overallData.filter(s => s.status === 'approved').length;
            const pending = overallData.filter(s => s.status === 'pending').length;
            const rejected = overallData.filter(s => s.status === 'rejected').length;
            const needsInfo = overallData.filter(s => s.status === 'needs_info').length;
            const uniqueContributors = new Set(overallData.map(s => s.contributor_email)).size;
            this.stats.overall = {
                total_submissions: totalCount,
                approved,
                pending,
                rejected,
                needs_info: needsInfo,
                unique_contributors: uniqueContributors
            };

            // By type stats
            const { data: typeData, error: typeError } = await window.supabaseClient
                .from('submissions')
                .select('submission_type, status');
            if (typeError) throw typeError;
            const byType = typeData.reduce((acc, s) => {
                const type = s.submission_type;
                if (!acc[type]) acc[type] = { submission_type: type, count: 0, approved_count: 0 };
                acc[type].count++;
                if (s.status === 'approved') acc[type].approved_count++;
                return acc;
            }, {});
            this.stats.by_type = Object.values(byType);

            // Recent activity (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { data: recentData, error: recentError } = await window.supabaseClient
                .from('submissions')
                .select('submission_date')
                .gte('submission_date', thirtyDaysAgo);
            if (recentError) throw recentError;
            const recentActivity = recentData.reduce((acc, s) => {
                const date = new Date(s.submission_date).toISOString().split('T')[0];
                if (!acc[date]) acc[date] = { date, submissions: 0 };
                acc[date].submissions++;
                return acc;
            }, {});
            this.stats.recent_activity = Object.values(recentActivity).sort((a, b) => new Date(b.date) - new Date(a.date));

            // Top contributors
            const { data: contribData, error: contribError } = await window.supabaseClient
                .from('submissions')
                .select('contributor_name, contributor_organization, contributor_email, status')
                .not('contributor_name', 'is', null)
                .not('contributor_name', 'eq', '');
            if (contribError) throw contribError;
            const contributors = contribData.reduce((acc, s) => {
                const email = s.contributor_email;
                if (!acc[email]) {
                    acc[email] = {
                        contributor_name: s.contributor_name,
                        contributor_organization: s.contributor_organization,
                        total_submissions: 0,
                        approved_count: 0
                    };
                }
                acc[email].total_submissions++;
                if (s.status === 'approved') acc[email].approved_count++;
                return acc;
            }, {});
            this.stats.top_contributors = Object.values(contributors)
                .sort((a, b) => b.approved_count - a.approved_count || b.total_submissions - a.total_submissions)
                .slice(0, 10);

            this.updateStatsDisplay();
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    updateStatsDisplay() {
        if (this.stats.overall) {
            const totalCount = document.getElementById('total-count');
            const pendingCount = document.getElementById('pending-count');
            const approvedCount = document.getElementById('approved-count');
            const rejectedCount = document.getElementById('rejected-count');
            const needsInfoCount = document.getElementById('needs-info-count');
            const contributorsCount = document.getElementById('contributors-count');
            
            if (totalCount) totalCount.textContent = this.stats.overall.total_submissions || 0;
            if (pendingCount) pendingCount.textContent = this.stats.overall.pending || 0;
            if (approvedCount) approvedCount.textContent = this.stats.overall.approved || 0;
            if (rejectedCount) rejectedCount.textContent = this.stats.overall.rejected || 0;
            if (needsInfoCount) needsInfoCount.textContent = this.stats.overall.needs_info || 0;
            if (contributorsCount) contributorsCount.textContent = this.stats.overall.unique_contributors || 0;
        }
    }
    
    async loadSubmissions() {
        const loading = document.getElementById('loading');
        const emptyState = document.getElementById('empty-state');
        const tbody = document.getElementById('admin-submissions-tbody');
        const table = document.getElementById('admin-submissions-table');
        const showingCount = document.getElementById('showing-count');

        if (loading) loading.style.display = 'flex';
        if (emptyState) emptyState.style.display = 'none';
        if (table) table.style.display = 'none';

        try {
            const statusFilter = document.getElementById('status-filter');
            const typeFilter = document.getElementById('type-filter');
            const searchInput = document.getElementById('search-input');

            // Base query with LEFT JOIN
            let query = window.supabaseClient
                .from('submissions')
                .select('id, submission_type, flood_event_id, title, description, submission_date, contributor_name, contributor_email, contributor_organization, status, review_notes, reviewed_by, review_date, floods(id, location_name, year, cause_of_flood, deaths_toll)')
                .order('submission_date', { ascending: false });

            // Add filters
            if (statusFilter && statusFilter.value && statusFilter.value !== '') {
                query = query.eq('status', statusFilter.value);
            }
            if (typeFilter && typeFilter.value) {
                query = query.eq('submission_type', typeFilter.value);
            }
            if (searchInput && searchInput.value) {
                const searchTerm = searchInput.value;
                query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
            }

            // Pagination
            const offset = (this.currentPage - 1) * this.itemsPerPage;
            query = query.range(offset, offset + this.itemsPerPage - 1);

            // Execute query
            const { data, error } = await query;
            if (error) throw error;

            // Get total count for pagination
            let countQuery = window.supabaseClient
                .from('submissions')
                .select('*', { count: 'exact', head: true });

            if (statusFilter && statusFilter.value && statusFilter.value !== '') {
                countQuery = countQuery.eq('status', statusFilter.value);
            }
            if (typeFilter && typeFilter.value) {
                countQuery = countQuery.eq('submission_type', typeFilter.value);
            }
            if (searchInput && searchInput.value) {
                const searchTerm = searchInput.value;
                countQuery = countQuery.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
            }

            const { count, error: countError } = await countQuery;
            if (countError) throw countError;

            // Transform data to flatten floods
            this.submissions = data.map(s => ({
                ...s,
                location_name: s.floods?.location_name,
                year: s.floods?.year,
                cause_of_flood: s.floods?.cause_of_flood,
                deaths_toll: s.floods?.deaths_toll
            }));
            this.totalItems = count;

            this.renderSubmissions();
            this.updatePagination();

            if (showingCount) {
                showingCount.textContent = `Showing ${this.submissions.length} submission${this.submissions.length !== 1 ? 's' : ''}`;
            }
        } catch (error) {
            console.error('Error loading submissions:', error);
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Error loading submissions</td></tr>';
            }
        } finally {
            if (loading) loading.style.display = 'none';

            if (this.submissions.length === 0) {
                if (emptyState) emptyState.style.display = 'flex';
                if (table) table.style.display = 'none';
            } else {
                if (emptyState) emptyState.style.display = 'none';
                if (table) table.style.display = 'table';
            }
        }
    }
    
    renderSubmissions() {
        const tbody = document.getElementById('admin-submissions-tbody');
        if (!tbody) return;
        
        if (this.submissions.length === 0) {
            tbody.innerHTML = '';
            return;
        }
        
        tbody.innerHTML = this.submissions.map(submission => `
            <tr>
                <td>${this.formatDate(submission.submission_date)}</td>
                <td><span class="type-indicator ${submission.submission_type}">${submission.submission_type}</span></td>
                <td>
                    ${submission.flood_event_id ? `#${submission.flood_event_id}` : 'New'}
                    ${submission.floods?.location_name ? ` - ${submission.floods.location_name}` : ''}
                </td>
                <td class="hide-mobile">${this.truncateText(submission.description, 60)}</td>
                <td class="hide-mobile">${submission.contributor_name || 'Anonymous'}</td>
                <td><span class="status-indicator ${submission.status}">${this.formatStatus(submission.status)}</span></td>
                <td>
                    <div class="admin-actions">
                        <button class="action-button" onclick="adminManager.viewDetails(${submission.id})" title="View Details">View</button>
                        ${submission.status !== 'approved' ? `<button class="action-button action-approve" onclick="adminManager.approveSubmission(${submission.id})" title="Approve">✓</button>` : ''}
                        ${submission.status !== 'rejected' ? `<button class="action-button action-reject" onclick="adminManager.rejectSubmission(${submission.id})" title="Reject">✗</button>` : ''}
                        <button class="action-button" onclick="adminManager.openReviewModal(${submission.id})" title="Review">Review</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    updatePagination() {
        const prevButton = document.getElementById('prev-page');
        const nextButton = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');
        
        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage) || 1;
        
        if (prevButton) {
            prevButton.disabled = this.currentPage === 1;
        }
        
        if (nextButton) {
            nextButton.disabled = this.currentPage >= totalPages;
        }
        
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        }
    }
    
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    
    formatStatus(status) {
        if (!status) return 'Unknown';
        return status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    }
    
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    async viewDetails(submissionId) {
        // Find the submission in our current data
        const submission = this.submissions.find(s => s.id === submissionId);
        
        if (!submission) {
            alert('Submission not found');
            return;
        }
        
        // Fetch full flood event details if applicable
        let floodEvent = null;
        if (submission.flood_event_id) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('floods')
                    .select('*')
                    .eq('id', submission.flood_event_id)
                    .single();
                if (!error) {
                    floodEvent = data;
                }
            } catch (error) {
                console.error('Error fetching flood event details:', error);
            }
        }
        
        // Build modal content
        const detailsHtml = `
            <div class="detail-section">
                <h4 class="section-title">Submission Details</h4>
                <div class="detail-item detail-item-highlighted">
                    <div class="detail-label">Submission ID</div>
                    <div class="detail-value">#${submission.id}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Type</div>
                    <div class="detail-value">${submission.submission_type.toUpperCase()}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${this.formatStatus(submission.status).toUpperCase()}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Date Submitted</div>
                    <div class="detail-value">${this.formatDate(submission.submission_date)}</div>
                </div>
                ${submission.reviewed_by ? `
                    <div class="detail-item">
                        <div class="detail-label">Reviewed By</div>
                        <div class="detail-value">${submission.reviewed_by}</div>
                    </div>
                ` : ''}
                ${submission.review_date ? `
                    <div class="detail-item">
                        <div class="detail-label">Review Date</div>
                        <div class="detail-value">${this.formatDate(submission.review_date)}</div>
                    </div>
                ` : ''}
                ${submission.flood_event_id ? `
                    <div class="detail-item">
                        <div class="detail-label">Related Event</div>
                        <div class="detail-value">#${submission.flood_event_id}</div>
                    </div>
                ` : ''}
                <div class="detail-item">
                    <div class="detail-label">Title</div>
                    <div class="detail-value">${submission.title || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Description</div>
                    <div class="detail-value">${submission.description || '-'}</div>
                </div>
                ${submission.review_notes ? `
                    <div class="detail-item">
                        <div class="detail-label">Review Notes</div>
                        <div class="detail-value">${submission.review_notes}</div>
                    </div>
                ` : ''}
                <div class="detail-item">
                    <div class="detail-label">Contributor</div>
                    <div class="detail-value">
                        ${submission.contributor_name || 'Anonymous'}
                        ${submission.contributor_organization ? ` - ${submission.contributor_organization}` : ''}
                        ${submission.contributor_email ? `<br><small>${submission.contributor_email}</small>` : ''}
                    </div>
                </div>
            </div>
            ${floodEvent ? `
                <div class="detail-section">
                    <h4 class="section-title">Related Flood Event</h4>
                    <div class="detail-item">
                        <div class="detail-label">Event ID</div>
                        <div class="detail-value">#${floodEvent.id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Location</div>
                        <div class="detail-value">${floodEvent.location_name || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Year</div>
                        <div class="detail-value">${floodEvent.year || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Cause</div>
                        <div class="detail-value">${floodEvent.cause_of_flood || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Deaths</div>
                        <div class="detail-value">${floodEvent.deaths_toll || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Source</div>
                        <div class="detail-value">${floodEvent.source || '-'}</div>
                    </div>
                </div>
            ` : ''}
        `;
        
        // Display in modal
        const modal = document.getElementById('admin-view-modal');
        const modalBody = document.getElementById('admin-view-modal-body');
        
        if (modal && modalBody) {
            modalBody.innerHTML = detailsHtml;
            modal.classList.add('active');
        }
    }
    
    async approveSubmission(submissionId) {
        const submission = this.submissions.find(s => s.id === submissionId);
        if (!submission) return;
        
        // Show confirmation
        const confirmed = await this.showConfirmation(`Approve submission "${submission.title}"?`);
        if (!confirmed) return;
        
        try {
            const { error } = await window.supabaseClient
                .from('submissions')
                .update({
                    status: 'approved',
                    reviewed_by: window.authManager.getUser().email,
                    review_date: new Date().toISOString()
                })
                .eq('id', submissionId);
            
            if (error) throw error;
            
            this.showSuccess('Submission approved successfully');
            await this.loadSubmissions();
            await this.loadStats();
        } catch (error) {
            console.error('Error approving submission:', error);
            this.showError('Failed to approve submission: ' + error.message);
        }
    }
    
    async rejectSubmission(submissionId) {
        const submission = this.submissions.find(s => s.id === submissionId);
        if (!submission) return;
        
        // Show confirmation
        const confirmed = await this.showConfirmation(`Reject submission "${submission.title}"?`);
        if (!confirmed) return;
        
        try {
            const { error } = await window.supabaseClient
                .from('submissions')
                .update({
                    status: 'rejected',
                    reviewed_by: window.authManager.getUser().email,
                    review_date: new Date().toISOString()
                })
                .eq('id', submissionId);
            
            if (error) throw error;
            
            this.showSuccess('Submission rejected successfully');
            await this.loadSubmissions();
            await this.loadStats();
        } catch (error) {
            console.error('Error rejecting submission:', error);
            this.showError('Failed to reject submission: ' + error.message);
        }
    }
    
    openReviewModal(submissionId) {
        const submission = this.submissions.find(s => s.id === submissionId);
        if (!submission) return;
        
        this.currentSubmission = submission;
        
        // Populate submission info
        const infoEl = document.getElementById('review-submission-info');
        if (infoEl) {
            infoEl.innerHTML = `
                <div class="detail-item">
                    <div class="detail-label">Submission</div>
                    <div class="detail-value">#${submission.id} - ${submission.title}</div>
                </div>
            `;
        }
        
        // Set current values
        document.getElementById('review-status').value = submission.status;
        document.getElementById('review-notes').value = submission.review_notes || '';
        
        // Show modal
        document.getElementById('review-modal').classList.add('active');
    }
    
    closeReviewModal() {
        const modal = document.getElementById('review-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    async submitReview(event) {
        event.preventDefault();
        
        const status = document.getElementById('review-status').value;
        const notes = document.getElementById('review-notes').value;
        
        try {
            const { error } = await window.supabaseClient
                .from('submissions')
                .update({
                    status: status,
                    review_notes: notes,
                    reviewed_by: window.authManager.getUser().email,
                    review_date: new Date().toISOString()
                })
                .eq('id', this.currentSubmission.id);
            
            if (error) throw error;
            
            this.showSuccess('Review saved successfully');
            this.closeReviewModal();
            await this.loadSubmissions();
            await this.loadStats();
        } catch (error) {
            console.error('Error saving review:', error);
            this.showError('Failed to save review: ' + error.message);
        }
    }
    
    showConfirmation(message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const messageEl = document.getElementById('confirm-message');
            const okBtn = document.getElementById('confirm-ok');
            const cancelBtn = document.getElementById('confirm-cancel');
            const closeBtn = document.getElementById('confirm-modal-close');
            
            messageEl.textContent = message;
            modal.classList.add('active');
            
            const handleOk = () => {
                cleanup();
                resolve(true);
            };
            
            const handleCancel = () => {
                cleanup();
                resolve(false);
            };
            
            const cleanup = () => {
                modal.classList.remove('active');
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
                closeBtn.removeEventListener('click', handleCancel);
            };
            
            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
            closeBtn.addEventListener('click', handleCancel);
        });
    }
    
    showSuccess(message) {
        // Create or get success banner
        let successBanner = document.getElementById('success-banner');
        if (!successBanner) {
            successBanner = document.createElement('div');
            successBanner.id = 'success-banner';
            successBanner.className = 'success-banner';
            document.body.insertBefore(successBanner, document.body.firstChild);
        }
        
        // Build success banner HTML
        const successHTML = `
            <div class="success-banner-content">
                <div class="success-banner-icon">✓</div>
                <div class="success-banner-message">${message}</div>
                <button class="success-banner-close" aria-label="Close success banner">×</button>
            </div>
        `;
        
        successBanner.innerHTML = successHTML;
        successBanner.classList.add('active');
        
        // Add close button functionality
        const closeButton = successBanner.querySelector('.success-banner-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                successBanner.classList.remove('active');
            });
        }
        
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            successBanner.classList.remove('active');
        }, 3000);
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
    
    async handleLogout() {
        const confirmed = await this.showConfirmation('Are you sure you want to logout?');
        if (!confirmed) return;
        
        const result = await window.authManager.signOut();
        if (result.success) {
            window.location.href = './index.html';
        } else {
            this.showError('Failed to logout: ' + result.error);
        }
    }
    
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for auth to be ready
    const initAdmin = () => {
        if (window.authManager && window.authManager.isAdmin()) {
            window.adminManager = new AdminSubmissionsManager();
        } else {
            window.location.href = './admin-login.html';
        }
    };
    
    if (window.authManager) {
        initAdmin();
    } else {
        window.addEventListener('supabase-ready', () => {
            setTimeout(initAdmin, 100); // Small delay to ensure auth is initialized
        });
    }
});