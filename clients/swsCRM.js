// SWS CRM Frontend Script - Table View

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('./swsCRM_data.json');
        
        if (!response.ok) {
            throw new Error('Failed to load data');
        }

        const data = await response.json();
        renderReport(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('table-body').innerHTML = 
            `<tr><td colspan="9" class="empty-state">Error loading checklist data. Please check if the data source exists.</td></tr>`;
    }
});

function renderReport(data) {
    // 1. Render Header
    const headerEl = document.getElementById('header-section');
    const today = new Date().toLocaleDateString('en-US', {
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric'
    }).replace(/\//g, '-'); // Format: MM-DD-YYYY

    // Use default names if missing from data payload
    const userName = data.userName || (data.user ? data.user.split('@')[0] : 'User');
    const salesRep = data.salesRep || 'Unknown';

    headerEl.innerHTML = `
        <h1 class="report-title">Project Weekly Report ${userName}</h1>
        <div class="report-meta">Sales Reps: ${salesRep}</div>
        <div class="report-meta report-date">Report Date: ${today}</div>
    `;

    // 2. Render Table Body
    const tbody = document.getElementById('table-body');
    if (!data.Projects || data.Projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No projects found.</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    data.Projects.forEach(project => {
        const row = document.createElement('tr');
        
        // Format Notes: Replace common delimiters if needed. 
        // The previous sample used "Space , Space" as a separator.
        // We will replace " , " with newlines.
        let formattedNotes = project.Notes ? project.Notes.replace(/ , /g, '\n\n') : '';

        // Add row content
        row.innerHTML = `
            <td>${project.Customer || ''}</td>
            <td>${project.JobStatus || ''}</td>
            <td>${project.ProjectStatus || ''}</td>
            <td>${project.SSA || ''}</td>
            <td>${project.SolarInstall || ''}</td>
            <td>${project.FinalDate || ''}</td>
            <td></td> <!-- PTO Column (Clean, as per screenshot) -->
            <td>${project.StartUp || ''}</td>
            <td class="notes-content">${formattedNotes}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// PDF Generation Function
function generatePDF() {
    const element = document.getElementById('report-container');
    const opt = {
        margin:       [0.2, 0.2, 0.2, 0.2], // minimal margins
        filename:     `Weekly_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 }, // Higher scale for better clarity
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' } // Landscape for wide table
    };

    // New Promise-based usage:
    html2pdf().set(opt).from(element).save();
}
