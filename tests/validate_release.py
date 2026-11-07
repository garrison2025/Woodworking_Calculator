#!/usr/bin/env python3
"""Offline release-mode SEO/GEO contract test. NEVER deploys example domain."""
import html.parser
import os
import json
import xml.etree.ElementTree as ET
from pathlib import Path

root=Path(__file__).resolve().parents[1]
dist=root/"dist"
base="https://woodworking.example"
manifest=json.loads((root/"src"/"tools.json").read_text(encoding="utf8"))
published=[x for x in manifest["tools"] if x["priority"] in ("P0","P1")]
hold=[x for x in manifest["tools"] if x["priority"]=="P2"]
# V3 original five P2 tools were implemented later, but their SEO release
# requires explicit approval in addition to RELEASE_APPROVED.
v3_p2={"spiral-staircase-calculator","gambrel-roof-calculator",
       "lumber-price-calculator","fence-picket-calculator","stave-calculator"}
assert len(v3_p2)==5 and v3_p2<={x["slug"] for x in published}
allow_p2=os.environ.get("RELEASE_V3_P2_APPROVED")=="1"
intents={x["slug"]:x for x in json.loads(
    (root/"src"/"tool-intents.json").read_text(encoding="utf8"))["tools"]}
errors=[]

class PageHead(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta={}
        self.links=[]
        self.title=""
        self.in_title=False
        self.schema=[]
        self.in_schema=False
        self.schema_text=""
        self.h1=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=="title":self.in_title=True
        if tag=="h1":self.h1+=1
        if tag=="meta":
            if "name" in a:self.meta[a["name"]]=a.get("content","")
            if a.get("property","").startswith("og:"):
                self.meta[a["property"]]=a.get("content","")
        if tag=="link":self.links.append(a)
        if tag=="script" and a.get("type")=="application/ld+json":
            self.in_schema=True;self.schema_text=""
    def handle_endtag(self,tag):
        if tag=="title":self.in_title=False
        if tag=="script" and self.in_schema:
            try:self.schema.append(json.loads(self.schema_text))
            except json.JSONDecodeError as exc:errors.append("Invalid JSON-LD: "+str(exc))
            self.in_schema=False
    def handle_data(self,data):
        if self.in_title:self.title+=data
        if self.in_schema:self.schema_text+=data

pages=list(dist.rglob("index.html"))
expected_urls={"/","/about/","/contact/","/privacy/","/terms/"}
expected_urls.update("/"+t["slug"]+"/" for t in published
                     if t["slug"] not in v3_p2 or allow_p2)
category_urls={"/"+data[1]+"/" for key,data in manifest["categories"].items()
               if any(t["category"]==key for t in published)}
release_categories={"/"+data[1]+"/" for key,data in manifest["categories"].items()
                    if any(t["category"]==key and (t["slug"] not in v3_p2 or allow_p2)
                           for t in published)}
expected_urls.update(release_categories)
assert ("/materials/" in release_categories)==allow_p2, "Materials must stay noindex until lumber P2 approval"
assert len(published)==31 and len(hold)==0
all_preview_routes=expected_urls|category_urls|{"/"+t["slug"]+"/" for t in published}
actual_urls=set()
for p in pages:
    path="/" if p.parent==dist else "/"+p.parent.relative_to(dist).as_posix()+"/"
    actual_urls.add(path)
    c=PageHead()
    c.feed(p.read_text(encoding="utf8"))
    eligible=path in expected_urls
    expected_robots="index,follow" if eligible else "noindex,nofollow,noarchive"
    if c.meta.get("robots")!=expected_robots:
        errors.append(path+": expected robots "+expected_robots)
    if c.h1!=1:errors.append(path+": expected one H1")
    can=[x.get("href") for x in c.links if x.get("rel")=="canonical"]
    if can!=([base+path] if eligible else []):errors.append(path+": canonical URL mismatch")
    if len(c.schema)!=(1 if eligible else 0):
        errors.append(path+": unexpected structured data count")
    elif eligible:
        j=c.schema[0]
        tool=next((t for t in published if t["slug"]==path.strip("/")),None)
        target="WebApplication" if tool else "WebSite"
        if j.get("@context")!="https://schema.org" or j.get("@type")!=target:
            errors.append(path+": incorrect JSON-LD type")
        if j.get("url")!=base+path:
            errors.append(path+": schema URL not same as canonical")
        if tool:
            if j.get("isAccessibleForFree") is not True:
                errors.append(path+": tool not marked as free application")
            if j.get("applicationCategory")!="UtilitiesApplication":
                errors.append(path+": unsupported applicationCategory")
            if j.get("name")!=intents[tool["slug"]]["seoTitle"]:
                errors.append(path+": application name differs from rendered task title")
    if not c.meta.get("description") or not c.meta.get("og:description"):
        errors.append(path+": missing explanatory description/social text")
    if not c.meta.get("og:title"):
        errors.append(path+": missing social title")
    if "pages.dev" in p.read_text(encoding="utf8"):
        errors.append(path+": preview host leaked into release HTML")
if actual_urls!=all_preview_routes:
    errors.append("Published path set mismatch: extra="+repr(sorted(actual_urls-all_preview_routes))+
                  " missing="+repr(sorted(all_preview_routes-actual_urls)))
for held in hold:
    if (dist/held["slug"]).exists():errors.append("P2 published without review: "+held["slug"])
site=dist/"sitemap.xml"
if not site.exists():errors.append("No release sitemap")
else:
    tree=ET.parse(site)
    ns={"s":"http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs=[el.text for el in tree.findall(".//s:loc",ns)]
    if len(locs)!=len(set(locs)) or set(locs)!={base+u for u in expected_urls}:
        errors.append("Sitemap differs from exactly the validated indexable routes")
robots=(dist/"robots.txt").read_text(encoding="utf8")
if "Allow: /" not in robots or "Sitemap: "+base+"/sitemap.xml" not in robots:
    errors.append("Release robots.txt does not permit sitemap crawling")
if "Disallow: /" in robots:
    errors.append("Release robots.txt still blocks indexing")
if errors:
    for e in errors:print("FAIL:",e)
    raise SystemExit(1)
print("PASS: release dry-run contains",len(expected_urls),
      "unique canonical/schema/sitemap routes; original V3 P2 SEO approved:",allow_p2,
       "; all 31 calculators remain usable, only eligible pages indexable")
print("NOTE: https://woodworking.example is a reserved offline test domain, not a purchased or deployed domain.")
