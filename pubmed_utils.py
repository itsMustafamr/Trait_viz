import re
import urllib.request
from time import sleep
import json
import os
from datetime import datetime
import httpx, asyncio



# Cache for PubMed API results
_pubmed_cache = {}
_cache_file = 'pubmed_cache.json'
_use_cache = True
_request_delay = 0.5

async def _async_fetch(url: str) -> str:
      async with httpx.AsyncClient(timeout=10) as client:
          resp = await client.get(url)
          resp.raise_for_status()
          return resp.text
def load_cache():
    """Load the PubMed cache from file."""
    global _pubmed_cache
    if os.path.exists(_cache_file):
        try:
            with open(_cache_file, 'r', encoding='utf-8') as f:
                _pubmed_cache = json.load(f)
            print(f"Loaded {len(_pubmed_cache)} cached PubMed entries")
        except Exception as e:
            print(f"Error loading PubMed cache: {e}")
            _pubmed_cache = {}
    else:
        _pubmed_cache = {}

def save_cache():
    """Save the PubMed cache to file."""
    if not _use_cache:
        return
        
    try:
        with open(_cache_file, 'w', encoding='utf-8') as f:
            json.dump(_pubmed_cache, f, indent=2)
        print(f"Saved {len(_pubmed_cache)} entries to PubMed cache")
    except Exception as e:
        print(f"Error saving PubMed cache: {e}")

def configure(config=None):
    """Configure the PubMed utilities with the given settings."""
    global _cache_file, _use_cache, _request_delay
    
    if config and 'pubmed_api' in config:
        api_config = config['pubmed_api']
        _use_cache = api_config.get('cache_results', True)
        _cache_file = api_config.get('cache_path', 'pubmed_cache.json')
        _request_delay = api_config.get('request_delay', 0.5)
    
    # Load the cache if enabled
    if _use_cache:
        load_cache()

def fetch_pubmed_paper(pmid):
    """
    Fetches a paper from PubMed API by PMID.
    Uses cache if available and enabled.
    
    Args:
        pmid (str): The PubMed ID to fetch
        
    Returns:
        dict: Paper information (PMID, Title, Abstract, Journal) or None if not found
    """
    # Check cache first if enabled
    if _use_cache and pmid in _pubmed_cache:
        print(f"Using cached data for PMID {pmid}")
        return _pubmed_cache[pmid]
    # Base URL for NCBI E-utilities
    base_url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'
    db = 'db=pubmed'
    
    # Use efetch directly since we have the PMID
    fetch_eutil = 'efetch.fcgi?'
    fetch_id = '&id=' + pmid
    fetch_retmode = "&retmode=xml"  # XML provides structured data
    
    # Create the complete URL
    fetch_url = base_url + fetch_eutil + db + fetch_id + fetch_retmode

    try:
        xml_data = asyncio.run(_async_fetch(fetch_url))
        
        # Parse the response
        paper_info = {}
        
        # Extract PMID (already known, but confirm)
        paper_info['PMID'] = pmid
        
        # Extract title
        title_match = re.search(r'<ArticleTitle>(.*?)</ArticleTitle>', xml_data, re.DOTALL)
        if title_match:
            paper_info['Title'] = title_match.group(1).strip()
        else:
            paper_info['Title'] = "Title not available"
        
        # Extract abstract
        abstract_match = re.search(r'<AbstractText.*?>(.*?)</AbstractText>', xml_data, re.DOTALL)
        if abstract_match:
            paper_info['Abstract'] = abstract_match.group(1).strip()
        else:
            paper_info['Abstract'] = "Abstract not available"
        
        # Extract journal info
        journal_match = re.search(r'<Journal>.*?<Title>(.*?)</Title>.*?</Journal>', xml_data, re.DOTALL)
        if journal_match:
            journal_title = journal_match.group(1).strip()
            
            # Get year, volume, issue if available
            year_match = re.search(r'<PubDate>.*?<Year>(.*?)</Year>.*?</PubDate>', xml_data)
            volume_match = re.search(r'<Volume>(.*?)</Volume>', xml_data)
            issue_match = re.search(r'<Issue>(.*?)</Issue>', xml_data)
            pages_match = re.search(r'<Pagination>.*?<MedlinePgn>(.*?)</MedlinePgn>.*?</Pagination>', xml_data, re.DOTALL)
            
            year = year_match.group(1) if year_match else ""
            volume = volume_match.group(1) if volume_match else ""
            issue = issue_match.group(1) if issue_match else ""
            pages = pages_match.group(1) if pages_match else ""
            
            citation = f"{journal_title}. {year}"
            if volume:
                citation += f";{volume}"
            if issue:
                citation += f"({issue})"
            if pages:
                citation += f":{pages}"
            
            paper_info['Journal'] = citation
        else:
            paper_info['Journal'] = "Journal information not available"
        
        # Add category (not available from API, default to "External")
        paper_info['Category'] = "External"
        
        # Add to cache if enabled
        if _use_cache:
            _pubmed_cache[pmid] = paper_info
            # Save cache periodically (every 10 new entries)
            if len(_pubmed_cache) % 10 == 0:
                save_cache()
        
        return paper_info
        
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"PMID {pmid} not found in PubMed")
            return None
        else:
            print(f"HTTP Error: {e.code} - {e.reason}")
            return None
    except Exception as e:
        print(f"Error fetching paper from PubMed: {e}")
        return None

def search_pubmed(query, max_results=10):
    """
    Searches PubMed for papers matching a query.
    
    Args:
        query (str): The search query
        max_results (int): Maximum number of results to return
        
    Returns:
        list: List of paper information dictionaries
    """
    # common settings between esearch and efetch
    base_url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'
    db = 'db=pubmed'

    # esearch settings
    search_eutil = 'esearch.fcgi?'
    search_term = '&term=' + urllib.parse.quote(query)
    search_usehistory = '&usehistory=y'
    search_retmax = f'&retmax={max_results}'

    # call the esearch command for the query and read the web result
    search_url = base_url + search_eutil + db + search_term + search_usehistory + search_retmax
    f = urllib.request.urlopen(search_url)
    search_data = f.read().decode('utf-8')

    # extract the PMIDs from the search results
    pmid_list = re.findall(r'<Id>(\d+)</Id>', search_data)
    
    # Fetch each paper by PMID
    papers = []
    for pmid in pmid_list:
        paper = fetch_pubmed_paper(pmid)
        if paper:
            papers.append(paper)
        # Be nice to the API
        sleep(0.5)
        
    return papers
