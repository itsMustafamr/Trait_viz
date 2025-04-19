import json
import os
import re
import html
from typing import List, Dict   
import nlp_utils                            
from flask import Flask, render_template, jsonify, request
from pubmed_utils import fetch_pubmed_paper, search_pubmed, configure as configure_pubmed  # Import our new utility

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

# ---------- dictionary matcher ----------
def dict_matches(text: str) -> List[Dict]:
    matches = []
    for trait in trait_list:
        pattern = rf"\b{re.escape(trait)}\b"
        for m in re.finditer(pattern, text, flags=re.IGNORECASE):
            matches.append({"start": m.start(), "end": m.end(), "label": "TRAIT", "term": m.group(0)})
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
        style = ""
        col = COLOR_MAP.get(sp["label"], {})
        if col:
            style = f"background:{col.get('background')};border:1px solid {col.get('border')};"
        buf.append(
            f'<span class="entity" style="{style}">{html.escape(sp["term"])}'
            f'<sup class="label">{sp["label"]}</sup></span>'
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
    return render_template("index.html", num_papers=len(qtl_data), num_traits=len(trait_list))

@app.route("/visualize", methods=["POST"])
def visualize():
    pmid = request.form.get("pmid", "").strip()
    if not pmid:
        return jsonify({"error": "PMID required"}), 400

    paper = qtl_data.get(pmid) or fetch_pubmed_paper(pmid)
    if paper is None:
        return jsonify({"error": f"PMID {pmid} not found"}), 404

    title, abstract = paper.get("Title", ""), paper.get("Abstract", "")

    combined_title  = deduplicate(nlp_utils.ner(title)  + dict_matches(title))
    combined_abs    = deduplicate(nlp_utils.ner(abstract) + dict_matches(abstract))

    return jsonify({
        "title": title,
        "abstract": abstract,
        "journal": paper.get("Journal", "N/A"),
        "source": "local" if pmid in qtl_data else "pubmed",
        "viz_title_html": span_html(title, combined_title),
        "viz_abstract_html": span_html(abstract, combined_abs)
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
            max_results = CONFIG.get('pubmed_api', {}).get('max_search_results', 10)
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
    host = CONFIG['server'].get('host', '0.0.0.0')
    port = CONFIG['server'].get('port', 5000)
    debug = CONFIG['server'].get('debug', True)
    
    print(f"Starting server on {host}:{port} (debug={debug})")
    app.run(host=host, port=port, debug=debug)