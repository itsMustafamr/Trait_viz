import json
import os
import re
import html
# Make sure 'request' is imported
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# --- Configuration ---
QTL_JSON_PATH = 'QTL_text.json'
TRAIT_DICT_PATH = 'Trait dictionary.txt'

# --- Data Loading ---
qtl_data = {}
trait_list = []

def load_data():
    """Loads QTL data and trait dictionary from files."""
    global qtl_data, trait_list
    # ... (Keep the existing load_data function as it is) ...
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
    # ... (Keep the existing find_traits function as it is) ...
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
    # ... (Keep the existing generate_visualization_html function as it is) ...
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

    # Lookup paper data
    paper_info = qtl_data.get(pmid)

    if not paper_info:
        return jsonify({'error': f"PMID '{pmid}' not found in the loaded data."}), 404

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
        'error': None # Explicitly indicate no error
    })

# --- Main Execution ---
if __name__ == '__main__':
    app.run(debug=True)
    