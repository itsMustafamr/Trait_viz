import json
import os
import re
import html
from typing import List, Dict   
import nlp_utils                            
from flask import Flask, render_template, jsonify, request, send_from_directory
from pubmed_utils import fetch_pubmed_paper, search_pubmed, configure as configure_pubmed

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
        style = ""
        col = COLOR_MAP.get(sp["label"], {})
        if col:
            style = f"background:{col.get('background')};border:1px solid {col.get('border')};"
        
        # Add data attributes for entity metadata
        source = sp.get("source", "model")
        metadata = f'data-entity-id="{sp["start"]}-{sp["end"]}" data-entity-label="{sp["label"]}" data-entity-source="{source}"'
        
        buf.append(
            f'<span class="entity interactive-entity" {metadata} style="{style}">{html.escape(sp["term"])}'
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
                    'label': 'TRAIT',
                    'term': match.group(0),
                    'source': 'dictionary'
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

# --- Dependency Parsing ---
def get_sentence_dependencies(text):
    """Get dependency parse for a sentence using spaCy"""
    return nlp_utils.get_dependencies(text)

# --- Flask Routes ---
@app.route('/')
def index():
    return render_template("index.html", num_papers=len(qtl_data), num_traits=len(trait_list))

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

    # Process annotations
    combined_title = deduplicate(nlp_utils.ner(title) + dict_matches(title))
    combined_abs = deduplicate(nlp_utils.ner(abstract) + dict_matches(abstract))
    
    # Generate statistics for each entity type
    entity_stats = {}
    for entity in combined_title + combined_abs:
        label = entity["label"]
        if label not in entity_stats:
            entity_stats[label] = {"count": 0, "terms": {}}
        
        entity_stats[label]["count"] += 1
        term = entity["term"].lower()
        if term not in entity_stats[label]["terms"]:
            entity_stats[label]["terms"][term] = 0
        entity_stats[label]["terms"][term] += 1
    
    # Convert term dictionaries to sorted lists
    for label in entity_stats:
        terms_dict = entity_stats[label]["terms"]
        # Sort by frequency, then alphabetically
        entity_stats[label]["terms"] = [
            {"term": term, "count": count}
            for term, count in sorted(
                terms_dict.items(), 
                key=lambda x: (-x[1], x[0])
            )
        ]

    return jsonify({
        "title": title,
        "abstract": abstract,
        "journal": paper.get("Journal", "N/A"),
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
    
    term = data['term'].lower()
    label = data.get('label', '')
    
    # For demonstration purposes - in a real app, you might query a database
    # or external API for more detailed information about the entity
    
    entity_info = {
        "term": data['term'],
        "label": label,
        "source": data.get('source', 'Unknown'),
        "definition": f"Definition information would be retrieved for {data['term']}",
        "external_links": [
            {"name": "PubMed", "url": f"https://pubmed.ncbi.nlm.nih.gov/?term={urllib.parse.quote(term)}"},
            {"name": "Wikipedia", "url": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(term.replace(' ', '_'))}"}
        ]
    }
    
    # If it's a trait, include trait-specific information
    if label.upper() == 'TRAIT':
        # You could look up trait-specific databases here
        entity_info["trait_info"] = {
            "category": "Example trait category",
            "related_traits": ["Related trait 1", "Related trait 2"],
            "synonyms": ["Synonym 1", "Synonym 2"]
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
        parse_data = get_sentence_dependencies(sentence)
        return jsonify(parse_data)
    except Exception as e:
        return jsonify({"error": f"Error parsing sentence: {str(e)}"}), 500

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
    import urllib.parse  # Add this import
    host = CONFIG.get('server', {}).get('host', '0.0.0.0')
    port = CONFIG.get('server', {}).get('port', 5000)
    debug = CONFIG.get('server', {}).get('debug', True)
    
    print(f"Starting server on {host}:{port} (debug={debug})")
    app.run(host=host, port=port, debug=debug)