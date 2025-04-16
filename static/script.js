document.addEventListener('DOMContentLoaded', () => {
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
        loadingDiv.style.display = 'block'; // Show loading indicator

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
                resultsDiv.style.display = 'block'; // Show results section
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
            loadingDiv.style.display = 'block';
            
            const term = searchInput.value.trim();
            const searchScopeSelect = document.getElementById('search-scope');
            const searchScope = searchScopeSelect ? searchScopeSelect.value : 'local';
            
            if (!term) {
                errorDiv.textContent = 'Please enter a search term.';
                loadingDiv.style.display = 'none';
                return;
            }
            
            try {
                const formData = new FormData();
                formData.append('term', term);
                formData.append('scope', searchScope);
                
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
});