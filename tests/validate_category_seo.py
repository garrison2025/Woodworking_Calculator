#!/usr/bin/env python3
"""Detect new duplicate/thin category templates and avoid preventable payload regressions.

Measured file-size ceilings are build artifacts, NOT field Core Web Vitals or
Google Search Console evidence. They do not assert crawl rank or speed score.
"""
import html
import json
from html.parser import HTMLParser
from pathlib import Path
import struct

ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/"dist"
registry=json.loads((ROOT/"src"/"tools.json").read_text(encoding="utf8"))
guides=json.loads((ROOT/"src"/"category-guides.json").read_text(encoding="utf8"))
class TextHead(HTMLParser):
    def __init__(self):
        super().__init__();self.heading=[];self.h1=False;self.count=0
    def handle_starttag(self,tag,attrs):
        if tag=="h1":self.h1=True;self.count+=1
    def handle_endtag(self,tag):
        if tag=="h1":self.h1=False
    def handle_data(self,data):
        if self.h1:self.heading.append(data)

home=(DIST/"index.html").read_text(encoding="utf8")
hp=TextHead();hp.feed(home)
assert hp.count==1 and "Free woodworking calculators" in "".join(hp.heading), "Home H1 must state what the site does"
assert "Good work begins" not in "".join(hp.heading), "Avoid an ambiguous brand-only H1"
assert '<script src="https://' not in home, "Do not add third-party runtime trackers through the SEO build"
seen=set()
for key,(label,slug) in registry["categories"].items():
    guide=guides[key]
    route=DIST/slug/"index.html"
    raw=route.read_text(encoding="utf8")
    doc=TextHead();doc.feed(raw)
    assert doc.count==1, (slug,"expected one H1")
    assert html.escape(guide["title"]) in raw, (slug,"missing descriptive title")
    assert html.escape(guide["lead"]) in raw, (slug,"missing custom intro")
    assert html.escape(guide["example"]) in raw, (slug,"missing independent calculation example")
    assert html.escape(guide["limit"]) in raw, (slug,"missing task limits")
    assert len(guide["lead"])>130 and len(guide["example"])>170, (slug,"thin guide")
    assert guide["example"] not in seen, (slug,"duplicated generic worked example")
    seen.add(guide["example"])
    for choice in guide["choices"]:
        assert choice["slug"] in {t["slug"] for t in registry["tools"] if t["category"]==key}, (slug,"cross-category choice")
        assert 'href="/'+choice["slug"]+'/"' in raw, (slug,"missing tool link")
    if key=="materials":
        assert len(guide["choices"])==1, "Materials must not invent tools"
        assert "0.008 MBF" in raw and "8 board feet" in raw, "Materials must explain BF to MBF with units"
# Full-width raster OG card should exist as a portable PNG and remain small.
png=(DIST/"social-card.png").read_bytes()
assert png[:8]==bytes.fromhex("89504e470d0a1a0a"), "OG image must be a real PNG"
width,height=struct.unpack(">II",png[16:24])
assert (width,height)==(1200,630), "OG PNG dimensions mismatch"
assert len(png)<200_000, "OG PNG exceeded 200 KB source budget"
assert len(list(DIST.rglob("index.html")))==42
# Soft-enforced static weight ceiling guards against accidentally embedding
# model registry or CSS into every page. Does not predict Core Web Vitals.
for path,maxbytes in [("assets/style.css",220_000),("assets/app.mjs",400_000),
                      ("assets/home.mjs",130_000)]:
    assert (DIST/path).stat().st_size<maxbytes,(path,"static payload unexpectedly large")
print("PASS: 6 distinct category guides, 42 original routes, semantic H1, 1200x630 OG PNG and static asset size budgets.")
