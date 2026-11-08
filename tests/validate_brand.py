#!/usr/bin/env python3
"""Check one coherent WoodLayout vector logo throughout all built static pages."""
from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"

class HeadAndBrand(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_title = False
        self.title = ""
        self.icon = []
        self.brand_links = 0
        self.brand_marks = 0
        self.site_names = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "a" and "brand" in a.get("class", "").split():
            if a.get("href") != "/" or a.get("aria-label") != "WoodLayout home":
                raise AssertionError("Brand link has wrong home URL or accessible name")
            self.brand_links += 1
        if tag == "img" and a.get("src") == "/logo-mark.svg":
            if a.get("alt") != "WoodLayout logo" or a.get("width") != "44" or a.get("height") != "44":
                raise AssertionError("Brand SVG img must describe the logo and retain stable dimensions")
            self.brand_marks += 1
        if tag == "link" and a.get("rel") == "icon":
            self.icon.append(a.get("href"))
        if tag == "meta" and a.get("property") == "og:site_name":
            self.site_names.append(a.get("content"))
    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
    def handle_data(self, data):
        if self.in_title:
            self.title += data

mark = (ROOT / "src" / "logo-mark.svg").read_text(encoding="utf-8")
lockup = (ROOT / "src" / "logo-lockup.svg").read_text(encoding="utf-8")
for label, raw in [("mark", mark), ("lockup", lockup)]:
    svg = ET.fromstring(raw)
    assert svg.tag == "{http://www.w3.org/2000/svg}svg", label + " not a valid SVG"
    assert svg.attrib.get("viewBox"), label + " missing scalable viewBox"
    assert any(x.text and "WoodLayout" in x.text
               for x in svg.iter("{http://www.w3.org/2000/svg}title")), label + " missing SVG accessible title"
assert (DIST / "logo-mark.svg").read_text(encoding="utf-8") == mark
assert (DIST / "favicon.svg").read_text(encoding="utf-8") == mark
assert (DIST / "logo-lockup.svg").read_text(encoding="utf-8") == lockup
pages = list(DIST.rglob("index.html"))
assert len(pages) == 42, f"Expected 42 indexed page files, found {len(pages)}"
for file in pages:
    contents = file.read_text(encoding="utf-8")
    parser = HeadAndBrand()
    parser.feed(contents)
    assert parser.title.endswith(" | WoodLayout"), file
    assert parser.icon == ["/favicon.svg"], file
    assert parser.site_names == ["WoodLayout"], file
    assert parser.brand_links == parser.brand_marks == 1, file
    assert 'class="brand-wordmark"' in contents and "Wood<span>Layout</span>" in contents, file
    assert "WORKSHOP <b>GEOMETRY</b>" not in contents, file
print("PASS: WoodLayout identity, one scalable mark/fav icon, and 42 coherent static pages.")
