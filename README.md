# TraitViz - PubMed Annotation Visualizer
By - Mohammed and Srikanth

A web application for visualizing trait annotations in scientific papers from PubMed and local datasets.

## Features

- Search by PMID to retrieve papers from a local database or from PubMed API
- Search by keyword to find relevant papers in the local database or PubMed
- Visualize trait and other biomedical entity annotations (e.g., genes, diseases) in the title and abstract
- Highlight entities using both dictionary matching (for traits) and a pre-trained biomedical NER model (scispaCy)

## Installation

1. Clone this repository
2. Install the required dependencies:

```bash
pip install -r requirements.txt
```
requirements.txt has all the dependencies for this web app.

   This will install Flask, spaCy, scispaCy, the required language models, and other dependencies.

3. Place your data files in the project directory:
   - `QTL_text.json`: JSON file containing paper data
   - `Trait dictionary.txt`: Text file with one trait per line

## Usage

1. Run the Flask application:

```bash
python app.py
```

2. Open your web browser and navigate to `http://localhost:5000`
3. Enter a PMID or search term to retrieve and visualize papers

## File Structure

- `app.py`: Main Flask application
- `pubmed_utils.py`: Utilities for PubMed API integration
- `nlp_utils.py`: Utilities for spaCy/scispaCy NLP processing (NER, Dependency Parsing)
- `pubmed_utils.py`: Utilities for PubMed API integration
- `config.json`: Configuration file (optional)
- `static/`: Contains CSS and JavaScript for the frontend
- `templates/`: Contains HTML templates (index.html, visualizer.html)

## Adding More Traits

To add more traits to the dictionary:
1. Open `Trait dictionary.txt`
2. Add one trait per line
3. Save the file and restart the application

## Local Database

The local database (`QTL_text.json`) contains papers in the following format:

```json
[
  {
    "PMID": "17179536",
    "Journal": "J Anim Sci. 2007 Jan;85(1):22-30.",
    "Title": "Variance component analysis of quantitative trait loci for pork carcass composition and meat quality on SSC4 and SSC11.",
    "Abstract": "Abstract text here...",
    "Category": "1"
  },
  ...
]
```

## PubMed API Integration

When a PMID is not found in the local database, the application will automatically try to retrieve it from the PubMed API.
