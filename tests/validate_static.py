#!/usr/bin/env python3
"""Check real generated HTML, internal links and preview indexing conditions."""
import html
import html.parser
import csv
import json
import re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
dist=root/"dist"
manifest=json.loads((root/"src"/"tools.json").read_text())
active=[t for t in manifest["tools"] if t["priority"] in ("P0","P1")]
intent_manifest=json.loads((root/"src"/"tool-intents.json").read_text(encoding="utf8"))
intent_entries=intent_manifest["tools"]
intents={x["slug"]:x for x in intent_entries}
field_checks=json.loads((root/"src"/"field-verification.json").read_text(encoding="utf8"))["checks"]
approved_cases=json.loads((root/"src"/"worked-cases.json").read_text(encoding="utf8"))["cases"]
case_map={}
for case in approved_cases:case_map.setdefault(case["slug"],[]).append(case)
assert {k:len(v) for k,v in case_map.items()}=={
    "deck-board-calculator":2,"rafter-calculator":2,"stair-stringer-calculator":2
}, "Only three audited tools may offer two worked scenarios each"
assert set(field_checks)==set(intents), "All active tools require task-specific field checks"
assert len(intent_entries)==len(intents)==len(active)==31, "Exactly 31 unique active intents required"
assert set(intents)=={t["slug"] for t in active}, "Intent metadata missing or holding an unpublished P2 route"
assert all(len(x["next"])==3 for x in intent_entries), "Exactly three specific next-task links per tool"
with (root/"research"/"woodworking-keyword-map-152.csv").open(newline="",encoding="utf-8") as source:
    research_rows=list(csv.DictReader(source))
assert len(research_rows)==152, "Expected 152 distinct approved research terms"
assert len({r["keyword"] for r in research_rows})==152, "Keyword duplicate in export"
cautions=json.loads((root/"research"/"keyword-intent-cautions.json").read_text(encoding="utf8"))["flagged"]
flagged={(x["originalRoute"],x["keyword"].lower()) for x in cautions}
assert len(cautions)==len(flagged), "Duplicated editorial search-intent caution"
assert flagged<={(x["target_route"],x["keyword"].lower()) for x in research_rows}, "Flagged term lacks original user research evidence"
# A reviewed intent correction may move copy ONLY to an existing P0/P1 page;
# all original keyword data must still remain unchanged and traceable.
supported_reassignments={x["keyword"].lower():x["supportedRoute"] for x in cautions if x.get("supportedRoute")}
assert len(supported_reassignments)==sum(bool(x.get("supportedRoute")) for x in cautions), "Duplicated keyword reassignment"
assert set(supported_reassignments.values()) <= {"/"+t["slug"]+"/" for t in active}, "Keyword redirected to a missing or held tool"
assert all(supported_reassignments[k] != x["originalRoute"] for x in cautions
           if (k:=x["keyword"].lower()) in supported_reassignments), "Reassignment has the same original destination"
known_routes={"/"+t["slug"]+"/" for t in manifest["tools"]}
for term in research_rows:
    assert term["target_route"] in known_routes, ("Keyword targets missing route",term)
    assert 0<=int(term["kd"])<=29, ("Keyword exceeds approved KD gate",term)
    assert int(term["monthly_volume_us"])>=0, ("Invalid search volume",term)
hold=[t for t in manifest["tools"] if t["priority"]=="P2"]
class Checker(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.title=False;self.title_text="";self.h1=0;self.robots=[];self.links=[];self.descriptions=[];self.canon=[];self.forms=0
        self.input_ids=[];self.input_types={};self.label_targets=set();self.field_note_ids=set()
        self.context_targets=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=="title":self.title=True
        if tag=="h1":self.h1+=1
        if tag=="form":self.forms+=1
        if tag in ("input","select") and a.get("id","").startswith("f-"):
            self.input_ids.append(a["id"])
            self.input_types[a["id"]]=tag if tag=="select" else a.get("type","text")
        if tag=="label" and a.get("for"):
            self.label_targets.add(a["for"])
        if a.get("id","").startswith("field-note-"):
            self.field_note_ids.add(a["id"])
        if tag=="meta" and a.get("name")=="robots":self.robots.append(a.get("content",""))
        if tag=="meta" and a.get("name")=="description":self.descriptions.append(a.get("content",""))
        if tag=="link" and a.get("rel")=="canonical":self.canon.append(a.get("href",""))
        if tag=="a" and a.get("href","").startswith("/"):self.links.append(a["href"])
        if tag=="a" and a.get("data-intent-target"):
            self.context_targets.append((a["data-intent-target"],a.get("href","")))
    def handle_endtag(self,tag):
        if tag=="title":self.title=False
    def handle_data(self,data):
        if self.title:self.title_text+=data
errors=[]
pages=sorted(dist.rglob("index.html"))
assert len(active)==31 and len(hold)==0,(len(active),len(hold))
assert len(pages)==1+31+len({t["category"] for t in active})+4,len(pages)
for p in pages:
    c=Checker();c.feed(p.read_text(encoding="utf8"))
    u="/" if p.parent==dist else "/"+p.parent.relative_to(dist).as_posix()+"/"
    if c.h1!=1:errors.append(f"{u}: expected one H1, got {c.h1}")
    if not c.title_text:errors.append(f"{u}: missing title")
    if len(c.descriptions)!=1 or len(c.descriptions[0])<35:errors.append(f"{u}: missing unique description")
    if any(t["slug"]==u.strip("/") for t in active) and len(c.descriptions)==1:
        d=c.descriptions[0]
        if len(d)>170:errors.append(f"{u}: description exceeds readability limit ({len(d)} chars)")
        if not d.endswith("."):errors.append(f"{u}: description must end with punctuation")
        if " Formula, dimension diagram" in d:errors.append(f"{u}: old broken SEO phrase remains")
    if len(c.robots)!=1 or "noindex" not in c.robots[0]:errors.append(f"{u}: preview must be noindex")
    body=p.read_text(encoding="utf8")
    if u=="/":
        category_count=len({t["category"] for t in active})
        if f"<strong>{len(active)}</strong> working calculator routes" not in body:
            errors.append("Homepage tool count differs from manifest")
        if f"<strong>{category_count}</strong> active categories" not in body:
            errors.append("Homepage category count differs from manifest")
        if f"DRAWING 01 / {len(active)}" not in body:
            errors.append("Homepage drawing count differs from manifest")
        if body.count('class="category-pill"')!=category_count:
            errors.append("Homepage category navigation differs from manifest")
        for marker in ('id="tool-search"','id="tool-directory"','id="tool-search-status"','id="clear-recent-tools"'):
            if body.count(marker)!=1:errors.append("Missing unique local discovery control "+marker)
        if "Start with a proven task" in body:
            errors.append("Homepage implies unverified physical workshop validation")
    if '{esc(t[' in body or '{esc(' in body or '{related_search_terms' in body:
        errors.append(f"{u}: unrendered Python template expression leaked to HTML")
    if any(t["slug"]==u.strip("/") for t in active) and 'Geometry rule</strong> {' in body:
        errors.append(f"{u}: geometry formula not evaluated")

    if c.canon:errors.append(f"{u}: preview must not claim a custom-domain canonical")
    page_tool=next((t for t in active if t["slug"]==u.strip("/")),None)
    # A homepage must not load 160 KB of calculator logic; static directory and
    # information pages need no calculator runtime at all.
    expected_script=("/assets/app.mjs" if page_tool else
                     "/assets/home.mjs" if u=="/" else None)
    live_scripts=re.findall(r'<script type="module" src="([^"]+)"',body)
    if live_scripts!=([expected_script] if expected_script else []):
        errors.append(f"{u}: unexpected JavaScript entry point {live_scripts}")
    if page_tool and c.forms!=1:errors.append(f"{u}: calculator form absent")
    if page_tool:
        for marker in ('id="share-measurements"', 'id="download-measurements-json"',
                       'id="load-measurements-json"', 'id="load-measurements-json" type="file" accept=".json,application/json"'):
            if body.count(marker)!=1:
                errors.append(f"{u}: missing or duplicate local input-backup control {marker}")
    if page_tool:
        intent=intents[page_tool["slug"]]
        if c.title_text != intent["seoTitle"]+" | Workshop Geometry Tools":
            errors.append(f"{u}: SEO title does not match task-specific approved intent")
        if page_tool["keyword"].lower() not in intent["seoTitle"].lower():
            # One historically broad research query is deliberately NOT used
            # in a title as if it matched a generic pricing intent.
            if page_tool["slug"]!="lumber-price-calculator" or not (
                "lumber" in intent["seoTitle"].lower()
                and "board foot" in intent["seoTitle"].lower()
                and "mbf" in intent["seoTitle"].lower()):
                errors.append(f"{u}: primary research keyword missing from human-readable SEO title")
            elif "historical broad research query" not in body.lower() or "NOT a general" not in body:
                errors.append(f"{u}: ambiguous historical thousand-price query lacks on-page scope caveat")
        if len(intent["seoTitle"])<25 or len(intent["seoTitle"])>75:
            errors.append(f"{u}: SEO title is too generic or overlong")
        if len(intent["useFor"])<45 or len(intent["notFor"])<42:
            errors.append(f"{u}: tool intent boundary descriptions are too thin")
        samples=case_map.get(page_tool["slug"],[])
        if body.count('class="btn secondary worked-apply"')!=len(samples):
            errors.append(f"{u}: worked scenario buttons do not match approved case list")
        for sample in samples:
            if sample["id"] not in body or html.escape(sample["verification"],quote=True) not in body:
                errors.append(f"{u}: worked scenario lacks its reproducible inputs or explanation")
        if 'class="field-verification"' not in body or html.escape(field_checks[page_tool["slug"]],quote=True) not in body:
            errors.append(f"{u}: task-specific field verification missing")
        if 'class="intent-fit"' not in body or 'class="related-box intent-related"' not in body:
            errors.append(f"{u}: task boundary or contextual-link panel missing")
        if html.escape(intent["useFor"],quote=True) not in body or html.escape(intent["notFor"],quote=True) not in body:
            errors.append(f"{u}: task fit or inappropriate-use warning missing")
        links=intent["next"]
        targets=[link["slug"] for link in links]
        if len(targets)!=len(set(targets)) or page_tool["slug"] in targets:
            errors.append(f"{u}: duplicate or self-targeted related workflow")
        if any(target not in intents for target in targets):
            errors.append(f"{u}: linked to an unpublished or unknown workflow")
        if c.context_targets != [(target,"/"+target+"/") for target in targets]:
            errors.append(f"{u}: generated contextual links do not follow the curated intent map")
        for link in links:
            if len(link["why"])<25 or html.escape(link["why"],quote=True) not in body:
                errors.append(f"{u}: missing practical explanation for next calculator {link['slug']}")
        # A captured SERP keyword that does not match the actual calculator
        # task is kept in research records but cannot be marketed as a live
        # functionality synonym in the generic nearby-search paragraph.
        nearby=re.search(r'<p class="intent-query-copy">.*?</p>',body)
        if nearby:
            rendered_query=html.unescape(nearby.group(0)).lower()
            if "closely related search terms include" in rendered_query:
                errors.append(f"{u}: generic synonym inventory still present")
            if (page_tool["slug"]!="lumber-price-calculator"
                and page_tool["keyword"].lower() not in rendered_query):
                errors.append(f"{u}: primary research search task missing")
            if page_tool["slug"]=="lumber-price-calculator" and (
                "lumber" not in rendered_query or "mbf" not in rendered_query):
                errors.append(f"{u}: lumber scope not defined precisely")
            for route,term in flagged:
                if route==u and term in rendered_query:
                    errors.append(f"{u}: flagged nonmatching search phrase used as a claimed synonym: {term}")
            for term,correct_route in supported_reassignments.items():
                if correct_route==u and term not in rendered_query:
                    errors.append(f"{u}: approved reassigned search intent not shown on the matching tool: {term}")
        expected={"f-"+field["key"] for field in page_tool["inputs"]}
        if len(c.input_ids)!=len(set(c.input_ids)):
            errors.append(f"{u}: duplicated calculator field IDs")
        if set(c.input_ids)!=expected:
            errors.append(f"{u}: generated input fields differ from manifest")
        for source_field in page_tool["inputs"]:
            field_id="f-"+source_field["key"]
            expected_type=("select" if source_field.get("options") else
                           "text" if source_field["kind"]=="L" else "number")
            if c.input_types.get(field_id)!=expected_type:
                errors.append(f"{u}: {field_id} expected {expected_type} input, got {c.input_types.get(field_id)}")
            if expected_type=="text" and "5 1/2" not in body:
                errors.append(f"{u}: fractional-inch input lacks accessible examples")
        for field_id in expected:
            if field_id not in c.label_targets:
                errors.append(f"{u}: input lacks a matching visible label: {field_id}")
            if "field-note-"+field_id[2:] not in c.field_note_ids:
                errors.append(f"{u}: input lacks its accessible help note: {field_id}")
        guidance=page_tool.get("guidance",[])
        if len(guidance)<2:
            errors.append(f"{u}: fewer than two distinct practical guidance sections")
        if len({g["heading"] for g in guidance})!=len(guidance):
            errors.append(f"{u}: guidance headings are duplicated")
        for section in guidance:
            if len(section["heading"].strip())<10 or len(section["text"].strip())<60:
                errors.append(f"{u}: guidance is too thin to explain this calculator")
            if html.escape(section["heading"],quote=True) not in body:
                errors.append(f"{u}: practical guidance heading was not prerendered")

    if any(t["slug"]==u.strip("/") for t in active):
        for marker in ('id="print-calibration"', 'calibration-100mm', 'calibration-1in', 'NOT a 1:1 template'):
            if marker not in body:errors.append(f"{u}: missing physical print scale caveat or calibration marker {marker}")
    for link in c.links:
        if link.startswith("/#"):continue
        path=dist/link.lstrip("/")
        if not (path/"index.html").exists() and not path.is_file():errors.append(f"{u}: broken internal link {link}")
for t in hold:
    if (dist/t["slug"]).exists():errors.append(f"P2 unexpectedly published: {t['slug']}")
if (dist/"sitemap.xml").exists():errors.append("Preview must not expose an XML sitemap")
if "Disallow: /" not in (dist/"robots.txt").read_text():errors.append("Preview robots.txt must disallow crawling")
# The physical 404 file must remain noindex even when later built for release.
# Preview HTTP headers must also protect non-HTML resources.
notfound=(dist/"404.html").read_text(encoding="utf8")
notfound_head=Checker();notfound_head.feed(notfound)
if notfound_head.robots!=["noindex,nofollow,noarchive"] or notfound_head.canon:
    errors.append("404.html must be noindex without a canonical")
if 'type="application/ld+json"' in notfound:
    errors.append("404.html must not advertise structured data")
pages_headers=(dist/"_headers").read_text(encoding="utf8")
if "\n/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n" not in "\n"+pages_headers:
    errors.append("Preview must send X-Robots-Tag noindex on all static assets")

for asset in ("assets/app.mjs","assets/home.mjs","assets/measurement-links.mjs","assets/measurement-files.mjs","assets/length-entry.mjs","assets/calcs.mjs","assets/cut-list.mjs","assets/framing-stations.mjs","assets/framing-review-versions.mjs","assets/tools.json","assets/style.css","favicon.svg","404.html","_headers"):
    if not (dist/asset).is_file():errors.append("Missing asset: "+asset)
# All 31 separately hydrated calculator configs must exactly match the
# source registry. A stale or partial config could silently change quantities.
config_dir=dist/"assets"/"tool-config"
actual_configs=list(config_dir.glob("*.json"))
if len(actual_configs)!=len(active):
    errors.append(f"Expected {len(active)} per-tool configs, got {len(actual_configs)}")
full_registry_bytes=(dist/"assets"/"tools.json").stat().st_size
for tool in active:
    file=config_dir/(tool["slug"]+".json")
    if not file.exists():
        errors.append(f"Missing runtime config for {tool['slug']}")
        continue
    try:
        served=json.loads(file.read_text(encoding="utf8"))
        if served != tool:errors.append(f"Config disagrees with source registry: {tool['slug']}")
    except (OSError,ValueError) as exc:
        errors.append(f"Unreadable config for {tool['slug']}: {exc}")
    if file.stat().st_size>=full_registry_bytes//2:
        errors.append(f"Not a compact per-tool config: {tool['slug']}")
if 'fetch("/assets/tools.json")' in (dist/"assets"/"app.mjs").read_text():
    errors.append("Calculator runtime still loads the complete registry")
home_js=(dist/"assets"/"home.mjs").read_text()
if "fetch(" in home_js or "import " in home_js:
    errors.append("Homepage module must use prerendered directory only")
# Validate local ESM import graph against BUILT assets, not only src files.
# An omitted import breaks every live calculator at module-load time despite
# correct HTML and numeric unit tests.
for module in (dist/"assets").glob("*.mjs"):
    for relative in re.findall(r"""from\s+['"](\./[^'"]+)['"]""",module.read_text(encoding="utf8")):
        if not (module.parent/relative).is_file():
            errors.append(f"{module.name}: unresolved published ESM import {relative}")
titles=[]
for p in pages:
    c=Checker();c.feed(p.read_text(encoding="utf8"));titles.append(c.title_text)
if len(titles)!=len(set(titles)):errors.append("Duplicate page titles")
descriptions=[]
for p in pages:
    c=Checker();c.feed(p.read_text(encoding="utf8"));descriptions.extend(c.descriptions)
if len(descriptions)!=len(set(descriptions)):errors.append("Duplicate page descriptions")
print("Preview static checks:",len(pages),"HTML pages;",len(active),"tool pages;",len(hold),"P2 held;",len(research_rows),"keyword rows validated")
if errors:
    for e in errors:print("FAIL:",e)
    raise SystemExit(1)
print("PASS: static structure, all 31 field labels/guidance, links, metadata, preview noindex, P2 hold")
