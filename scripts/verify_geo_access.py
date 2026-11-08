#!/usr/bin/env python3
"""Read-only production audit for AI search crawler and agent accessibility."""
from __future__ import annotations
import argparse
import concurrent.futures
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = json.loads((ROOT / "src" / "tools.json").read_text(encoding="utf-8"))
TOOLS = [x for x in REGISTRY["tools"] if x["priority"] in {"P0", "P1"}]
CATEGORIES = [
    "/" + slug + "/" for key, (_, slug) in REGISTRY["categories"].items()
    if any(t["category"] == key for t in TOOLS)
]
ROUTES = ["/"] + ["/" + x["slug"] + "/" for x in TOOLS] + sorted(CATEGORIES) + [
    "/about/", "/contact/", "/privacy/", "/terms/"
]
BOT_SAMPLES = [
    ("OAI-SearchBot",
     "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)",
     "/stud-calculator/"),
    ("ChatGPT-User",
     "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
     "/framing-calculator/"),
    ("Claude-SearchBot",
     "Claude-SearchBot",
     "/rafter-calculator/"),
    ("Claude-User",
     "Claude-User",
     "/roof-pitch-calculator/"),
    ("PerplexityBot",
     "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
     "/hole-spacing-calculator/"),
    ("Perplexity-User",
     "Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
     "/lumber-price-calculator/"),
    ("Bingbot",
     "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
     "/materials/"),
    ("Googlebot",
     "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
     "/"),
]
CHALLENGE_MARKERS = (
    "just a moment", "attention required", "cf-chl-", "cloudflare ray id",
    "you are being rate limited", "verify you are human"
)

def fetch(url: str, user_agent: str):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept": "text/html,application/xml,text/plain,*/*",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=18) as response:
            body = response.read(2_500_000).decode("utf-8", errors="replace")
            return {
                "status": response.status,
                "url": response.geturl(),
                "content_type": response.headers.get("Content-Type", ""),
                "x_robots_tag": response.headers.get("X-Robots-Tag", ""),
                "body": body,
            }
    except urllib.error.HTTPError as exc:
        body = exc.read(200_000).decode("utf-8", errors="replace")
        return {
            "status": exc.code, "url": exc.geturl(),
            "content_type": exc.headers.get("Content-Type", ""),
            "x_robots_tag": exc.headers.get("X-Robots-Tag", ""),
            "body": body,
        }
    except Exception as exc:
        return {"status": 0, "url": url, "content_type": "",
                "x_robots_tag": "", "body": "", "error": str(exc)}

def groups(text: str):
    result = []
    current = None
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            if current and current["agents"]:
                result.append(current)
            current = None
            continue
        if ":" not in line:
            continue
        key, value = (x.strip() for x in line.split(":", 1))
        key = key.lower()
        if key == "user-agent":
            if current is None:
                current = {"agents": [], "rules": []}
            elif current["rules"]:
                result.append(current)
                current = {"agents": [], "rules": []}
            current["agents"].append(value.lower())
        elif current is not None and key in {"allow", "disallow"}:
            current["rules"].append((key, value))
    if current and current["agents"]:
        result.append(current)
    return result

def page_failure(result, canonical):
    if result.get("status") != 200:
        return f"HTTP {result.get('status')}: {result.get('error', '')}"
    if urllib.parse.urlparse(result.get("url", "")).netloc != "woodlayout.com":
        return "redirected away from canonical host: " + result.get("url", "")
    if "noindex" in result.get("x_robots_tag", "").lower():
        return "HTTP X-Robots-Tag contains noindex"
    body = result.get("body", "")
    lower = body.lower()
    if any(marker in lower for marker in CHALLENGE_MARKERS):
        return "Cloudflare or bot challenge content returned instead of the page"
    if "<h1" not in lower or "<title>" not in lower:
        return "HTML response is missing a readable title or H1"
    if f'<link rel="canonical" href="{canonical}">' not in body:
        return "canonical link does not match the requested production URL"
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="https://woodlayout.com")
    parser.add_argument("--report", default="woodlayout-geo-access.json")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    if base != "https://woodlayout.com":
        raise SystemExit("This production GEO audit is pinned to https://woodlayout.com")

    report = {
        "base": base,
        "routes_checked": len(ROUTES),
        "bot_user_agents_checked": [x[0] for x in BOT_SAMPLES],
        "failures": [],
        "route_results": [],
        "bot_results": [],
        "scope_note": (
            "HTTP User-Agent checks verify public responses, not crawler identity or source IP. "
            "Confirm official IP verification and Cloudflare AI Crawler policies separately."
        ),
    }
    shared_ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    robots_result = fetch(base + "/robots.txt", shared_ua)
    if robots_result["status"] != 200:
        report["failures"].append("robots.txt HTTP " + str(robots_result["status"]))
        robots_text = ""
    else:
        robots_text = robots_result["body"]
    expected_bots = [x[0].lower() for x in BOT_SAMPLES] + ["*"]
    for bot in expected_bots:
        found = [g for g in groups(robots_text) if bot in g["agents"]]
        rules = [rule for g in found for rule in g["rules"]]
        if not found or ("allow", "/") not in rules or ("disallow", "/") in rules:
            report["failures"].append(f"robots.txt does not explicitly allow {bot}")

    llms_result = fetch(base + "/llms.txt", shared_ua)
    if llms_result["status"] != 200:
        report["failures"].append("llms.txt HTTP " + str(llms_result["status"]))
    elif not llms_result["body"].startswith("# WoodLayout"):
        report["failures"].append("llms.txt body is not the expected WoodLayout directory")
    elif "pages.dev" in llms_result["body"].lower():
        report["failures"].append("llms.txt leaks a preview host")

    sitemap_result = fetch(base + "/sitemap.xml", shared_ua)
    if sitemap_result["status"] != 200:
        report["failures"].append("sitemap.xml HTTP " + str(sitemap_result["status"]))
    else:
        try:
            root = ET.fromstring(sitemap_result["body"])
            ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            locs = [n.text for n in root.findall(".//s:loc", ns)]
            expected = {base + route for route in ROUTES}
            if len(locs) != 42 or set(locs) != expected:
                report["failures"].append(
                    f"sitemap URL set mismatch: expected 42 canonical HTML routes, got {len(locs)}"
                )
        except ET.ParseError as exc:
            report["failures"].append("sitemap XML parse error: " + str(exc))

    def check_route(route):
        result = fetch(base + route, shared_ua)
        failure = page_failure(result, base + route)
        return {"route": route, "status": result.get("status"),
                "failure": failure, "content_type": result.get("content_type")}

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for item in pool.map(check_route, ROUTES):
            report["route_results"].append(item)
            if item["failure"]:
                report["failures"].append(item["route"] + ": " + item["failure"])

    def check_bot(sample):
        name, user_agent, route = sample
        result = fetch(base + route, user_agent)
        failure = page_failure(result, base + route)
        return {"bot": name, "route": route, "status": result.get("status"),
                "failure": failure, "content_type": result.get("content_type")}

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for item in pool.map(check_bot, BOT_SAMPLES):
            report["bot_results"].append(item)
            if item["failure"]:
                report["failures"].append(
                    item["bot"] + " on " + item["route"] + ": " + item["failure"]
                )

    report["passed"] = not report["failures"]
    Path(args.report).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if report["failures"]:
        for failure in report["failures"]:
            print("FAIL:", failure)
        raise SystemExit(1)
    print(
        f"PASS: {len(ROUTES)} canonical pages, robots.txt, sitemap, llms.txt and "
        f"{len(BOT_SAMPLES)} AI/search user-agent requests returned readable production content."
    )
    print(report["scope_note"])

if __name__ == "__main__":
    main()
