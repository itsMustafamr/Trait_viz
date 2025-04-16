import json
import os
import re
import html
from flask import Flask, render_template, jsonify, request
from pubmed_utils import fetch_pubmed_paper, search_pubmed, configure as configure_pubmed  # Import our new utility

app = Flask(__name__)

# --- Configuration ---
CONFIG_PATH = 'config.json'

# Load configuration from file
try:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)
        QTL_JSON_PATH = config['data_paths']['qtl_json']
        TRAIT_DICT_PATH = config['data_paths']['trait_dictionary']
        print(f"Loaded configuration from {CONFIG_PATH}")
    else:
        print(f"Config file {CONFIG_PATH} not found, using defaults")
        QTL_JSON_PATH = 'QTL_text.json'
        TRAIT_DICT_PATH = 'Trait dictionary.txt'
        config = {
            "server": {
                "host": "0.0.0.0",
                "port": 5000,
                "debug": True
            }
        }
except Exception as e:
    print(f"Error loading config: {e}, using defaults")
    QTL_JSON_PATH = 'QTL_text.json'
    TRAIT_DICT_PATH = 'Trait dictionary.txt'
    config = {
        "server": {
            "host": "0.0.0.0",
            "port": 5000,
            "debug": True
        }
    }

# Configure PubMed utilities
configure_pubmed(config)

# --- Data Loading ---
qtl_data = {}
trait_list = []

def load_data():
    """Loads QTL data and trait dictionary from files."""
    global qtl_data, trait_list
    # Load QTL_text.json
    try:
        if not os.path.exists(QTL_JSON_PATH):
             print(f"ERROR: {QTL_JSON_PATH} not found. Please place it in the application directory.")
             qtl_data = {}
        else:
            with open(QTL_JSON_PATH, 'r', encoding='utf-8') as f: # Added encoding
                qtl_data_list = json.load(f)
            # Convert list to dict for faster lookup by PMID
            qtl_data = {item['PMID']: item for item in qtl_data_list if 'PMID' in item} # Ensure PMID exists
            print(f"Loaded {len(qtl_data)} records from {QTL_JSON_PATH}.")
            if not qtl_data:
                 print(f"WARNING: No records loaded from {QTL_JSON_PATH}. Ensure the file is not empty and contains valid JSON with 'PMID' keys.")

    except json.JSONDecodeError:
        print(f"ERROR: Could not decode {QTL_JSON_PATH}. Ensure it's valid JSON.")
        qtl_data = {}
    except Exception as e:
        print(f"An unexpected error occurred loading {QTL_JSON_PATH}: {e}")
        qtl_data = {}

    # Load Trait dictionary.txt
    try:
        if not os.path.exists(TRAIT_DICT_PATH):
             print(f"ERROR: {TRAIT_DICT_PATH} not found. Please place it in the application directory.")
             trait_list = []
        else:
            with open(TRAIT_DICT_PATH, 'r', encoding='utf-8') as f: # Added encoding
                # Read lines, strip whitespace, filter out empty lines
                trait_list = [line.strip() for line in f if line.strip()]
            print(f"Loaded {len(trait_list)} traits from {TRAIT_DICT_PATH}.")
            if not trait_list:
                 print(f"WARNING: No traits loaded from {TRAIT_DICT_PATH}. Ensure the file is not empty.")

    except Exception as e:
        print(f"An unexpected error occurred loading {TRAIT_DICT_PATH}: {e}")
        trait_list = []

# Load data when the application starts
load_data()


# --- Trait Finding Logic ---
def find_traits(text: str, trait_list: list[str]) -> list[dict]:
    """Finds occurrences of traits in the text using dictionary matching."""
    if not text or not trait_list:
        return []

    all_matches = []
    for trait in trait_list:
        try:
            if not trait:
                continue
            pattern = r'\b' + re.escape(trait) + r'\b'
            for match in re.finditer(pattern, text, re.IGNORECASE):
                all_matches.append({
                    'start': match.start(),
                    'end': match.end(),
                    'label': 'Trait',
                    'term': match.group(0)
                })
        except re.error as e:
            print(f"Regex error for trait '{trait}': {e}")
            continue

    if not all_matches:
        return []

    all_matches.sort(key=lambda x: (x['start'], -x['end']))

    filtered_matches = []
    last_match_end = -1

    for match in all_matches:
        if match['start'] >= last_match_end:
            filtered_matches.append(match)
            last_match_end = match['end']

    return filtered_matches


# --- Visualization HTML Generation ---
def generate_visualization_html(text: str, matches: list[dict]) -> str:
    """Generates an HTML string with matched traits highlighted using spans."""
    if not matches or not text:
        return html.escape(text)

    matches.sort(key=lambda x: x['start'])
    result_parts = []
    last_end = 0

    for match in matches:
        start, end = match['start'], match['end']
        label = match['label']
        term_text = match.get('term', text[start:end])

        if start > last_end:
            result_parts.append(html.escape(text[last_end:start]))

        result_parts.append(
            f'<span class="entity label-{label.upper()}">'
            f'<span class="entity-text">{html.escape(term_text)}</span>'
            f'<span class="entity-label">{html.escape(label)}</span>'
            f'</span>'
        )
        last_end = end

    if last_end < len(text):
        result_parts.append(html.escape(text[last_end:]))

    return "".join(result_parts)


# --- Flask Routes ---
@app.route('/')
def index():
    """Renders the main HTML page."""
    num_papers = len(qtl_data)
    num_traits = len(trait_list)
    return render_template('index.html', num_papers=num_papers, num_traits=num_traits)

@app.route('/visualize', methods=['POST'])
def visualize():
    """Handles the PMID submission, finds traits, and returns visualization data."""
    if not request.form or 'pmid' not in request.form:
        return jsonify({'error': 'Missing PMID in request form.'}), 400

    pmid = request.form.get('pmid').strip()
    if not pmid:
        return jsonify({'error': 'PMID cannot be empty.'}), 400

    # Lookup paper data in local database first
    paper_info = qtl_data.get(pmid)
    source = "local"
    
    # If not found locally, try fetching from PubMed API
    if not paper_info:
        print(f"PMID '{pmid}' not found in local data, trying PubMed API...")
        paper_info = fetch_pubmed_paper(pmid)
        source = "pubmed"
        
    # If still not found, return error
    if not paper_info:
        return jsonify({'error': f"PMID '{pmid}' not found in local data or PubMed."}), 404

    # Get title and abstract from paper info
    original_title = paper_info.get('Title', '')
    original_abstract = paper_info.get('Abstract', '')

    # Find traits
    title_matches = find_traits(original_title, trait_list)
    abstract_matches = find_traits(original_abstract, trait_list)

    # Generate visualization HTML
    viz_title_html = generate_visualization_html(original_title, title_matches)
    viz_abstract_html = generate_visualization_html(original_abstract, abstract_matches)

    # Return data as JSON
    return jsonify({
        'title': original_title,
        'abstract': original_abstract,
        'viz_title_html': viz_title_html,
        'viz_abstract_html': viz_abstract_html,
        'journal': paper_info.get('Journal', 'Not available'),
        'source': source,  # Indicate where we found the paper
        'error': None # Explicitly indicate no error
    })

# Add a search route for term-based search
@app.route('/search', methods=['POST'])
def search():
    """Searches for papers by keyword."""
    if not request.form or 'term' not in request.form:
        return jsonify({'error': 'Missing search term in request form.'}), 400

    search_term = request.form.get('term').strip()
    search_scope = request.form.get('scope', 'local')  # Options: local, pubmed, both
    
    if not search_term:
        return jsonify({'error': 'Search term cannot be empty.'}), 400
        
    # First search local data
    local_results = []
    if search_scope in ['local', 'both']:
        for pmid, paper in qtl_data.items():
            title = paper.get('Title', '').lower()
            abstract = paper.get('Abstract', '').lower()
            if search_term.lower() in title or search_term.lower() in abstract:
                local_results.append({
                    'pmid': pmid,
                    'title': paper.get('Title', 'No title'),
                    'journal': paper.get('Journal', 'No journal info'),
                    'source': 'local'
                })
    
    # Then search PubMed if requested
    pubmed_results = []
    if search_scope in ['pubmed', 'both']:
        try:
            max_results = config.get('pubmed_api', {}).get('max_search_results', 10)
            papers = search_pubmed(search_term, max_results=max_results)
            for paper in papers:
                pubmed_results.append({
                    'pmid': paper.get('PMID', ''),
                    'title': paper.get('Title', 'No title'),
                    'journal': paper.get('Journal', 'No journal info'),
                    'source': 'pubmed'
                })
        except Exception as e:
            print(f"Error searching PubMed: {e}")
            # Continue with local results only
    
    # Combine results
    all_results = local_results + pubmed_results
    
    return jsonify({
        'results': all_results,
        'count': len(all_results),
        'local_count': len(local_results),
        'pubmed_count': len(pubmed_results)
    })

# --- Main Execution ---
if __name__ == '__main__':
    host = config['server'].get('host', '0.0.0.0')
    port = config['server'].get('port', 5000)
    debug = config['server'].get('debug', True)
    
    print(f"Starting server on {host}:{port} (debug={debug})")
    app.run(host=host, port=port, debug=debug)