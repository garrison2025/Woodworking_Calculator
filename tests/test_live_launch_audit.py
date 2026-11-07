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


def fake_site(mode, p2=False, broken=None):
    broken = broken or set()
    eligible = launch.expected_index_routes(p2) if mode == "production" else set()

    def get(url):
        u = urlsplit(url)
        path = u.path
        if u.hostname == "woodworking-calculator.pages.dev" and mode == "production":
            if "alias" in broken:
                return 200, "Old public HTML", {}
            return 301, "", {"location": DOMAIN + path}
        if path.startswith("/nonexistent-woodworking-release-audit"):
            return 404, "Not found", {}
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
            return 200, json.dumps({"slug": slug}), {}
        if path.startswith("/assets/") or path == "/favicon.svg":
            return 200, "asset", {}
        if path not in launch.ALL_PAGES:
            return 404, "", {}
        indexed = path in eligible
        if path == "/materials/" and "material_index" in broken:
            indexed = True
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
        doc = ('<!doctype html><html><head><title>Page: ' + path +
               '</title><meta name="description" content="Useful geometry calculator">'
               '<meta name="robots" content="' + robot + '">' + canonical + schema +
               '</head><body>' + h1 + form + "</body></html>")
        return 200, doc, {}
    return get


class LiveAuditTests(unittest.TestCase):
    def test_scope_and_launchable_routes(self):
        self.assertEqual(len(launch.ALL_PAGES), 42)
        self.assertEqual(len(launch.expected_index_routes(False)), 36)
        self.assertEqual(len(launch.expected_index_routes(True)), 42)
        self.assertNotIn("/materials/", launch.expected_index_routes(False))
        self.assertIn("/materials/", launch.expected_index_routes(True))

    def test_preview_is_not_indexable_and_never_has_sitemap(self):
        result = launch.audit(PAGES, "preview", get=fake_site("preview"))
        self.assertEqual(result["status"], "PASS", result["failures"])
        self.assertEqual(result["http_pages_checked"], 42)
        self.assertEqual(result["indexable_routes_expected"], 0)

    def test_production_keeps_p2_and_materials_noindex_until_approval(self):
        result = launch.audit(DOMAIN, "production", pages_origin=PAGES,
                              get=fake_site("production"))
        self.assertEqual(result["status"], "PASS", result["failures"])
        self.assertEqual(result["indexable_routes_expected"], 36)

    def test_all_routes_after_explicit_original_p2_approval(self):
        result = launch.audit(DOMAIN, "production", allow_p2=True,
                              pages_origin=PAGES, get=fake_site("production", True))
        self.assertEqual(result["status"], "PASS", result["failures"])
        self.assertEqual(result["indexable_routes_expected"], 42)

    def test_unapproved_materials_category_fails(self):
        result = launch.audit(DOMAIN, "production", pages_origin=PAGES,
                              get=fake_site("production", broken={"material_index"}))
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
