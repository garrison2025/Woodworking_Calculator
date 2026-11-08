#!/usr/bin/env python3
"""Validate production-only GEO files and answer-ready calculator content."""
from __future__ import annotations
import html
import json
import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
BASE = os.environ.get("EXPECTED_RELEASE_ORIGIN", "https://woodlayout.com").rstrip("/")
registry = json.loads((ROOT / "src" / "tools.json").read_text(encoding="utf-8"))
intents = {x["slug"]: x for x in json.loads(
    (ROOT / "src" / "tool-intents.json").read_text(encoding="utf-8"))["tools"]}
guides = json.loads((ROOT / "src" / "category-guides.json").read_text(encoding="utf-8"))
tools = [x for x in registry["tools"] if x["priority"] in {"P0", "P1"}]
assert len(tools) == 31 and len(intents) == 31

def robots_groups(text: str):
    groups = []
    current = None
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            if current and current["agents"]:
                groups.append(current)
            current = None
            continue
        if ":" not in line:
            continue
        key, value = (x.strip() for x in line.split(":", 1))
        key = key.lower()
        if key == "user-agent":
            if current is None:
                current = {"agents": [], "rules": []}
            elif current["rules"]:
                groups.append(current)
                current = {"agents": [], "rules": []}
            current["agents"].append(value.lower())
        elif current is not None and key in {"allow", "disallow"}:
            current["rules"].append((key, value))
    if current and current["agents"]:
        groups.append(current)
    return groups

robots_path = DIST / "robots.txt"
assert robots_path.exists(), "Production robots.txt is missing"
robots = robots_path.read_text(encoding="utf-8")
groups = robots_groups(robots)
for bot in ("oai-searchbot", "chatgpt-user", "claude-searchbot",
            "claude-user", "perplexitybot", "perplexity-user",
            "googlebot", "bingbot", "*"):
    matches = [g for g in groups if bot in g["agents"]]
    assert matches, f"robots.txt has no explicit group for {bot}"
    rules = [rule for group in matches for rule in group["rules"]]
    assert ("allow", "/") in rules, f"{bot} is not explicitly allowed"
    assert ("disallow", "/") not in rules, f"{bot} is blocked sitewide"

llms_path = DIST / "llms.txt"
assert llms_path.exists(), "Production llms.txt is missing"
llms = llms_path.read_text(encoding="utf-8")
assert llms.startswith("# WoodLayout\n"), "llms.txt must identify the site"
assert f"Canonical website: {BASE}/" in llms
assert "31 task-specific calculators across six woodworking categories" in llms
assert "not a promise of inclusion or citation" in llms
assert "pages.dev" not in llms.lower(), "Preview host leaked into llms.txt"
for tool in tools:
    intent = intents[tool["slug"]]
    expected_link = f"[{tool['title']}]({BASE}/{tool['slug']}/)"
    assert expected_link in llms, f"llms.txt missing tool {tool['slug']}"
    assert tool["formula"] in llms, f"llms.txt missing actual formula for {tool['slug']}"
    assert intent["useFor"] in llms and intent["notFor"] in llms, (
        f"llms.txt lost task boundaries for {tool['slug']}")
for key, (name, slug) in registry["categories"].items():
    if any(t["category"] == key for t in tools):
        assert f"[{name}]({BASE}/{slug}/)" in llms, f"llms.txt missing category {slug}"
for path in ("/about/", "/terms/", "/privacy/", "/contact/"):
    assert f"({BASE}{path})" in llms, f"llms.txt missing trust page {path}"
assert "/llms.txt\n  Content-Type: text/plain; charset=utf-8" in (
    (DIST / "_headers").read_text(encoding="utf-8"))

def read_schema(path: Path):
    source = path.read_text(encoding="utf-8")
    matches = re.findall(
        r'<script type="application/ld\+json">(.*?)</script>',
        source, flags=re.S)
    assert len(matches) == 1, f"{path}: expected one JSON-LD block"
    return json.loads(matches[0]), source

home_schema, home_html = read_schema(DIST / "index.html")
publisher = home_schema.get("publisher", {})
assert home_schema.get("@type") == "WebSite"
assert publisher.get("@type") == "Organization"
assert publisher.get("@id") == BASE + "#organization"
assert publisher.get("name") == "WoodLayout"
assert publisher.get("email") == "contact@woodlayout.com"
assert home_schema.get("author", {}).get("@id") == BASE + "#organization"
assert home_schema.get("dateModified") == "2026-11-08"
assert '<img src="/logo-mark.svg" alt="WoodLayout logo"' in home_html
assert '<h2 id="home-method-title">How do I choose and check a woodworking calculator?</h2>' in home_html
assert '<ol class="home-method-steps">' in home_html
assert '<table><caption>Exact standard length relationships</caption>' in home_html
assert "https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors" in home_html
assert '<time datetime="2026-11-08">' in home_html

for tool in tools:
    path = DIST / tool["slug"] / "index.html"
    schema, source = read_schema(path)
    assert schema.get("@type") == "WebApplication", tool["slug"]
    assert schema.get("inLanguage") == "en", tool["slug"]
    assert schema.get("isPartOf", {}).get("@id") == BASE + "/#website", tool["slug"]
    assert schema.get("publisher", {}).get("@id") == BASE + "#organization", tool["slug"]
    assert schema.get("isAccessibleForFree") is True, tool["slug"]
    assert schema.get("author", {}).get("@id") == BASE + "#organization", tool["slug"]
    assert schema.get("browserRequirements"), tool["slug"]
    assert len(schema.get("featureList", [])) >= 5, tool["slug"]
    assert 'id="geometry-rule"' in source, f"{tool['slug']}: missing answer-first formula"
    assert html.escape(tool["formula"], quote=True) in source
    assert 'id="calculation-method"' in source
    assert html.escape(tool["example"], quote=True) in source
    assert html.escape(intents[tool["slug"]]["useFor"], quote=True) in source
    assert html.escape(intents[tool["slug"]]["notFor"], quote=True) in source

about_schema, about = read_schema(DIST / "about" / "index.html")
assert about_schema.get("dateModified") == "2026-11-08"
for marker in ("Measurement conventions", "clear opening", "center-to-center",
               "Public source repository", "llms.txt", "NIST Guide to the SI"):
    assert marker.lower() in about.lower(), f"About page missing GEO trust context: {marker}"

sitemap = ET.parse(DIST / "sitemap.xml")
ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
locs = [node.text for node in sitemap.findall(".//s:loc", ns)]
assert len(locs) == 42 and len(locs) == len(set(locs)), (
    "GEO work must preserve the existing 42 canonical HTML routes")
assert BASE + "/llms.txt" not in locs, "llms.txt is a resource, not an HTML sitemap route"
print("PASS: GEO access policy, llms.txt directory, 31 answer-first formulas, publisher entity graph and 42-route sitemap.")
