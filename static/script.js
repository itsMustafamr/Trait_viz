document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const pmidForm = document.getElementById('pmid-form');
    const searchForm = document.getElementById('search-form');
    const pmidInput = document.getElementById('pmid');
    const searchInput = document.getElementById('search-term');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error-message');
    const resultsDiv = document.getElementById('results');
    const searchResultsDiv = document.getElementById('search-results');
    const titleDiv = document.getElementById('paper-title');
    const journalDiv = document.getElementById('paper-journal');
    const sourceDiv = document.getElementById('paper-source');
    const abstractDiv = document.getElementById('paper-abstract');
    const vizTitleDiv = document.getElementById('viz-title');
    const vizAbstractDiv = document.getElementById('viz-abstract');
    const entityModal = document.getElementById('entity-modal');
    const entityModalTitle = document.getElementById('entity-modal-title');
    const entityModalContent = document.getElementById('entity-modal-content');
    const closeModal = document.querySelector('.close-modal');
    const sentenceSelect = document.getElementById('sentence-select');
    const btnParseTitle = document.getElementById('btn-parse-title');
    const btnParseSentence = document.getElementById('btn-parse-sentence');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const navTabs = document.querySelectorAll('.tabs a');
    const tabSections = document.querySelectorAll('.tab-content');
    
    // Global state
    let currentPaper = null;
    let abstractSentences = [];
    
    // Initialize tabs
    function initTabs() {
        // Navigation tabs
        navTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const targetId = tab.getAttribute('data-tab');
                tabSections.forEach(section => {
                    section.classList.remove('active');
                });
                document.getElementById(targetId).classList.add('active');
            });
        });
        
        // Analysis tabs
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                const tabId = button.getAttribute('data-tab');
                tabPanels.forEach(panel => {
                    panel.classList.remove('active');
                });
                document.getElementById(tabId).classList.add('active');
            });
        });
    }
    
    // Initialize modal
    function initModal() {
        closeModal.addEventListener('click', () => {
            entityModal.style.display = 'none';
        });
        
        window.addEventListener('click', (event) => {
            if (event.target === entityModal) {
                entityModal.style.display = 'none';
            }
        });
    }
    
    // Initialize entity interactions
    function initEntityInteractions() {
        document.addEventListener('click', async (event) => {
            // Check if clicked element is an entity or its child
            const entityElement = event.target.closest('.interactive-entity');
            if (entityElement) {
                const term = entityElement.textContent.replace(/[A-Z]+$/, '').trim();
                const label = entityElement.dataset.entityLabel;
                const source = entityElement.dataset.entitySource;
                
                try {
                    const response = await fetch('/get_entity_info', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ term, label, source })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}`);
                    }
                    
                    const entityInfo = await response.json();
                    showEntityModal(entityInfo);
                } catch (error) {
                    console.error('Error fetching entity info:', error);
                    showEntityModal({
                        term,
                        label,
                        source,
                        definition: "Error loading entity information"
                    });
                }
            }
        });
    }
    
    // Show entity modal with information
    function showEntityModal(entityInfo) {
        entityModalTitle.textContent = `${entityInfo.term} (${entityInfo.label})`;
        
        let modalContent = `
            <div class="entity-info">
                <div class="info-section">
                    <h3>Basic Information</h3>
                    <p><strong>Label:</strong> ${entityInfo.label}</p>
                    <p><strong>Source:</strong> ${entityInfo.source}</p>
                </div>
        `;
        
        if (entityInfo.definition) {
            modalContent += `
                <div class="info-section">
                    <h3>Definition</h3>
                    <p>${entityInfo.definition}</p>
                </div>
            `;
        }
        
        if (entityInfo.trait_info) {
            const traitInfo = entityInfo.trait_info;
            modalContent += `
                <div class="info-section">
                    <h3>Trait-specific Information</h3>
                    <p><strong>Category:</strong> ${traitInfo.category}</p>
                    <h4>Related Traits</h4>
                    <ul>
                        ${traitInfo.related_traits.map(trait => `<li>${trait}</li>`).join('')}
                    </ul>
                    <h4>Synonyms</h4>
                    <ul>
                        ${traitInfo.synonyms.map(syn => `<li>${syn}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        if (entityInfo.external_links && entityInfo.external_links.length > 0) {
            modalContent += `
                <div class="info-section">
                    <h3>External Resources</h3>
                    <ul>
                        ${entityInfo.external_links.map(link => 
                            `<li><a href="${link.url}" target="_blank">${link.name}</a></li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }
        
        modalContent += '</div>';
        entityModalContent.innerHTML = modalContent;
        entityModal.style.display = 'block';
    }
    
    // Split abstract into sentences for dependency parsing
    function populateSentenceSelector(abstract) {
        sentenceSelect.innerHTML = '<option value="">-- Select a sentence --</option>';
        
        if (!abstract) return;
        
        // Simple sentence splitting (a more sophisticated approach would use NLP)
        abstractSentences = abstract.split(/(?<=[.!?])\s+/);
        
        abstractSentences.forEach((sentence, index) => {
            if (sentence.trim().length > 5) {  // Skip very short sentences
                const option = document.createElement('option');
                option.value = index;
                
                // Truncate long sentences for display
                const displayText = sentence.length > 60 
                    ? sentence.substring(0, 57) + '...' 
                    : sentence;
                    
                option.textContent = displayText;
                sentenceSelect.appendChild(option);
            }
        });
        
        btnParseSentence.disabled = abstractSentences.length === 0;
    }
    
    // Generate entity statistics visualization
    function generateEntityStatistics(entityStats) {
        const statsTab = document.getElementById('tab-statistics');
        const chartContainer = document.getElementById('entity-chart-container');
        const tableContainer = document.getElementById('entity-table-container');
        
        // Reset containers
        tableContainer.innerHTML = '';
        
        if (!entityStats || Object.keys(entityStats).length === 0) {
            tableContainer.innerHTML = '<p>No entities found in this paper.</p>';
            return;
        }
        
        // Create statistics table
        const table = document.createElement('table');
        table.className = 'entity-table';
        
        // Add table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Entity Type</th>
                <th>Count</th>
                <th>Most Common Terms</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Add table body
        const tbody = document.createElement('tbody');
        
        // Prepare data for chart
        const labels = [];
        const data = [];
        const backgroundColors = [];
        
        Object.entries(entityStats).forEach(([label, stats]) => {
            // Add row to table
            const row = document.createElement('tr');
            
            // Get entity color from CSS custom properties if available
            const entityColorVar = `--color-${label.toLowerCase()}`;
            const entityColor = getComputedStyle(document.documentElement)
                .getPropertyValue(entityColorVar) || '#cccccc';
            
            // Generate top terms list
            const topTerms = stats.terms
                .slice(0, 3)
                .map(t => `${t.term} (${t.count})`)
                .join(', ');
            
            row.innerHTML = `
                <td>
                    <span class="entity-color-box" style="background-color: ${entityColor}"></span>
                    ${label}
                </td>
                <td>${stats.count}</td>
                <td>${topTerms}</td>
            `;
            
            tbody.appendChild(row);
            
            // Add data for chart
            labels.push(label);
            data.push(stats.count);
            backgroundColors.push(entityColor);
        });
        
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        
        // Create chart
        const ctx = document.getElementById('entity-chart').getContext('2d');
        
        // Destroy previous chart if it exists
        if (window.entityChart) {
            window.entityChart.destroy();
        }
        
        window.entityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Entity Count',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => adjustColor(color, -30)),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Entity Distribution'
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const label = context.label;
                                const entityStats = window.currentEntityStats[label];
                                if (entityStats && entityStats.terms) {
                                    const topTerms = entityStats.terms
                                        .slice(0, 3)
                                        .map(t => `${t.term}: ${t.count}`)
                                        .join('\n');
                                    return `\nTop terms:\n${topTerms}`;
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Entity Type'
                        }
                    }
                }
            }
        });
        
        // Store entity stats for tooltip access
        window.currentEntityStats = entityStats;
    }
    
    // Helper function to adjust color brightness
    function adjustColor(color, amount) {
        // Remove # if present
        color = color.replace(/^#/, '');
        
        // Parse the color
        let r = parseInt(color.substring(0, 2), 16);
        let g = parseInt(color.substring(2, 4), 16);
        let b = parseInt(color.substring(4, 6), 16);
        
        // Adjust values
        r = Math.max(0, Math.min(255, r + amount));
        g = Math.max(0, Math.min(255, g + amount));
        b = Math.max(0, Math.min(255, b + amount));
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // Handle PMID form submission
    pmidForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default page reload

        // Clear previous results and errors
        errorDiv.textContent = '';
        titleDiv.textContent = '';
        journalDiv.textContent = '';
        sourceDiv.textContent = '';
        abstractDiv.textContent = '';
        vizTitleDiv.innerHTML = ''; // Use innerHTML for rendered HTML
        vizAbstractDiv.innerHTML = '';
        resultsDiv.style.display = 'none'; // Hide results initially
        searchResultsDiv.style.display = 'none'; // Hide search results
        loadingDiv.style.display = 'flex'; // Show loading indicator

        const pmid = pmidInput.value.trim();
        if (!pmid) {
            errorDiv.textContent = 'Please enter a PMID.';
            loadingDiv.style.display = 'none';
            return;
        }

        try {
            const formData = new FormData();
            formData.append('pmid', pmid);

            const response = await fetch('/visualize', {
                method: 'POST',
                body: formData
            });

            loadingDiv.style.display = 'none'; // Hide loading indicator

            if (!response.ok) {
                // Handle HTTP errors
                const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
                errorDiv.textContent = errorData.error || `An error occurred: ${response.statusText}`;
                return;
            }
            
            const data = await response.json();

            if (data.error) {
                errorDiv.textContent = data.error;
            } else {
                // Store paper data globally for export function
                window.currentPaper = {
                    pmid: pmid,
                    ...data
                };  
                
                // Success! Display the results
                titleDiv.textContent = data.title || 'N/A';
                journalDiv.textContent = data.journal || 'N/A';
                
                // Show source of the paper (local or PubMed)
                const sourceText = data.source === 'local' 
                    ? 'Source: Local Database' 
                    : 'Source: PubMed API';
                sourceDiv.textContent = sourceText;
                
                abstractDiv.textContent = data.abstract || 'N/A';
                vizTitleDiv.innerHTML = data.viz_title_html || '';
                vizAbstractDiv.innerHTML = data.viz_abstract_html || '';
                
                // Populate sentence selector for dependency parsing
                populateSentenceSelector(data.abstract);
                
                // Generate entity statistics
                if (data.entity_statistics) {
                    generateEntityStatistics(data.entity_statistics);
                }
                
                // Show results and switch to analysis tab
                resultsDiv.style.display = 'block';
                
                // Switch to analysis tab
                document.querySelector('a[data-tab="analysis-section"]').click();
            }

        } catch (error) {
            // Handle network errors or other unexpected issues
            console.error('Fetch Error:', error);
            errorDiv.textContent = 'An unexpected error occurred while fetching data.';
            loadingDiv.style.display = 'none';
        }
    });
    // Handle search form submission
    if (searchForm) {
        searchForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            // Clear previous results and errors
            errorDiv.textContent = '';
            searchResultsDiv.innerHTML = '<h2>Search Results</h2>';
            resultsDiv.style.display = 'none';
            searchResultsDiv.style.display = 'none';
            loadingDiv.style.display = 'flex';
            
            const term = searchInput.value.trim();
            const searchScopeSelect = document.getElementById('search-scope');
            const searchScope = searchScopeSelect ? searchScopeSelect.value : 'local';
            const startDateInput = document.getElementById('start-date');
            const endDateInput = document.getElementById('end-date');
            const startDate = startDateInput ? startDateInput.value : '';
            const endDate = endDateInput ? endDateInput.value : '';

            if (!term) {
                errorDiv.textContent = 'Please enter a search term.';
                loadingDiv.style.display = 'none';
                return;
            }
            
            try {
                const formData = new FormData();
                formData.append('term', term);
                formData.append('scope', searchScope);
                // Add dates to form data if they exist
                if (startDate) {
                    formData.append('start_date', startDate);
                }
                if (endDate) {
                    formData.append('end_date', endDate);
                }

                const response = await fetch('/search', {
                    method: 'POST',
                    body: formData
                });
                
                loadingDiv.style.display = 'none';
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
                    errorDiv.textContent = errorData.error || `An error occurred: ${response.statusText}`;
                    return;
                }
                
                const data = await response.json();
                
                if (data.count === 0) {
                    searchResultsDiv.innerHTML += '<p>No results found.</p>';
                } else {
                    // Add summary of search results
                    const summaryDiv = document.createElement('div');
                    summaryDiv.className = 'search-summary';
                    
                    let summaryText = `Found ${data.count} results`;
                    if ('local_count' in data && 'pubmed_count' in data) {
                        summaryText += ` (${data.local_count} from local database, ${data.pubmed_count} from PubMed)`;
                    }
                    summaryDiv.textContent = summaryText;
                    searchResultsDiv.appendChild(summaryDiv);
                    
                    const resultsList = document.createElement('ul');
                    resultsList.className = 'search-results-list';
                    
                    data.results.forEach(paper => {
                        const listItem = document.createElement('li');
                        listItem.className = paper.source === 'pubmed' ? 'pubmed-result' : 'local-result';
                        
                        const pmidLink = document.createElement('a');
                        pmidLink.href = '#';
                        pmidLink.textContent = paper.pmid;
                        pmidLink.className = 'pmid-link';
                        pmidLink.dataset.pmid = paper.pmid;
                        
                        // Add click event to the PMID link
                        pmidLink.addEventListener('click', (e) => {
                            e.preventDefault();
                            pmidInput.value = paper.pmid;
                            pmidForm.dispatchEvent(new Event('submit'));
                        });
                        
                        // Create a source badge
                        const sourceBadge = document.createElement('span');
                        sourceBadge.className = `source-badge ${paper.source}-badge`;
                        sourceBadge.textContent = paper.source === 'pubmed' ? 'PubMed' : 'Local';
                        
                        listItem.appendChild(sourceBadge);
                        listItem.appendChild(document.createTextNode(' PMID: '));
                        listItem.appendChild(pmidLink);
                        listItem.appendChild(document.createTextNode(' - ' + paper.title));
                        listItem.appendChild(document.createElement('br'));
                        listItem.appendChild(document.createTextNode(paper.journal));
                        
                        resultsList.appendChild(listItem);
                    });
                    
                    searchResultsDiv.appendChild(resultsList);
                }
                
                searchResultsDiv.style.display = 'block';
                
            } catch (error) {
                console.error('Search Error:', error);
                errorDiv.textContent = 'An unexpected error occurred during search.';
                loadingDiv.style.display = 'none';
            }
        });
    }
    
    // Handle dependency parsing for title
    if (btnParseTitle) {
        btnParseTitle.addEventListener('click', async () => {
            if (!currentPaper || !currentPaper.title) {
                return;
            }
            
            try {
                await parseSentence(currentPaper.title);
                // Switch to parsing tab
                document.querySelector('button[data-tab="tab-parsing"]').click();
            } catch (error) {
                console.error('Error parsing title:', error);
                errorDiv.textContent = 'An error occurred while parsing the title.';
            }
        });
    }
    
    // Handle dependency parsing for selected sentence
    if (btnParseSentence) {
        btnParseSentence.addEventListener('click', async () => {
            const selectedIndex = sentenceSelect.value;
            if (!selectedIndex || !abstractSentences[selectedIndex]) {
                return;
            }
            
            try {
                await parseSentence(abstractSentences[selectedIndex]);
                // Switch to parsing tab
                document.querySelector('button[data-tab="tab-parsing"]').click();
            } catch (error) {
                console.error('Error parsing sentence:', error);
                errorDiv.textContent = 'An error occurred while parsing the sentence.';
            }
        });
    }
    
    // Parse a sentence and visualize the dependency structure
    async function parseSentence(text) {
        loadingDiv.style.display = 'flex';
        errorDiv.textContent = '';
        
        try {
            const response = await fetch('/parse_sentence', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const parseData = await response.json();

            // Check if the backend returned an error within the JSON payload
            if (parseData.error) {
                throw new Error(parseData.error); // Throw error to be caught below
            }

            // Render the visualization using dependency.js
            renderDependencyGraph(parseData); // Only call if no error

        } catch (error) {
            console.error('Error in sentence parsing:', error);
            errorDiv.textContent = 'Failed to parse sentence: ' + error.message;
            // Clear the visualization area on error
            const container = document.getElementById('dependency-visualization');
            if (container) {
                container.innerHTML = '<p class="error-text">Could not generate dependency parse.</p>';
            }
        } finally {
            loadingDiv.style.display = 'none';
        }
    }
    
    // Handle zoom controls for dependency parsing
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
        if (window.dependencyVisualization) {
            window.dependencyVisualization.zoomIn();
        }
    });
    
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
        if (window.dependencyVisualization) {
            window.dependencyVisualization.zoomOut();
        }
    });
    
    document.getElementById('btn-reset-zoom').addEventListener('click', () => {
        if (window.dependencyVisualization) {
            window.dependencyVisualization.resetZoom();
        }
    });
    
    // Build legend from colors
    const legendDiv = document.getElementById('legend');
    function buildLegend(colors) {
        legendDiv.innerHTML = '';
        Object.entries(colors).forEach(([label, col]) => {
            const box = document.createElement('span');
            box.className = 'legend-item';
            box.style.background = col.background;
            box.style.border = `1px solid ${col.border}`;
            box.textContent = label;
            box.dataset.label = label;
            box.onclick = () => {
                box.classList.toggle('selected');
                document.querySelectorAll(`.entity[data-entity-label='${label}']`).forEach(e => {
                    e.classList.toggle('hidden');
                });
            };
            legendDiv.appendChild(box);
        });
    }
    
    // Initialize legend, tabs, and modal
    fetch('/static/config.json')
        .then(r => r.json())
        .then(cfg => {
            buildLegend(cfg.visualization.entity_colors);
            // Set CSS variables for entity colors
            Object.entries(cfg.visualization.entity_colors).forEach(([label, colors]) => {
                document.documentElement.style.setProperty(
                    `--color-${label.toLowerCase()}`, 
                    colors.background
                );
            });
        })
        .catch(err => console.error('Error loading config:', err));
    
    // Initialize UI components
    initTabs();
    initModal();
    initEntityInteractions();
});
