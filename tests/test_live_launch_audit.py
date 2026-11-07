#!/usr/bin/env python3
"""Pure fixture tests for the read-only live HTTP launch audit."""
import importlib.util
import json
from pathlib import Path
import unittest
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "live_launch", ROOT / "scripts" / "verify_live_launch.py")
launch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launch)

DOMAIN = "https://custom-woodwork.com"
PAGES = "https://woodworking-calculator.pages.dev"


def fake_site(mode, broken=None, source_sync=False):
    broken = broken or set()
    eligible = launch.expected_index_routes() if mode == "production" else set()

    def get(url):
        u = urlsplit(url)
        path = u.path
        if u.hostname == "woodworking-calculator.pages.dev" and mode == "production":
            if "alias" in broken:
                return 200, "Old public HTML", {}
            return 301, "", {"location": DOMAIN + path}
        if path.startswith("/nonexistent-woodworking-release-audit"):
            robots = ("index,follow" if "indexed_404" in broken
                      else "noindex,nofollow,noarchive")
            return (404, '<html><head><meta name="robots" content="' +
                    robots + '"></head><body>Not found</body></html>',
                    {"x-robots-tag": "noindex"} if mode == "preview" else {})
        if path == "/robots.txt":
            return (200, "User-agent: *\nDisallow: /\n", {}) if mode == "preview" else (
                200, "User-agent: *\nAllow: /\nSitemap: " + DOMAIN + "/sitemap.xml\n", {})
        if path == "/sitemap.xml":
            if mode == "preview":
                return 404, "", {}
            urls = eligible
            xml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            xml += "".join("<url><loc>" + DOMAIN + p + "</loc></url>"
                           for p in sorted(urls))
            xml += "</urlset>"
            return 200, xml, {}
        if path.startswith("/assets/tool-config/"):
            slug = path.rsplit("/", 1)[-1][:-5]
            if slug not in {t["slug"] for t in launch.TOOLS}:
                return 404, "", {}
            if "missing_config" in broken and slug == "stud-calculator":
                return 404, "", {}
            if source_sync:
                tool = next(t for t in launch.TOOLS if t["slug"] == slug)
                if "stale_deck_config" in broken and slug == "deck-material-calculator":
                    tool = {**tool, "desc": "Outdated version with same slug"}
                return 200, json.dumps(tool), {}
            return 200, json.dumps({"slug": slug}), {}
        if path in ("/favicon.svg", "/logo-mark.svg", "/logo-lockup.svg"):
            if source_sync:
                icon = "logo-lockup.svg" if path == "/logo-lockup.svg" else "logo-mark.svg"
                if "stale_logo" in broken and path == "/logo-mark.svg":
                    return 200, "<svg>stale brand</svg>", {}
                return 200, (launch.ROOT / "src" / icon).read_text(encoding="utf-8"), {}
            return 200, "<svg/>", {}
        if path.startswith("/assets/"):
            if source_sync and path.startswith("/assets/"):
                name = path[len("/assets/"):]
                asset = launch.ROOT / "src" / name
                if asset.is_file():
                    if "stale_calcs" in broken and name == "calcs.mjs":
                        return 200, "stale calculator engine", {}
                    return 200, asset.read_text(encoding="utf-8"), {}
            return 200, "asset", {}
        if path not in launch.ALL_PAGES:
            return 404, "", {}
        indexed = path in eligible
        if path == "/materials/" and "material_noindex" in broken:
            indexed = False
        if path == "/framing/" and "missing_h1" in broken:
            h1 = ""
        else:
            h1 = "<h1>Example</h1>"
        canonical = ('<link rel="canonical" href="' + DOMAIN + path + '">'
                     if indexed else "")
        schema = ('<script type="application/ld+json">' + json.dumps({
            "url": DOMAIN + path,
            "@type": "WebApplication" if path in launch.TOOL_PATHS else "WebSite"
        }) + "</script>" if indexed else "")
        robot = "index,follow" if indexed else "noindex,nofollow,noarchive"
        form = '<form id="calculator-form"></form>' if path in launch.TOOL_PATHS else ""
        if source_sync and path in launch.TOOL_PATHS:
            tool = next(t for t in launch.TOOLS if path == "/" + t["slug"] + "/")
            fields = [x["key"] for x in tool["inputs"]]
            if "stale_deck_form" in broken and path == "/deck-material-calculator/":
                fields.remove("joistLayoutMode")
            form = '<form id="calculator-form">' + "".join(
                '<input id="f-' + key + '">' for key in fields) + "</form>"
        doc = ('<!doctype html><html><head><title>Page: ' + path +
               (' | WoodLayout' if source_sync else '') +
               '</title><meta name="description" content="Useful geometry calculator">'
               '<meta name="robots" content="' + robot + '">' + canonical + schema +
               '</head><body>' +
               ('<a class="brand" href="/"><img src="/logo-mark.svg">'
                '<span class="brand-wordmark">Wood<span>Layout</span></span></a>'
                if source_sync and "stale_brand" not in broken else '') +
               h1 + form + "</body></html>")
        response_headers = ({"x-robots-tag": "noindex, nofollow, noarchive"}
                            if mode == "preview" and
                            not ("missing_preview_header" in broken and path == "/")
                            else {})
        return 200, doc, response_headers
    return get


class LiveAuditTests(unittest.TestCase):
    def test_scope_and_launchable_routes(self):
        self.assertEqual(len(launch.ALL_PAGES), 42)
        self.assertEqual(len(launch.expected_index_routes()), 42)
        self.assertIn("/materials/", launch.expected_index_routes())
        for slug in ("spiral-staircase-calculator", "gambrel-roof-calculator",
                     "lumber-price-calculator", "fence-picket-calculator",
                     "stave-calculator"):
            self.assertIn("/" + slug + "/", launch.expected_index_routes())

    def test_preview_is_not_indexable_and_never_has_sitemap(self):
        result = launch.audit(PAGES, "preview", get=fake_site("preview"))
        self.assertEqual(result["status"], "PASS", result["failures"])
        self.assertEqual(result["http_pages_checked"], 42)
        self.assertEqual(result["indexable_routes_expected"], 0)

    def test_missing_preview_http_noindex_blocks_acceptance(self):
        result = launch.audit(PAGES, "preview",
                              get=fake_site("preview", broken={"missing_preview_header"}))
        self.assertEqual(result["status"], "FAIL")
        self.assertTrue(any("X-Robots-Tag" in x for x in result["failures"]))

    def test_indexable_404_body_blocks_acceptance(self):
        result = launch.audit(PAGES, "preview",
                              get=fake_site("preview", broken={"indexed_404"}))
        self.assertEqual(result["status"], "FAIL")
        self.assertTrue(any("404 body" in x for x in result["failures"]))

    def test_production_indexes_all_42_including_former_p2_and_materials(self):
        result = launch.audit(DOMAIN, "production", pages_origin=PAGES,
                              get=fake_site("production"))
        self.assertEqual(result["status"], "PASS", result["failures"])
        self.assertEqual(result["indexable_routes_expected"], 42)

    def test_obsolete_materials_noindex_is_rejected(self):
        result = launch.audit(DOMAIN, "production", pages_origin=PAGES,
                              get=fake_site("production", broken={"material_noindex"}))
        self.assertEqual(result["status"], "FAIL")
        self.assertTrue(any("/materials/" in x for x in result["failures"]))

    def test_pages_dev_must_redirect_after_custom_domain_launch(self):
        result = launch.audit(DOMAIN, "production", pages_origin=PAGES,
                              get=fake_site("production", broken={"alias"}))
        self.assertEqual(result["status"], "FAIL")
        self.assertTrue(any("pages.dev" in x for x in result["failures"]))

    def test_missing_real_tool_config_blocks_launch(self):
        result = launch.audit(PAGES, "preview",
                              get=fake_site("preview", broken={"missing_config"}))
        self.assertEqual(result["status"], "FAIL")
        self.assertTrue(any("stud-calculator.json" in x for x in result["failures"]))

    def test_missing_heading_blocks_launch(self):
        result = launch.audit(PAGES, "preview",
                              get=fake_site("preview", broken={"missing_h1"}))
        self.assertEqual(result["status"], "FAIL")
        self.assertTrue(any("/framing/" in x for x in result["failures"]))

    def test_full_live_source_parity_passes_when_remote_matches_checked_out_commit(self):
        result = launch.audit(PAGES, "preview", verify_source_parity=True,
                              get=fake_site("preview", source_sync=True))
        self.assertEqual(result["status"], "PASS", result["failures"])
        self.assertEqual(result["source_parity_checks"], 118)
        self.assertEqual(result["http_pages_checked"], 42)

    def test_deployed_deck_config_mismatch_detected_even_when_slug_is_correct(self):
        result = launch.audit(PAGES, "preview", verify_source_parity=True,
                              get=fake_site("preview", source_sync=True,
                                            broken={"stale_deck_config"}))
        self.assertEqual(result["status"], "FAIL")
        self.assertTrue(any("deck-material-calculator.json" in x and
                            "differs" in x for x in result["failures"]))

    def test_deployed_form_missing_latest_mode_is_not_falsely_accepted(self):
        result = launch.audit(PAGES, "preview", verify_source_parity=True,
                              get=fake_site("preview", source_sync=True,
                                            broken={"stale_deck_form"}))
        self.assertEqual(result["status"], "FAIL")
        self.assertTrue(any("/deck-material-calculator/" in x and
                            "form fields" in x for x in result["failures"]))

    def test_deployed_calculator_engine_mismatch_detected(self):
        result = launch.audit(PAGES, "preview", verify_source_parity=True,
                              get=fake_site("preview", source_sync=True,
                                            broken={"stale_calcs"}))
        self.assertEqual(result["status"], "FAIL")
        self.assertTrue(any("/assets/calcs.mjs" in x and
                            "differs" in x for x in result["failures"]))

    def test_stale_logo_and_brand_cannot_pass_live_source_parity(self):
        for broken, marker in [("stale_logo", "/logo-mark.svg"),
                               ("stale_brand", "WoodLayout navigation logo")]:
            result = launch.audit(PAGES, "preview", verify_source_parity=True,
                                  get=fake_site("preview", source_sync=True,
                                                broken={broken}))
            self.assertEqual(result["status"], "FAIL")
            self.assertTrue(any(marker in failure for failure in result["failures"]))

    def test_fake_or_preview_hosts_cannot_be_production(self):
        for origin in (PAGES, "https://woodworking.example",
                       "http://custom-woodwork.com", "https://custom-woodwork.com/path/"):
            with self.subTest(origin=origin):
                with self.assertRaises(ValueError):
                    launch.validate_base(origin, "production")
        with self.assertRaises(ValueError):
            launch.audit(DOMAIN, "production", get=fake_site("production"))


if __name__ == "__main__":
    unittest.main()
