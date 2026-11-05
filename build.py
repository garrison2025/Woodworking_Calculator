#!/usr/bin/env python3
"""Static site generator. No dependencies, account, APIs, or runtime backend."""
from __future__ import annotations
import html
import json
import csv
import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEST = ROOT / "dist"
REGISTRY = json.loads((ROOT / "src" / "tools.json").read_text(encoding="utf-8"))
TOOLS = [t for t in REGISTRY["tools"] if t["priority"] in {"P0", "P1"}]
CATS = REGISTRY["categories"]
with (ROOT / "research" / "woodworking-keyword-map-152.csv").open(encoding="utf-8", newline="") as keyword_file:
    KEYWORDS = list(csv.DictReader(keyword_file))
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
            '<div class="hero-facts"><span><strong>26</strong> working calculator routes</span><span><strong>5</strong> active categories</span><span><strong>0</strong> accounts required</span></div>'
            '</div>' + hero_graphic() + '</section>')
    body += ('<section id="tools" class="wrap home-section"><div class="section-heading"><div><span class="eyebrow">FIND YOUR TOOL</span>'
             '<h2>Built around the work, not the jargon.</h2><p>Browse the most common workshop measurements and quickly jump to the right calculator.</p></div></div>'
             '<nav class="categories" aria-label="Tool categories">'+categories_nav()+'</nav>'
             '<section id="recent-tools" class="recent-panel" hidden><span class="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h3>Recently used tools</h3><div id="recent-links" class="recent-links"></div></section>'
             '<div class="section-heading compact"><h3>Start with a proven task</h3><span>FEATURED TOOLS</span></div><div class="tool-grid">'+''.join(tool_card(t) for t in featured)+'</div>'
             '<div class="section-heading compact" id="all-tools"><h3>Every available calculator</h3><span>26 TOOL WORKSPACES</span></div>'
             '<div class="directory-list">'+''.join(f'<a href="/{esc(t["slug"])}/"><span>{esc(t["title"])}</span><small>{esc(CATS[t["category"]][0])}</small><b>↗</b></a>' for t in TOOLS)+'</div>'
             '</section>')
    body+= ('<section class="wrap trust-strip"><div><span class="eyebrow">REPRODUCIBLE BY DESIGN</span><h2>Measure, inspect, take it to the bench.</h2></div>'
            '<div><b>01 / Input</b><p>US customary inches and feet, with millimeters, centimeters and meters one click away.</p></div>'
            '<div><b>02 / Check</b><p>Visible formulas, explicit assumptions, precise dimensions.</p></div>'
            '<div><b>03 / Export</b><p>Save a locally generated CSV or SVG; print to PDF from your browser.</p></div></section>')
    return page("Free Woodworking Calculators, Layout & Cutting Geometry","26 practical woodworking geometry and layout tools: studs, decking, rafters, framing, spacing, shelves and cutting diagrams.",body)

def tool_page(t):
    cluster = [k["keyword"] for k in KEYWORDS if k["target_route"] == '/' + t['slug'] + '/' and k['keyword'].lower() != t['keyword'].lower()]
    related_search_terms = ', '.join(cluster[:4])
    def field_markup(f):
        field_id = 'f-' + esc(f["key"])
        label = esc(f["label"]) + (' <span data-length-unit>in</span>' if f["kind"] == "L" else '')
        if f.get("options"):
            opts = ''.join(f'<option value="{esc(o["value"])}"{" selected" if o["value"] == f["value"] else ""}>{esc(o["label"])}</option>' for o in f["options"])
            control = f'<select id="{field_id}" name="{esc(f["key"])}" aria-describedby="field-note-{esc(f["key"])}">{opts}</select>'
            note = 'Select the intended reference or layout option'
        else:
            control = f'<input id="{field_id}" name="{esc(f["key"])}" type="number" inputmode="decimal" step="any" value="{esc(f["value"])}" aria-describedby="field-note-{esc(f["key"])}">'
            note = "Length: enter the unit selected above" if f["kind"] == "L" else "Enter a number using the described measurement"
        return f'<div class="field"><label for="{field_id}">{label}</label>{control}<small id="field-note-{esc(f["key"])}">{esc(note)}</small></div>'
    fields = ''.join(field_markup(f) for f in t["inputs"] if not f.get("advanced"))
    advanced_fields = ''.join(field_markup(f) for f in t["inputs"] if f.get("advanced"))
    advanced_options = (
        '<details class="framing-stock-options" id="framing-stock-options">'
        '<summary>Compare other lumber lengths (10 ft / 12 ft)</summary>'
        '<p>Optional supplier quotes for each profile. Prices of 0 disable that length; keep base stock untouched for the original estimate. All prices use the selected currency.</p>'
        f'<div class="stock-offer-grid">{advanced_fields}</div>'
        '</details>'
    ) if advanced_fields else ""
    guidance = ''.join(f'<h3>{esc(g["heading"])}</h3><p>{esc(g["text"])}</p>' for g in t.get("guidance",[]))
    related = [p for p in TOOLS if p["category"]==t["category"] and p["slug"]!=t["slug"]][:4]
    others = [p for p in TOOLS if p["category"]!=t["category"]][:2]
    relevant=(related+others)[:6]
    catname,catslug=CATS[t["category"]]
    body=(f'<div class="wrap tool-heading"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">All tools</a><span>/</span><a href="/{catslug}/">{esc(catname)}</a><span>/</span>{esc(t["title"])}</nav>'
          f'<span class="eyebrow"><span class="eyebrow-dot"></span> TOOL {esc(t["priority"])} · GEOMETRY WORKSPACE</span>'
          f'<h1>{esc(t["title"])}</h1><p class="tool-lede">{esc(t["desc"])}</p>'
          '<div class="tool-hints"><span>↗ Live calculation</span><span>◈ Scaled schematic</span><span>⇩ Local export</span></div></div>')
    quote_currency_id="framing-currency" if t["slug"]=="framing-calculator" else "deck-currency"
    currency_picker=(
        f'<div class="framing-currency-control"><label for="{quote_currency_id}">Supplier quote currency</label>'
        f'<select id="{quote_currency_id}" aria-label="Currency for entered stock prices">'
        '<option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>'
        '<option value="CAD">CAD</option><option value="AUD">AUD</option>'
        '<option value="BRL">BRL</option><option value="MXN">MXN</option>'
        '</select><small>No FX conversion: change prices yourself when changing currency.</small></div>'
    ) if t["slug"] in ("framing-calculator","deck-material-calculator") else ""
    shelf_pin_panel=(
        '<section class="content-block shelf-pin-panel" id="shelf-pin-panel">'
        '<span class="eyebrow">OPTIONAL SUPPORT DRILL GUIDE</span>'
        '<h2>Measured shelf pin hole positions — left and right side panels</h2>'
        '<p>Enter a positive support hole diameter to turn on this pattern. Each shelf uses two hole centers on each side panel, one measured from the inside FRONT edge and one from the inside BACK edge. All Y values start at the inside cabinet floor; set the measured hole-center drop BELOW the shelf underside for your actual hardware. A zero hole diameter disables the guide and preserves the original shelf spacing worksheet.</p>'
        '<p id="shelf-pin-status" class="framing-price-status" role="status" aria-live="polite">Set a support-hole diameter above zero to enable the drilling guide.</p>'
        '<div id="shelf-pin-svg" class="shelf-pin-drawing" aria-label="Proportional shelf side-panel drilling diagrams"></div>'
        '<h3>Support-hole centers and circular face edges</h3>'
        '<div class="table-scroll shelf-pin-scroll"><table id="shelf-pin-table" aria-label="Shelf drilling coordinates from each side panel inside front bottom corner">'
        '<thead><tr><th>Shelf</th><th>Panel</th><th>Front/back</th><th>Center X</th><th>Center Y</th><th>Hole Ø</th>'
        '<th>Front X edge</th><th>Back X edge</th><th>Bottom Y edge</th><th>Top Y edge</th><th>Clear below shelf</th></tr></thead><tbody></tbody></table></div>'
        '<div class="takeoff-actions">'
        '<button id="download-shelf-pins-csv" type="button" class="btn secondary" disabled>↓ Export side-panel drill coordinates CSV</button>'
        '<button id="download-shelf-pin-svg" type="button" class="btn secondary" disabled>↓ Export proportional side-panel SVG</button>'
        '</div>'
        '<p class="caution">Reference coordinates only. The same front-referenced X datum is used separately on BOTH left and right panels; never drill from the wrong physical edge. Holes, pin heads, side-panel stock thickness, hardware load ratings and printer dimensions must be verified with the actual supplier and installation. Not a 1:1 drilling jig.</p>'
        '</section>'
    ) if t["slug"]=="shelf-spacing-calculator" else ""
    stringer_section=(
        '<section class="content-block stringer-section" id="stringer-section">'
        '<span class="eyebrow">NOMINAL CUT SECTION</span><h2>Modeled stringer profile and support datums</h2>'
        '<p>This is a proportional mathematical side-section: nominal step-notch vertices are joined to a parallel lower stock edge at the entered board normal depth. The first and last vertical closing edges are artificial drawing clips, NOT measured or safe bearing cuts. No actual blank length, material grade, fastening or structural capacity is inferred.</p>'
        '<p id="stringer-model-status" class="framing-price-status" role="status" aria-live="polite">Enter valid geometry to view a modeled section.</p>'
        '<h3>Modeled section outline vertices</h3>'
        '<div class="table-scroll"><table id="stringer-outline-table" aria-label="Modeled stringer side-section vertices">'
        '<thead><tr><th>Vertex</th><th>Boundary</th><th>Horizontal reference X</th><th>Elevation Y</th></tr></thead><tbody></tbody></table></div>'
        '<h3>Independent lower and upper support surface measurements</h3>'
        '<p>Optional horizontal support references are drawn outside the notch span. They do not automatically determine timber end cuts, actual bearing contact, connection capacity or approval. Verify both ends on site.</p>'
        '<div class="table-scroll"><table id="stringer-support-table" aria-label="Measured horizontal support surface references">'
        '<thead><tr><th>Reference surface</th><th>Start X</th><th>End X</th><th>Elevation</th></tr></thead><tbody></tbody></table></div>'
        '<div class="takeoff-actions">'
        '<button id="download-stringer-section-csv" type="button" class="btn secondary">↓ Download modeled profile vertices CSV</button>'
        '<button id="download-stringer-support-csv" type="button" class="btn secondary">↓ Download measured support references CSV</button>'
        '</div>'
        '<p class="caution">This model is NOT a full-size cutting template. Side-section area is a geometry cross-check, not a lumber board purchasing quantity or strength rating. Structural and end-bearing acceptance require independent measurements and professional review.</p>'
        '</section>'
    ) if t["slug"]=="stair-stringer-calculator" else ""
    body+=(f'<section class="workspace wrap" data-workspace><div class="pane input-pane"><div class="pane-head"><div><span class="pane-index">01 / SETUP</span>'
           '<h2>Measurements</h2></div><span class="pane-state">EDITABLE</span></div>'
           '<div class="unit-row"><label for="unit-select">Units</label><select id="unit-select" aria-label="Measurement units"><option value="in">Inches (in)</option><option value="ft">Feet (ft)</option><option value="mm">Millimeters (mm)</option><option value="cm">Centimeters (cm)</option><option value="m">Meters (m)</option></select>'
           '<label for="fraction-select">Fraction</label><select id="fraction-select" aria-label="Inch fraction precision"><option value="16">1/16</option><option value="32">1/32</option></select></div>'
           +currency_picker+
           f'<form id="calculator-form" novalidate>{fields}{advanced_options}</form>'
           '<div class="pane-actions"><button class="btn secondary" id="reset-values" type="button">Reset dimensions ↺</button></div>'
           '<p class="sidebar-note"><span>ⓘ</span> Inputs stay in your browser. Units convert automatically; calculations run locally.</p></div>'
           '<div class="pane drawing-pane"><div class="pane-head"><div><span class="pane-index">02 / VISUALIZE</span><h2>Dimension drawing</h2></div>'
           '<div class="zoom-controls"><button type="button" id="zoom-out" aria-label="Zoom out">−</button><button type="button" id="zoom-reset" aria-label="Reset zoom">100%</button><button type="button" id="zoom-in" aria-label="Zoom in">+</button></div></div>'
           '<div class="drawing-grid" id="dimension-svg"><div class="loading-graphic">Drawing will update from your measurements.</div></div>'
           '<div class="drawing-caption"><span><i></i> SCALED SCHEMATIC</span><span>NOT A VERIFIED 1:1 TEMPLATE</span></div>'
           '<div class="diagram-tools"><button type="button" class="btn subtle" id="download-svg">↓ Save SVG</button><button type="button" class="btn subtle" id="print-sheet">⎙ Print / PDF</button></div>'
           '<p class="print-advice">Printed worksheets include two physical calibration rulers. Use 100% / Actual size and check them with a real ruler; the geometry diagram itself is NOT a 1:1 template.</p>'
           '<section id="print-calibration" class="print-calibration" aria-label="Printed ruler calibration check">'
           '<h3>Physical print scale check</h3>'
           '<p>Print at 100% / Actual size on A4 or Letter; disable Fit to page. Measure both bars with a trusted ruler before using worksheet values. The drawing remains schematic regardless of this check.</p>'
           '<div class="calibration-measure"><strong>100 mm reference</strong><div class="calibration-bar calibration-100mm" role="img" aria-label="Reference bar nominally 100 millimeters wide when printed at actual size"></div><small>Accept only 99.5 to 100.5 mm measured on paper (±0.5%).</small></div>'
           '<div class="calibration-measure"><strong>1 in reference</strong><div class="calibration-bar calibration-1in" role="img" aria-label="Reference bar nominally one inch wide when printed at actual size"></div><small>Accept only 0.995 to 1.005 in measured on paper (±0.5%).</small></div>'
           '<p class="calibration-warning">If either ruler is outside tolerance, reject the printed sheet and correct printer settings. Passing these checks does NOT turn the resized SVG diagram into a full-size cutting pattern.</p>'
           '</section></div>'
           '<aside class="pane result-pane"><div class="pane-head"><div><span class="pane-index">03 / RESULTS</span><h2>Your takeoff</h2></div><span class="live-indicator">LIVE</span></div>'
           '<p id="calc-error" class="error-banner" role="alert" hidden></p><div id="result-cards" class="result-stack" aria-live="polite">'
           '<p class="empty-result">Enter measurements to see calculated dimensions.</p></div>'
           '<div class="export-stack"><button type="button" id="copy-result" class="btn primary">Copy results <span>↗</span></button>'
           '<button type="button" id="download-csv" class="btn secondary">↓ Download CSV cut list</button></div>'
           '<p class="action-status" id="action-status" role="status" aria-live="polite">Calculations will update instantly.</p></aside></section>')
    framing_takeoff=(
        '<div class="content-block framing-takeoff" id="framing-takeoff">'
        '<span class="eyebrow">LUMBER PURCHASE PLAN</span><h2>Material & stock cutting estimate</h2>'
        '<p>Groups studs, headers and window sills by separate stock profiles. First-fit decreasing (FFD) is a reproducible packing estimate, NOT proof of minimum waste. No joined pieces or cross-profile reuse. Saw kerf is charged between cuts on each stock stick; added reserve sticks are not counted as placed cuts.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-material-table" aria-label="Material summary by stock profile">'
        '<thead><tr><th>Profile</th><th>Pieces</th><th>Cut length</th><th>Stock length(s)</th><th>Planned sticks</th><th>Reserve</th><th>Buy</th><th>Offcut</th></tr></thead><tbody></tbody></table></div>'
        '<h3>Supplier quote & material budget</h3>'
        '<p>Enter an actual price per purchased stick for each needed material group. Zero means quote needed, not free material. A complete estimated purchase amount appears only when all used groups are quoted. Tax, delivery, fittings and labor are excluded.</p>'
        '<p class="framing-price-status" id="framing-price-status" role="status" aria-live="polite">Enter supplier prices to calculate material costs.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-price-table" aria-label="Purchase costs by material profile">'
        '<thead><tr><th>Profile</th><th>Length offer</th><th>Buy</th><th>Per stick</th><th>Planned cost</th><th>Reserve cost</th><th>Purchase cost</th></tr></thead><tbody></tbody></table></div>'
        '<h3>Compared purchase plans</h3>'
        '<p>Each material profile compares every fully fitting single-length FFD plan and one heuristic mixed-length plan when alternatives are quoted. The highlighted choice has the lowest quoted purchase cost among evaluated candidates, not a proven global optimum. Stock totals include purchase allowance.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-offer-table" aria-label="Single and mixed length stock comparisons">'
        '<thead><tr><th>Profile</th><th>Candidate</th><th>Planned sticks</th><th>Buy</th><th>Estimated purchase</th><th>Unallocated offcut</th><th>Decision</th></tr></thead><tbody></tbody></table></div>'
        '<div class="takeoff-legend">Quoted supplier offers only · Unquoted base length excluded from price comparisons · No offcut carryover between material families</div>'
        '<section id="framing-optimizer-panel" class="framing-optimizer-panel" aria-label="Exact material cost proof">'
        '<h3>Optimality verification</h3>'
        '<p id="framing-optimizer-status" role="status" aria-live="polite">Check prices to see exact and heuristic verification.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-proof-table" aria-label="Optimization proof by material">'
        '<thead><tr><th>Material</th><th>Pieces</th><th>Search status</th><th>Distinct states</th><th>Merged repeats</th><th>Certificate</th></tr></thead><tbody></tbody></table></div>'
        '<p class="optimizer-note">Exact mode memoizes equivalent cutting states and can prove the modeled lowest quote cost for up to 16 pieces per material when all distinct search states fit within a 40,000-state limit. A certificate is issued only when search completes with every required supplier price provided. It is valid only for offered lengths, between-cut kerf, independent material profiles and separately rounded purchase allowances. Other results are heuristic estimates, not proven optima.</p>'
        '</section>'

        '<section class="framing-order-ticket" id="framing-order-ticket" aria-label="Printable purchasing checklist">'
        '<h3>Purchase checklist</h3><p id="framing-ticket-status">Enter supplier quotes.</p>'
        '<ul id="framing-ticket-list"></ul>'
        '<p class="ticket-caveat">Geometry-only material estimate. Verify lengths, profiles, prices and availability; plates, engineered header layers, tax, delivery, labor and hardware excluded.</p></section>'
        '<h3>Stock-by-stock cut plan</h3>'
        '<p>Piece lengths and offcut for each stick share the calculated framing cut list. The browser worksheet shows approximate inch fractions; CSV exports keep numeric precision.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-stock-table" aria-label="Suggested stock cuts">'
        '<thead><tr><th>Stock ID</th><th>Cut sequence (reference lengths)</th><th>Kerf</th><th>Offcut</th></tr></thead><tbody></tbody></table></div>'
        '<div class="takeoff-actions"><button id="download-stock-csv" type="button" class="btn secondary">↓ Download stock cut plan CSV</button>'
        '<button id="download-price-csv" type="button" class="btn secondary">↓ Download quoted materials CSV</button></div>'
        '<p class="caution">Reference lengths only. No material grade, structural header sizing, defects, end trimming, splices or real-world optimizer certification. Verify each purchase and cut before working.</p>'
        '</div>'
    ) if t["slug"]=="framing-calculator" else ""
    deck_takeoff=(
        '<section class="content-block deck-purchase-plan" id="deck-purchase-plan">'
        '<span class="eyebrow">DECK MATERIAL PLANNING</span><h2>Supplier quote & fastening reference</h2>'
        '<p>The counted deck boards include the entered stock allowance, with no offcut reuse. Each installed board piece is counted at every joist CENTERLINE it touches. At each butt seam the two separate pieces create two piece/joist fastening contacts at the same line; this does NOT validate actual bearing, double joists, end gaps, a safe fastener pattern or structural spans. Enter actual supplier quotes to display a complete materials-only total.</p>'
        '<p id="deck-cost-status" class="framing-price-status" role="status" aria-live="polite">Enter board and fastener pack prices.</p>'
        '<div class="table-scroll"><table id="deck-budget-table" aria-label="Deck materials buying list">'
        '<thead><tr><th>Material</th><th>Planned</th><th>Buy</th><th>Units</th><th>Price each</th><th>Purchase cost</th></tr></thead><tbody></tbody></table></div>'
        '<h3>Fastener contacts by installed row</h3>'
        '<p>One contact means one individual decking piece at a joist reference line, NOT a code-approved screw count. Set fasteners per contact to zero if hardware is not in scope. Stock purchased boards and fastener packs are rounded separately; supplier pack leftovers are not credited to the cut list.</p>'
        '<div class="table-scroll deck-fastener-scroll"><table id="deck-fastener-table" aria-label="Fastener count per decking row">'
        '<thead><tr><th>Row</th><th>Joist lines</th><th>Butt seams</th><th>Piece/joist contacts</th><th>Fasteners/row</th><th>First seam</th><th>Last seam</th></tr></thead><tbody></tbody></table></div>'
        '<section class="framing-order-ticket" aria-label="Printable deck buying ticket">'
        '<h3>Deck buying ticket</h3><p id="deck-ticket-status">Supplier quotes required.</p>'
        '<ul id="deck-ticket-list"></ul>'
        '<p class="ticket-caveat">Geometry-only reference. Board stock count does not include cutting kerf, end trimming or offcut reuse. Fastener references are not installation specifications. Joist lumber, blocking, footings, tax, delivery and labor are excluded.</p></section>'
        '<div class="takeoff-actions">'
        '<button id="download-deck-budget-csv" type="button" class="btn secondary">↓ Download materials quote CSV</button>'
        '<button id="download-deck-fastener-csv" type="button" class="btn secondary">↓ Download fastener rows CSV</button>'
        '</div></section>'
    ) if t["slug"]=="deck-material-calculator" else ""
    body+=(f'<section class="wrap detail-layout"><div class="detail-main"><div class="content-block"><span class="eyebrow">CUT & POSITION DATA</span><h2>Measurement schedule</h2>'
           '<p>Items below are generated from the same numbers used for the drawing. The downloadable CSV uses plain numeric cells and puts the selected units in column headers for Excel or other spreadsheets. Inspect all cuts on site.</p>'
           '<div class="table-scroll"><table id="cut-table"><tbody><tr><td>Calculated position data appears here.</td></tr></tbody></table></div>'
           '<p class="schedule-count" id="schedule-count" aria-live="polite"></p>'
           '<nav class="schedule-pager" id="schedule-pager" aria-label="Measurement schedule pages" hidden>'
           '<button type="button" id="schedule-prev" class="schedule-pager-button">← Previous</button>'
           '<span id="schedule-page-status">Page 1 of 1</span>'
           '<label for="schedule-page-input">Go to page</label>'
           '<input id="schedule-page-input" type="number" min="1" step="1" value="1" inputmode="numeric">'
           '<button type="button" id="schedule-go" class="schedule-pager-button">Go</button>'
           '<button type="button" id="schedule-next" class="schedule-pager-button">Next →</button></nav></div>'
           +framing_takeoff+deck_takeoff+stringer_section+shelf_pin_panel+
           '<div class="content-block proof"<span class="eyebrow">CALCULATION METHOD</span><h2>How this calculator works</h2>'
           f'<p>{esc(t["desc"])}</p><p>This workspace directly addresses <strong>{esc(t["keyword"])}</strong> measurements. '+(f'Related terms in the same measurement task include {esc(related_search_terms)}.' if related_search_terms else 'All measurements use the same dimensional model.')+f'</p><p class="formula"><strong>Geometry rule</strong> {esc(t["formula"])}</p>'
           f'<h3>Reproducible example</h3><p>{esc(t["example"])}</p>'
            +guidance+
            '<h3>Assumptions and limits</h3>'
           f'<p id="print-assumptions">{esc(t["limit"])}</p>'
           '<p class="caution">This tool describes dimensional geometry. It does not certify building-code compliance, structural capacity, fastening, material quality or safe cutting techniques.</p>'
           '<h3>Printing and precision</h3><p>Use Print / PDF to save the worksheet as a PDF. The SVG is a proportional diagram, not a one-to-one cutting template. Before transferring marks to wood, verify units, stock dimensions, kerf, reference faces and printer scaling.</p>'
           '</div></div><aside class="details-side"><div class="related-box"><span class="eyebrow">NEXT AT THE WORKBENCH</span><h2>Related tools</h2>'
           +''.join(f'<a href="/{esc(r["slug"])}/">{esc(r["title"])} <span>↗</span></a>' for r in relevant)
           +'</div><div class="related-box muted-box"><span class="eyebrow">SITE POLICY</span><h3>Local by default</h3><p>No account, no project upload, no paid API. A small local setting may remember recent tools.</p></div></aside></section>')
    description=t["desc"].strip().rstrip(".")
    if len(description)<=120:
        description+=". Free local calculation with SVG and CSV export."
    else:
        description+="."
    return page(t["title"],description,body,"/"+t["slug"]+"/","tool")

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
    shutil.copyfile(ROOT/"src"/"cut-list.mjs",assets/"cut-list.mjs")
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
