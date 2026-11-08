#!/usr/bin/env python3
"""Offline release-mode SEO/GEO contract test. NEVER deploys example domain."""
import html
import html.parser
import json
import os
import xml.etree.ElementTree as ET
from pathlib import Path

root=Path(__file__).resolve().parents[1]
dist=root/"dist"
base=os.environ.get("EXPECTED_RELEASE_ORIGIN", "https://woodworking.example")
manifest=json.loads((root/"src"/"tools.json").read_text(encoding="utf8"))
published=[x for x in manifest["tools"] if x["priority"] in ("P0","P1")]
hold=[x for x in manifest["tools"] if x["priority"]=="P2"]
# All 31 completed tools are eligible in one owner-authorized custom-domain
# SEO release. Historical V3 P2 planning priority has no separate index gate.
intents={x["slug"]:x for x in json.loads(
    (root/"src"/"tool-intents.json").read_text(encoding="utf8"))["tools"]}
guides=json.loads((root/"src"/"category-guides.json").read_text(encoding="utf8"))
category_by_path={"/"+slug+"/":key for key,(_,slug) in manifest["categories"].items()}
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
expected_urls.update("/"+t["slug"]+"/" for t in published)
category_urls={"/"+data[1]+"/" for key,data in manifest["categories"].items()
               if any(t["category"]==key for t in published)}
expected_urls.update(category_urls)
assert "/materials/" in category_urls, "Materials category must be released with Lumber Price"
assert len(published)==31 and len(hold)==0
assert len(expected_urls)==42, "Production sitemap must index exactly all 42 approved routes"
all_preview_routes=expected_urls
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
        target=("WebApplication" if tool else "CollectionPage" if path in category_urls
                else "WebSite" if path=="/" else "AboutPage" if path=="/about/"
                else "ContactPage" if path=="/contact/" else "WebPage")
        if j.get("@context")!="https://schema.org" or j.get("@type")!=target:
            errors.append(path+": incorrect JSON-LD type")
        if j.get("url")!=base+path:
            errors.append(path+": schema URL not same as canonical")
        if path in category_urls or tool:
            crumbs=j.get("breadcrumb", {})
            elements=crumbs.get("itemListElement",[]) if isinstance(crumbs,dict) else []
            expected_crumbs=3 if tool else 2
            if crumbs.get("@type")!="BreadcrumbList" or len(elements)!=expected_crumbs:
                errors.append(path+": missing or incorrect task breadcrumb schema")
            else:
                for i,crumb in enumerate(elements):
                    if crumb.get("position")!=i+1 or not str(crumb.get("item","")).startswith(base):
                        errors.append(path+": breadcrumb item/position mismatch")
        if path in category_urls:
            guide=guides[category_by_path[path]]
            if c.title!=guide["title"]+" | WoodLayout":
                errors.append(path+": category title differs from task guide")
            body=p.read_text(encoding="utf8")
            for text in (guide["lead"],guide["example"],guide["limit"],guide["example_title"]):
                if html.escape(text, quote=True) not in body:
                    errors.append(path+": unique category content not rendered")
            for choice in guide["choices"]:
                if 'href="/'+choice["slug"]+'/"' not in body:
                    errors.append(path+": missing curated same-category link "+choice["slug"])
            list_data=j.get("mainEntity", {})
            rows=list_data.get("itemListElement",[]) if isinstance(list_data,dict) else []
            category_count=sum(t["category"]==category_by_path[path] for t in published)
            if list_data.get("@type")!="ItemList" or list_data.get("numberOfItems")!=category_count or len(rows)!=category_count:
                errors.append(path+": category ItemList does not match actual links")
        if path=="/" and (j.get("name")!="WoodLayout" or
                        j.get("@id")!=base+"/#website" or
                        "Free woodworking calculators" not in p.read_text(encoding="utf8")):
            errors.append(path+": missing named WebSite or descriptive primary H1")
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
    if c.meta.get("og:url")!=base+path or c.meta.get("og:image")!=base+"/social-card.png":
        errors.append(path+": missing canonical Open Graph URL or PNG image")
    if c.meta.get("og:image:width")!="1200" or c.meta.get("og:image:height")!="630":
        errors.append(path+": incorrect OG raster dimensions")
    if "pages.dev" in p.read_text(encoding="utf8"):
        errors.append(path+": preview host leaked into release HTML")
if actual_urls!=all_preview_routes:
    errors.append("Published path set mismatch: extra="+repr(sorted(actual_urls-all_preview_routes))+
                  " missing="+repr(sorted(all_preview_routes-actual_urls)))
for held in hold:
    if (dist/held["slug"]).exists():errors.append("P2 published without review: "+held["slug"])
social=dist/"social-card.png"
if not social.exists() or social.read_bytes()[:8]!=bytes.fromhex("89504e470d0a1a0a"):
    errors.append("Missing or invalid branded social PNG")
elif len(social.read_bytes())>200_000:
    errors.append("Branded PNG share image exceeds lightweight budget")
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
# A custom 404 response is NEVER a canonical landing page, even when all
# allowed production routes are indexable.
notfound=(dist/"404.html").read_text(encoding="utf8")
notfound_head=PageHead();notfound_head.feed(notfound)
if notfound_head.meta.get("robots")!="noindex,nofollow,noarchive":
    errors.append("Production 404.html must remain noindex")
if any(x.get("rel")=="canonical" for x in notfound_head.links):
    errors.append("Production 404.html must not publish canonical")
if notfound_head.schema:
    errors.append("Production 404.html must not contain JSON-LD")
headers=(dist/"_headers").read_text(encoding="utf8")
nonindex="  X-Robots-Tag: noindex, nofollow, noarchive\n"
for pattern in ("https://woodworking-calculator.pages.dev/*",
                "https://:version.woodworking-calculator.pages.dev/*"):
    if pattern+"\n"+nonindex not in headers:
        errors.append("Production Pages alias is missing host-scoped noindex: "+pattern)
if "\n/*\n"+nonindex in "\n"+headers:
    errors.append("Production must not globally noindex the approved custom domain")
# Owner has approved the five originally P2 tools. An extra HTTP noindex on
# any route would silently suppress its approved canonical/sitemap listing.
for path in sorted(expected_urls):
    if "\n"+path+"\n"+nonindex in headers:
        errors.append("Approved URL has obsolete path-scoped HTTP noindex: "+path)

if errors:
    for e in errors:print("FAIL:",e)
    raise SystemExit(1)
print("PASS: release dry-run contains",len(expected_urls),
      "unique canonical/schema/sitemap routes including all 31 calculators and Materials")
print("NOTE: Static release validation does not prove public domain response, HTTPS, or Google indexing.")
