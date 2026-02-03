// SWS CRM Frontend Script - Table View

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('./swsCRM_data.json');
        
        if (!response.ok) {
            throw new Error('Failed to load data');
        }

        const data = await response.json();
        
        // Store data globally for PDF generation
        window.reportData = data;

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
        
        // Format Notes for HTML display
        let formattedNotes = project.Notes ? project.Notes.replace(/ , /g, '\n\n') : '';

        // Add row content
        row.innerHTML = `
            <td>${project.Customer || ''}</td>
            <td>${project.JobStatus || ''}</td>
            <td>${project.ProjectStatus || ''}</td>
            <td>${project.SSA || ''}</td>
            <td>${project.SolarInstall || ''}</td>
            <td>${project.FinalDate || ''}</td>
            <td></td> <!-- PTO Column -->
            <td>${project.StartUp || ''}</td>
            <td class="notes-content">${formattedNotes}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// PDF Generation Function
function generatePDF() {
    try {
        if (!window.jspdf) {
            alert("PDF Library not loaded. Please refresh the page.");
            return;
        }

        if (!window.reportData) {
            alert("Project data not loaded yet.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const data = window.reportData;
        
        // Create document: Landscape, Letter size
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'in',
            format: 'letter'
        });

        // 1. Header Info
        const today = new Date().toLocaleDateString('en-US', {
            month: '2-digit', day: '2-digit', year: 'numeric'
        }).replace(/\//g, '-');
        
        const userName = data.userName || (data.user ? data.user.split('@')[0] : 'User');
        const salesRep = data.salesRep || 'Unknown';
        const title = `Project Weekly Report ${userName}`;

        // 2. Add Header Text to PDF
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(title, 0.5, 0.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Sales Reps: ${salesRep}`, 0.5, 0.8);
        doc.text(`Report Date: ${today}`, 0.5, 1.0);

        // 3. Prepare Table Body from Data Directly
        const tableBody = data.Projects.map(project => {
            // Replace ' , ' with newlines for the PDF list effect
            const pdfNotes = project.Notes ? project.Notes.replace(/ , /g, '\n\n') : '';
            
            return [
                project.Customer || '',
                project.JobStatus || '',
                project.ProjectStatus || '',
                project.SSA || '',
                project.SolarInstall || '',
                project.FinalDate || '',
                '', // PTO
                project.StartUp || '',
                pdfNotes
            ];
        });

        // 4. Generate Table
        doc.autoTable({
            head: [['Project Address', 'Job Status', 'Project Status', 'SSA', 'Solar Install', 'Final', 'PTO', 'Start-Up / Monitor', 'Project Notes']],
            body: tableBody,
            startY: 1.2,
            theme: 'grid', 
            styles: {
                font: 'helvetica',
                fontSize: 8,
                cellPadding: 0.08, 
                lineColor: [0, 0, 0], 
                lineWidth: 0.005,
                valign: 'top',
                overflow: 'linebreak' // This ensures \n creates new lines
            },
            headStyles: {
                fillColor: [255, 255, 255], 
                textColor: [0, 0, 0], 
                fontStyle: 'bold',
                lineWidth: 0.005,
                lineColor: [0, 0, 0]
            },
            columnStyles: {
                0: { cellWidth: 1.5 }, // Project Address
                1: { cellWidth: 0.8 }, // Job Status
                2: { cellWidth: 1.0 }, // Project Status
                3: { cellWidth: 0.6 }, // SSA
                4: { cellWidth: 0.6 }, // Install
                5: { cellWidth: 0.6 }, // Final
                6: { cellWidth: 0.5 }, // PTO
                7: { cellWidth: 0.8 }, // Start-Up
                8: { cellWidth: 'auto' } // Notes
            },
            showHead: 'everyPage', 
            pageBreak: 'auto',
            rowPageBreak: 'auto',
            margin: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }
        });

        doc.save(`Weekly_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
        console.error("PDF Generation Error:", err);
        alert("Error generating PDF: " + err.message);
    }
}
