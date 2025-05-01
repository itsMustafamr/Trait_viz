"""Utility wrapper that lazily loads the scispaCy pipeline exactly once."""
import functools
import os
import spacy
from typing import List, Dict, Any

# Cache for NLP models
_nlp_cache = {}

def _get_nlp(disable=None):
    """Get a cached spaCy model with specified components disabled."""
    model_name = os.getenv("SCISPACY_MODEL", "en_ner_bionlp13cg_md")
    disable_key = tuple(sorted(disable)) if disable else None
    cache_key = (model_name, disable_key)
    
    if cache_key not in _nlp_cache:
        _nlp_cache[cache_key] = spacy.load(model_name, disable=disable)
    
    return _nlp_cache[cache_key]

# --- NER Function ---
@functools.lru_cache(maxsize=128) # Add caching for NER results on same text
def ner(text: str) -> List[Dict]:
    """Return list of entity dicts (start, end, label, term)."""
    if not text or not text.strip():
        return []

    # Use the main model, disable components not needed *specifically* for NER
    # The parser might be needed by other functions using the same cached model instance
    nlp = _get_nlp(disable=["tagger", "lemmatizer"]) # Keep parser enabled if needed elsewhere
    doc = nlp(text)

    return [
        {"start": ent.start_char, "end": ent.end_char, "label": ent.label_, "term": ent.text, "source": "model"}
        for ent in doc.ents
    ]

# --- Dependency Parsing Function ---
@functools.lru_cache(maxsize=128) # Add caching for dependency results on same text
def get_dependencies(text: str) -> Dict[str, Any]:
    """Get dependency parsing information for visualization using the main model."""
    if not text or not text.strip():
        return {"tokens": [], "arcs": [], "text": text, "error": "Empty input text"}

    try:
        # --- Revert to using en_core_web_sm specifically for parsing ---
        # This ensures a reliable parser is used, separate from the NER model.
        # Note: This increases memory usage as two models might be loaded.
        try:
            # Attempt to load en_core_web_sm if not already cached for parsing
            # We can use a simple cache key for this specific purpose
            if "en_core_web_sm_parser" not in _nlp_cache:
                 _nlp_cache["en_core_web_sm_parser"] = spacy.load("en_core_web_sm")
            nlp_parser = _nlp_cache["en_core_web_sm_parser"]
        except OSError:
             # Handle case where en_core_web_sm is not downloaded
             return {"tokens": [], "arcs": [], "text": text, "error": "Model 'en_core_web_sm' not found. Please download it (python -m spacy download en_core_web_sm)."}

        if not nlp_parser.has_pipe("parser"):
             # This shouldn't happen with en_core_web_sm, but check just in case
             return {"tokens": [], "arcs": [], "text": text, "error": "Parser component missing in en_core_web_sm."}

        # Process the ENTIRE text directly using the dedicated parser model
        doc = nlp_parser(text)

        # Create token data relative to the *full doc* with detailed error checking
        tokens = []
        for i, token in enumerate(doc):
            try:
                # Check attributes individually to pinpoint the error
                token_text = token.text
                token_pos = token.pos_
                token_tag = token.tag_
                token_dep = token.dep_
                # Ensure token.head exists before accessing .i
                token_head_i = token.head.i if token.head is not None else i
                token_is_stop = token.is_stop
                token_lemma = token.lemma_

                tokens.append({
                    "id": i,
                    "text": token_text,
                    "pos": token_pos,
                    "tag": token_tag,
                    "dep": token_dep,
                    "head": token_head_i,
                    "is_stop": token_is_stop,
                    "lemma": token_lemma
                })
            except AttributeError as ae:
                 print(f"AttributeError accessing token {i} ('{token.text}'): {ae}")
                 # Add placeholder on error
                 tokens.append({
                     "id": i, "text": token.text, "pos": "X", "tag": "X",
                     "dep": "ERROR", "head": i, "is_stop": False, "lemma": token.text
                 })
            except Exception as token_ex: # Catch other potential errors during token processing
                 print(f"Error processing token {i} ('{token.text}'): {token_ex}")
                 tokens.append({
                     "id": i, "text": token.text, "pos": "X", "tag": "X",
                     "dep": "ERROR", "head": i, "is_stop": False, "lemma": token.text
                 })


        # Create dependency arcs relative to the *full doc* with error checking
        arcs = []
        if not tokens: # Check if token generation failed
             print("No tokens generated, cannot create arcs.")
             # Return error if no tokens were created
             return {"tokens": [], "arcs": [], "text": doc.text, "error": "Token generation failed"}

        for i, token_data in enumerate(tokens):
            try:
                # Use .get() for safer dictionary access
                head_idx = token_data.get('head')
                dep_label = token_data.get('dep', 'ERROR') # Default label if 'dep' is missing

                if head_idx is None:
                    print(f"Token {i} ('{token_data.get('text')}') has missing 'head' index.")
                    continue # Skip arc generation for this token

                # Ensure head_idx is valid within the doc and not pointing to itself
                if head_idx != i and 0 <= head_idx < len(tokens):
                    start_idx = min(i, head_idx)
                    end_idx = max(i, head_idx)
                    arcs.append({
                        "start": start_idx,
                        "end": end_idx,
                        "label": dep_label,
                        "dir": "left" if head_idx < i else "right"
                    })
            except Exception as arc_ex:
                 print(f"Error creating arc for token {i} ('{token_data.get('text')}'): {arc_ex}")
                 # Continue processing other arcs

        return {
            "tokens": tokens,
            "arcs": arcs,
            "text": doc.text
        }
    except Exception as e:
        # Log the error properly in a real app
        print(f"Error in dependency parsing for text '{text[:50]}...': {e}")
        return {
            "tokens": [],
            "arcs": [],
            "text": text,
            "error": f"Parsing failed: {str(e)}"
        }


import spacy
from spacy import displacy

nlp_displacy = spacy.load("en_core_web_sm")  # Use small model for browser rendering

def render_displacy(sentence: str) -> str:
    doc = nlp_displacy(sentence)
    html = displacy.render(doc, style="dep", page=False)  # SVG only, no full HTML
    return html

# --- Sentence Splitting Function (Optional - Keep if used elsewhere) ---
# If this function is needed, refactor to use _get_nlp() as well
# @functools.lru_cache(maxsize=128)
# def split_into_sentences(text: str) -> List[str]:
#     """Split text into sentences using the main spaCy model."""
#     if not text or not text.strip():
#         return []
#     try:
#         nlp = _get_nlp() # Use the main cached model
#         # Ensure sentence boundaries are detected (usually requires parser or sentencizer)
#         if not nlp.has_pipe("parser") and not nlp.has_pipe("sentencizer"):
#              # Add sentencizer if missing and needed
#              # Note: Modifying pipeline of cached model might have side effects.
#              # Consider loading a separate instance if pipeline needs modification.
#              # For now, assume the base model handles sentences.
#              pass # Or raise error/log warning
#
#         doc = nlp(text)
#         return [sent.text.strip() for sent in doc.sents]
#     except Exception as e:
#         print(f"Error splitting sentences for text '{text[:50]}...': {e}")
#         # Fallback to simple splitting by punctuation
#         import re
#         return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
