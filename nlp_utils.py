"""Utility wrapper that lazily loads the scispaCy pipeline exactly once."""
import functools, os, spacy
from typing import List, Dict

@functools.lru_cache(maxsize=1)
def _get_nlp():
    model_name = os.getenv("SCISPACY_MODEL", "en_ner_bionlp13cg_md")
    return spacy.load(model_name, exclude=["tagger", "lemmatizer", "parser"])  # keep it light

def ner(text: str) -> List[Dict]:
    """Return list of entity dicts (start, end, label, term)."""
    if not text.strip():
        return []
    doc = _get_nlp()(text)
    return [
        {"start": ent.start_char, "end": ent.end_char, "label": ent.label_, "term": ent.text}
        for ent in doc.ents
    ]