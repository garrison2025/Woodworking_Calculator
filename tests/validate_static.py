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
assert len(intent_entries)==len(intents)==len(active)==28, "Exactly 26 unique active intents required"
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
        self.input_ids=[];self.label_targets=set();self.field_note_ids=set()
        self.context_targets=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=="title":self.title=True
        if tag=="h1":self.h1+=1
        if tag=="form":self.forms+=1
        if tag in ("input","select") and a.get("id","").startswith("f-"):
            self.input_ids.append(a["id"])
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
assert len(active)==28 and len(hold)==3,(len(active),len(hold))
assert len(pages)==1+28+len({t["category"] for t in active})+4,len(pages)
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
    if '{esc(t[' in body or '{esc(' in body or '{related_search_terms' in body:
        errors.append(f"{u}: unrendered Python template expression leaked to HTML")
    if any(t["slug"]==u.strip("/") for t in active) and 'Geometry rule</strong> {' in body:
        errors.append(f"{u}: geometry formula not evaluated")

    if c.canon:errors.append(f"{u}: preview must not claim a custom-domain canonical")
    page_tool=next((t for t in active if t["slug"]==u.strip("/")),None)
    if page_tool and c.forms!=1:errors.append(f"{u}: calculator form absent")
    if page_tool:
        intent=intents[page_tool["slug"]]
        if c.title_text != intent["seoTitle"]+" | Workshop Geometry Tools":
            errors.append(f"{u}: SEO title does not match task-specific approved intent")
        if page_tool["keyword"].lower() not in intent["seoTitle"].lower():
            errors.append(f"{u}: primary research keyword missing from human-readable SEO title")
        if len(intent["seoTitle"])<25 or len(intent["seoTitle"])>75:
            errors.append(f"{u}: SEO title is too generic or overlong")
        if len(intent["useFor"])<45 or len(intent["notFor"])<42:
            errors.append(f"{u}: tool intent boundary descriptions are too thin")
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
for asset in ("assets/app.mjs","assets/calcs.mjs","assets/cut-list.mjs","assets/framing-stations.mjs","assets/framing-review-versions.mjs","assets/tools.json","assets/style.css","favicon.svg","404.html","_headers"):
    if not (dist/asset).is_file():errors.append("Missing asset: "+asset)
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
print("PASS: static structure, all 28 field labels/guidance, links, metadata, preview noindex, P2 hold")
