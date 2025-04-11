# app.py - Flask app for dictionary-based annotation

import json
import os
import re
import html
from flask import Flask, render_template, jsonify # Added jsonify for potential future API use

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


def find_traits(text: str, trait_list: list[str]) -> list[dict]:
    """
    Finds occurrences of traits in the text using dictionary matching.
    Handles overlaps by preferring the longest match starting at the same position.

    Args:
        text: The text string (title or abstract) to search within.
        trait_list: A list of trait terms to search for.

    Returns:
        A list of dictionaries, where each dictionary represents a found trait
        and has keys: 'start', 'end', 'label', 'term'.
        Returns an empty list if no matches are found.
    """
    if not text or not trait_list:
        return []

    all_matches = []
    # Use a set for faster lookup if trait_list is very large, but list is fine for now
    # trait_set = set(trait_list)

    for trait in trait_list:
        # Escape special regex characters in the trait and add word boundaries
        # Use re.IGNORECASE for case-insensitive matching
        try:
            # Ensure the trait is not empty before creating pattern
            if not trait:
                continue
            pattern = r'\b' + re.escape(trait) + r'\b'
            for match in re.finditer(pattern, text, re.IGNORECASE):
                all_matches.append({
                    'start': match.start(),
                    'end': match.end(),
                    'label': 'Trait', # Hardcoded label for now
                    'term': match.group(0) # Store the actual matched text (maintains case)
                                           # Alternatively, use 'term': trait if original case isn't needed
                })
        except re.error as e:
            # Handle potential regex errors if a trait is malformed, though re.escape should prevent most
            print(f"Regex error for trait '{trait}': {e}")
            continue


    # --- Overlap Filtering (Prefer Longest Match) ---
    if not all_matches:
        return []

    # Sort primarily by start index (ascending), secondarily by end index (descending - longer matches first)
    all_matches.sort(key=lambda x: (x['start'], -x['end']))

    filtered_matches = []
    last_match_end = -1

    for match in all_matches:
        # Only add match if it doesn't significantly overlap with the previous accepted match
        if match['start'] >= last_match_end:
            filtered_matches.append(match)
            last_match_end = match['end']
        # Optional: Handle cases where a slightly overlapping but much longer match might be preferred
        # (This basic filtering is usually sufficient for dictionary matching)

    return filtered_matches

# Load data when the application starts
load_data()

# --- Flask Routes ---
@app.route('/')
def index():
    """Renders the main HTML page."""
    # Pass the number of loaded records/traits just for info display if needed
    num_papers = len(qtl_data)
    num_traits = len(trait_list)
    return render_template('index.html', num_papers=num_papers, num_traits=num_traits)

# #--- Temporary Testing Block (REMOVE BEFORE RUNNING THE APP) ---
# if __name__ == '__main__':
#     test_text = "Variance component analysis of quantitative trait loci for pork carcass composition and meat quality on SSC4 and SSC11."
#     print("Test Text:", test_text)
#     if trait_list: # Make sure traits are loaded
#         found = find_traits(test_text, trait_list)
#         print("Found Traits:")
#         for item in found:
#             print(f"  - Term: '{item['term']}', Start: {item['start']}, End: {item['end']}, Label: {item['label']}")
#     else:
#         print("Trait list is empty, cannot test.")
#     #--- End Temporary Testing Block ---

    # Main Execution
    app.run(debug=True) # Keep this line commented out while testing the block above




# app.py - Streamlit app for dictionary-based annotation

# import streamlit as st
# import json
# import re

# # -------------------
# # 1. LOAD THE DATA
# # -------------------
# # Load the QTL text data
# with open("QTL_text.json", "r", encoding="utf-8") as f:
#     qtl_data = json.load(f)

# # Convert the list of entries into a dict {PMID: record, ...} for easy lookup
# qtl_records = {entry["PMID"]: entry for entry in qtl_data}

# # Load the trait dictionary
# with open("Trait dictionary.txt", "r", encoding="utf-8") as f:
#     traits = [line.strip() for line in f if line.strip()]

# # ---------------------------
# # 2. DICTIONARY MATCH HELPER
# # ---------------------------
# def highlight_terms(text, terms):
#     """
#     Finds occurrences of each term in `terms` within `text` (case-insensitive)
#     and wraps them in <mark>...</mark> for highlighting.
    
#     This approach identifies all non-overlapping matches, sorted by start index,
#     then rebuilds the text with <mark> tags.
#     """
#     if not text:
#         return ""

#     # We'll collect all matches as (start, end, matched_string)
#     matches = []
#     for term in terms:
#         # Use word-boundary regex to match whole words (case-insensitive).
#         pattern = rf"\b{re.escape(term)}\b"
#         for match in re.finditer(pattern, text, flags=re.IGNORECASE):
#             start, end = match.span()
#             matches.append((start, end, text[start:end]))

#     # If no matches, just return the original text
#     if not matches:
#         return text

#     # Sort matches by the start index (ascending)
#     matches.sort(key=lambda x: x[0])

#     # Build a new string with <mark> around matched spans
#     highlighted_text = []
#     last_idx = 0

#     for start, end, matched_str in matches:
#         # If there's a gap between the last end and this start, add that text
#         if start >= last_idx:
#             highlighted_text.append(text[last_idx:start])
#             # Highlight the match
#             highlighted_text.append(f"<mark>{text[start:end]}</mark>")
#             last_idx = end
#         else:
#             # Overlapping match or already covered by previous highlight, skip it
#             continue

#     # Add any remaining text after the last match
#     highlighted_text.append(text[last_idx:])

#     return "".join(highlighted_text)


# # -------------------
# # 3. STREAMLIT APP
# # -------------------
# st.title("Dictionary-Based Annotation Demo")

# st.markdown("""
# Enter a **PMID** below to retrieve its Title and Abstract from the QTL_text.json file.
# Then we do a simple dictionary lookup on each word from **Trait dictionary.txt** and highlight the matches.
# """)

# pmid_input = st.text_input("Enter a PMID (e.g., 17179536)")

# if st.button("Submit"):
#     if not pmid_input:
#         st.warning("Please enter a PMID first.")
#     else:
#         # Find the record with that PMID
#         record = qtl_records.get(pmid_input)
#         if record:
#             title = record.get("Title", "")
#             abstract = record.get("Abstract", "")

#             # 1) Highlight Title
#             highlighted_title = highlight_terms(title, traits)
#             # 2) Highlight Abstract
#             highlighted_abstract = highlight_terms(abstract, traits)

#             # Display them with Streamlit, allowing HTML
#             st.subheader("Title")
#             st.markdown(highlighted_title, unsafe_allow_html=True)

#             st.subheader("Abstract")
#             st.markdown(highlighted_abstract, unsafe_allow_html=True)
#         else:
#             st.error(f"No record found for PMID: {pmid_input}")
