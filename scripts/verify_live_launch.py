#!/usr/bin/env python3
"""Read-only HTTP acceptance for a deployed Woodworking Calculator site.

Run AFTER a domain is attached and configured; this does not deploy, index,
submit to Google, authorize workshop cuts or verify physical print scaling.
Only Python's standard library is required (including on Windows).
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import html.parser
import json
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "src" / "tools.json").read_text(encoding="utf-8"))
TOOLS = [t for t in MANIFEST["tools"] if t["priority"] in ("P0", "P1")]
assert len(TOOLS) == 31
TOOL_PATHS = {"/" + t["slug"] + "/" for t in TOOLS}
CATEGORIES = {
    "/" + c[1] + "/": {t["slug"] for t in TOOLS if t["category"] == key}
    for key, c in MANIFEST["categories"].items()
}
OTHER = {"/", "/about/", "/contact/", "/privacy/", "/terms/"}
ALL_PAGES = OTHER | TOOL_PATHS | set(CATEGORIES)
assert len(ALL_PAGES) == 42


class Head(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.h1 = 0
        self.title = ""
        self.in_title = False
        self.meta = {}
        self.canonical = []
        self.schema = []
        self.in_json = False
        self.json_text = ""
        self.calculator_forms = 0
        self.tool_field_ids = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "h1":
            self.h1 += 1
        if tag == "title":
            self.in_title = True
        if tag == "meta" and a.get("name"):
            self.meta[a["name"]] = a.get("content", "")
        if tag == "link" and "canonical" in a.get("rel", "").split():
            self.canonical.append(a.get("href", ""))
        if tag == "form" and a.get("id") == "calculator-form":
            self.calculator_forms += 1
        if tag in ("input", "select") and a.get("id", "").startswith("f-"):
            self.tool_field_ids.append(a["id"])
        if tag == "script" and a.get("type") == "application/ld+json":
            self.in_json = True
            self.json_text = ""

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_json:
            self.json_text += data

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script" and self.in_json:
            try:
                self.schema.append(json.loads(self.json_text))
            except json.JSONDecodeError:
                self.schema.append(None)
            self.in_json = False


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


_OPENER = build_opener(NoRedirect)


def http_get(url: str):
    """Return (HTTP code, decoded body, lowercase headers); never follow redirects."""
    req = Request(url, headers={"User-Agent": "Woodworking-Launch-Audit/1.0",
                                "Accept-Encoding": "identity"})
    try:
        response = _OPENER.open(req, timeout=12)
    except HTTPError as error:
        response = error
    with response:
        body = response.read(3_000_001)
        headers = {k.lower(): v for k, v in response.headers.items()}
        status = response.status if hasattr(response, "status") else response.code
    return status, body.decode("utf-8", "replace"), headers


def expected_index_routes():
    """All completed tool and category routes in an approved custom-domain build."""
    approved_tools = {t["slug"] for t in TOOLS}
    urls = (OTHER | {"/" + slug + "/" for slug in approved_tools} |
            {path for path, children in CATEGORIES.items()
             if children & approved_tools})
    assert len(urls) == 42
    return urls


def validate_base(url: str, mode: str):
    u = urlsplit(url)
    if (u.scheme != "https" or not u.hostname or u.username or u.password or
            u.query or u.fragment or u.path not in ("", "/")):
        raise ValueError("Use an origin-only HTTPS URL, such as https://your-domain.com")
    host = u.hostname.lower()
    if mode == "production" and (
        host.endswith(".pages.dev") or host == "pages.dev"
        or host.endswith((".example", ".invalid", ".test", ".localhost"))
    ):
        raise ValueError("Production requires a real owned custom HTTPS domain, not a preview or placeholder")
    if mode == "preview" and not host.endswith(".pages.dev"):
        raise ValueError("Preview audit requires the actual Cloudflare *.pages.dev origin")
    return url.rstrip("/")


def audit(base: str, mode: str, pages_origin: str | None = None,
          get=http_get, verify_source_parity: bool = False):
    """Return a machine-readable result. An injected get() supports offline tests."""
    origin = validate_base(base, mode)
    if mode not in ("preview", "production"):
        raise ValueError("mode must be preview or production")
    if mode == "production":
        if not pages_origin:
            raise ValueError("Production audit requires --pages-origin to check the old host redirect")
        pages_origin = validate_base(pages_origin, "preview")
    results = {"checked_at_utc": datetime.now(timezone.utc).isoformat(),
               "base": origin, "mode": mode, "production_seo_scope": "all_31_tools",
               "checks": 0, "failures": [],
               "http_pages_checked": 0,
               "verify_source_parity": verify_source_parity,
               "source_parity_checks": 0,
               "physical_measurement": "NOT RUN",
               "device_screen_reader_test": "NOT RUN",
               "gsc_indexing": "NOT RUN"}

    def check(ok, note):
        results["checks"] += 1
        if not ok:
            results["failures"].append(note)

    def request(path, host=origin):
        try:
            return get(host + path)
        except (OSError, URLError, ValueError) as exc:
            check(False, "HTTP exception: " + host + path + ": " + str(exc))
            return 0, "", {}

    index_routes = expected_index_routes() if mode == "production" else set()
    seen_titles = {}
    for path in sorted(ALL_PAGES):
        status, body, headers = request(path)
        check(status == 200, path + ": expected HTTP 200, got " + str(status))
        if status != 200:
            continue
        results["http_pages_checked"] += 1
        p = Head()
        p.feed(body)
        check(p.h1 == 1, path + ": expected exactly one H1")
        check(bool(p.title.strip()), path + ": missing document title")
        if verify_source_parity:
            results["source_parity_checks"] += 1
            check('class="mobile-site-menu"' in body and
                  'aria-label="Mobile tool categories"' in body and
                  'href="/materials/"' in body,
                  path + ": deployed V4 mobile category navigation differs from source")
        if verify_source_parity:
            results["source_parity_checks"] += 1
            check('src="/logo-mark.svg"' in body and
                  'class="brand-wordmark"' in body and
                  'Wood<span>Layout</span>' in body and
                  p.title.endswith(" | WoodLayout"),
                  path + ": deployed WoodLayout navigation logo/brand differs from source")
        check(bool(p.meta.get("description", "").strip()), path + ": missing meta description")
        if p.title in seen_titles:
            check(False, path + ": duplicate title with " + seen_titles[p.title])
        else:
            seen_titles[p.title] = path
        approved = path in index_routes
        robots = "index,follow" if approved else "noindex,nofollow,noarchive"
        check(p.meta.get("robots") == robots, path + ": incorrect robots meta")
        xrobots = headers.get("x-robots-tag", "").lower()
        if mode == "preview":
            check("noindex" in xrobots,
                  path + ": Pages preview missing response X-Robots-Tag noindex")
        elif approved:
            check("noindex" not in xrobots,
                  path + ": approved custom-domain route has HTTP noindex")
        expected_canonical = [origin + path] if approved else []
        check(p.canonical == expected_canonical, path + ": canonical not aligned with release gate")
        check(len(p.schema) == (1 if approved else 0),
              path + ": unexpected schema count")
        if approved and len(p.schema) == 1:
            schema = p.schema[0]
            check(isinstance(schema, dict) and schema.get("url") == origin + path,
                  path + ": JSON-LD URL not canonical")
            check(isinstance(schema, dict) and schema.get("@type") ==
                  ("WebApplication" if path in TOOL_PATHS else "WebSite"),
                  path + ": JSON-LD type does not match page")
        if path in TOOL_PATHS:
            check(p.calculator_forms == 1, path + ": missing or duplicate live calculator form")
            if verify_source_parity:
                tool = next(t for t in TOOLS if path == "/" + t["slug"] + "/")
                expected_fields = {"f-" + f["key"] for f in tool["inputs"]}
                results["source_parity_checks"] += 1
                check(len(p.tool_field_ids) == len(expected_fields) and
                      set(p.tool_field_ids) == expected_fields,
                      path + ": deployed form fields differ from the current source manifest")
                # HTML and engine assets can deploy independently. Confirm the
                # entire 31-route in-page workbench navigation is present too.
                results["source_parity_checks"] += 1
                check('aria-label="Jump between calculator sections"' in body and
                      all(('id="' + key + '"') in body for key in (
                          "workbench-input", "workbench-results", "workbench-drawing",
                          "dock-primary-label", "dock-primary-value")) and
                      all(('href="#' + key + '"') in body for key in (
                          "workbench-input", "workbench-results", "workbench-drawing")),
                      path + ": deployed workbench navigator/summary differs from the current source")
                results["source_parity_checks"] += 1
                check('id="undo-reset" type="button" hidden' in body and
                      'id="review-invalid" type="button" aria-describedby="calc-error" hidden' in body,
                      path + ": deployed input-recovery controls differ from the current source")
                results["source_parity_checks"] += 1
                check(all(('id="' + element + '"') in body for element in (
                          "dock-toggle", "workbench-shortcuts",
                          "diagram-inspector", "diagram-selection", "diagram-find-row",
                          "geometry-link-status", "measurement-schedule")) and
                      'aria-label="Worksheet results sections"' in body and
                      (path != "/framing-calculator/" or
                       'class="advanced-results-disclosure"' in body),
                      path + ": deployed V4 advanced-workbench UI differs from current source")
    for asset in ("favicon.svg", "logo-mark.svg", "logo-lockup.svg",
                  "assets/app.mjs", "assets/calcs.mjs", "assets/style.css"):
        status, _, _ = request("/" + asset)
        check(status == 200, "/" + asset + ": missing static asset")
    for t in TOOLS:
        path = "/assets/tool-config/" + t["slug"] + ".json"
        status, body, _ = request(path)
        check(status == 200, path + ": missing per-tool configuration")
        if status == 200:
            try:
                config = json.loads(body)
                check(config.get("slug") == t["slug"], path + ": wrong runtime tool config")
                if verify_source_parity:
                    results["source_parity_checks"] += 1
                    check(config == t, path + ": deployed config differs from current source (possible stale deployment)")
            except (ValueError, AttributeError):
                check(False, path + ": invalid runtime tool config JSON")
    if verify_source_parity:
        # Generated tool configs and markup may drift independently of the
        # JavaScript engine. A correct slug or HTTP 200 alone cannot prove the
        # current GitHub main commit is the one Cloudflare actually serves.
        # Build.py copies these files byte-for-byte, so text equality is a
        # meaningful, repeatable deployment parity check.
        source_assets = {
            "assets/tools.json": "tools.json",
            "assets/app.mjs": "app.mjs",
            "assets/home.mjs": "home.mjs",
            "assets/calcs.mjs": "calcs.mjs",
            "assets/cut-list.mjs": "cut-list.mjs",
            "assets/length-entry.mjs": "length-entry.mjs",
            "assets/measurement-files.mjs": "measurement-files.mjs",
            "assets/measurement-links.mjs": "measurement-links.mjs",
            "assets/framing-stations.mjs": "framing-stations.mjs",
            "assets/framing-review-versions.mjs": "framing-review-versions.mjs",
            "assets/style.css": "style.css",
            "logo-mark.svg": "logo-mark.svg",
            "logo-lockup.svg": "logo-lockup.svg",
            "favicon.svg": "logo-mark.svg",
        }
        for asset, source in source_assets.items():
            status, actual, _ = request("/" + asset)
            results["source_parity_checks"] += 1
            check(status == 200, "/" + asset + ": missing asset for source parity")
            if status != 200:
                continue
            expected = (ROOT / "src" / source).read_text(encoding="utf-8")
            if source.endswith(".json"):
                try:
                    matches = json.loads(actual) == json.loads(expected)
                except ValueError:
                    matches = False
            else:
                matches = actual == expected
            check(matches, "/" + asset +
                  ": deployed content differs from source (possible stale deployment)")
    status, body, _ = request("/robots.txt")
    check(status == 200, "Missing robots.txt")
    if mode == "preview":
        check("Disallow: /" in body and "Sitemap:" not in body,
              "Preview robots.txt must disallow crawling and omit sitemap")
        status, _, _ = request("/sitemap.xml")
        check(status == 404, "Preview must not publish sitemap.xml")
    else:
        check("Allow: /" in body and "Disallow: /" not in body and
              "Sitemap: " + origin + "/sitemap.xml" in body,
              "Production robots.txt must allow crawling and name canonical sitemap")
        status, body, _ = request("/sitemap.xml")
        check(status == 200, "Production sitemap.xml not HTTP 200")
        if status == 200:
            try:
                root = ET.fromstring(body)
                locs = [el.text for el in root.findall(
                    ".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
                expected = {origin + path for path in index_routes}
                check(set(locs) == expected and len(locs) == len(expected),
                      "Sitemap must contain exactly the approved indexable canonical URLs")
            except ET.ParseError:
                check(False, "Invalid sitemap XML")
        for path in ("/", "/stud-calculator/"):
            status, _, headers = request(path, pages_origin)
            location = headers.get("location", "")
            check(status in (301, 308) and location == origin + path,
                  "pages.dev" + path + ": expected exact permanent redirect to custom domain")
    status, body, _ = request("/nonexistent-woodworking-release-audit-404/")
    check(status == 404, "Unknown URL must return HTTP 404")
    if status == 404:
        missing = Head()
        missing.feed(body)
        check(missing.meta.get("robots") == "noindex,nofollow,noarchive",
              "Custom 404 body must remain noindex")
        check(not missing.canonical and not missing.schema,
              "Custom 404 body must not contain canonical or JSON-LD")
    results["status"] = "PASS" if not results["failures"] else "FAIL"
    results["indexable_routes_expected"] = len(index_routes)
    return results


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="Site HTTPS origin, no path")
    parser.add_argument("--mode", required=True, choices=("preview", "production"))
    parser.add_argument("--pages-origin",
                        help="Required for production: https://woodworking-calculator.pages.dev")
    parser.add_argument("--report", help="Write JSON verification evidence to this file")
    parser.add_argument("--verify-source-parity", action="store_true",
                        help="Compare deployed 31 form-field sets, 31 tool configs and 11 source assets with current checked-out source; run after deployment")
    args = parser.parse_args(argv)
    try:
        result = audit(args.base, args.mode, args.pages_origin,
                       verify_source_parity=args.verify_source_parity)
    except ValueError as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.report:
        target = Path(args.report)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8")
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
