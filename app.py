import json
import os
import re
import html
from typing import List, Dict
import nlp_utils
from flask import Flask, render_template, jsonify, request, send_from_directory
from pubmed_utils import fetch_pubmed_paper, search_pubmed, configure as configure_pubmed, save_cache
import urllib.parse # Make sure this import is present

app = Flask(__name__)

# --- Configuration ---
CONFIG_PATH = 'config.json'

# Load configuration from file
if os.path.exists(CONFIG_PATH):
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        CONFIG = json.load(f)
else:
    CONFIG = {}

QTL_JSON_PATH  = CONFIG.get("data_paths", {}).get("qtl_json", "QTL_text.json")
TRAIT_DICT_PATH = CONFIG.get("data_paths", {}).get("trait_dictionary", "Trait dictionary.txt")

# Configure PubMed utilities
configure_pubmed(CONFIG)

# --- Data Loading ---
qtl_data: Dict[str, Dict] = {}
trait_list: List[str] = []

def load_data():
    """Loads QTL data and trait dictionary from files."""
    global qtl_data, trait_list
    if os.path.exists(QTL_JSON_PATH):
        with open(QTL_JSON_PATH, "r", encoding="utf-8") as f:
            qtl_data_list = json.load(f)
        qtl_data = {item["PMID"]: item for item in qtl_data_list if "PMID" in item}
    if os.path.exists(TRAIT_DICT_PATH):
        with open(TRAIT_DICT_PATH, "r", encoding="utf-8") as f:
            trait_list = [ln.strip() for ln in f if ln.strip()]
# Load data when the application starts
load_data()


from nlp_utils import render_displacy

@app.route('/displacy', methods=['POST'])
def displacy_endpoint():
    data = request.json
    sentence = data.get("text", "").strip()
    if not sentence:
        return jsonify({"error": "Text required"}), 400
    try:
        html = render_displacy(sentence)
        return jsonify({"html": html})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- dictionary matcher ----------
def dict_matches(text: str) -> List[Dict]:
    matches = []
    for trait in trait_list:
        pattern = rf"\b{re.escape(trait)}\b"
        for m in re.finditer(pattern, text, flags=re.IGNORECASE):
            matches.append({
                "start": m.start(),
                "end": m.end(),
                "label": "TRAIT",
                "term": m.group(0),
                "source": "dictionary"
            })
    return matches

# ---------- helpers ----------
def deduplicate(matches: List[Dict]) -> List[Dict]:
    """Remove overlaps; keep longer span then earlier span."""
    matches.sort(key=lambda d: (d["start"], -(d["end"]-d["start"])))
    out, last_end = [], -1
    for m in matches:
        if m["start"] >= last_end:
            out.append(m)
            last_end = m["end"]
    return out

COLOR_MAP = CONFIG.get("visualization", {}).get("entity_colors", {})

def span_html(text: str, spans: List[Dict]) -> str:
    if not spans:
        return html.escape(text)
    spans = sorted(spans, key=lambda s: s["start"])
    buf, cur = [], 0
    for sp in spans:
        if sp["start"] > cur:
            buf.append(html.escape(text[cur:sp["start"]]))
        
        col = COLOR_MAP.get(sp["label"], {})
        
        # Always use background and border from the color map
        bg_color = col.get('background', '#ffffff')
        border_color = col.get('border', '#cccccc')
        
        # Set text color to black for good contrast on colored backgrounds
        text_color = "#000000"  
        
        # Add explicit styling to ensure visibility
        style = f"background-color:{bg_color};border:1px solid {border_color};color:{text_color};"
        
        # Add data attributes for entity metadata
        source = sp.get("source", "model")
        metadata = f'data-entity-id="{sp["start"]}-{sp["end"]}" data-entity-label="{sp["label"]}" data-entity-source="{source}"'

        buf.append(
            f'<span class="entity interactive-entity" {metadata} style="{style}">{html.escape(sp["term"])}'
            f'<sup class="label" data-entity-label="{sp["label"]}">{sp["label"]}</sup></span>'
        )
        cur = sp["end"]
    buf.append(html.escape(text[cur:]))
    return "".join(buf)
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
            # Use word boundaries for exact matching, case-insensitive
            pattern = r'(?<!\w)' + re.escape(trait) + r'(?!\w)'
            for match in re.finditer(pattern, text, re.IGNORECASE):
                all_matches.append({
                    'start': match.start(),
                    'end': match.end(),
                    'label': 'TRAIT',
                    'term': match.group(0),
                    'source': 'dictionary'
                })
        except re.error as e:
            print(f"Regex error for trait '{trait}': {e}")
            continue

    if not all_matches:
        return []

    # Sort matches primarily by start index, secondarily by end index (longer matches first)
    all_matches.sort(key=lambda x: (x['start'], -x['end']))

    # Filter out overlapping matches, keeping the longest one that starts first
    filtered_matches = []
    last_match_end = -1

    for match in all_matches:
        # Only add if the current match starts after or at the end of the last added match
        if match['start'] >= last_match_end:
            filtered_matches.append(match)
            last_match_end = match['end']
        # Optional: If you prefer keeping the longest match even if it overlaps slightly later
        # elif match['end'] > last_match_end:
        #    # Check if this match is significantly longer and replaces the previous one
        #    # This logic can become complex, stick to non-overlapping for simplicity first
        #    pass

    return filtered_matches


# --- Dependency Parsing ---
def get_sentence_dependencies(text):
    """Get dependency parse for a sentence using spaCy"""
    return nlp_utils.get_dependencies(text)

# --- Flask Routes ---

# NEW: Route for the landing page
@app.route('/')
def landing_page():
    """Serves the new landing page (index.html)."""
    return render_template("index.html")

# NEW: Route for the main visualizer application page
@app.route('/visualizer')
def visualizer_app():
    """Serves the main annotation visualizer page (visualizer.html)."""
    # Pass necessary counts to the template
    return render_template("visualizer.html", num_papers=len(qtl_data), num_traits=len(trait_list))

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route("/visualize", methods=["POST"])
def visualize():
    pmid = request.form.get("pmid", "").strip()
    if not pmid:
        return jsonify({"error": "PMID required"}), 400

    paper = qtl_data.get(pmid) or fetch_pubmed_paper(pmid)
    if paper is None:
        return jsonify({"error": f"PMID {pmid} not found"}), 404

    title, abstract = paper.get("Title", ""), paper.get("Abstract", "")

    # Process annotations using both NER and dictionary matching
    title_ner_matches = nlp_utils.ner(title)
    title_dict_matches = find_traits(title, trait_list) # Use find_traits here
    combined_title = deduplicate(title_ner_matches + title_dict_matches)

    abstract_ner_matches = nlp_utils.ner(abstract)
    abstract_dict_matches = find_traits(abstract, trait_list) # Use find_traits here
    combined_abs = deduplicate(abstract_ner_matches + abstract_dict_matches)

    # Generate statistics for each entity type
    entity_stats = {}
    for entity in combined_title + combined_abs:
        label = entity["label"]
        source = entity.get("source", "model") # Get source
        term = entity["term"].lower()

        if label not in entity_stats:
            entity_stats[label] = {"count": 0, "terms": {}, "sources": {"model": 0, "dictionary": 0}}

        entity_stats[label]["count"] += 1
        entity_stats[label]["sources"][source] += 1 # Increment source count

        if term not in entity_stats[label]["terms"]:
            entity_stats[label]["terms"][term] = {"count": 0, "sources": {"model": 0, "dictionary": 0}}

        entity_stats[label]["terms"][term]["count"] += 1
        entity_stats[label]["terms"][term]["sources"][source] += 1 # Increment term source count

    # Format author information
    author_display = ""
    if paper.get("Authors"):
        authors = paper.get("Authors", [])
        author_names = [author.get("name", "") for author in authors]
        author_display = ", ".join(author_names)

    # Convert term dictionaries to sorted lists
    for label in entity_stats:
        terms_dict = entity_stats[label]["terms"]
        # Sort by frequency, then alphabetically
        entity_stats[label]["terms"] = [
            {"term": term, "count": details["count"], "sources": details["sources"]} # Include sources
            for term, details in sorted(
                terms_dict.items(),
                key=lambda x: (-x[1]["count"], x[0]) # Sort by count desc, then term asc
            )
        ]


    return jsonify({
        "pmid": pmid,
        "title": title,
        "abstract": abstract,
        "journal": paper.get("Journal", "N/A"),
        "authors": paper.get("Authors", []),  # Full author data
        "author_display": author_display,    # Formatted author string
        "publication_date": paper.get("PublicationDate", ""),
        "source": "local" if pmid in qtl_data else "pubmed",
        "viz_title_html": span_html(title, combined_title),
        "viz_abstract_html": span_html(abstract, combined_abs),
        "entity_statistics": entity_stats
    })

@app.route('/get_entity_info', methods=['POST'])
def get_entity_info():
    """Get additional information about an entity"""
    data = request.json
    if not data or 'term' not in data:
        return jsonify({"error": "Entity term required"}), 400

    term = data['term'] # Keep original case for display if needed
    term_lower = term.lower()
    label = data.get('label', '')
    source = data.get('source', 'Unknown')

    # Basic info
    entity_info = {
        "term": term,
        "label": label,
        "source": source,
        "definition": f"Definition for '{term}' (Label: {label}, Source: {source}) would be retrieved here.",
        "external_links": [
            {"name": "PubMed Search", "url": f"https://pubmed.ncbi.nlm.nih.gov/?term={urllib.parse.quote(term)}"},
            {"name": "Google Scholar", "url": f"https://scholar.google.com/scholar?q={urllib.parse.quote(term)}"},
            {"name": "Wikipedia", "url": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(term.replace(' ', '_'))}"}
        ]
    }

    # If it's a trait and from the dictionary, add specific trait info
    if label.upper() == 'TRAIT' and source.lower() == 'dictionary':
         # Example: check if trait exists in a more detailed local dictionary if available
         # Or provide links to trait-specific databases
         entity_info["trait_details"] = {
             "description": f"This trait '{term}' was identified from the local dictionary.",
             "links": [
                  # Add links to relevant trait databases if applicable, e.g., GWAS Catalog, OMIM
                  {"name": "GWAS Catalog", "url": f"https://www.ebi.ac.uk/gwas/search?query={urllib.parse.quote(term)}"},
             ]
         }
    # Add specific info for other entity types if needed
    elif label.upper() == 'GENE_OR_GENE_PRODUCT':
         entity_info["gene_details"] = {
             "description": f"Gene/protein identified as '{term}'. Further details require database lookups.",
              "links": [
                  {"name": "NCBI Gene", "url": f"https://www.ncbi.nlm.nih.gov/gene/?term={urllib.parse.quote(term)}"},
                  {"name": "UniProt", "url": f"https://www.uniprot.org/uniprotkb?query={urllib.parse.quote(term)}"}
              ]
         }

    return jsonify(entity_info)


@app.route('/parse_sentence', methods=['POST'])
def parse_sentence():
    """Get dependency parsing for a sentence"""
    data = request.json
    if not data or 'text' not in data:
        return jsonify({"error": "Sentence text required"}), 400

    sentence = data['text'].strip()
    if not sentence:
        return jsonify({"error": "Empty sentence"}), 400

    # Get dependency parse
    try:
        # Ensure text is clean before parsing
        cleaned_sentence = re.sub(r'\s+', ' ', sentence).strip()
        if len(cleaned_sentence) > 1000: # Add a length limit for safety/performance
             return jsonify({"error": "Sentence too long for parsing."}), 400

        parse_data = get_sentence_dependencies(cleaned_sentence)
        # --- DEBUGGING: Log the data being sent to the frontend ---
        import logging
        app.logger.setLevel(logging.DEBUG) # Ensure debug messages are shown
        app.logger.debug(f"Parse data for frontend: {json.dumps(parse_data, indent=2)}")
        # --- END DEBUGGING ---

        # Check if parsing returned an error structure
        if parse_data.get("error"):
             # Return error as JSON, but with a 200 OK status initially,
             # as the frontend JS expects to parse JSON even on logical errors.
             # The JS will then handle the 'error' key.
             # Alternatively, could return 4xx/5xx and adjust JS fetch error handling.
             return jsonify(parse_data), 200 # Or return 500 if preferred

        return jsonify(parse_data)

    except Exception as e:
        # Log the exception for debugging
        app.logger.error(f"Error parsing sentence '{sentence[:50]}...': {str(e)}")
        return jsonify({"error": f"An unexpected error occurred during sentence parsing: {str(e)}"}), 500


@app.route('/search', methods=['POST'])
def search():
    """Searches for papers by keyword."""
    if not request.form or 'term' not in request.form:
        return jsonify({'error': 'Missing search term in request form.'}), 400

    search_term = request.form.get('term').strip()
    search_scope = request.form.get('scope', 'local')  # Options: local, pubmed, both
    start_date = request.form.get('start_date') # Get start date (YYYY-MM-DD)
    end_date = request.form.get('end_date')     # Get end date (YYYY-MM-DD)

    if not search_term:
        return jsonify({'error': 'Search term cannot be empty.'}), 400

    # First search local data
    local_results = []
    if search_scope in ['local', 'both']:
        search_term_lower = search_term.lower()
        for pmid, paper in qtl_data.items():
            title = paper.get('Title', '').lower()
            abstract = paper.get('Abstract', '').lower()
            # More robust search: check if term is a whole word or substring
            # Using 'in' for substring matching. For whole word, use regex: rf'\b{re.escape(search_term_lower)}\b'
            if search_term_lower in title or search_term_lower in abstract:
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
            max_results = CONFIG.get('pubmed_api', {}).get('max_search_results', 10)
            # Pass dates to search_pubmed (implementation needed in pubmed_utils.py)
            papers = search_pubmed(
                search_term,
                max_results=max_results,
                start_date=start_date,
                end_date=end_date
            )
            for paper in papers:
                 # Avoid adding duplicates if already found locally
                 if not any(r['pmid'] == paper.get('PMID', '') for r in local_results):
                    pubmed_results.append({
                        'pmid': paper.get('PMID', ''),
                        'title': paper.get('Title', 'No title'),
                        'journal': paper.get('Journal', 'No journal info'),
                        'source': 'pubmed'
                    })
        except Exception as e:
            # Log the error for debugging
            app.logger.error(f"Error searching PubMed for term '{search_term}': {e}")
            # Optionally inform the user about the PubMed search failure
            # return jsonify({'error': f'PubMed search failed: {e}. Only local results shown.'}), 500
            # Or just continue with local results silently

    # Combine results (local first, then PubMed)
    all_results = local_results + pubmed_results

    # Limit total results if necessary (e.g., to 50 total)
    max_total_results = 50
    if len(all_results) > max_total_results:
        all_results = all_results[:max_total_results]


    return jsonify({
        'results': all_results,
        'count': len(all_results),
        'local_count': len(local_results),
        'pubmed_count': len(pubmed_results),
        'query': search_term, # Return the original query
        'scope': search_scope # Return the scope used
    })


# --- Main Execution ---
if __name__ == '__main__':
    import os, atexit
    port  = int(os.getenv("PORT", 5000))         # 👈 new
    host  = os.getenv("HOST", "0.0.0.0")         # optional
    debug = CONFIG.get("server", {}).get("debug", False)

    print(f"Starting server on http://{host}:{port} (debug={debug})")
    # Make sure cache is saved on exit if modified
    atexit.register(save_cache)
    app.run(host=host, port=port, debug=debug)
    
