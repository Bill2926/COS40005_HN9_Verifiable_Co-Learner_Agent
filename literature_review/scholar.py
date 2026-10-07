#!/usr/bin/env python3
"""
Search Google Scholar (>= 2023), classify each result as survey/review or
individual paper, save a CSV, and add the results to a Zotero collection.

Setup:
    pip install scholarly pyzotero python-dotenv
    Create a .env file next to this script (see .env.example):
        ZOTERO_LIBRARY_ID=1234567        # numeric ID from zotero.org/settings/keys
        ZOTERO_API_KEY=xxxxxxxx          # key with write access
        ZOTERO_LIBRARY_TYPE=user         # or "group"

Run:
    python scholar.py --dry-run   # search + classify + CSV only
    python scholar.py             # also add to Zotero

Notes:
  * Google Scholar has no official API and blocks scrapers quickly. If you get
    blocked, run again later, or use --proxy to route through a free proxy
    (scholarly's FreeProxies), or switch to SerpAPI (paid).
  * Scraping Scholar is against its terms of service; keep volume low.
"""
import argparse
import csv
import json
import os
import random
import re
import sys
import time
 
from dotenv import load_dotenv
from scholarly import scholarly, ProxyGenerator
from pyzotero import zotero
 
# Load .env from the script's folder (works no matter where you run it from)
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

FIRST_KWS = (
    '("co-learner" OR "pedagogical agent" OR "LLM agent" OR "software agent") '
    '(verification OR "runtime verification" OR "state machine" OR guardrails) '
    '(education OR learning OR tutoring OR "knowledge tracing")'
    )

GRAPH_TRAVERSAL_STATIC_CHECK = (
        '("depth-first search" OR DFS OR "graph traversal" OR "reachability analysis" '
        'OR "static constraint*" OR "static verification") '
        '("prerequisite graph*" OR "concept graph*" OR "knowledge graph*" OR "learning path*" OR "curriculum") '
        '(education OR learning OR tutoring)'
    )

KT_LLM_TUTOR = (
    '("knowledge tracing" OR "learner modeling" OR "student modeling" OR "mastery estimation") '
    '("large language model*" OR LLM OR "LLM-based") '
    '(tutoring OR "intelligent tutoring system*" OR "co-learner")'
)

QUERY = KT_LLM_TUTOR
COLLECTION_NAME = "VerifiableSweAgents"
MIN_YEAR = 2023
MAX_RESULTS = 30
 
# Words that suggest a survey / review rather than a single study.
SURVEY_PATTERNS = [
    r"\bsurvey\b", r"\bsystematic review\b", r"\bsystematic literature review\b",
    r"\bscoping review\b", r"\bliterature review\b", r"\bmeta-analysis\b",
    r"\bmapping study\b", r"\bstate[- ]of[- ]the[- ]art\b", r"\btaxonomy\b",
    r"\ba review\b", r"\breview of\b", r"\boverview\b", r"\bcomprehensive review\b",
    r"\bumbrella review\b", r"\broadmap\b", r"\bsok\b",
]
SURVEY_RE = re.compile("|".join(SURVEY_PATTERNS), re.IGNORECASE)
 
 
def classify(title: str, abstract: str) -> str:
    """Return 'survey/review' or 'individual'. Title matches count most;
    the abstract (often a truncated snippet) is checked as a fallback."""
    if SURVEY_RE.search(title or ""):
        return "survey/review"
    # Require two hits in the snippet to avoid flagging papers that merely
    # mention "overview" or "review of" in passing.
    if len(SURVEY_RE.findall(abstract or "")) >= 2:
        return "survey/review"
    return "individual"
 
 
EN_WORDS = {
    "the", "of", "and", "in", "for", "with", "to", "a", "an", "on", "is", "are",
    "by", "from", "using", "based", "that", "this", "we", "as", "at", "or",
}
# Common function words of other Latin-script languages (no overlap with English).
OTHER_WORDS = {
    "de", "la", "el", "los", "las", "en", "y", "con", "para", "por", "una", "del",
    "um", "uma", "não", "para", "os", "da", "do", "dos", "das", "et", "les", "des",
    "du", "une", "dans", "pour", "sur", "und", "der", "die", "das", "mit", "von",
    "für", "zur", "zum", "ein", "eine", "im", "auf", "il", "di", "che", "per",
    "sulla", "della", "nel", "een", "het", "voor", "van", "och", "som", "för",
}


def is_english(title: str, abstract: str = "") -> bool:
    """Cheap English check (no extra dependency): reject non-Latin scripts, then
    compare English vs. other-language function words."""
    text = f"{title} {abstract}"
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    # Non-Latin scripts (CJK, Cyrillic, Arabic...) or heavy diacritics
    non_ascii = sum(1 for c in letters if ord(c) > 0x24F)
    if non_ascii / len(letters) > 0.2:
        return False
    words = re.findall(r"[^\W\d_]+", text.lower())
    en = sum(1 for w in words if w in EN_WORDS)
    other = sum(1 for w in words if w in OTHER_WORDS)
    return en > other


def year_str(value) -> str:
    """Scholar sometimes returns 'NA' or nothing for the year; keep only 4-digit years."""
    m = re.search(r"\b(19|20)\d{2}\b", str(value or ""))
    return m.group(0) if m else ""
 
 
def year_int(value) -> int:
    y = year_str(value)
    return int(y) if y else 0
 
 
def norm(title: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (title or "").lower())
 
 
def search_scholar(max_results: int, min_year: int, use_proxy: bool):
    if use_proxy:
        pg = ProxyGenerator()
        if pg.FreeProxies():
            scholarly.use_proxy(pg)
        else:
            print("Could not set up a free proxy; continuing without.", file=sys.stderr)
 
    results, seen = [], set()
    try:
        for i, pub in enumerate(scholarly.search_pubs(QUERY, year_low=min_year)):
            bib = pub.get("bib", {})
            title = bib.get("title", "").strip()
            key = norm(title)
            if not title or key in seen:
                continue
            seen.add(key)
 
            authors = bib.get("author", [])
            if isinstance(authors, str):
                authors = [a.strip() for a in authors.split(" and ")]
            abstract = bib.get("abstract", "")
            if not is_english(title, abstract):
                print(f"[skip non-English] {title[:80]}")
                continue
            results.append({
                "title": title,
                "authors": authors,
                "year": year_str(bib.get("pub_year")),
                "venue": bib.get("venue", ""),
                "abstract": abstract,
                "url": pub.get("pub_url") or pub.get("eprint_url") or "",
                "cited_by": pub.get("num_citations", 0),
                "type": classify(title, abstract),
            })
            print(f"[{len(results):3d}/{max_results}] {results[-1]['type']:<13} {title[:80]}")
            if len(results) >= max_results:
                break
            # be polite: pause after each page of ~10 results
            if len(results) % 10 == 0:
                time.sleep(random.uniform(6, 14))
    except Exception as e:  # blocked, captcha, network...
        print(f"\nSearch stopped early ({type(e).__name__}: {e}). "
              f"Keeping the {len(results)} results collected so far.", file=sys.stderr)
    return results
 
 
def save_csv(results, path):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["type", "year", "title", "authors", "venue", "cited_by", "url"])
        # surveys first so they are easy to spot
        for r in sorted(results, key=lambda r: (r["type"] != "survey/review", -year_int(r["year"]))):
            w.writerow([r["type"], r["year"], r["title"], "; ".join(r["authors"]),
                        r["venue"], r["cited_by"], r["url"]])
 
 
def get_or_create_collection(zot, name):
    for c in zot.everything(zot.collections()):
        if c["data"]["name"] == name:
            return c["key"]
    resp = zot.create_collections([{"name": name}])
    key = resp["successful"]["0"]["key"]
    print(f"Created Zotero collection '{name}'.")
    return key
 
 
def add_to_zotero(results):
    lib_id = os.environ.get("ZOTERO_LIBRARY_ID")
    api_key = os.environ.get("ZOTERO_API_KEY")
    lib_type = os.environ.get("ZOTERO_LIBRARY_TYPE", "user")
    if not lib_id or not api_key:
        sys.exit("Missing ZOTERO_LIBRARY_ID or ZOTERO_API_KEY in your .env file.")
 
    zot = zotero.Zotero(lib_id, lib_type, api_key)
    coll = get_or_create_collection(zot, COLLECTION_NAME)
 
    existing = {norm(i["data"].get("title", ""))
                for i in zot.everything(zot.collection_items(coll))
                if i["data"].get("itemType") != "attachment"}
 
    items = []
    for r in results:
        if norm(r["title"]) in existing:
            continue
        item = zot.item_template("document")
        item["title"] = r["title"]
        item["creators"] = [{"creatorType": "author", "name": a} for a in r["authors"]]
        item["abstractNote"] = r["abstract"]
        item["date"] = r["year"]
        item["url"] = r["url"]
        item["publisher"] = r["venue"]
        item["extra"] = f"Cited by: {r['cited_by']} (Google Scholar)"
        item["tags"] = [{"tag": r["type"]}]
        item["collections"] = [coll]
        items.append(item)
 
    added = 0
    for i in range(0, len(items), 50):  # Zotero API limit: 50 items per request
        resp = zot.create_items(items[i:i + 50])
        added += len(resp.get("successful", {}))
        if resp.get("failed"):
            print("Some items failed:", resp["failed"], file=sys.stderr)
    print(f"Added {added} new items to '{COLLECTION_NAME}' "
          f"({len(results) - len(items)} duplicates skipped).")
 
 
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="skip Zotero, only search + CSV")
    ap.add_argument("--proxy", action="store_true", help="use scholarly free proxies")
    ap.add_argument("--from-cache", action="store_true",
                    help="reuse scholar_cache.json instead of searching Scholar again")
    ap.add_argument("--max", type=int, default=MAX_RESULTS)
    ap.add_argument("--csv", default="scholar_results.csv")
    args = ap.parse_args()
 
    cache = "scholar_cache.json"
    if args.from_cache and os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            results = json.load(f)
        n = len(results)
        results = [r for r in results if is_english(r["title"], r.get("abstract", ""))]
        print(f"Loaded {n} results from {cache} (no Scholar request made); "
              f"{n - len(results)} non-English dropped.")
    else:
        results = search_scholar(args.max, MIN_YEAR, args.proxy)
        if not results:
            sys.exit("No results collected (likely blocked by Google Scholar).")
        # save right away so a later error never costs you the search
        with open(cache, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=1)
 
    save_csv(results, args.csv)
    surveys = [r for r in results if r["type"] == "survey/review"]
    print(f"\n{len(results)} results: {len(surveys)} survey/review, "
          f"{len(results) - len(surveys)} individual. Saved to {args.csv}")
    print("\nSurveys / reviews:")
    for r in surveys:
        print(f"  - ({r['year']}) {r['title']}")
 
    if not args.dry_run:
        add_to_zotero(results)
 
 
if __name__ == "__main__":
    main()