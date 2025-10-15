/**
 * Community Submissions Page JavaScript
 * Unified design with proper tab functionality
 */

class SubmissionsManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.totalItems = 0;
        this.submissions = [];
        this.stats = {};
        
        this.init();
    }
    
    async init() {
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
        
        // New submission button
        const newSubmissionBtn = document.getElementById('new-submission-btn');
        if (newSubmissionBtn) {
            newSubmissionBtn.addEventListener('click', () => {
                this.openSubmissionModal();
            });
        }
        
        // Modal close buttons
        const modalClose = document.getElementById('modal-close');
        const btnCancel = document.getElementById('btn-cancel');
        const viewModalClose = document.getElementById('view-modal-close');
        
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.closeSubmissionModal();
            });
        }
        
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                this.closeSubmissionModal();
            });
        }
        
        if (viewModalClose) {
            viewModalClose.addEventListener('click', () => {
                this.closeViewModal();
            });
        }
        
        // Submission form
        const submissionForm = document.getElementById('submission-form');
        if (submissionForm) {
            submissionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitForm();
            });
        }
        
        // Type selector - show/hide event ID field
        const submissionType = document.getElementById('submission-type');
        if (submissionType) {
            submissionType.addEventListener('change', (e) => {
                const eventIdGroup = document.getElementById('event-id-group');
                const eventIdInput = document.getElementById('event-id');
                
                if (e.target.value === 'correction') {
                    eventIdGroup.style.display = 'block';
                    eventIdInput.required = true;
                } else {
                    eventIdGroup.style.display = 'none';
                    eventIdInput.required = false;
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
            const uniqueContributors = new Set(overallData.map(s => s.contributor_email)).size;
            this.stats.overall = {
                total_submissions: totalCount,
                approved,
                pending,
                rejected,
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
            const contributorsCount = document.getElementById('contributors-count');
            
            if (totalCount) totalCount.textContent = this.stats.overall.total_submissions || 0;
            if (pendingCount) pendingCount.textContent = this.stats.overall.pending || 0;
            if (approvedCount) approvedCount.textContent = this.stats.overall.approved || 0;
            if (contributorsCount) contributorsCount.textContent = this.stats.overall.unique_contributors || 0;
        }
    }
    
    async loadSubmissions() {
        const loading = document.getElementById('loading');
        const emptyState = document.getElementById('empty-state');
        const tbody = document.getElementById('submissions-tbody');
        const table = document.getElementById('submissions-table');
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
                .select('id, submission_type, flood_event_id, title, description, submission_date, contributor_name, contributor_organization, status, floods(location_name, year)')
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
                year: s.floods?.year
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
        const tbody = document.getElementById('submissions-tbody');
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
                    ${submission.location_name ? ` - ${submission.location_name}` : ''}
                </td>
                <td class="hide-mobile">${this.truncateText(submission.description, 80)}</td>
                <td class="hide-mobile">${submission.contributor_name || 'Anonymous'}</td>
                <td><span class="status-indicator ${submission.status}">${this.formatStatus(submission.status)}</span></td>
                <td>
                    <button class="action-button" onclick="submissionsManager.viewDetails(${submission.id})">View</button>
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
    
    openSubmissionModal() {
        const modal = document.getElementById('submission-modal');
        if (modal) {
            modal.classList.add('active');
            // Reset form
            const form = document.getElementById('submission-form');
            if (form) form.reset();
            // Hide event ID field by default
            const eventIdGroup = document.getElementById('event-id-group');
            if (eventIdGroup) eventIdGroup.style.display = 'none';
        }
    }
    
    closeSubmissionModal() {
        const modal = document.getElementById('submission-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    closeViewModal() {
        const modal = document.getElementById('view-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    async checkRateLimit(email) {
        // Note: Client-side IP detection is not feasible without external APIs
        // We only check email-based rate limiting here
        // Full rate limiting enforcement will be handled by Row Level Security in the next phase

        try {
            // Check if email is blocked
            const { data: blockedData, error: blockedError } = await window.supabaseClient
                .from('submission_rate_limits')
                .select('blocked_until')
                .eq('identifier', email)
                .eq('identifier_type', 'email')
                .gt('blocked_until', new Date().toISOString())
                .single();

            if (blockedData) {
                return { allowed: false, message: `Rate limit exceeded. Try again after ${new Date(blockedData.blocked_until).toLocaleString()}` };
            }

            // Check submission count in last 7 days
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: rateLimitData, error: rateLimitError } = await window.supabaseClient
                .from('submission_rate_limits')
                .select('submission_count')
                .eq('identifier', email)
                .eq('identifier_type', 'email')
                .gt('last_submission', sevenDaysAgo)
                .single();

            const MAX_SUBMISSIONS_PER_EMAIL_WEEK = 10;
            if (rateLimitData && rateLimitData.submission_count >= MAX_SUBMISSIONS_PER_EMAIL_WEEK) {
                return { allowed: false, message: 'Rate limit exceeded. You can submit up to 10 contributions per week.' };
            }

            return { allowed: true, message: null };
        } catch (error) {
            // If no rate limit record exists, allow submission
            if (error.code === 'PGRST116') { // Not found
                return { allowed: true, message: null };
            }
            console.error('Error checking rate limit:', error);
            return { allowed: true, message: null }; // Allow on error to avoid blocking legitimate users
        }
    }

    async submitForm() {
        const form = document.getElementById('submission-form');
        if (!form) return;

        // Gather form data
        const formData = {
            type: document.getElementById('submission-type').value,
            flood_event_id: null,
            title: document.getElementById('submission-title').value,
            description: document.getElementById('submission-description').value,
            evidence: document.getElementById('evidence-urls').value,
            contributor: {
                name: document.getElementById('contributor-name').value,
                email: document.getElementById('contributor-email').value,
                organization: document.getElementById('contributor-org').value
            }
        };

        // Add event ID for corrections
        if (formData.type === 'correction') {
            const eventId = document.getElementById('event-id').value;
            if (eventId) {
                formData.flood_event_id = parseInt(eventId);
            }
        }

        // Check rate limit
        const rateLimitCheck = await this.checkRateLimit(formData.contributor.email);
        if (!rateLimitCheck.allowed) {
            alert(rateLimitCheck.message);
            return;
        }

        try {
            // Insert submission
            const submissionData = {
                submission_type: formData.type,
                flood_event_id: formData.flood_event_id,
                title: formData.title,
                description: formData.description,
                evidence_urls: formData.evidence,
                contributor_name: formData.contributor.name,
                contributor_email: formData.contributor.email,
                contributor_organization: formData.contributor.organization,
                suggested_changes: null, // Not currently used in the form
                submission_ip: null // Cannot be obtained client-side
            };

            const { data, error } = await window.supabaseClient
                .from('submissions')
                .insert(submissionData)
                .select()
                .single();

            if (error) throw error;

            const submissionId = data.id;

            // Update rate limit counter
            const rateLimitUpdate = {
                identifier: formData.contributor.email,
                identifier_type: 'email',
                submission_count: 1, // Will be incremented by trigger or handled by upsert logic
                last_submission: new Date().toISOString()
            };

            const { error: upsertError } = await window.supabaseClient
                .from('submission_rate_limits')
                .upsert(rateLimitUpdate, { onConflict: 'identifier,identifier_type' });

            if (upsertError) console.error('Error updating rate limit:', upsertError); // Log but don't fail submission

            alert('Thank you for your submission! It will be reviewed by our team.');
            this.closeSubmissionModal();
            // Reload submissions and stats
            await this.loadStats();
            await this.loadSubmissions();
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('An error occurred. Please try again later.');
        }
    }
    
    async viewDetails(submissionId) {
        // Find the submission in our current data
        const submission = this.submissions.find(s => s.id === submissionId);
        
        if (!submission) {
            alert('Submission not found');
            return;
        }
        
        // Open modal with submission details
        const modal = document.getElementById('view-modal');
        const modalBody = document.getElementById('view-modal-body');
        
        if (modal && modalBody) {
            // Format the details HTML - matching home page flood details style
            const detailsHtml = `
                <div id="submission-details">
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
                    
                    ${submission.flood_event_id ? `
                        <div class="detail-item">
                            <div class="detail-label">Related Event</div>
                            <div class="detail-value">#${submission.flood_event_id}</div>
                        </div>
                    ` : ''}
                    
                    ${submission.location_name ? `
                        <div class="detail-item">
                            <div class="detail-label">Location</div>
                            <div class="detail-value">${submission.location_name} ${submission.year ? `(${submission.year})` : ''}</div>
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
                    
                    <div class="detail-item">
                        <div class="detail-label">Contributor</div>
                        <div class="detail-value">
                            ${submission.contributor_name || 'Anonymous'}
                            ${submission.contributor_organization ? ` - ${submission.contributor_organization}` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            modalBody.innerHTML = detailsHtml;
            modal.classList.add('active');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.submissionsManager = new SubmissionsManager();
});
