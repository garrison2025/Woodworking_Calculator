#!/usr/bin/env python3
"""Check real generated HTML, internal links and preview indexing conditions."""
import html.parser
import csv
import json
import re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
dist=root/"dist"
manifest=json.loads((root/"src"/"tools.json").read_text())
active=[t for t in manifest["tools"] if t["priority"] in ("P0","P1")]
with (root/"research"/"woodworking-keyword-map-152.csv").open(newline="",encoding="utf-8") as source:
    research_rows=list(csv.DictReader(source))
assert len(research_rows)==152, "Expected 152 distinct approved research terms"
assert len({r["keyword"] for r in research_rows})==152, "Keyword duplicate in export"
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
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=="title":self.title=True
        if tag=="h1":self.h1+=1
        if tag=="form":self.forms+=1
        if tag=="meta" and a.get("name")=="robots":self.robots.append(a.get("content",""))
        if tag=="meta" and a.get("name")=="description":self.descriptions.append(a.get("content",""))
        if tag=="link" and a.get("rel")=="canonical":self.canon.append(a.get("href",""))
        if tag=="a" and a.get("href","").startswith("/"):self.links.append(a["href"])
    def handle_endtag(self,tag):
        if tag=="title":self.title=False
    def handle_data(self,data):
        if self.title:self.title_text+=data
errors=[]
pages=sorted(dist.rglob("index.html"))
assert len(active)==26 and len(hold)==5,(len(active),len(hold))
assert len(pages)==1+26+len({t["category"] for t in active})+4,len(pages)
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
    if any(t["slug"]==u.strip("/") for t in active) and c.forms!=1:errors.append(f"{u}: calculator form absent")
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
for asset in ("assets/app.mjs","assets/calcs.mjs","assets/cut-list.mjs","assets/tools.json","assets/style.css","favicon.svg","404.html","_headers"):
    if not (dist/asset).is_file():errors.append("Missing asset: "+asset)
titles=[]
for p in pages:
    c=Checker();c.feed(p.read_text(encoding="utf8"));titles.append(c.title_text)
if len(titles)!=len(set(titles)):errors.append("Duplicate page titles")
print("Preview static checks:",len(pages),"HTML pages;",len(active),"tool pages;",len(hold),"P2 held;",len(research_rows),"keyword rows validated")
if errors:
    for e in errors:print("FAIL:",e)
    raise SystemExit(1)
print("PASS: static structure, links, metadata, preview noindex, P2 hold")
