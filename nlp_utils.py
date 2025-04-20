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

def ner(text: str) -> List[Dict]:
    """Return list of entity dicts (start, end, label, term)."""
    if not text.strip():
        return []
    
    # For NER, disable unnecessary components
    doc = _get_nlp(disable=["tagger", "parser", "lemmatizer"])(text)
    
    return [
        {"start": ent.start_char, "end": ent.end_char, "label": ent.label_, "term": ent.text, "source": "model"}
        for ent in doc.ents
    ]

def get_dependencies(text: str) -> Dict[str, Any]:
    """Get dependency parsing information for visualization."""
    if not text.strip():
        return {}
    
    try:
        # For dependency parsing, use a different model
        nlp = spacy.load("en_core_web_sm")
        doc = nlp(text)
        
        # For sentences longer than 50 words, just process the first 50
        max_tokens = 50
        if len(doc) > max_tokens:
            # Try to find a sentence break before max_tokens
            for i in range(min(max_tokens, len(doc) - 1), 0, -1):
                if doc[i].is_sent_end:
                    doc = doc[:i+1]
                    break
            else:
                # If no sentence break found, just take first max_tokens
                doc = doc[:max_tokens]
        
        # Create token data
        tokens = []
        for i, token in enumerate(doc):
            tokens.append({
                "id": i,  # Use local index instead of token.i
                "text": token.text,
                "pos": token.pos_,
                "tag": token.tag_,
                "dep": token.dep_,
                "head": token.head.i - token.sent.start if hasattr(token, 'sent') else token.head.i,  # Adjust for sentence
                "is_stop": token.is_stop,
                "lemma": token.lemma_
            })
        
        # Create dependency arcs
        arcs = []
        for i, token in enumerate(doc):
            # Skip root
            if token.head.i != token.i:
                # Use local indices
                start_idx = min(i, token.head.i - token.sent.start if hasattr(token, 'sent') else token.head.i)
                end_idx = max(i, token.head.i - token.sent.start if hasattr(token, 'sent') else token.head.i)
                
                arcs.append({
                    "start": start_idx,
                    "end": end_idx,
                    "label": token.dep_,
                    "dir": "left" if token.head.i < token.i else "right"
                })
        
        return {
            "tokens": tokens,
            "arcs": arcs,
            "text": text
        }
    except Exception as e:
        print(f"Error in dependency parsing: {e}")
        # Return a minimal valid structure
        return {
            "tokens": [{"id": 0, "text": token, "pos": "X", "dep": "", "head": 0, "tag": ""} 
                      for i, token in enumerate(text.split())],
            "arcs": [],
            "text": text,
            "error": str(e)
        }

def split_into_sentences(text: str) -> List[str]:
    """Split text into sentences using spaCy."""
    if not text.strip():
        return []
    
    try:
        # Use a general model for sentence splitting
        nlp = spacy.load("en_core_web_sm")
        doc = nlp(text)
        return [sent.text.strip() for sent in doc.sents]
    except Exception:
        # Fallback to simple splitting by punctuation
        import re
        return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]