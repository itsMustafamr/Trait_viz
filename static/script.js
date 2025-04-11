document.addEventListener('DOMContentLoaded', () => {
    const pmidForm = document.getElementById('pmid-form');
    const pmidInput = document.getElementById('pmid');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error-message');
    const resultsDiv = document.getElementById('results');
    const titleDiv = document.getElementById('paper-title');
    const abstractDiv = document.getElementById('paper-abstract');
    const vizTitleDiv = document.getElementById('viz-title');
    const vizAbstractDiv = document.getElementById('viz-abstract');

    pmidForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default page reload

        // Clear previous results and errors
        errorDiv.textContent = '';
        titleDiv.textContent = '';
        abstractDiv.textContent = '';
        vizTitleDiv.innerHTML = ''; // Use innerHTML for rendered HTML
        vizAbstractDiv.innerHTML = '';
        resultsDiv.style.display = 'none'; // Hide results initially
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
                body: formData // Send form data
                // No need for Content-Type header when using FormData with fetch,
                // the browser sets it correctly (multipart/form-data or application/x-www-form-urlencoded)
            });

            loadingDiv.style.display = 'none'; // Hide loading indicator

            if (!response.ok) {
                // Handle HTTP errors (like 404 Not Found, 400 Bad Request)
                const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
                errorDiv.textContent = errorData.error || `An error occurred: ${response.statusText}`;
                return;
            }

            const data = await response.json();

            if (data.error) {
                errorDiv.textContent = data.error;
            } else {
                // Success! Display the results
                titleDiv.textContent = data.title || 'N/A'; // Display original title
                abstractDiv.textContent = data.abstract || 'N/A'; // Display original abstract
                vizTitleDiv.innerHTML = data.viz_title_html || ''; // Render visualized title
                vizAbstractDiv.innerHTML = data.viz_abstract_html || ''; // Render visualized abstract
                resultsDiv.style.display = 'block'; // Show results section
            }

        } catch (error) {
            // Handle network errors or other unexpected issues
            console.error('Fetch Error:', error);
            errorDiv.textContent = 'An unexpected error occurred while fetching data.';
            loadingDiv.style.display = 'none';
        }
    });
});