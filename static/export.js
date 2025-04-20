/**
 * Export functionality for PubMed Annotation Visualizer
 */

// Export data in various formats
function exportData(format) {
    if (!window.currentPaper) {
        alert('No paper data available to export.');
        return;
    }
    
    let exportContent;
    let filename;
    let mimeType;
    
    switch (format) {
        case 'json':
            exportContent = JSON.stringify(prepareExportData(), null, 2);
            filename = `paper_${window.currentPaper.pmid || 'unknown'}.json`;
            mimeType = 'application/json';
            break;
            
        case 'csv':
            exportContent = convertToCSV(prepareExportData());
            filename = `paper_${window.currentPaper.pmid || 'unknown'}.csv`;
            mimeType = 'text/csv';
            break;
            
        case 'txt':
            exportContent = convertToPlainText(prepareExportData());
            filename = `paper_${window.currentPaper.pmid || 'unknown'}.txt`;
            mimeType = 'text/plain';
            break;
            
        case 'html':
            exportContent = convertToHTML(prepareExportData());
            filename = `paper_${window.currentPaper.pmid || 'unknown'}.html`;
            mimeType = 'text/html';
            break;
            
        default:
            alert('Unsupported export format.');
            return;
    }
    
    // Create download link
    downloadFile(exportContent, filename, mimeType);
}

// Prepare data for export
function prepareExportData() {
    const data = window.currentPaper;
    
    if (!data) return {};
    
    // Get entity statistics
    const entityStats = data.entity_statistics || {};
    
    // Collect entities from title and abstract
    const collectEntities = (html) => {
        const entities = [];
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const entityElements = tempDiv.querySelectorAll('.entity');
        entityElements.forEach(el => {
            entities.push({
                text: el.textContent.replace(/[A-Z]+$/, '').trim(),
                label: el.dataset.entityLabel || el.querySelector('.label').textContent,
                source: el.dataset.entitySource || 'unknown'
            });
        });
        
        return entities;
    };
    
    const titleEntities = data.viz_title_html ? collectEntities(data.viz_title_html) : [];
    const abstractEntities = data.viz_abstract_html ? collectEntities(data.viz_abstract_html) : [];
    
    // Combine all data for export
    return {
        pmid: data.pmid,
        title: data.title,
        abstract: data.abstract,
        journal: data.journal,
        source: data.source,
        entities: {
            title: titleEntities,
            abstract: abstractEntities
        },
        statistics: entityStats
    };
}

// Convert to CSV format
function convertToCSV(data) {
    if (!data) return '';
    
    // Create header and basic paper info
    let csv = 'PMID,Title,Journal,Source\n';
    csv += `"${data.pmid || ''}","${escapeCSV(data.title || '')}","${escapeCSV(data.journal || '')}","${data.source || ''}"\n\n`;
    
    // Add abstract
    csv += 'Abstract\n';
    csv += `"${escapeCSV(data.abstract || '')}"\n\n`;
    
    // Add entities
    csv += 'Entity,Label,Source,Location\n';
    
    // Title entities
    if (data.entities && data.entities.title) {
        data.entities.title.forEach(entity => {
            csv += `"${escapeCSV(entity.text)}","${entity.label}","${entity.source}","title"\n`;
        });
    }
    
    // Abstract entities
    if (data.entities && data.entities.abstract) {
        data.entities.abstract.forEach(entity => {
            csv += `"${escapeCSV(entity.text)}","${entity.label}","${entity.source}","abstract"\n`;
        });
    }
    
    // Add statistics
    if (data.statistics) {
        csv += '\nEntity Type,Count\n';
        
        Object.entries(data.statistics).forEach(([label, stats]) => {
            csv += `"${label}","${stats.count}"\n`;
        });
        
        // Add common terms
        csv += '\nEntity Type,Term,Count\n';
        
        Object.entries(data.statistics).forEach(([label, stats]) => {
            if (stats.terms && stats.terms.length > 0) {
                stats.terms.slice(0, 5).forEach(term => {
                    csv += `"${label}","${escapeCSV(term.term)}","${term.count}"\n`;
                });
            }
        });
    }
    
    return csv;
}

// Convert to plain text format
function convertToPlainText(data) {
    if (!data) return '';
    
    let text = '';
    
    // Paper info
    text += `PMID: ${data.pmid || 'N/A'}\n`;
    text += `Title: ${data.title || 'N/A'}\n`;
    text += `Journal: ${data.journal || 'N/A'}\n`;
    text += `Source: ${data.source || 'N/A'}\n\n`;
    
    // Abstract
    text += `Abstract:\n${data.abstract || 'N/A'}\n\n`;
    
    // Entities
    text += `Entities:\n`;
    text += `Location\tEntity\tLabel\tSource\n`;
    text += `-----------------------------------------------\n`;
    
    // Title entities
    if (data.entities && data.entities.title && data.entities.title.length > 0) {
        data.entities.title.forEach(entity => {
            text += `Title\t${entity.text}\t${entity.label}\t${entity.source}\n`;
        });
    } else {
        text += `Title\tNo entities found\n`;
    }
    
    // Abstract entities
    if (data.entities && data.entities.abstract && data.entities.abstract.length > 0) {
        data.entities.abstract.forEach(entity => {
            text += `Abstract\t${entity.text}\t${entity.label}\t${entity.source}\n`;
        });
    } else {
        text += `Abstract\tNo entities found\n`;
    }
    
    // Statistics
    text += `\nEntity Statistics:\n`;
    text += `Entity Type\tCount\n`;
    text += `-----------------------------------------------\n`;
    
    if (data.statistics) {
        Object.entries(data.statistics).forEach(([label, stats]) => {
            text += `${label}\t${stats.count}\n`;
        });
        
        // Most common terms
        text += `\nMost Common Terms by Entity Type:\n`;
        text += `Entity Type\tTerm\tCount\n`;
        text += `-----------------------------------------------\n`;
        
        Object.entries(data.statistics).forEach(([label, stats]) => {
            if (stats.terms && stats.terms.length > 0) {
                stats.terms.slice(0, 3).forEach(term => {
                    text += `${label}\t${term.term}\t${term.count}\n`;
                });
            } else {
                text += `${label}\tNo terms found\n`;
            }
        });
    } else {
        text += `No statistics available\n`;
    }
    
    return text;
}

// Convert to HTML format
function convertToHTML(data) {
    if (!data) return '';
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Paper Analysis - PMID: ${data.pmid || 'Unknown'}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
        .container { max-width: 1000px; margin: 0 auto; }
        h1, h2, h3 { color: #0056b3; }
        .metadata { margin-bottom: 20px; }
        .metadata p { margin: 5px 0; }
        .abstract { background-color: #f8f9fa; padding: 15px; border-left: 3px solid #0056b3; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        .entity { padding: 2px 4px; margin: 0 2px; border-radius: 3px; display: inline-block; }
        .TRAIT { background-color: #e0e0ff; border: 1px solid #a0a0cc; }
        .CANCER { background-color: #ffebee; border: 1px solid #ffcdd2; }
        .GENE_OR_GENE_PRODUCT { background-color: #fff8e1; border: 1px solid #ffecb3; }
        .SIMPLE_CHEMICAL { background-color: #e0f7fa; border: 1px solid #b2ebf2; }
        .footer { margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; color: #777; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Paper Analysis</h1>
        
        <div class="metadata">
            <p><strong>PMID:</strong> ${data.pmid || 'N/A'}</p>
            <p><strong>Title:</strong> ${escapeHTML(data.title || 'N/A')}</p>
            <p><strong>Journal:</strong> ${escapeHTML(data.journal || 'N/A')}</p>
            <p><strong>Source:</strong> ${data.source || 'N/A'}</p>
        </div>
        
        <h2>Abstract</h2>
        <div class="abstract">
            ${escapeHTML(data.abstract || 'No abstract available')}
        </div>
        
        <h2>Entity Analysis</h2>`;
    
    // Add title entities
    html += `
        <h3>Title Entities</h3>`;
    
    if (data.entities && data.entities.title && data.entities.title.length > 0) {
        html += `
        <table>
            <tr>
                <th>Entity</th>
                <th>Label</th>
                <th>Source</th>
            </tr>`;
        
        data.entities.title.forEach(entity => {
            html += `
            <tr>
                <td><span class="entity ${entity.label}">${escapeHTML(entity.text)}</span></td>
                <td>${entity.label}</td>
                <td>${entity.source}</td>
            </tr>`;
        });
        
        html += `
        </table>`;
    } else {
        html += `
        <p>No entities found in title</p>`;
    }
    
    // Add abstract entities
    html += `
        <h3>Abstract Entities</h3>`;
    
    if (data.entities && data.entities.abstract && data.entities.abstract.length > 0) {
        html += `
        <table>
            <tr>
                <th>Entity</th>
                <th>Label</th>
                <th>Source</th>
            </tr>`;
        
        data.entities.abstract.forEach(entity => {
            html += `
            <tr>
                <td><span class="entity ${entity.label}">${escapeHTML(entity.text)}</span></td>
                <td>${entity.label}</td>
                <td>${entity.source}</td>
            </tr>`;
        });
        
        html += `
        </table>`;
    } else {
        html += `
        <p>No entities found in abstract</p>`;
    }
    
    // Add statistics
    html += `
        <h2>Entity Statistics</h2>`;
    
    if (data.statistics && Object.keys(data.statistics).length > 0) {
        html += `
        <table>
            <tr>
                <th>Entity Type</th>
                <th>Count</th>
            </tr>`;
        
        Object.entries(data.statistics).forEach(([label, stats]) => {
            html += `
            <tr>
                <td>${label}</td>
                <td>${stats.count}</td>
            </tr>`;
        });
        
        html += `
        </table>
        
        <h3>Top Terms by Entity Type</h3>`;
        
        Object.entries(data.statistics).forEach(([label, stats]) => {
            html += `
        <h4>${label}</h4>`;
            
            if (stats.terms && stats.terms.length > 0) {
                html += `
        <table>
            <tr>
                <th>Term</th>
                <th>Count</th>
            </tr>`;
                
                stats.terms.slice(0, 5).forEach(term => {
                    html += `
            <tr>
                <td>${escapeHTML(term.term)}</td>
                <td>${term.count}</td>
            </tr>`;
                });
                
                html += `
        </table>`;
            } else {
                html += `
        <p>No terms found for this entity type</p>`;
            }
        });
    } else {
        html += `
        <p>No statistics available</p>`;
    }
    
    // Close HTML
    html += `
        <div class="footer">
            <p>Generated by PubMed Annotation Visualizer - ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
    
    return html;
}

// Helper function to escape text for CSV
function escapeCSV(text) {
    if (!text) return '';
    return text.replace(/"/g, '""');
}

// Helper function to escape text for HTML
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Create download for the exported file
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    
    // Append to body, click, and remove
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// Initialize export dropdown menu
function initExportFunctionality() {
    const btnExport = document.getElementById('btn-export-data');
    if (!btnExport) return;
    
    // Create export options dropdown
    const exportOptions = document.createElement('div');
    exportOptions.id = 'export-options';
    exportOptions.className = 'export-options';
    
    // Add export format options
    const formats = [
        { id: 'json', name: 'JSON' },
        { id: 'csv', name: 'CSV' },
        { id: 'txt', name: 'Plain Text' },
        { id: 'html', name: 'HTML Report' }
    ];
    
    formats.forEach(format => {
        const option = document.createElement('div');
        option.className = 'export-option';
        option.dataset.format = format.id;
        option.textContent = format.name;
        option.addEventListener('click', () => {
            exportData(format.id);
            exportOptions.classList.remove('show');
        });
        exportOptions.appendChild(option);
    });
    
    // Add the dropdown to the document
    document.body.appendChild(exportOptions);
    
    // Toggle dropdown when button clicked
    btnExport.addEventListener('click', (e) => {
        e.preventDefault();
        
        const rect = btnExport.getBoundingClientRect();
        exportOptions.style.top = `${rect.bottom + window.scrollY}px`;
        exportOptions.style.left = `${rect.left + window.scrollX}px`;
        
        exportOptions.classList.toggle('show');
        
        // Close when clicking outside
        window.addEventListener('click', function closeDropdown(e) {
            if (!exportOptions.contains(e.target) && e.target !== btnExport) {
                exportOptions.classList.remove('show');
                window.removeEventListener('click', closeDropdown);
            }
        });
    });
}

// Call this function when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initExportFunctionality();
});