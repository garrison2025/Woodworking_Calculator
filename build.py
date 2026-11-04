#!/usr/bin/env python3
"""Static site generator. No dependencies, account, APIs, or runtime backend."""
from __future__ import annotations
import html
import json
import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEST = ROOT / "dist"
REGISTRY = json.loads((ROOT / "src" / "tools.json").read_text(encoding="utf-8"))
TOOLS = [t for t in REGISTRY["tools"] if t["priority"] in {"P0", "P1"}]
CATS = REGISTRY["categories"]
SITE_URL = os.environ.get("SITE_URL", "").strip().rstrip("/")
APPROVED = os.environ.get("RELEASE_APPROVED") == "1"
INDEXABLE = SITE_URL.startswith("https://") and "pages.dev" not in SITE_URL and APPROVED
esc = lambda s: html.escape(str(s), quote=True)

def href(path):
    return "/" + path.strip("/") + ("/" if path and not path.endswith(".") else "")

def page(title, description, body, path="/", type_="website"):
    desc = description[:180]
    canon = SITE_URL + path if INDEXABLE else None
    canonical = f'<link rel="canonical" href="{esc(canon)}">' if canon else ""
    robots = "index,follow" if INDEXABLE else "noindex,nofollow,noarchive"
    schema = ""
    if INDEXABLE:
        item = {"@context":"https://schema.org","@type":"WebApplication" if type_ == "tool" else "WebSite","name":title if type_ == "tool" else "Workshop Geometry Tools","description":desc,"url":canon}
        if type_ == "tool":
            item["applicationCategory"] = "UtilitiesApplication"
            item["operatingSystem"] = "Any"
            item["isAccessibleForFree"] = True
        schema = '<script type="application/ld+json">' + json.dumps(item, ensure_ascii=False).replace("<","\\u003c") + '</script>'
    nav = '<a class="brand" href="/" aria-label="Workshop Geometry Tools home"><span class="brand-icon">W<span>G</span></span><span>WORKSHOP <b>GEOMETRY</b><small>MEASURE. LAYOUT. BUILD.</small></span></a>'
    links = [('Tools','/#tools'),('Framing','/framing/'),('Decks','/decks-and-railings/'),('Roofs & stairs','/roof-and-stairs/'),('Woodworking','/woodworking/')]
    navlinks = ''.join(f'<a href="{esc(url)}">{esc(label)}</a>' for label,url in links)
    footer = ('<footer class="footer"><div class="footer-inner"><p><strong>Workshop Geometry Tools</strong> · Draft useful measurements, not engineering approvals.</p>'
              '<nav aria-label="Legal"><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav>'
              '<small>All diagrams are illustrative unless separately verified for full-size printing. No login, paid API or cloud data storage.</small></div></footer>')
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<meta name="color-scheme" content="light"><meta name="robots" content="{robots}">'
            f'<title>{esc(title)} | Workshop Geometry Tools</title><meta name="description" content="{esc(desc)}">{canonical}'
            f'<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/assets/style.css">'
            f'<meta property="og:type" content="website"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">{schema}'
            f'</head><body data-tool="{esc(path.strip("/")) if type_ == "tool" else ""}">'
            f'<a href="#main" class="skip">Skip to main content</a><header class="topbar"><div class="topbar-inner">{nav}<nav aria-label="Primary navigation">{navlinks}</nav><a class="nav-cta" href="/#tools">Explore calculators <span aria-hidden="true">↗</span></a></div></header>'
            f'<main id="main">{body}</main>{footer}'
            f'<script type="module" src="/assets/app.mjs"></script></body></html>')

def write(url, content):
    target = DEST / url.strip("/") / "index.html" if url != "/" else DEST / "index.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

def tool_card(t):
    return (f'<a class="tool-card" href="/{esc(t["slug"])}/">'
            f'<span class="tool-card-top"><span class="tool-icon" aria-hidden="true">⌁</span><span class="tool-priority">{esc(t["priority"])}</span></span>'
            f'<strong>{esc(t["title"])}</strong><span>{esc(t["desc"])}</span>'
            f'<span class="tool-card-bottom">Open calculator <span aria-hidden="true">↗</span></span></a>')

def categories_nav():
    out = []
    for key,(name,slug) in CATS.items():
        subset = [t for t in TOOLS if t["category"] == key]
        if not subset:
            continue
        out.append(f'<a class="category-pill" href="/{slug}/"><span>{esc(name)}</span><span class="category-count">{len(subset):02d}</span></a>')
    return ''.join(out)

def hero_graphic():
    return '''<div class="hero-graphic" aria-hidden="true"><svg viewBox="0 0 590 350"><defs><pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#d0d8d0" stroke-width=".7"/></pattern></defs><rect x="0" y="0" width="590" height="350" fill="url(#p)"/><g transform="translate(75 48)"><path d="M35 228L395 228 395 38Z" fill="#e5eee6" stroke="#1e6454" stroke-width="3"/><path d="M35 228V70L395 38" fill="none" stroke="#b48456" stroke-dasharray="9 6" stroke-width="2"/><path d="M35 228L395 38" stroke="#1e6454" stroke-width="5"/><g stroke="#bd8d54" stroke-width="4"><path d="M85 228V202M145 228V170M205 228V139M265 228V107M325 228V75"/></g><path d="M35 245V262M395 245V262M35 256H395" stroke="#64736c" stroke-width="1.5"/><path d="M25 228L35 228 35 218" fill="none" stroke="#64736c" stroke-width="1.5"/><g fill="#34554b" font-family="monospace" font-size="14"><text x="185" y="280">12′-0″  /  144 IN</text><text x="400" y="38">6:12</text><text x="46" y="58">R A K E  W A L L</text></g></g></svg><div class="graphic-caption"><span class="graphic-dot"></span> LIVE GEOMETRY WORKSPACE <span>DRAWING 01 / 26</span></div></div>'''

def home():
    featured = sorted(TOOLS, key=lambda t:(t["priority"] != "P0", -t["volume"]))[:6]
    body = ('<section class="hero wrap"><div class="hero-copy"><span class="eyebrow"><span class="eyebrow-dot"></span> PRECISION FOR THE WORKSHOP</span>'
            '<h1>Good work begins<br>with <em>better measurements.</em></h1>'
            '<p>Woodworking calculators for practical layouts, cut lengths, spacing and material takeoffs. Enter dimensions, inspect an annotated drawing, then export your work.</p>'
            '<div class="hero-actions"><a class="btn primary" href="/#tools">Explore 26 free tools <span aria-hidden="true">↗</span></a>'
            '<a class="btn subtle" href="/stud-calculator/">Try the stud calculator</a></div>'
            '<div class="hero-facts"><span><strong>26</strong> working calculator routes</span><span><strong>6</strong> workshop categories</span><span><strong>0</strong> accounts required</span></div>'
            '</div>' + hero_graphic() + '</section>')
    body += ('<section id="tools" class="wrap home-section"><div class="section-heading"><div><span class="eyebrow">FIND YOUR TOOL</span>'
             '<h2>Built around the work, not the jargon.</h2><p>Browse the most common workshop measurements and quickly jump to the right calculator.</p></div></div>'
             '<nav class="categories" aria-label="Tool categories">'+categories_nav()+'</nav>'
             '<div class="section-heading compact"><h3>Start with a proven task</h3><span>FEATURED TOOLS</span></div><div class="tool-grid">'+''.join(tool_card(t) for t in featured)+'</div>'
             '<div class="section-heading compact" id="all-tools"><h3>Every available calculator</h3><span>26 TOOL WORKSPACES</span></div>'
             '<div class="directory-list">'+''.join(f'<a href="/{esc(t["slug"])}/"><span>{esc(t["title"])}</span><small>{esc(CATS[t["category"]][0])}</small><b>↗</b></a>' for t in TOOLS)+'</div>'
             '</section>')
    body+= ('<section class="wrap trust-strip"><div><span class="eyebrow">REPRODUCIBLE BY DESIGN</span><h2>Measure, inspect, take it to the bench.</h2></div>'
            '<div><b>01 / Input</b><p>US customary inches first, millimeters one click away.</p></div>'
            '<div><b>02 / Check</b><p>Visible formulas, explicit assumptions, precise dimensions.</p></div>'
            '<div><b>03 / Export</b><p>Save a locally generated CSV or SVG; print to PDF from your browser.</p></div></section>')
    return page("Free Woodworking Calculators, Layout & Cutting Geometry","26 practical woodworking geometry and layout tools: studs, decking, rafters, framing, spacing, shelves and cutting diagrams.",body)

def tool_page(t):
    fields = ''.join(f'<div class="field"><label for="f-{esc(f["key"])}">{esc(f["label"])}{(" <span data-length-unit>in</span>" if f["kind"]=="L" else "")}</label>'
         f'<input id="f-{esc(f["key"])}" name="{esc(f["key"])}" type="number" inputmode="decimal" step="any" value="{esc(f["value"])}" aria-describedby="field-note-{esc(f["key"])}">'
         f'<small id="field-note-{esc(f["key"])}">{"Length: enter inches or millimeters" if f["kind"] == "L" else "Enter a number using the described measurement"}</small></div>' for f in t["inputs"])
    related = [p for p in TOOLS if p["category"]==t["category"] and p["slug"]!=t["slug"]][:4]
    others = [p for p in TOOLS if p["category"]!=t["category"]][:2]
    relevant=(related+others)[:6]
    catname,catslug=CATS[t["category"]]
    body=(f'<div class="wrap tool-heading"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">All tools</a><span>/</span><a href="/{catslug}/">{esc(catname)}</a><span>/</span>{esc(t["title"])}</nav>'
          f'<span class="eyebrow"><span class="eyebrow-dot"></span> TOOL {esc(t["priority"])} · GEOMETRY WORKSPACE</span>'
          f'<h1>{esc(t["title"])}</h1><p class="tool-lede">{esc(t["desc"])}</p>'
          '<div class="tool-hints"><span>↗ Live calculation</span><span>◈ Scaled schematic</span><span>⇩ Local export</span></div></div>')
    body+=(f'<section class="workspace wrap" data-workspace><div class="pane input-pane"><div class="pane-head"><div><span class="pane-index">01 / SETUP</span>'
           '<h2>Measurements</h2></div><span class="pane-state">EDITABLE</span></div>'
           '<div class="unit-row"><label for="unit-select">Units</label><select id="unit-select" aria-label="Measurement units"><option value="in">Inches (in)</option><option value="mm">Millimeters (mm)</option></select>'
           '<label for="fraction-select">Fraction</label><select id="fraction-select" aria-label="Inch fraction precision"><option value="16">1/16</option><option value="32">1/32</option></select></div>'
           f'<form id="calculator-form" novalidate>{fields}</form>'
           '<div class="pane-actions"><button class="btn secondary" id="reset-values" type="button">Reset dimensions ↺</button></div>'
           '<p class="sidebar-note"><span>ⓘ</span> Inputs stay in your browser. Units convert automatically; calculations run locally.</p></div>'
           '<div class="pane drawing-pane"><div class="pane-head"><div><span class="pane-index">02 / VISUALIZE</span><h2>Dimension drawing</h2></div>'
           '<div class="zoom-controls"><button type="button" id="zoom-out" aria-label="Zoom out">−</button><button type="button" id="zoom-reset" aria-label="Reset zoom">100%</button><button type="button" id="zoom-in" aria-label="Zoom in">+</button></div></div>'
           '<div class="drawing-grid" id="dimension-svg"><div class="loading-graphic">Drawing will update from your measurements.</div></div>'
           '<div class="drawing-caption"><span><i></i> SCALED SCHEMATIC</span><span>NOT A VERIFIED 1:1 TEMPLATE</span></div>'
           '<div class="diagram-tools"><button type="button" class="btn subtle" id="download-svg">↓ Save SVG</button><button type="button" class="btn subtle" id="print-sheet">⎙ Print / PDF</button></div></div>'
           '<aside class="pane result-pane"><div class="pane-head"><div><span class="pane-index">03 / RESULTS</span><h2>Your takeoff</h2></div><span class="live-indicator">LIVE</span></div>'
           '<p id="calc-error" class="error-banner" role="alert" hidden></p><div id="result-cards" class="result-stack" aria-live="polite">'
           '<p class="empty-result">Enter measurements to see calculated dimensions.</p></div>'
           '<div class="export-stack"><button type="button" id="copy-result" class="btn primary">Copy results <span>↗</span></button>'
           '<button type="button" id="download-csv" class="btn secondary">↓ Download CSV cut list</button></div>'
           '<p class="action-status" id="action-status" role="status" aria-live="polite">Calculations will update instantly.</p></aside></section>')
    body+=(f'<section class="wrap detail-layout"><div class="detail-main"><div class="content-block"><span class="eyebrow">CUT & POSITION DATA</span><h2>Measurement schedule</h2>'
           '<p>Items below are generated from the same numbers used for the drawing. Use CSV for a portable worksheet; inspect all cuts on site.</p>'
           '<div class="table-scroll"><table id="cut-table"><tbody><tr><td>Calculated position data appears here.</td></tr></tbody></table></div></div>'
           '<div class="content-block proof"><span class="eyebrow">CALCULATION METHOD</span><h2>How this calculator works</h2>'
           f'<p>{esc(t["desc"])}</p><p class="formula"><strong>Geometry rule</strong> {esc(t["formula"])}</p>'
           f'<h3>Reproducible example</h3><p>{esc(t["example"])}</p><h3>Assumptions and limits</h3>'
           f'<p id="print-assumptions">{esc(t["limit"])}</p>'
           '<p class="caution">This tool describes dimensional geometry. It does not certify building-code compliance, structural capacity, fastening, material quality or safe cutting techniques.</p>'
           '<h3>Printing and precision</h3><p>Use Print / PDF to save the worksheet as a PDF. The SVG is a proportional diagram, not a one-to-one cutting template. Before transferring marks to wood, verify units, stock dimensions, kerf, reference faces and printer scaling.</p>'
           '</div></div><aside class="details-side"><div class="related-box"><span class="eyebrow">NEXT AT THE WORKBENCH</span><h2>Related tools</h2>'
           +''.join(f'<a href="/{esc(r["slug"])}/">{esc(r["title"])} <span>↗</span></a>' for r in relevant)
           +'</div><div class="related-box muted-box"><span class="eyebrow">SITE POLICY</span><h3>Local by default</h3><p>No account, no project upload, no paid API. A small local setting may remember recent tools.</p></div></aside></section>')
    return page(t["title"],t["desc"]+" Formula, dimension diagram, metric units and CSV takeoff.",body,"/"+t["slug"]+"/","tool")

def cat_page(key, name, slug):
    subset=[t for t in TOOLS if t["category"]==key]
    body=(f'<section class="wrap category-header"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">All tools</a><span>/</span>{esc(name)}</nav>'
          f'<span class="eyebrow">WORKSHOP DIRECTORY / {len(subset):02d} TOOLS</span><h1>{esc(name)}</h1>'
          '<p>Choose a dedicated measurement tool. Every calculator has explicit inputs, a geometric result, a printable diagram and its own calculation explanation.</p>'
          '<div class="tool-grid">'+''.join(tool_card(t) for t in subset)+'</div></section>')
    return page(f"{name} Calculators",f"Free practical {name.lower()} calculators with SVG dimension drawings and downloadable measurement lists.",body)

def info_page(title, paragraphs, url):
    body='<article class="wrap legal-page"><a href="/">← Back to calculators</a><span class="eyebrow">WORKSHOP GEOMETRY TOOLS</span><h1>'+esc(title)+'</h1>'+''.join('<p>'+esc(p)+'</p>' for p in paragraphs)+'</article>'
    return page(title,paragraphs[0],body,url)

def build():
    if DEST.exists(): shutil.rmtree(DEST)
    DEST.mkdir()
    assets=DEST/"assets";assets.mkdir()
    shutil.copyfile(ROOT/"src"/"tools.json",assets/"tools.json")
    shutil.copyfile(ROOT/"src"/"app.mjs",assets/"app.mjs")
    shutil.copyfile(ROOT/"src"/"calcs.mjs",assets/"calcs.mjs")
    shutil.copyfile(ROOT/"src"/"style.css",assets/"style.css")
    write("/",home())
    for t in TOOLS: write("/"+t["slug"]+"/",tool_page(t))
    for k,(name,slug) in CATS.items():
        if any(t["category"]==k for t in TOOLS):write("/"+slug+"/",cat_page(k,name,slug))
    pages={
    "/about/":("About",["Workshop Geometry Tools is an independent collection of browser-based woodworking geometry calculators. It gives DIY builders reproducible measurements, diagrams and local exports.","These tools are educational dimension aids only; they do not provide structural engineering, safe spans, or building-code certification."]),
    "/contact/":("Contact",["For feedback, corrections or questions, please open an issue in the public GitHub repository: github.com/garrison2025/Woodworking_Calculator.","We do not collect contact messages through this website or maintain a user account system."]),
    "/privacy/":("Privacy",["This preview does not run analytics, advertising scripts, third-party APIs, or form submissions. Calculator values are processed in your browser; no measurements are uploaded by the site.","The website may store a short list of recently visited tools in your browser localStorage. You can remove that item by clearing site storage. The web host can still process standard HTTP requests and access logs. If analytics or ads are added, this policy must be revised before those scripts are enabled."]),
    "/terms/":("Terms & Safety",["All tools are supplied as free dimensional reference aids without warranties. Verify actual cuts against a physical sample, chosen stock and applicable local codes.","No computed number constitutes structural certification or a guarantee of workmanship. Avoid using a diagram as a full-size printed cutting template unless its physical scale has been verified."])
    }
    for path,(title,paragraphs) in pages.items():write(path,info_page(title,paragraphs,path))
    (DEST/"favicon.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="18" fill="#1e6454"/><path d="M14 21l10 39h9l7-25 7 25h9l10-39H55l-4 20-6-20H35l-6 20-4-20z" fill="#f8f7f4"/></svg>')
    (DEST/"404.html").write_text(page("Page not found","This tool URL is not available.","<section class='wrap legal-page'><h1>That tool isn't here.</h1><p>Try the complete calculator directory.</p><a class='btn primary' href='/#tools'>Find a tool ↗</a></section>","/404/"))
    (DEST/"_headers").write_text("/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n")
    if INDEXABLE:
        urls=["/"]+[f"/{t['slug']}/" for t in TOOLS]+["/"+slug+"/" for key,(name,slug) in CATS.items() if any(t["category"]==key for t in TOOLS)]+list(pages)
        xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+esc(SITE_URL+url)+'</loc></url>' for url in urls)+'</urlset>'
        (DEST/"sitemap.xml").write_text(xml,encoding="utf-8")
        (DEST/"robots.txt").write_text("User-agent: *\nAllow: /\nSitemap: "+SITE_URL+"/sitemap.xml\n")
    else:
        (DEST/"robots.txt").write_text("User-agent: *\nDisallow: /\n")
    print(f"Built {len(TOOLS)} calculator pages; indexable={INDEXABLE}; output={DEST}")

if __name__ == "__main__":
    build()
