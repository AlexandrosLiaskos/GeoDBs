/**
 * EmailHelper - Email templates and CSV download utilities
 *
 * Handles email composition for data submissions, bug reports,
 * and feature suggestions. Also handles CSV template downloads.
 */

class EmailHelper {
    constructor() {
        this.recipients = 'alexliaskos@geol.uoa.gr,evelpidou@geol.uoa.gr';
    }

    downloadCSVTemplate() {
        const headers = [
            'date_of_commencement',
            'latitude',
            'longitude',
            'location_name',
            'flood_event_name',
            'source',
            'deaths_toll_int',
            'cause_of_flood',
            'relevant_information'
        ];

        const exampleRow = [
            '1924-11-04',
            '37.0384673',
            '22.1104259',
            'MESSINIA',
            'KALAMATA',
            'https://example.org/source',
            '16',
            'Heavy rainfall',
            'Example row - delete this and add your data'
        ];

        const csvContent = [
            headers.join(','),
            exampleRow.join(',')
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', 'historic_floods_template.csv');
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }

    openSubmitDataEmail() {
        const subject = encodeURIComponent('Historic Floods Data Submission');

        const body = encodeURIComponent(
`Dear Historic Floods Team,

Please find attached flood data for inclusion in the Historic Floods database.

SUBMISSION DETAILS
==================
Region/Country: [Please specify]
Time Period: [e.g., 1900-2020]
Number of Records: [Please specify]

CONTRIBUTORS
============
Name(s): [Your name and co-contributors]
Affiliation: [University/Institution/Organization]
Contact Email: [Your email address]

ADDITIONAL NOTES
================
[Any additional information about the data, sources, or methodology]

Best regards,
[Your name]

---
Please attach your CSV or Excel file containing the flood data to this email.
Ensure the data follows the template format available at: https://historicfloods.org`
        );

        window.location.href = `mailto:${this.recipients}?subject=${subject}&body=${body}`;
    }

    openReportBugEmail() {
        const subject = encodeURIComponent('Historic Floods - Issue Report');

        const body = encodeURIComponent(
`Dear Historic Floods Team,

I would like to report an issue with the website.

ISSUE DETAILS
=============
Type: [Bug / Data Error]

Description:
[Please describe the problem you encountered]

Where it happened:
[e.g., Map, Filters, Query Builder, specific flood event #123]

Best regards,
[Your name]`
        );

        window.location.href = `mailto:${this.recipients}?subject=${subject}&body=${body}`;
    }

    openSuggestionEmail() {
        const subject = encodeURIComponent('Historic Floods - Feature Suggestion');

        const body = encodeURIComponent(
`Dear Historic Floods Team,

I have a suggestion for the Historic Floods website.

SUGGESTION
==========
Type: [New Feature / Improvement / Data Addition]

Description:
[Please describe your idea]

Why it would be useful:
[How would this help users?]

Best regards,
[Your name]`
        );

        window.location.href = `mailto:${this.recipients}?subject=${subject}&body=${body}`;
    }
}

export default EmailHelper;
