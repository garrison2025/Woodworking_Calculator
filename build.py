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
CATEGORY_GUIDES = json.loads((ROOT / "src" / "category-guides.json").read_text(encoding="utf-8"))
assert set(CATEGORY_GUIDES) == set(CATS), "One unique category guide required for every category"
for key, guide in CATEGORY_GUIDES.items():
    assert all(guide.get(k) for k in ("title", "description", "lead", "choices", "example_title", "example", "limit")), key
    choices = [x["slug"] for x in guide["choices"]]
    assert len(choices) == len(set(choices)), "Duplicate category task links"
    assert all(any(t["slug"] == slug and t["category"] == key for t in TOOLS) for slug in choices), "Guide must link to real same-category tools"
# Explicit search-task boundaries and contextual next-tool choices: do NOT
# choose related links by arbitrary manifest position or include held P2 URLs.
INTENT_FILE = json.loads((ROOT / "src" / "tool-intents.json").read_text(encoding="utf-8"))
INTENTS = {entry["slug"]:entry for entry in INTENT_FILE["tools"]}
assert len(INTENTS) == len(INTENT_FILE["tools"]) == len(TOOLS), "Intent metadata must cover exactly the released tools"
assert set(INTENTS) == {t["slug"] for t in TOOLS}, "Missing or extra released-tool intent metadata"
FIELD_CHECKS = json.loads((ROOT / "src" / "field-verification.json").read_text(encoding="utf-8"))["checks"]
assert set(FIELD_CHECKS) == set(INTENTS), "Every active tool needs a distinct independent measurement check"
# Reviewed, reproducible synthetic measurement fixtures. These are useful
# examples, not real wood cuts, a structural signoff or provider data.
CASE_FILE = json.loads((ROOT / "src" / "worked-cases.json").read_text(encoding="utf-8"))
CASES_BY_SLUG = {}
for case in CASE_FILE["cases"]:
    tool = next((x for x in TOOLS if x["slug"] == case["slug"]), None)
    assert tool and len(case["checks"]) >= 3 and case["id"] not in {
        c["id"] for sub in CASES_BY_SLUG.values() for c in sub
    }, "Invalid or duplicated worked measurement case"
    assert set(case["inputs"]) == {f["key"] for f in tool["inputs"]}, "A worked case must supply every modeled input"
    assert all(isinstance(v, (int, float)) for v in case["inputs"].values()), "Worked case contains nonnumeric inputs"
    assert all(check["label"] and isinstance(check["value"], (int,float)) for check in case["checks"]), "Expected values must be typed"
    CASES_BY_SLUG.setdefault(case["slug"], []).append(case)
assert {key:len(value) for key,value in CASES_BY_SLUG.items()} == {
    "deck-board-calculator":2, "rafter-calculator":2,
    "stair-stringer-calculator":2}, "Exactly two scenarios per approved high-demand tool"

with (ROOT / "research" / "woodworking-keyword-map-152.csv").open(encoding="utf-8", newline="") as keyword_file:
    KEYWORDS = list(csv.DictReader(keyword_file))
# Original keyword rows remain fully preserved as historical Semrush data.
# An editorial caution excludes misleading query intents from the visible
# synonym paragraph; it never rewrites research evidence or creates new URLs.
CAUTION_DATA = json.loads((ROOT / "research" / "keyword-intent-cautions.json").read_text(encoding="utf-8"))
CAUTIONED_TERMS = {(item["originalRoute"], item["keyword"].lower()) for item in CAUTION_DATA["flagged"]}
assert len(CAUTIONED_TERMS) == len(CAUTION_DATA["flagged"]), "Duplicate intent cautions"
assert CAUTIONED_TERMS <= {(k["target_route"], k["keyword"].lower()) for k in KEYWORDS}, "Intent caution is not traceable to source keyword data"
# Correct only a query whose REAL implemented tool now matches the intent.
# This is an editorial presentation overlay; never rewrite the Semrush CSV.
SUPPORTED_REASSIGNMENTS = {item["keyword"].lower():item["supportedRoute"]
                           for item in CAUTION_DATA["flagged"] if item.get("supportedRoute")}
assert len(SUPPORTED_REASSIGNMENTS) == sum(bool(x.get("supportedRoute")) for x in CAUTION_DATA["flagged"])
assert set(SUPPORTED_REASSIGNMENTS.values()) <= {"/" + t["slug"] + "/" for t in TOOLS}, "SEO reassignment targets unpublished or unknown tools"
# 2026-11-07 owner approval: all 31 completed P0/P1 tools, including the
# five originally listed as P2 in the V3 plan, share the ONE production gate.
# Historical planning priority is not a quality or SEO publication veto.
# The owner acquired woodlayout.com, attached it to Cloudflare Pages and
# explicitly authorized a code-managed search-index release on 2026-11-08.
# Only the production Pages main branch automatically publishes 42 canonical
# URLs; all PR/preview branches remain noindex. Do not treat proportional SVG
# as a physically certified print/cutting template.
# RELEASE_V3_P2_APPROVED is obsolete and intentionally ignored.
ACTIVE_CATEGORIES = {
    "/" + slug + "/" for key, (_, slug) in CATS.items()
    if any(t["category"] == key for t in TOOLS)
}
OWNER_SITE_URL = "https://woodlayout.com"
IS_PAGES = os.environ.get("CF_PAGES") == "1"
IS_PAGES_PRODUCTION = IS_PAGES and os.environ.get("CF_PAGES_BRANCH") == "main"
IS_PAGES_PREVIEW = IS_PAGES and not IS_PAGES_PRODUCTION
# Site owner approved direct source-controlled production indexing.
# A stale or conflicting Cloudflare dashboard environment variable must not
# silently keep the purchased main domain noindexed or advertise Pages URLs.
# Local/offline release tests retain their explicit env-based simulation.
SITE_URL = (OWNER_SITE_URL if IS_PAGES_PRODUCTION else
            os.environ.get("SITE_URL", "").strip().rstrip("/"))
APPROVED = (IS_PAGES_PRODUCTION or os.environ.get("RELEASE_APPROVED") == "1")
INDEXABLE = SITE_URL.startswith("https://") and "pages.dev" not in SITE_URL and APPROVED and not IS_PAGES_PREVIEW
esc = lambda s: html.escape(str(s), quote=True)

def href(path):
    return "/" + path.strip("/") + ("/" if path and not path.endswith(".") else "")

def page(title, description, body, path="/", type_="website"):
    desc = description.strip()
    if len(desc) > 155:
        raise ValueError(f"SEO description exceeds 155-character editorial budget on {path}: {len(desc)}")
    eligible = INDEXABLE and path != "/404/"
    canon = SITE_URL + path if eligible else None
    canonical = f'<link rel="canonical" href="{esc(canon)}">' if canon else ""
    robots = "index,follow" if eligible else "noindex,nofollow,noarchive"
    schema = ""
    if eligible:
        types = {"tool": "WebApplication", "category": "CollectionPage",
                 "info": "WebPage", "about": "AboutPage", "contact": "ContactPage"}
        kind = "WebSite" if path == "/" else types.get(type_, "WebPage")
        organization = {
            "@type": "Organization",
            "@id": SITE_URL + "#organization",
            "name": "WoodLayout",
            "url": SITE_URL,
            "email": "contact@woodlayout.com",
        }
        item = {"@context": "https://schema.org", "@type": kind,
                "name": "WoodLayout" if path == "/" else title,
                "description": desc, "url": canon, "inLanguage": "en"}
        if path == "/":
            item["@id"] = canon + "#website"
            item["alternateName"] = "WoodLayout Woodworking Calculators"
        else:
            item["@id"] = canon + ("#webapplication" if type_ == "tool" else "#webpage")
            item["isPartOf"] = {"@id": SITE_URL + "/#website"}
        item["publisher"] = organization
        if type_ == "tool":
            selected = next(t for t in TOOLS if "/" + t["slug"] + "/" == path)
            item["applicationCategory"] = "UtilitiesApplication"
            item["applicationSubCategory"] = CATS[selected["category"]][0]
            item["operatingSystem"] = "Any"
            item["isAccessibleForFree"] = True
            item["browserRequirements"] = "Requires a modern browser with JavaScript enabled"
            item["featureList"] = [
                "Interactive browser-based geometry calculations",
                "Proportional SVG measurement diagrams",
                "CSV measurement and cut schedules",
                "Browser print and PDF worksheet export",
                "Inch, foot, millimeter, centimeter and meter inputs",
                "Local calculation without an account or paid API",
            ]
        if type_ == "category":
            subset = [t for t in TOOLS if "/" + CATS[t["category"]][1] + "/" == path]
            item["mainEntity"] = {
                "@type": "ItemList", "numberOfItems": len(subset),
                "itemListElement": [
                    {"@type": "ListItem", "position": i + 1,
                     "name": t["title"], "url": SITE_URL + "/" + t["slug"] + "/"}
                    for i, t in enumerate(subset)
                ],
            }
        if type_ in ("tool", "category"):
            crumbs = [{"@type": "ListItem", "position": 1,
                       "name": "All woodworking calculators", "item": SITE_URL + "/"}]
            if type_ == "tool":
                slug = path.strip("/")
                selected = next(t for t in TOOLS if t["slug"] == slug)
                category_name, category_slug = CATS[selected["category"]]
                crumbs.append({"@type": "ListItem", "position": 2,
                               "name": category_name, "item": SITE_URL + "/" + category_slug + "/"})
            crumbs.append({"@type": "ListItem", "position": len(crumbs) + 1,
                           "name": title, "item": canon})
            item["breadcrumb"] = {"@type": "BreadcrumbList", "itemListElement": crumbs}
        schema = '<script type="application/ld+json">' + json.dumps(item, ensure_ascii=False).replace("<","\\u003c") + '</script>'
    og_title = {"/about/": "About WoodLayout", "/contact/": "Contact WoodLayout",
                 "/privacy/": "WoodLayout Privacy Policy",
                 "/terms/": "WoodLayout Terms & Safety"}.get(path, title)
    nav = '<a class="brand" href="/" aria-label="WoodLayout home"><span class="brand-icon"><img src="/logo-mark.svg" alt="" width="44" height="44"></span><span class="brand-wordmark"><strong>Wood<span>Layout</span></strong><small>WOODWORKING CALCULATORS</small></span></a>'
    links = [('Tools','/#tools'),('Framing','/framing/'),('Decks','/decks-and-railings/'),('Roofs & stairs','/roof-and-stairs/'),('Woodworking','/woodworking/')]
    navlinks = ''.join(f'<a href="{esc(url)}">{esc(label)}</a>' for label,url in links)
    mobile_categories = ''.join(
        f'<a href="/{esc(slug)}/">{esc(name)}</a>'
        for name,slug in CATS.values())
    mobile_menu = ('<details class="mobile-site-menu"><summary>Browse tools</summary>'
                   '<nav aria-label="Mobile tool categories"><a href="/#tools">All calculators</a>'
                   + mobile_categories + '</nav></details>')
    script = ('<script type="module" src="/assets/home.mjs"></script>' if path == "/"
              else '<script type="module" src="/assets/app.mjs"></script>' if type_ == "tool"
              else "")
    footer = ('<footer class="footer"><div class="footer-inner"><p><strong>WoodLayout</strong> · Draft useful measurements, not engineering approvals.</p>'
              '<nav aria-label="Legal"><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav>'
              '<small>All diagrams are illustrative unless separately verified for full-size printing. No login, paid API or cloud data storage.</small></div></footer>')
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<meta name="color-scheme" content="light"><meta name="robots" content="{robots}">'
            f'<title>{esc(title)} | WoodLayout</title><meta name="description" content="{esc(desc)}">{canonical}'
            f'<link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="theme-color" content="#203b34"><meta name="application-name" content="WoodLayout"><link rel="stylesheet" href="/assets/style.css">'
            f'<meta property="og:type" content="website"><meta property="og:site_name" content="WoodLayout"><meta property="og:title" content="{esc(og_title)}"><meta property="og:description" content="{esc(desc)}">'
            + (f'<meta property="og:url" content="{esc(canon)}">' if eligible else "")
            + (f'<meta property="og:image" content="{esc(SITE_URL)}/social-card.png">'
               '<meta property="og:image:type" content="image/png">'
               '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
               '<meta property="og:image:alt" content="WoodLayout woodworking geometry calculators illustration">'
               '<meta name="twitter:card" content="summary_large_image">'
               f'<meta name="twitter:title" content="{esc(og_title)}">'
               f'<meta name="twitter:description" content="{esc(desc)}">'
               f'<meta name="twitter:image" content="{esc(SITE_URL)}/social-card.png">'
               '<meta name="twitter:image:alt" content="WoodLayout woodworking geometry calculators illustration">' if eligible else "") + schema +
            f'</head><body data-tool="{esc(path.strip("/")) if type_ == "tool" else ""}">'
            f'<a href="#main" class="skip">Skip to main content</a><header class="topbar"><div class="topbar-inner">{nav}<nav aria-label="Primary navigation">{navlinks}</nav>{mobile_menu}<a class="nav-cta" href="/#tools">Explore calculators <span aria-hidden="true">↗</span></a></div></header>'
            f'<main id="main">{body}</main>{footer}{script}</body></html>')

def write(url, content):
    target = DEST / url.strip("/") / "index.html" if url != "/" else DEST / "index.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def build_llms_txt(base):
    """Generate a compact, source-derived AI navigation index for the English site."""
    lines = [
        "# WoodLayout",
        "",
        "> Free browser-based woodworking geometry and layout calculators for measured dimensions, cut schedules and material estimates.",
        "",
        f"Canonical website: {base}/",
        "Language: English",
        "",
        "## What this site provides",
        "",
        "WoodLayout contains 31 task-specific calculators across six woodworking categories. Calculations run in the visitor's browser. Tool pages expose their intended task, excluded tasks, calculation rule, reproducible example, independent measurement check and safety limits in the HTML.",
        "",
        "The calculators provide dimensional references and estimates. They are not structural engineering, building-code approval, safe-cutting instructions or certified 1:1 templates.",
        "",
        "## How to use the content",
        "",
        "- Use each calculator page's stated measurement task and input datums; do not substitute center-to-center, face-to-face, clear-opening and outside dimensions.",
        "- Read the formula and worked example on the specific calculator page before interpreting its output.",
        "- Treat proportional SVG drawings as diagrams. Verify actual stock, kerf, printer scale, material condition and site dimensions independently.",
        "- Supplier prices are user-entered; the site does not supply live lumber prices or foreign-exchange conversion.",
        "- Calculations are local to the browser. Optional measurement sharing encodes numeric inputs in the URL fragment; shared links disclose those inputs to recipients.",
        "",
        "## Calculator categories",
        "",
    ]
    for key, (name, slug) in CATS.items():
        subset = [t for t in TOOLS if t["category"] == key]
        if not subset:
            continue
        guide = CATEGORY_GUIDES[key]
        lines.extend([
            f"### [{name}]({base}/{slug}/)",
            "",
            guide["lead"],
            "",
        ])
        for tool in subset:
            intent = INTENTS[tool["slug"]]
            lines.append(
                f"- [{tool['title']}]({base}/{tool['slug']}/): {tool['desc']} "
                f"Use for: {intent['useFor']} Not for: {intent['notFor']} "
                f"Calculation rule: {tool['formula']}"
            )
        lines.append("")
    lines.extend([
        "## Site methodology and limitations",
        "",
        f"- [About and measurement methodology]({base}/about/): measurement conventions, software checks, public source and correction process.",
        f"- [Terms and safety]({base}/terms/): dimensional-reference limitations and physical verification requirements.",
        f"- [Privacy]({base}/privacy/): local calculation, browser storage, optional share links and hosting logs.",
        f"- [Contact]({base}/contact/): contact@woodlayout.com.",
        f"- [Public source repository](https://github.com/garrison2025/Woodworking_Calculator): implementation and automated regression tests.",
        "",
        "The linked calculator HTML pages are the source of truth for current inputs, formulas, examples and output behavior. This file is a navigation summary, not a separate specification and not a promise of inclusion or citation by any search or AI service.",
        "",
    ])
    return "\n".join(lines)

# Purposeful line icons distinguish real tool families. No remote icon/font fetch.
TOOL_FAMILY_ICONS = {
    "framing": '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M9 5v14M15 5v14M4 10h16"/>',
    "decks": '<path d="M4 6h16M4 12h16M4 18h16M8 6v6M16 12v6"/>',
    "roof": '<path d="m3 14 9-9 9 9M6 12v8h12v-8M12 8v12"/>',
    "interior": '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8 4v16M16 4v16M4 14h16"/>',
    "wood": '<path d="M5 19V9l7-5 7 5v10M5 19h14M8 11h8M8 15h8"/>',
    "materials": '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
}
TOOL_FAMILY_NAMES = {
    "framing": "Framing", "decks": "Decking", "roof": "Roofs & stairs",
    "interior": "Interior", "wood": "Woodworking", "materials": "Materials",
}
assert set(TOOL_FAMILY_ICONS) == set(TOOL_FAMILY_NAMES) == set(CATS)

def tool_card(t):
    family = t["category"]
    icon = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
            'fill="none" stroke="currentColor" stroke-width="1.65" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            + TOOL_FAMILY_ICONS[family] + '</svg>')
    return (f'<a class="tool-card" data-category="{esc(family)}" href="/{esc(t["slug"])}/">'
            f'<span class="tool-card-top"><span class="tool-icon" aria-hidden="true">{icon}</span>'
            f'<span class="tool-priority">{esc(TOOL_FAMILY_NAMES[family])}</span></span>'
            f'<strong>{esc(t["title"])}</strong><span>{esc(t["desc"])}</span>'
            '<span class="tool-card-bottom">Open calculator <span aria-hidden="true">↗</span></span></a>')

def categories_nav():
    out = []
    for key,(name,slug) in CATS.items():
        subset = [t for t in TOOLS if t["category"] == key]
        if not subset:
            continue
        out.append(f'<a class="category-pill" href="/{slug}/"><span>{esc(name)}</span><span class="category-count">{len(subset):02d}</span></a>')
    return ''.join(out)

def hero_graphic():
    return f'''<div class="hero-graphic" aria-hidden="true"><svg class="blueprint-illustration" viewBox="0 0 590 350"><defs><pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#d0d8d0" stroke-width=".7"/></pattern></defs><rect x="0" y="0" width="590" height="350" fill="url(#p)"/><g transform="translate(75 48)"><path d="M35 228L395 228 395 38Z" fill="#e5eee6" stroke="#1e6454" stroke-width="3"/><path d="M35 228V70L395 38" fill="none" stroke="#b48456" stroke-dasharray="9 6" stroke-width="2"/><path class="blueprint-trace" d="M35 228L395 38" stroke="#1e6454" stroke-width="5"/><g stroke="#bd8d54" stroke-width="4"><path d="M85 228V202M145 228V170M205 228V139M265 228V107M325 228V75"/></g><path d="M35 245V262M395 245V262M35 256H395" stroke="#64736c" stroke-width="1.5"/><path d="M25 228L35 228 35 218" fill="none" stroke="#64736c" stroke-width="1.5"/><g fill="#34554b" font-family="monospace" font-size="14"><text x="185" y="280">12′-0″  /  144 IN</text><text x="400" y="38">6:12</text><text x="46" y="58">R A K E  W A L L</text></g></g></svg><div class="graphic-caption"><span class="graphic-dot"></span> GEOMETRY WORKSPACE <span>DRAWING 01 / {len(TOOLS)}</span></div></div>'''

def directory_link(t):
    route = '/' + t['slug'] + '/'
    primary = [] if (route, t['keyword'].lower()) in CAUTIONED_TERMS else [t['keyword']]
    reviewed = [word for word, target in SUPPORTED_REASSIGNMENTS.items() if target == route]
    category = CATS[t['category']][0]
    terms = '|'.join([t['title'], category, *primary, *reviewed])
    return (f'<a href="{esc(route)}" data-search-terms="{esc(terms)}">'
            f'<span>{esc(t["title"])}</span><small>{esc(category)}</small><b>↗</b></a>')

def home():
    featured = sorted(TOOLS, key=lambda t:(t["priority"] != "P0", -t["volume"]))[:6]
    category_count = len({tool["category"] for tool in TOOLS})
    body = ('<section class="hero wrap"><div class="hero-copy"><span class="eyebrow"><span class="eyebrow-dot"></span> PRECISION FOR THE WORKSHOP</span>'
            '<h1>Free woodworking calculators<br><em>for better measurements.</em></h1>'
            '<p>Woodworking calculators for practical layouts, cut lengths, spacing and material takeoffs. Enter dimensions, inspect an annotated drawing, then export your work.</p>'
            f'<div class="hero-actions"><a class="btn primary" href="/#tools">Explore {len(TOOLS)} free tools <span aria-hidden="true">↗</span></a>'
            '<a class="btn subtle" href="/stud-calculator/">Try the stud calculator</a></div>'
            f'<div class="hero-facts"><span><strong>{len(TOOLS)}</strong> working calculator routes</span><span><strong>{category_count}</strong> active categories</span><span><strong>0</strong> accounts required</span></div>'
            '</div>' + hero_graphic() + '</section>')
    body += ('<section id="tools" class="wrap home-section"><div class="section-heading"><div><span class="eyebrow">FIND YOUR TOOL</span>'
             '<h2>Built around the work, not the jargon.</h2><p>Browse the most common workshop measurements and quickly jump to the right calculator.</p></div></div>'
             '<nav class="categories" aria-label="Tool categories">'+categories_nav()+'</nav>'
             '<section id="recent-tools" class="recent-panel" hidden><span class="eyebrow">PICK UP WHERE YOU LEFT OFF</span><div class="recent-header"><h3>Recently used tools</h3><button id="clear-recent-tools" class="recent-clear" type="button">Clear history</button></div><div id="recent-links" class="recent-links"></div></section>'
             '<div class="section-heading compact"><h3>Start with a common task</h3><span>FEATURED TOOLS</span></div><div class="tool-grid">'+''.join(tool_card(t) for t in featured)+'</div>'
             f'<div class="section-heading compact" id="all-tools"><h3>Every available calculator</h3><span>{len(TOOLS)} TOOL WORKSPACES</span></div>'
             f'<div class="tool-search-panel"><label for="tool-search">Find a calculator</label><div class="tool-search-row"><div class="tool-search-field"><input id="tool-search" type="search" autocomplete="off" aria-controls="tool-directory" aria-describedby="tool-search-status" placeholder="Search {len(TOOLS)} tools by task or category"><kbd aria-hidden="true">/</kbd></div><output id="tool-search-status" for="tool-search" role="status" aria-live="polite">Showing {len(TOOLS)} tools</output></div></div>'
             '<div class="directory-list" id="tool-directory">'+''.join(directory_link(t) for t in TOOLS)+'</div>'
             '<div id="tool-search-empty" class="search-empty" role="region" aria-label="No matching calculators" hidden>'
             '<span class="search-empty-symbol" aria-hidden="true">⌕</span>'
             '<div><strong>No matching calculator</strong>'
             '<p>Try a shorter measurement task, or return to the full 31-tool directory.</p></div>'
             '<button id="tool-search-clear" type="button">Clear search</button></div>'
             '</section>')
    body+= ('<section class="wrap trust-strip"><div><span class="eyebrow">REPRODUCIBLE BY DESIGN</span><h2>Measure, inspect, take it to the bench.</h2></div>'
            '<div><b>01 / Input</b><p>US customary inches and feet, with millimeters, centimeters and meters one click away.</p></div>'
            '<div><b>02 / Check</b><p>Visible formulas, explicit assumptions, precise dimensions.</p></div>'
            '<div><b>03 / Export</b><p>Save a locally generated CSV or SVG; print to PDF from your browser.</p></div></section>')
    return page("Free Woodworking Calculators & Layout Tools",f"{len(TOOLS)} practical woodworking geometry and layout tools: studs, decking, rafters, framing, spacing, shelves and cutting diagrams.",body)

def tool_page(t):
    intent = INTENTS[t["slug"]]
    # Historical keyword rankings are EVIDENCE, not a license to call
    # different search tasks synonyms. Human-facing text describes exactly
    # the current calculator; only separately approved intent corrections
    # may add wording beyond the tool's primary research query.
    task_note = ('<p class="intent-query-copy">Primary measurement task: '
                 f'<strong>{esc(t["keyword"])}</strong>. '
                 'The dimensions, SVG and CSV cover this specific layout. '
                 'Do not infer that a differently named task uses the same model.')
    if t["slug"] == "lumber-price-calculator":
        # The historical research keyword is broader than the actual
        # supported task. Do not pretend a generic thousand-item quote is MBF.
        task_note = (
            '<p class="intent-query-copy">Specific measurement task: lumber '
            'quoted per board foot (BF) or 1,000 board feet (MBF). '
            'The historical broad research query is NOT a general '
            'price-per-thousand-items feature and is deliberately not '
            'marketed as a matching search synonym. '
            'Enter actual lumber dimensions for board feet; add a supplier rate only if you need a cost estimate.')
    reviewed = [word for word,route in SUPPORTED_REASSIGNMENTS.items()
                if route == '/' + t['slug'] + '/']
    if reviewed:
        assert t["slug"] == "framing-calculator" and len(reviewed) == 1, (
            "Every new editorial query correction needs explicit task-specific copy")
        task_note += (' For <strong>' + esc(reviewed[0]) + '</strong>, '
                      'this page actually models user-entered door and window '
                      'openings with measured sill/header and king/jack stations; '
                      'the simpler Wall Stud page does not.')
    task_note += '</p>'
    def field_markup(f):
        field_id = 'f-' + esc(f["key"])
        label = esc(f["label"]) + (' <span data-length-unit>in</span>' if f["kind"] == "L" else '')
        if f.get("options"):
            opts = ''.join(f'<option value="{esc(o["value"])}"{" selected" if o["value"] == f["value"] else ""}>{esc(o["label"])}</option>' for o in f["options"])
            control = f'<select id="{field_id}" name="{esc(f["key"])}" aria-describedby="field-note-{esc(f["key"])}">{opts}</select>'
            note = 'Select the intended reference or layout option'
        elif f["kind"] == "L":
            # Native number inputs reject the fractional-inch notation used
            # on rulers and shop drawings (5 1/2, 5-1/2, 3/4).
            # A strict parser converts accepted entries to decimal inches
            # before all calculations, exports and measurement sharing.
            control = f'<input id="{field_id}" name="{esc(f["key"])}" type="text" inputmode="text" maxlength="64" autocomplete="off" spellcheck="false" value="{esc(f["value"])}" aria-describedby="field-note-{esc(f["key"])}">'
            note = "Use selected units. In inches: 5.5, 5 1/2, 3/4, or feet-and-inches written as 8' 3 1/2\". Other units: decimals only."
        else:
            control = f'<input id="{field_id}" name="{esc(f["key"])}" type="number" inputmode="decimal" step="any" value="{esc(f["value"])}" aria-describedby="field-note-{esc(f["key"])}">'
            note = ("Optional. Leave blank or enter 0 to calculate board feet without a quote."
                    if "emptyValue" in f else "Enter a number using the described measurement")
        condition = f' data-show-when="{esc(f["showWhen"])}"' if f.get("showWhen") else ""
        return f'<div class="field"{condition}><label for="{field_id}">{label}</label>{control}<small id="field-note-{esc(f["key"])}">{esc(note)}</small></div>'
    scenarios=CASES_BY_SLUG.get(t["slug"], [])
    scenario_panel=(
        '<section class="worked-cases" id="worked-cases" aria-label="Reproducible dimension scenarios">'
        '<h3>Try a calculated measurement scenario</h3>'
        '<p>Two complete sample input sets with independently checkable dimensions. '
        'Click to fill the calculator in your current units, then check the drawing and downloadable CSV. '
        '<strong>Not verified on real lumber or approved for cutting.</strong></p>'
        '<div class="worked-cases-grid">'+''.join(
            '<article class="worked-case"><h4>'+esc(case["title"])+'</h4><p>'+esc(case["description"])+'</p>'
            '<p class="worked-values">'+
            '; '.join(esc(v["label"])+': <b>'+esc(format(v["value"], ".8g"))+
                 (" "+("in" if v["kind"]=="L" else "") if v["kind"] in ("L","N") else "")+'</b>'
                for v in case["checks"])+'</p>'
            '<p class="worked-proof">'+esc(case["verification"])+'</p>'
            '<button class="btn secondary worked-apply" type="button" data-case-id="'+esc(case["id"])+
            '" data-case-name="'+esc(case["title"])+
            '" data-case-inputs="'+esc(json.dumps(case["inputs"],separators=(",",":")))+
            '">Use these measurements</button></article>' for case in scenarios)+'</div></section>'
    ) if scenarios else ""
    fields = ''.join(field_markup(f) for f in t["inputs"] if not f.get("advanced"))
    advanced_fields = ''.join(field_markup(f) for f in t["inputs"] if f.get("advanced"))
    advanced_options = (
        '<details class="framing-stock-options" id="framing-stock-options">'
        '<summary>Advanced lumber offers and stock-loss review</summary>'
        '<p>Optional supplier prices and independent trim / saw-kerf / candidate-offcut diagnostics. Review mode never changes the original procurement count or quotation. A failing audit means the base order is NOT a verified sufficient order. Zero supplier price disables that offer.</p>'
        f'<div class="stock-offer-grid">{advanced_fields}</div>'
        '</details>'
    ) if advanced_fields else ""
    guidance = ''.join(f'<h3>{esc(g["heading"])}</h3><p>{esc(g["text"])}</p>' for g in t.get("guidance",[]))
    targets = {p["slug"]:p for p in TOOLS}
    relevant = [(targets[link["slug"]], link["why"]) for link in intent["next"]]
    assert len({p["slug"] for p, why in relevant}) == len(relevant), "Duplicate next tools"
    assert all(p["slug"] != t["slug"] for p, why in relevant), "Self link in next tools"
    catname,catslug=CATS[t["category"]]
    body=(f'<div class="wrap tool-heading"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">All tools</a><span>/</span><a href="/{catslug}/">{esc(catname)}</a><span>/</span>{esc(t["title"])}</nav>'
          f'<span class="eyebrow"><span class="eyebrow-dot"></span> WOODLAYOUT · {esc(catname).upper()} WORKBENCH</span>'
          f'<h1>{esc(t["title"])}</h1><p class="tool-lede">{esc(t["desc"])}</p>'
          '<div class="intent-fit" aria-label="When to use this calculator">'
          f'<p><strong>Typical task</strong> {esc(intent["useFor"])}</p>'
          f'<p><strong>Not covered</strong> {esc(intent["notFor"])}</p>'
          '</div>'
          f'<p class="formula tool-formula" id="geometry-rule"><strong>Geometry rule</strong> {esc(t["formula"])}</p>'
          '<div class="tool-hints"><span>↗ Live calculation</span><span>◈ Scaled schematic</span><span>⇩ Local export</span></div></div>')
    quote_currency_id=("framing-currency" if t["slug"]=="framing-calculator"
                       else "lumber-currency" if t["slug"]=="lumber-price-calculator"
                       else "deck-currency")
    currency_picker=(
        f'<div class="framing-currency-control"><label for="{quote_currency_id}">Supplier quote currency</label>'
        f'<select id="{quote_currency_id}" aria-label="Currency for entered stock prices">'
        '<option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>'
        '<option value="CAD">CAD</option><option value="AUD">AUD</option>'
        '<option value="BRL">BRL</option><option value="MXN">MXN</option>'
        '</select><small>No FX conversion: change prices yourself when changing currency.</small></div>'
    ) if t["slug"] in ("framing-calculator","deck-material-calculator","lumber-price-calculator") else ""
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
        '<h3>Exact nominal tread/riser sawline coordinates</h3>'
        '<p>All nominal notch legs are exported as individual line segments with start/end X and Y, measured length and reference angle. Optional field-chosen END line extensions from the bottom and top nominal corners can be calculated separately, but these do not automatically establish safe bearing cuts or purchased-stock length.</p>'
        '<div class="table-scroll"><table id="stringer-sawline-table" aria-label="Nominal stringer tread and riser sawline endpoints">'
        '<thead><tr><th>Sawline</th><th>Type</th><th>Start X</th><th>Start Y</th><th>End X</th><th>End Y</th><th>Length</th><th>Angle</th></tr></thead><tbody></tbody></table></div>'
        '<h3>Optional field-chosen timber end line intersections</h3>'
        '<div class="table-scroll"><table id="stringer-end-lines-table" aria-label="User-selected stringer end line geometry">'
        '<thead><tr><th>End</th><th>Type</th><th>Start X</th><th>Start Y</th><th>End X</th><th>End Y</th><th>Length</th><th>Angle</th></tr></thead><tbody></tbody></table></div>'
        '<p class="caution">End-line offsets are INDEPENDENT from the entered support-surface runs. They identify a user-selected lower-edge intersection, NOT a designed cut for load-bearing support. The stock-axis length envelope is only a geometric bound. A numeric fit cannot prove material suitability.</p>'
        '<h3>Independent lower and upper support surface measurements</h3>'
        '<p>Optional horizontal support references are drawn outside the notch span. They do not automatically determine timber end cuts, actual bearing contact, connection capacity or approval. Verify both ends on site.</p>'
        '<div class="table-scroll"><table id="stringer-support-table" aria-label="Measured horizontal support surface references">'
        '<thead><tr><th>Reference surface</th><th>Start X</th><th>End X</th><th>Elevation</th></tr></thead><tbody></tbody></table></div>'
        '<h3>Pitch-aligned rectangular stock reference — four measured coordinates</h3>'
        '<p>The transparent dashed rectangle in the SVG is aligned with the nominal stringer pitch and uses the entered board NORMAL depth. Its length is the calculated minimum with chosen end reserve unless you supply an actual raw board length. With a supplied length the rectangle is centered on the modeled longitudinal range for visual comparison, NOT automatically positioned on real stock. A fit only checks the modeled two-dimensional envelope.</p>'
        '<div class="table-scroll"><table id="stringer-blank-table" aria-label="Pitch aligned rectangle corner positions">'
        '<thead><tr><th>Corner</th><th>Longitudinal station</th><th>Normal offset</th><th>X</th><th>Elevation Y</th></tr></thead><tbody></tbody></table></div>'
        '<h3>Measured end projections versus entered support reference runs</h3>'
        '<p>Shown only when you supply BOTH an end-line extension and a horizontal support reference for the same end. The tool checks whether the end point X coordinate falls within the measured support X interval. This is NOT a test of bearing contact, timber connection, alignment in 3D, grade or compliance.</p>'
        '<div class="table-scroll"><table id="stringer-end-projection-table" aria-label="One dimensional end point projections versus support references">'
        '<thead><tr><th>Side</th><th>End X</th><th>End extension</th><th>Support run</th><th>Outside by</th><th>1D status</th></tr></thead><tbody></tbody></table></div>'
        '<h3>Actual 2D intersection of selected end CUT LINE and measured support LINE</h3>'
        '<p>Optional signed support LINE offsets (+up/−down) are relative to the lower finished floor or upper finished landing. Each chosen tilted end sawline and entered horizontal support reference are intersected in the same X/elevation-Y plane. A shared corner or interior intersection is ONE POINT with ZERO coincident linear bearing length; a projected X match does NOT imply 2D intersection. Never use a point result as structural bearing or a construction approval.</p>'
        '<div class="table-scroll"><table id="stringer-end-contact-table" aria-label="Nonstructural 2D end cut intersection with measured support line">'
        '<thead><tr><th>End</th><th>Support Y</th><th>Geometry</th><th>Intersect X</th><th>Intersect Y</th><th>Line fraction t</th><th>X miss at support Y</th><th>Shared cut/support length</th></tr></thead><tbody></tbody></table></div>'
        '<div class="takeoff-actions">'
        '<button id="download-stringer-sawline-csv" type="button" class="btn secondary">↓ Download nominal notch sawlines CSV</button>'
        '<button id="download-stringer-end-lines-csv" type="button" class="btn secondary" disabled>↓ Download site-selected end lines CSV</button>'
        '<button id="download-stringer-section-csv" type="button" class="btn secondary">↓ Download modeled profile vertices CSV</button>'
        '<button id="download-stringer-support-csv" type="button" class="btn secondary">↓ Download measured support references CSV</button>'
        '<button id="download-stringer-blank-csv" type="button" class="btn secondary">↓ Download 2D rectangular stock corners CSV</button>'
        '<button id="download-stringer-projections-csv" type="button" class="btn secondary" disabled>↓ Download end projection diagnostics CSV</button>'
        '<button id="download-stringer-end-contact-csv" type="button" class="btn secondary" disabled>↓ Download 2D end/support intersections CSV</button>'
        '</div>'
        '<p class="caution">This model is NOT a full-size cutting template. Side-section area is a geometry cross-check, not a lumber board purchasing quantity or strength rating. Structural and end-bearing acceptance require independent measurements and professional review.</p>'
        '</section>'
    ) if t["slug"]=="stair-stringer-calculator" else ""

    roof_reuse_section=(
        '<section class="content-block roof-reuse-panel" id="roof-reuse-panel">'
        '<span class="eyebrow">OPTIONAL STOCK-CUT VERIFICATION</span>'
        '<h2>Full-sheet cut-box reuse layout</h2>'
        '<p>Opt into the bounded guillotine packing estimate to place each rectangular roof cut or hip polygon BOUNDING BOX onto full stock sheets. Every piece has its own stock-local X/Y placement and polygon vertices. The algorithm checks nonoverlap, charges user-entered split-line kerf and conserves stock area. It does NOT reuse scraps inside angled polygons, certify a real saw path, panel support, fasteners, installation staggering or the lowest sheet count.</p>'
        '<p id="roof-reuse-status" class="framing-price-status" role="status" aria-live="polite">Select optional stock reuse to evaluate sheet placements.</p>'
        '<div id="roof-reuse-svg" class="shelf-pin-drawing" aria-label="Proportional stock sheet layouts, first six source sheets"></div>'
        '<h3>Stock-local piece placement schedule</h3>'
        '<div class="table-scroll"><table id="roof-reuse-table" aria-label="Verified stock bounding boxes and cut polygon coordinates">'
        '<thead><tr><th>Roof cut</th><th>Roof plane</th><th>Stock sheet</th><th>Stock X</th><th>Stock Y</th><th>Box width</th><th>Box height</th><th>Installed area</th></tr></thead><tbody></tbody></table></div>'
        '<div class="takeoff-actions"><button id="download-roof-reuse-csv" type="button" class="btn secondary" disabled>↓ Download full stock-cut placement CSV</button>'
        '<button id="download-roof-reuse-svg" type="button" class="btn secondary" disabled>↓ Download stock-layout preview SVG</button></div>'
        '<p class="caution">The drawing previews at most SIX stock sheets; the numeric CSV lists ALL stock placements and cutting vertices. Not a 1:1 saw template or structural roofing plan. Split-line kerf does not include every angled polygon-perimeter cut.</p>'
        '</section>'
    ) if t["slug"] in ("hip-roof-calculator","roof-sheathing-calculator") else ""
    # The responsive navigation links to real pane anchors, not to duplicate
    # calculators or generated SEO routes. The compact layout already presents
    # measurements, then results, then the detailed drawing.
    body+=(
        '<nav class="workbench-dock wrap" aria-label="Jump between calculator sections">'
        '<span class="dock-kicker">WORKBENCH</span>'
        '<button id="dock-toggle" class="dock-toggle" type="button" aria-controls="workbench-shortcuts" aria-expanded="true" hidden>Sections <span aria-hidden="true">⌄</span></button>'
        '<div class="dock-links" id="workbench-shortcuts">'
        '<a href="#workbench-input">Measurements</a>'
        '<a href="#workbench-results">Results</a>'
        '<a href="#workbench-drawing">Drawing</a>'
        '</div>'
        '<a class="dock-summary" href="#workbench-results">'
        '<span class="dock-summary-label" id="dock-primary-label">Live calculation</span>'
        '<strong class="dock-summary-value" id="dock-primary-value">Preparing…</strong>'
        '<span class="dock-summary-arrow" aria-hidden="true">↗</span>'
        '</a></nav>'
    )
    body+=(f'<section class="workspace wrap" data-workspace><div id="workbench-input" tabindex="-1" class="pane input-pane"><div class="pane-head"><div><span class="pane-index">01 / SETUP</span>'
           '<h2>Measurements</h2></div><span class="pane-state">EDITABLE</span></div>'
           '<div class="unit-row"><label for="unit-select">Units</label><select id="unit-select" aria-label="Measurement units"><option value="in">Inches (in)</option><option value="ft">Feet (ft)</option><option value="mm">Millimeters (mm)</option><option value="cm">Centimeters (cm)</option><option value="m">Meters (m)</option></select>'
           '<label for="fraction-select">Fraction</label><select id="fraction-select" aria-label="Inch fraction precision"><option value="16">1/16</option><option value="32">1/32</option></select></div>'
           +currency_picker+
           f'<form id="calculator-form" novalidate>{fields}{advanced_options}</form>'+scenario_panel+
           '<div class="pane-actions"><button class="btn secondary" id="reset-values" type="button">Reset dimensions ↺</button>'
            '<button class="btn secondary undo-reset" id="undo-reset" type="button" hidden>↶ Undo last reset</button>'
           '<button class="btn secondary" id="share-measurements" type="button" disabled>Copy measurement link ↗</button>'
           '<button class="btn secondary" id="download-measurements-json" type="button" disabled>↓ Save measurements JSON</button>'
           '<label class="measurement-import-label" for="load-measurements-json">Restore a local measurements JSON file</label>'
           '<input id="load-measurements-json" type="file" accept=".json,application/json" aria-label="Restore saved measurements from local JSON file"></div>'
           '<p class="sidebar-note"><span>ⓘ</span> Inputs stay in your browser. Units convert automatically; calculations run locally. Sharing and local JSON backups are optional. Both preserve numeric inputs, units and quote currency, but NOT material inspections or purchasing approvals. Local files are read only in your browser.</p></div>'
           '<div id="workbench-drawing" tabindex="-1" class="pane drawing-pane"><div class="pane-head"><div><span class="pane-index">02 / VISUALIZE</span><h2>Dimension drawing</h2></div>'
           '<div class="zoom-controls" role="group" aria-label="Diagram zoom controls"><button type="button" id="zoom-out" aria-label="Zoom out" aria-controls="dimension-svg">−</button><button type="button" id="zoom-reset" aria-label="Reset diagram zoom to 100%" aria-controls="dimension-svg">100%</button><button type="button" id="zoom-in" aria-label="Zoom in" aria-controls="dimension-svg">+</button></div></div>'
           '<div class="drawing-grid" id="dimension-svg"><div class="loading-graphic">Drawing will update from your measurements.</div></div>'
           '<div class="drawing-caption"><span><i></i> SCALED SCHEMATIC</span><span>NOT A VERIFIED 1:1 TEMPLATE</span></div>'
           '<p class="diagram-linked-help" id="geometry-link-status">Part selection is available only where a drawing element maps exactly to one numbered schedule row.</p>'
           '<button id="diagram-start-row" class="btn secondary diagram-start-row" type="button" hidden>Inspect measured parts →</button>'
           '<div id="diagram-inspector" class="diagram-inspector" aria-live="polite" hidden>'
           '<strong id="diagram-selection">No measured part selected</strong>'
           '<button id="diagram-previous-row" type="button">← Previous</button>'
           '<button id="diagram-next-row" type="button">Next →</button>'
           '<button id="diagram-find-row" type="button">Show matching schedule row ↗</button>'
           '</div>'
           '<div class="diagram-tools"><button type="button" class="btn subtle" id="download-svg">↓ Save SVG</button><button type="button" class="btn subtle" id="print-sheet">⎙ Print / PDF</button></div>'
           '<p class="print-advice">Print / PDF includes the complete measurement schedule, including rows on other screen pages, plus two physical calibration rulers. Use 100% / Actual size and check both with a real ruler; the geometry diagram itself is NOT a 1:1 template. Printed schedules may span many sheets.</p>'
           '<section id="print-calibration" class="print-calibration" aria-label="Printed ruler calibration check">'
           '<h3>Physical print scale check</h3>'
           '<p>Print at 100% / Actual size on A4 or Letter; disable Fit to page. Measure both bars with a trusted ruler before using worksheet values. The drawing remains schematic regardless of this check.</p>'
           '<div class="calibration-measure"><strong>100 mm reference</strong><div class="calibration-bar calibration-100mm" role="img" aria-label="Reference bar nominally 100 millimeters wide when printed at actual size"></div><small>Accept only 99.5 to 100.5 mm measured on paper (±0.5%).</small></div>'
           '<div class="calibration-measure"><strong>1 in reference</strong><div class="calibration-bar calibration-1in" role="img" aria-label="Reference bar nominally one inch wide when printed at actual size"></div><small>Accept only 0.995 to 1.005 in measured on paper (±0.5%).</small></div>'
           '<p class="calibration-warning">If either ruler is outside tolerance, reject the printed sheet and correct printer settings. Passing these checks does NOT turn the resized SVG diagram into a full-size cutting pattern. Calculated dimensions do not certify structural capacity, code compliance, material quality or safe cutting techniques.</p>'
           '</section></div>'
           '<aside id="workbench-results" tabindex="-1" class="pane result-pane"><div class="pane-head"><div><span class="pane-index">03 / RESULTS</span><h2>Your takeoff</h2></div><span class="live-indicator">LIVE</span></div>'
           '<p id="calc-error" class="error-banner" role="alert" hidden></p>'
            '<button class="btn secondary error-review" id="review-invalid" type="button" aria-describedby="calc-error" hidden>Find invalid measurement ↗</button>'
            '<div id="result-cards" class="result-stack" aria-live="off">'
           '<p class="empty-result">Enter measurements to see calculated dimensions.</p></div>'
           '<div class="export-stack"><button type="button" id="copy-result" class="btn primary">Copy results <span>↗</span></button>'
           '<button type="button" id="download-csv" class="btn secondary">↓ Download CSV cut list</button></div>'
           '<p class="action-status" id="action-status" role="status" aria-live="polite">Calculations will update instantly.</p></aside></section>')
    body+=(
        '<section class="wrap print-input-snapshot" id="print-input-snapshot" aria-labelledby="print-input-title" hidden>'
        '<h2 id="print-input-title">Measurements used for this worksheet</h2>'
        '<p id="print-input-context">Printed inputs are an exact snapshot of user-entered values. The schematic is NOT a 1:1 template.</p>'
        '<table id="print-input-table" aria-label="All input settings used for the printed calculation">'
        '<thead><tr><th scope="col">Input / setting</th><th scope="col">Value at print time</th></tr></thead>'
        '<tbody></tbody></table></section>'
    )
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
        '<details class="advanced-results-disclosure" open>'
        '<summary>Advanced optimality verification <span>Show or hide technical proof</span></summary>'
        '<div class="advanced-results-body"><h3>Optimality verification</h3>'
        '<p id="framing-optimizer-status" role="status" aria-live="polite">Check prices to see exact and heuristic verification.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-proof-table" aria-label="Optimization proof by material">'
        '<thead><tr><th>Material</th><th>Pieces</th><th>Search status</th><th>Distinct states</th><th>Merged repeats</th><th>Certificate</th></tr></thead><tbody></tbody></table></div>'
        '<p class="optimizer-note">Exact mode memoizes equivalent cutting states and can prove the modeled lowest quote cost for up to 16 pieces per material when all distinct search states fit within a 40,000-state limit. A certificate is issued only when search completes with every required supplier price provided. It is valid only for offered lengths, between-cut kerf, independent material profiles and separately rounded purchase allowances. Other results are heuristic estimates, not proven optima.</p>'
        '</div></details></section>'

        '<section class="framing-order-ticket" id="framing-order-ticket" aria-label="Printable purchasing checklist">'
        '<h3>Purchase checklist</h3><p id="framing-ticket-status">Enter supplier quotes.</p>'
        '<ul id="framing-ticket-list"></ul>'
        '<p class="ticket-caveat">Geometry-only material estimate. Verify lengths, profiles, prices and availability; plates, engineered header layers, tax, delivery, labor and hardware excluded.</p></section>'
        '<h3>Stock-by-stock cut plan</h3>'
        '<p>Every bracketed start–end interval is measured from the SAME 0 end of its purchased stick, not from the wall datum. Between successive pieces, the entered saw kerf occupies the intervening interval. Unallocated offcut starts after the last listed piece and is not automatically reused. Display fractions are approximate; CSV preserves numeric positions.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-stock-table" aria-label="Suggested stock cuts">'
        '<thead><tr><th>Stock ID</th><th>Piece · cut length · stock-local start–end</th><th>Between-cut kerf</th><th>Unallocated offcut</th></tr></thead><tbody></tbody></table></div>'
        '<section id="framing-stock-audit" class="framing-stock-audit" aria-label="Optional stock loss and possible offcut reuse check" hidden>'
        '<h3>Optional physical trim &amp; offcut assessment</h3>'
        '<p id="framing-stock-audit-status" class="framing-price-status" role="status" aria-live="polite">Review mode is off.</p>'
        '<p>For each original source stick, this separate review reserves the entered trim at BOTH ends and an extra final-sever kerf if a tail remains. It checks the EXISTING selected cut plan only: no new packing, purchases, discounts, or offcut assignments are inferred. Candidate scraps still require measured stock profile, condition and safe cutting checks.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-stock-audit-table" aria-label="Optional physical stock-fit and candidate tail offcut assessment">'
        '<thead><tr><th>Original stick</th><th>Raw stock length</th><th>Last modeled cut ends</th><th>Extra final kerf</th><th>Available tail after end trim</th><th>Shortfall</th><th>Result</th></tr></thead><tbody></tbody></table></div>'
        '<div class="takeoff-actions"><button id="download-stock-audit-csv" type="button" class="btn secondary" disabled>↓ Download optional stock-loss audit CSV</button></div>'
        '<p class="caution">A failing stick means the original price / purchase plan is NOT enough for these additional allowances. The review does not recalculate a replacement order or validate actual reclaim value. Before cutting: independently verify both end trims, actual blade kerf, cross-section, defects, clamps and separation procedure. No structural approval or machine-ready toolpath.</p>'
        '</section>'
        '<section class="framing-reuse-plan" id="framing-reuse-plan" aria-label="Optional same-profile offcut reallocation comparison" hidden>'
        '<span class="eyebrow">OPTIONAL · COMPARE ONLY</span><h3>Reallocate unused tails across purchased sticks</h3>'
        '<p id="framing-reuse-status" class="framing-price-status" role="status" aria-live="polite">Enable reallocation and enter a positive minimum offcut length to compare.</p>'
        '<p>Independent bounded heuristic: try eliminating WHOLE source sticks by assigning every intact member on them into previously unused tails of other already-purchased sticks of the SAME profile. All positions are recomputed with your actual source lengths, between-piece kerf, entered end trims and final-sever kerf. No splices, no extra purchased sticks and no member duplication. The original purchase and cut plan remains downloadable and unchanged.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-reuse-table" aria-label="Alternative stock-local relocated member coordinates">'
        '<thead><tr><th>Profile</th><th>Original stock</th><th>Alternative stock</th><th>Member</th><th>Length</th><th>Start</th><th>End</th><th>Kerf before</th></tr></thead><tbody></tbody></table></div>'
        '<h3>Alternative supplier quantities and quote</h3>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-reuse-purchase-table" aria-label="Offcut reallocation recalculated stock purchases and supplier quote">'
        '<thead><tr><th>Profile</th><th>Stock offer</th><th>Originally buy</th><th>Alternative buy</th><th>Price per stick</th><th>Alternative cost</th></tr></thead><tbody></tbody></table></div>'
        '<section id="framing-station-ledger" class="framing-station-ledger" aria-label="Per-stick dimensional cutting station ledger" hidden>'
        '<h3>Every inch accounted for: source-local station ledger</h3>'
        '<p id="framing-station-status" role="status" aria-live="polite">No alternative source stations available.</p>'
        '<p>This is a continuous 0-origin <strong>dimensional ledger, NOT a sequence of saw operations</strong>. Every purchased stick shows leading trim, retained members, kerfs between members, optional final separation loss, still-unallocated tail, and trailing trim. The sum of all stations must match the actual source length. No grade, blade setup, clamping or cut procedure is certified.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-station-table" aria-label="Source-local intervals for each retained member, trimmed end and saw-loss segment">'
        '<thead><tr><th>Stock ID</th><th>Profile</th><th>Station</th><th>Segment kind</th><th>Member</th><th>Original stick</th><th>Start</th><th>End</th><th>Length</th></tr></thead><tbody></tbody></table></div>'
        '<div class="takeoff-actions"><button id="download-framing-stations-csv" type="button" class="btn secondary" disabled>↓ Download dimensional station ledger CSV</button></div>'
        '<section class="framing-field-preflight" id="framing-field-preflight" aria-label="Optional manually entered measured source dimensions">'
        '<h4>Field dimensions · manually entered, never auto-verified</h4>'
        '<p>Enter the actual physical length of EVERY proposed source stick. Enter the blade kerf and BOTH-end trim allowance actually intended for this cutting setup, plus any last separation kerf. Empty fields mean <strong>not checked</strong>; do not copy modeled values into measurements without checking real stock. These entries do NOT change the original or alternative buy plan.</p>'
        '<div class="field-measure-global">'
        '<label for="physical-saw-kerf">User-entered blade kerf <span data-field-unit>in</span><input id="physical-saw-kerf" data-measured-global="sawKerf" type="number" min="0" step="any" inputmode="decimal" placeholder="Not entered"><span class="field-print-value" data-field-global-echo="sawKerf">Not entered</span></label>'
        '<label for="physical-end-trim">User-entered trim at EACH end <span data-field-unit>in</span><input id="physical-end-trim" data-measured-global="endTrim" type="number" min="0" step="any" inputmode="decimal" placeholder="Not entered"><span class="field-print-value" data-field-global-echo="endTrim">Not entered</span></label>'
        '<label for="physical-final-kerf">User-entered final-sever kerf <span data-field-unit>in</span><input id="physical-final-kerf" data-measured-global="finalSeverKerf" type="number" min="0" step="any" inputmode="decimal" placeholder="Not entered"><span class="field-print-value" data-field-global-echo="finalSeverKerf">Not entered</span></label>'
        '</div>'
        '<p id="framing-field-status" class="framing-price-status" role="status" aria-live="polite">All physical measurements pending.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-field-table" aria-label="Per-stick entered physical length and dimension-only clearance">'
        '<thead><tr><th>Source stick</th><th>Model length</th><th>Enter actual length</th><th>Required using entered losses</th><th>Remaining or shortfall</th><th>Result</th></tr></thead><tbody></tbody></table></div>'
        '<div class="takeoff-actions"><button id="download-framing-field-csv" type="button" class="btn secondary" disabled>↓ Download field-dimension review CSV</button></div>'
        '<p class="caution">A dimension-only fit is NOT material acceptance, physical inspection proof, safe cutting approval, structural suitability or a validated saving. Recheck grade, defects, thickness/width, accurate blade kerf, manufacturer instructions, clamps, local codes and final supplier invoice. Blank entries stay PENDING; clearing or changing an alternative invalidates prior entries for that layout.</p>'
        '</section>'
        '<section id="framing-purchase-review" class="framing-purchase-review" aria-label="Self-reported pre-purchase review packet" hidden>'
        '<h4>Pre-purchase review packet · human decision required</h4>'
        '<p>Record inspection declarations for EACH source stick, then mark independent safety, structural and purchasing checks. These declarations are NOT verifications performed by this website. Even a completed packet is <strong>not a purchase approval</strong>, proof of saw safety, or realized savings.</p>'
        '<p id="framing-purchase-review-status" class="framing-price-status" role="status" aria-live="polite">HOLD — field measurements and stock inspections pending.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-purchase-review-table" aria-label="Per-stock user inspection declarations">'
        '<thead><tr><th>Source stick</th><th>Dimension review</th><th>Profile and grade reviewed</th><th>Defects and usable cuts reviewed</th><th>Review status</th></tr></thead><tbody></tbody></table></div>'
        '<div class="review-global-checks" aria-label="Global purchase and safe cutting review declarations">'
        '<label><input type="checkbox" data-review-global="sawSafetyReviewed"><span class="review-print-value">NOT DECLARED</span> I reviewed the actual blade, guards, clamping, manufacturer guidance and safe cutting procedure.</label>'
        '<label><input type="checkbox" data-review-global="structuralReviewed"><span class="review-print-value">NOT DECLARED</span> I reviewed stock suitability and applicable structural / building-code requirements with a qualified person where required.</label>'
        '<label><input type="checkbox" data-review-global="supplierVerified"><span class="review-print-value">NOT DECLARED</span> I independently checked quoted supplier SKUs, stock availability and prices.</label>'
        '<label><input type="checkbox" data-review-global="totalCostReviewed"><span class="review-print-value">NOT DECLARED</span> I reviewed purchase quantities, spare-stock allowance, tax, delivery, labor and the actual buying decision.</label>'
        '</div>'
        '<div class="takeoff-actions"><button id="download-framing-purchase-review-csv" type="button" class="btn secondary" disabled>↓ Download self-reported review packet CSV</button></div>'
        '<section class="framing-review-versions" id="framing-review-versions" aria-label="Version labels and comparison of self-reported review packets" hidden>'
        '<h4>Version reference and changes · local comparison only</h4>'
        '<p>Every alternative produces separate non-security IDs for source layout, manually entered measurements, supplier quote and self-declarations. The combined packet ID changes whenever one component changes. Identifiers are comparison checksums, NOT digital signatures or proof of field inspection.</p>'
        '<div id="framing-version-identifiers" class="framing-version-identifiers" aria-label="Current version identities">No current packet.</div>'
        '<div class="takeoff-actions review-version-actions">'
        '<button id="framing-version-pin" type="button" class="btn secondary" disabled>Pin current packet as reference</button>'
        '<button id="framing-version-json" type="button" class="btn secondary" disabled>↓ Download current reference JSON</button>'
        '<button id="framing-version-restore" type="button" class="btn secondary" disabled>Restore historical measurements ONLY (recheck physical stock)</button>'
        '<button id="framing-version-diff-csv" type="button" class="btn secondary" disabled>↓ Download comparison CSV</button>'
        '</div>'
        '<label class="framing-version-import-label" for="framing-version-import">Compare with a previously downloaded reference (local JSON, never uploaded)'
        '<input id="framing-version-import" type="file" accept=".json,application/json"></label>'
        '<p id="framing-version-status" class="framing-price-status" role="status" aria-live="polite">No reference selected. Pin the current packet, or import a previous reference JSON.</p>'
        '<p id="framing-version-restore-warning" class="caution" role="status" aria-live="polite" hidden>Restored values come from a historical user-entered reference. They have NOT been measured again. Source grade/defects, saw setup, structural review and all supplier confirmations are RESET and require fresh checks. Quotes, member placements and buying authorization are NOT restored.</p>'
        '<div class="table-scroll framing-table-scroll"><table id="framing-version-diff-table" aria-label="Differences between saved reference and current review version">'
        '<thead><tr><th>Component</th><th>Changed field</th><th>Reference</th><th>Current</th></tr></thead><tbody></tbody></table></div>'
        '<p class="caution">A reference JSON records self-reported wood measurements, prices and declarations. It is only saved to your device when you download it; nothing is uploaded by this comparison. Import rejects mismatched version metadata, but non-cryptographic IDs cannot authenticate a file. Comparing or pinning a packet never approves a purchase. Current references live in browser memory only; download JSON to compare again after reopening the page.</p>'
        '</section>'
        '<p class="caution">The site never places or authorizes an order. A review packet marked complete only says the user has explicitly checked every item; physical inspection, professional approval when required, supplier invoice and human purchase authorization remain independent. Any measurement, layout or quotation change invalidates affected declarations.</p>'
        '</section>'
        '<h4>Workshop inspection required for EACH source stick</h4>'
        '<ul class="station-inspection-list"><li>□ Measure actual purchased stock length from one physical zero end and confirm profile, thickness, width, species and grade</li>'
        '<li>□ Inspect defects, cracks, knots, twists, damaged ends and whether each moved member remains suitable for its intended structural role</li>'
        '<li>□ Confirm the real blade kerf, required end trims, terminal separation loss, clamps, tool clearance and manufacturer instructions</li>'
        '<li>□ Independently establish a safe physical cutting order; do NOT execute this station ledger as a saw program or 1:1 template</li>'
        '<li>□ Recheck supplier pricing, purchase reserve and local structural/bearing requirements before using any model savings</li></ul>'
        '</section>'
        '<div class="takeoff-actions"><button id="download-framing-reuse-csv" type="button" class="btn secondary" disabled>↓ Download alternative cut placements CSV</button>'
        '<button id="download-framing-reuse-quote-csv" type="button" class="btn secondary" disabled>↓ Download alternative purchase quote CSV</button></div>'
        '<p class="caution">A positive monetary difference compares ONLY your entered supplier prices and this finite modeled plan. This bounded reassignment is not a global optimum and cannot certify safe on-site cuts, scrap material quality, structural use, or guaranteed savings. A failed extra-loss audit blocks the comparison. Verify every new plan and reprice the real order before purchasing.</p>'
        '</section>'
        '<div class="takeoff-actions"><button id="download-stock-csv" type="button" class="btn secondary">↓ Download stock cut plan CSV</button>'
        '<button id="download-price-csv" type="button" class="btn secondary">↓ Download quoted materials CSV</button></div>'
        '<p class="caution">Stock-local placement intervals are NOT a certified saw sequence or full-scale cutting template. The model charges kerf ONLY between retained cuts; final end separation, rough-end trimming, defects, blade setup, clamps and stock profile checks require site verification and may consume extra material. Never assume unused offcuts have been reused or structurally approved.</p>'
        '</div>'
    ) if t["slug"]=="framing-calculator" else ""
    deck_takeoff=(
        '<section class="content-block deck-purchase-plan" id="deck-purchase-plan">'
        '<span class="eyebrow">DECK MATERIAL PLANNING</span><h2>Supplier quote & fastening reference</h2>'
        '<p>The counted deck boards include the entered stock allowance, with no offcut reuse. Each installed board piece is counted at every joist CENTERLINE it touches. At each butt seam the two separate pieces create two piece/joist fastening contacts at the same line; this does NOT validate actual bearing, double joists, end gaps, a safe fastener pattern or structural spans. Enter actual supplier quotes to display a complete materials-only total.</p>'
        '<p id="deck-cost-status" class="framing-price-status" role="status" aria-live="polite">Enter board and fastener pack quotes; if enabled, quote optional full-width joist sticks too.</p>'
        '<div class="table-scroll"><table id="deck-budget-table" aria-label="Deck materials buying list">'
        '<thead><tr><th>Material</th><th>Planned</th><th>Buy</th><th>Units</th><th>Price each</th><th>Purchase cost</th></tr></thead><tbody></tbody></table></div>'
        '<h3>Fastener contacts by installed row</h3>'
        '<p>One contact means one individual decking piece at a joist reference line, NOT a code-approved screw count. Set fasteners per contact to zero if hardware is not in scope. Stock purchased boards and fastener packs are rounded separately; supplier pack leftovers are not credited to the cut list.</p>'
        '<div class="table-scroll deck-fastener-scroll"><table id="deck-fastener-table" aria-label="Fastener count per decking row">'
        '<thead><tr><th>Row</th><th>Joist lines</th><th>Butt seams</th><th>Piece/joist contacts</th><th>Fasteners/row</th><th>First seam</th><th>Last seam</th></tr></thead><tbody></tbody></table></div>'
        '<section class="framing-order-ticket" aria-label="Printable deck buying ticket">'
        '<h3>Deck buying ticket</h3><p id="deck-ticket-status">Supplier quotes required.</p>'
        '<ul id="deck-ticket-list"></ul>'
        '<p class="ticket-caveat">Geometry-only reference. Decking stock counts do not include saw kerf, end trimming or offcut reuse. Optional full-width straight joist sticks are included in the quote ONLY when explicitly enabled; they are not structural sizing. All other joist/framing design, blocking, beams, ledger, posts, footings, tax, delivery and labor are excluded. Fastener references are not installation specifications.</p></section>'
        '<div class="takeoff-actions">'
        '<button id="download-deck-budget-csv" type="button" class="btn secondary">↓ Download materials quote CSV</button>'
        '<button id="download-deck-fastener-csv" type="button" class="btn secondary">↓ Download fastener rows CSV</button>'
        '</div></section>'
    ) if t["slug"]=="deck-material-calculator" else ""
    # Navigation is task-based, not a new SEO route. The full underlying
    # tables, assumptions and exports remain in the DOM and in print.
    detail_index = (
        '<nav class="worksheet-index" aria-label="Worksheet results sections">'
        '<span class="eyebrow">ON THIS WORKSHEET</span>'
        '<a href="#workbench-results">Key results</a>'
        '<a href="#workbench-drawing">Drawing</a>'
        '<a href="#measurement-schedule">Measurements</a>'
        + ('<a href="#framing-takeoff">Material plan</a>'
           '<a href="#framing-optimizer-panel">Advanced verification</a>'
           '<a href="#framing-order-ticket">Purchase checklist</a>'
           if t["slug"]=="framing-calculator" else '')
        + ('<a href="#deck-purchase-plan">Materials & fasteners</a>'
           if t["slug"]=="deck-material-calculator" else '')
        + '</nav>'
    )
    body+=(f'<section class="wrap detail-layout"><div class="detail-main">{detail_index}<div id="measurement-schedule" class="content-block worksheet-schedule"><span class="eyebrow">CUT & POSITION DATA</span><h2>Measurement schedule</h2>'
           '<p>Items below are generated from the same numbers used for the drawing. The screen may show only 160 rows per page, but Print / PDF expands the entire schedule before printing and restores your screen page afterwards; CSV always includes all rows. Numeric CSV cells use the selected units in column headers for spreadsheet import. Inspect all cuts on site.</p>'
           '<div class="table-scroll"><table id="cut-table" aria-label="Calculated cut and measurement schedule"><tbody><tr><td>Calculated position data appears here.</td></tr></tbody></table></div>'
           '<p class="schedule-count" id="schedule-count" aria-live="polite"></p>'
           '<div id="print-schedule-readable" class="print-schedule-readable" aria-label="Readable print-only schedule" hidden></div>'
           '<nav class="schedule-pager" id="schedule-pager" aria-label="Measurement schedule pages" hidden>'
           '<button type="button" id="schedule-prev" class="schedule-pager-button">← Previous</button>'
           '<span id="schedule-page-status">Page 1 of 1</span>'
           '<label for="schedule-page-input">Go to page</label>'
           '<input id="schedule-page-input" type="number" min="1" step="1" value="1" inputmode="numeric">'
           '<button type="button" id="schedule-go" class="schedule-pager-button">Go</button>'
           '<button type="button" id="schedule-next" class="schedule-pager-button">Next →</button></nav></div>'
           +framing_takeoff+deck_takeoff+stringer_section+roof_reuse_section+shelf_pin_panel+
           '<div class="content-block proof" id="calculation-method"><span class="eyebrow">REPRODUCIBLE METHOD</span><h2>Worked example and independent verification</h2>'
           f'<p>{esc(t["desc"])}</p>'+task_note+
           f'<h3>Reproducible example</h3><p>{esc(t["example"])}</p>'
            +guidance+
            f'<section class="field-verification" aria-label="Independent measurement review"><h3>How to independently verify your result</h3><p>{esc(FIELD_CHECKS[t["slug"]])}</p><p class="field-caution">Use actual measured reference faces and the numeric CSV. This is a review prompt, not a completed field inspection or structural approval.</p></section>'
            '<h3>Assumptions and limits</h3>'
           '<h3 class="print-only-heading">Worksheet assumptions &amp; safety limits</h3>'
           f'<p id="print-assumptions">{esc(t["limit"])}</p>'
           '<p class="caution">This tool describes dimensional geometry. It does not certify building-code compliance, structural capacity, fastening, material quality or safe cutting techniques.</p>'
           '<h3>Printing and precision</h3><p>Use Print / PDF to save the worksheet as a PDF. The SVG is a proportional diagram, not a one-to-one cutting template. Before transferring marks to wood, verify units, stock dimensions, kerf, reference faces and printer scaling.</p>'
           '</div></div><aside class="details-side"><nav class="related-box intent-related" aria-label="Next calculator for a different task"><span class="eyebrow">NEXT AT THE WORKBENCH</span><h2>Choose your next calculation</h2>'
           +''.join(f'<a href="/{esc(r["slug"])}/" data-intent-target="{esc(r["slug"])}"><strong>{esc(r["title"])}</strong><small>{esc(why)}</small></a>' for r,why in relevant)
           +'</nav><div class="related-box muted-box"><span class="eyebrow">SITE POLICY</span><h3>Local by default</h3><p>No account, no project upload, no paid API. A small local setting may remember recent tools.</p></div></aside></section>')
    description=t["desc"].strip().rstrip(".") + "."
    return page(intent["seoTitle"],description,body,"/"+t["slug"]+"/","tool")

def cat_page(key, name, slug):
    subset = [t for t in TOOLS if t["category"] == key]
    guide = CATEGORY_GUIDES[key]
    lookup = {t["slug"]: t for t in subset}
    choices = ''.join(
        '<a class="category-choice" href="/' + esc(choice["slug"]) + '/">'
        '<strong>' + esc(choice["label"]) + '</strong>'
        '<span>' + esc(choice["why"]) + '</span>'
        '<small>' + esc(lookup[choice["slug"]]["title"]) + ' ↗</small></a>'
        for choice in guide["choices"]
    )
    body = (
        f'<section class="wrap category-header"><nav class="breadcrumbs" aria-label="Breadcrumb">'
        f'<a href="/">All tools</a><span>/</span>{esc(name)}</nav>'
        f'<span class="eyebrow">WORKSHOP DIRECTORY / {len(subset):02d} TOOLS</span>'
        f'<h1>{esc(guide["title"])}</h1>'
        f'<p class="category-lede">{esc(guide["lead"])}</p>'
        '<div class="tool-grid">' + ''.join(tool_card(t) for t in subset) + '</div>'
        '<section class="category-guide" aria-label="Choose and check your measurement task">'
        '<div class="category-guide-heading"><span class="eyebrow">MATCH THE MEASUREMENT</span>'
        '<h2>Choose the right calculator for the job</h2>'
        '<p>These tools answer different geometry questions. Start with what you can actually measure.</p></div>'
        '<div class="category-choice-grid">' + choices + '</div>'
        '<div class="category-guide-notes">'
        '<section class="category-example"><span class="eyebrow">CHECK THE MATH</span>'
        '<h2>' + esc(guide["example_title"]) + '</h2><p>' + esc(guide["example"]) + '</p></section>'
        '<section class="category-limit"><span class="eyebrow">SCOPE &amp; SAFETY</span>'
        '<h2>What these tools do not certify</h2><p>' + esc(guide["limit"]) + '</p>'
        '<p>Calculations are browser-based references. Verify physical measurements and local requirements before working on material.</p>'
        '</section></div></section></section>'
    )
    return page(guide["title"],guide["description"],body,"/"+slug+"/","category")

def info_page(title, paragraphs, url):
    if url == "/contact/":
        # A mailto link is only a user-initiated handoff to the visitor's
        # email client. The static site has no web form or message storage.
        body = ('<article class="wrap legal-page"><a href="/">← Back to calculators</a>'
                '<span class="eyebrow">WOODLAYOUT</span><h1>Contact</h1>'
                '<p>Questions, corrections, or feedback about a calculator? '
                'Email <a href="mailto:contact@woodlayout.com">contact@woodlayout.com</a>.</p>'
                '<p>For reproducible geometry issues, include the calculator name, '
                'input dimensions, selected units and the result you expected. '
                'Do not send passwords or sensitive personal information.</p>'
                '<p>You can also report a technical issue through the '
                '<a href="https://github.com/garrison2025/Woodworking_Calculator/issues">'
                'public GitHub issue tracker</a>. Remember that GitHub issues are public.</p>'
                '<p>This site does not collect or store messages through a web form. '
                'Sending email uses your email provider and the receiving mailbox provider.</p>'
                '</article>')
        return page(title,"Email contact@woodlayout.com for WoodLayout calculator questions, corrections and feedback.",body,url,"contact")
    body='<article class="wrap legal-page"><a href="/">← Back to calculators</a><span class="eyebrow">WOODLAYOUT</span><h1>'+esc(title)+'</h1>'+''.join('<p>'+esc(p)+'</p>' for p in paragraphs)
    if url == "/about/":
        body += ('<section class="about-method" aria-label="How WoodLayout is built and checked">'
                 '<h2>How WoodLayout calculates and checks dimensions</h2>'
                 '<p>Each calculator has a task-specific measurement model, an explicit geometry rule, a local JavaScript calculation engine and a page-level explanation of what the result does and does not represent. The same modeled dimensions feed the numeric schedule and proportional drawing. Each tool page also publishes a reproducible worked example and a separate measurement check.</p>'
                 '<h2>Measurement conventions</h2>'
                 '<ul><li>Choose the reference that matches the task: clear opening, outside dimension, center-to-center distance, face edge, or a named datum. These are not interchangeable.</li>'
                 '<li>Available length units are inches, feet, millimeters, centimeters and meters. In inch mode, common fractional-inch entries such as 5 1/2 and 3/4 are accepted; other unit modes use decimal entries.</li>'
                 '<li>Fraction display precision can be selected for inch results. CSV exports preserve numeric values and label their units; do not treat rounded display fractions as more precise than the entered measurements.</li>'
                 '<li>Supplier prices are entered by the visitor. WoodLayout does not provide live lumber prices or currency conversion.</li></ul>'
                 '<h2>How to interpret drawings, schedules and estimates</h2>'
                 '<p>SVG diagrams are proportional geometry references, not 1:1 cutting or drilling templates. Print worksheets include physical calibration bars; measure them on paper before relying on printed scale. Material estimates depend on the dimensions, stock lengths, kerf and allowances entered by the visitor. A mathematical fit does not prove a safe saw path, stock quality or installation method.</p>'
                 '<h2>What has and has not been tested</h2>'
                 '<p>Automated unit, browser, document-output and deployment checks cover selected inputs, exports and responsive layouts. Worked examples are reproducible software fixtures, not real-shop test cuts. Actual lumber cuts, real printer dimensions, material strength and compliance with local building rules have not been independently field certified.</p>'
                 '<h2>Public implementation and corrections</h2>'
                 '<p>The <a href="https://github.com/garrison2025/Woodworking_Calculator">public source repository</a> contains the calculation engines and automated regression tests. To report a discrepancy, provide the calculator URL, selected units, exact entered dimensions and expected comparison. Send it to <a href="mailto:contact@woodlayout.com">contact@woodlayout.com</a> or use the public <a href="https://github.com/garrison2025/Woodworking_Calculator/issues">GitHub issue tracker</a> without posting private information.</p>'
                 '<p>This independent tool collection is free to use in a browser; calculations run locally, there is no account requirement, and no live lumber pricing service.</p>'
                 + ('<p>For machine-readable navigation, see the optional <a href="/llms.txt">WoodLayout site guide</a>. It summarizes the site and links to the detailed calculator pages; it does not guarantee search ranking, indexing or AI citations.</p>' if INDEXABLE else '') + '</section>')
    body += '</article>'
    content_type = "about" if url == "/about/" else "info"
    meta_descriptions = {
        "/about/": "About WoodLayout: free browser-based woodworking calculators with measurement guides, diagrams and local CSV/SVG exports.",
        "/privacy/": "Privacy: calculations run in your browser. Measurements are not uploaded; the site uses no analytics, ads, third-party APIs or web forms.",
        "/terms/": "Terms and safety: free dimensional reference tools. Verify cuts, stock, printer scale and local building requirements before use."
    }
    return page(title,meta_descriptions.get(url,paragraphs[0]),body,url,content_type)

def build():
    if DEST.exists(): shutil.rmtree(DEST)
    DEST.mkdir()
    assets=DEST/"assets";assets.mkdir()
    shutil.copyfile(ROOT/"src"/"tools.json",assets/"tools.json")
    # Tool pages hydrate from their own exact registry entry, rather than
    # transferring 31 tools (and every formula/example) for one calculation.
    config_dir = assets/"tool-config"
    config_dir.mkdir()
    for t in TOOLS:
        (config_dir/(t["slug"]+".json")).write_text(
            json.dumps(t,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    # Preset inputs are embedded in rendered HTML; no extra browser fetch is
    # necessary and all worked cases can be examined without JavaScript.
    shutil.copyfile(ROOT/"src"/"app.mjs",assets/"app.mjs")
    shutil.copyfile(ROOT/"src"/"home.mjs",assets/"home.mjs")
    shutil.copyfile(ROOT/"src"/"measurement-links.mjs",assets/"measurement-links.mjs")
    shutil.copyfile(ROOT/"src"/"length-entry.mjs",assets/"length-entry.mjs")
    shutil.copyfile(ROOT/"src"/"measurement-files.mjs",assets/"measurement-files.mjs")
    shutil.copyfile(ROOT/"src"/"calcs.mjs",assets/"calcs.mjs")
    shutil.copyfile(ROOT/"src"/"cut-list.mjs",assets/"cut-list.mjs")
    shutil.copyfile(ROOT/"src"/"framing-stations.mjs",assets/"framing-stations.mjs")
    shutil.copyfile(ROOT/"src"/"framing-review-versions.mjs",assets/"framing-review-versions.mjs")
    shutil.copyfile(ROOT/"src"/"style.css",assets/"style.css")
    write("/",home())
    for t in TOOLS: write("/"+t["slug"]+"/",tool_page(t))
    for k,(name,slug) in CATS.items():
        if any(t["category"]==k for t in TOOLS):write("/"+slug+"/",cat_page(k,name,slug))
    pages={
    "/about/":("About",["WoodLayout is an independent collection of browser-based woodworking geometry calculators. It gives DIY builders reproducible measurements, diagrams and local exports.","These tools are educational dimension aids only; they do not provide structural engineering, safe spans, or building-code certification."]),
    "/contact/":("Contact",["For questions and feedback, email contact@woodlayout.com or report a reproducible issue in our public GitHub repository.","We do not operate a contact web form or user account system."]),
    "/privacy/":("Privacy",["This website does not currently run analytics, advertising scripts, third-party APIs, or web form submissions. Calculator values are processed in your browser; no measurements are uploaded by the site.","The website may store a short list of recently visited tools in your browser localStorage. You can remove that item by clearing site storage. Optional copied measurement links encode numeric inputs in the URL fragment (after #), which is not included in HTTP requests, but anyone you share the link with can see these measurements. Optional local JSON backups are downloaded to and read from your own device with no file upload. The web host can still process standard HTTP requests and access logs. If analytics or ads are added, this policy must be revised before those scripts are enabled.","If you contact contact@woodlayout.com by email, your email provider and the receiving mailbox provider process your message, sender address and any details you choose to include. The website itself does not receive your email message via its static hosting. Do not email passwords or sensitive personal data."]),
    "/terms/":("Terms & Safety",["All tools are supplied as free dimensional reference aids without warranties. Verify actual cuts against a physical sample, chosen stock and applicable local codes.","No computed number constitutes structural certification or a guarantee of workmanship. Avoid using a diagram as a full-size printed cutting template unless its physical scale has been verified."])
    }
    for path,(title,paragraphs) in pages.items():write(path,info_page(title,paragraphs,path))
    # One icon source for the navigation mark, browser tab and external lockup.
    # Do not regress to mismatched hand-drawn WG/W logos in different contexts.
    shutil.copyfile(ROOT/"src"/"logo-mark.svg", DEST/"logo-mark.svg")
    shutil.copyfile(ROOT/"src"/"logo-mark.svg", DEST/"favicon.svg")
    shutil.copyfile(ROOT/"src"/"logo-lockup.svg", DEST/"logo-lockup.svg")
    from scripts.social_card import generate as generate_social_card
    generate_social_card(DEST/"social-card.png")
    (DEST/"404.html").write_text(page("Page not found","This tool URL is not available.","<section class='wrap legal-page'><h1>That tool isn't here.</h1><p>Try the complete calculator directory.</p><a class='btn primary' href='/#tools'>Find a tool ↗</a></section>","/404/"))
    # Cloudflare Pages static response headers. 404.html must never be a
    # canonical search result; the page() gate above separately keeps its
    # HTML robots meta noindex in every mode.
    headers = ("/*\n  X-Content-Type-Options: nosniff\n"
               "  Referrer-Policy: strict-origin-when-cross-origin\n"
               "  X-Frame-Options: DENY\n"
               "  Permissions-Policy: camera=(), microphone=(), geolocation=()\n")
    nonindex = "  X-Robots-Tag: noindex, nofollow, noarchive\n"
    if not INDEXABLE:
        # Both default Pages and custom-domain previews must remain noindex,
        # including non-HTML resources without a robots meta tag.
        headers += "\n/*\n" + nonindex
    else:
        # Production assets may still be reachable on the Pages origin before
        # the owner activates the host-level 301 redirect. Fail closed for
        # Pages aliases WITHOUT suppressing approved custom-domain URLs.
        headers += "\nhttps://woodworking-calculator.pages.dev/*\n" + nonindex
        headers += "\nhttps://:version.woodworking-calculator.pages.dev/*\n" + nonindex
    headers += "\n/llms.txt\n  Content-Type: text/plain; charset=utf-8\n"
    (DEST/"_headers").write_text(headers, encoding="utf-8")
    if INDEXABLE:
        urls=["/"]+[f"/{t['slug']}/" for t in TOOLS]+sorted(ACTIVE_CATEGORIES)+list(pages)
        xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+esc(SITE_URL+url)+'</loc></url>' for url in urls)+'</urlset>'
        (DEST/"sitemap.xml").write_text(xml,encoding="utf-8")
        robots = [
            "# Public search and user-requested retrieval crawlers",
            "User-agent: OAI-SearchBot", "Allow: /", "",
            "User-agent: ChatGPT-User", "Allow: /", "",
            "User-agent: Claude-SearchBot", "Allow: /", "",
            "User-agent: Claude-User", "Allow: /", "",
            "User-agent: PerplexityBot", "Allow: /", "",
            "User-agent: Perplexity-User", "Allow: /", "",
            "User-agent: Googlebot", "Allow: /", "",
            "User-agent: Bingbot", "Allow: /", "",
            "User-agent: *", "Allow: /", "",
            "Sitemap: " + SITE_URL + "/sitemap.xml",
        ]
        (DEST/"robots.txt").write_text("\n".join(robots) + "\n",encoding="utf-8")
        (DEST/"llms.txt").write_text(build_llms_txt(SITE_URL),encoding="utf-8")
    else:
        (DEST/"robots.txt").write_text("User-agent: *\nDisallow: /\n")
    print(f"Built {len(TOOLS)} calculator pages; indexable={INDEXABLE}; production SEO scope={len(TOOLS)} tools / {len(ACTIVE_CATEGORIES)} categories; output={DEST}")

if __name__ == "__main__":
    build()
