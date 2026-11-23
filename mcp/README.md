# WoodLayout MCP — independent preview

An **optional, read-only** Model Context Protocol server for [WoodLayout](https://woodlayout.com/), backed by the site's existing tested `src/calcs.mjs` geometry engine. Includes three tools: rise/run slope, board-foot and lumber quotation, and geometric baluster spacing.

**Isolation**: The live site uses Cloudflare Pages, built from `main` via `python3 build.py`. This MCP lives only under `mcp/`, is never imported by the static builder, has its **own** npm package and Wrangler configuration, and is deployed (if approved) as a **separate** Cloudflare Worker named `woodlayout-public-mcp`. Do not change any site's Cloudflare Pages project, DNS, `main` branch, routes, redirects, canonical URLs, sitemap, or AdSense configuration.

## Local checks

Requires Node.js 22+.

```sh
cd mcp
npm install
npm run check
npm run dev
```

Then connect an MCP Inspector to `http://localhost:8787/mcp`. The `GET /health` endpoint returns a basic JSON health check. `POST /mcp` is the official Streamable HTTP MCP endpoint.

## Explicitly optional deployment

**Do not deploy the Worker or merge the PR without production-isolation checks.** An authorized Cloudflare account is required to deploy:

```sh
cd mcp
npx wrangler login
npm run deploy
```

A deployed URL normally has the form `https://woodlayout-public-mcp.<account-subdomain>.workers.dev/mcp`; do **not** claim this URL exists until checked. Running `wrangler deploy` inside `mcp/` targets the dedicated Worker, not the Pages project. Note free usage quotas and the possibility of abusive public requests; no database, paid API, third-party tracking, or long-running job is required.

## Before directory submissions

1. Test MCP handshake, list tools, and each tool invocation against the deployed Worker using MCP Inspector.
2. Confirm public `/health` and `/mcp` behavior, Worker deployment owner, and that `https://woodlayout.com/` and its 42 static routes remain unchanged.
3. Publish only truthful tool descriptions and include the homepage `https://woodlayout.com`, GitHub source, privacy/legal notices, and limits.
4. Apply to relevant registries/marketplaces individually. Directory approval, Dofollow, indexation and referral value are **not** guaranteed.
5. Use a real deployed URL, not the placeholder above, for an official MCP Registry `server.json` or marketplace application.

## Interpretation and limits

All dimensions are **actual inches**, not automatically converted nominal sizes. The quotation uses user-provided prices; it does not fetch vendor prices. These are geometry/reference outputs, not structural or building-code assessments. No personal data is required or persisted by these functions. The health endpoint discloses no secrets. Tool inputs are bounded; baluster row output is capped at 30 while the full count remains available.

Source of truth: `../src/calcs.mjs`. Do not fork/reimplement formulas. Keep the MCP feature separate so the Pages website can evolve independently.
