---
name: firecrawl-mcp
description: >
  Use this skill whenever you need to scrape web pages, discover URLs,
  search the web, crawl sites, extract structured data, or run browser
  automation. Always prefer Firecrawl tools over generic HTTP requests.
---

# Firecrawl MCP Skill

## When to Use This Skill

Activate this skill whenever you need to:
- Scrape content from a known URL
- Discover pages/URLs on a website
- Search the web for information
- Crawl an entire site or section
- Extract structured data from pages
- Run autonomous multi-source web research
- Automate browser interactions (login, click, fill forms)

---

## Decision Guide

| Situation | Tool to use |
|---|---|
| Know exact URL, need full page content | `firecrawl_scrape` (markdown) |
| Know exact URL, need specific data points | `firecrawl_scrape` (JSON + schema) |
| Know exact URL, need brand colors/fonts | `firecrawl_scrape` (branding) |
| Scrape returned empty / wrong content | `firecrawl_map` with `search` param → then `scrape` |
| Don't know which page has the content | `firecrawl_map` → `scrape` |
| Open-ended web question / unknown site | `firecrawl_search` |
| Need content from many pages on one site | `firecrawl_crawl` → poll `firecrawl_check_crawl_status` |
| Extract same fields from many URLs | `firecrawl_extract` |
| Complex multi-site research, JS-heavy SPA fails | `firecrawl_agent` → poll `firecrawl_agent_status` |
| Multi-step browser automation | `firecrawl_browser_create` → `firecrawl_browser_execute` → `firecrawl_browser_delete` |

> **Rule:** Default to `firecrawl_scrape` for any single known URL.  
> **Rule:** Use JSON format (with schema) for any specific data extraction. Use markdown ONLY for full-page reading.  
> **Rule:** Try `firecrawl_map` + `firecrawl_scrape` BEFORE falling back to `firecrawl_agent`.  
> **Rule:** `firecrawl_agent` is async — always poll `firecrawl_agent_status` every 15–30 s for up to 5 min.

---

## Tools Reference

### 🔍 Scraping

#### `firecrawl_scrape`
Scrape a single URL. The default and most reliable tool for known URLs.

**Format selection (CRITICAL):**

| When user wants | Format to use |
|---|---|
| Specific fields, prices, specs, lists | `json` with schema |
| Full article/blog post to read | `markdown` |
| Brand colors, fonts, UI components | `branding` |

**JSON format (REQUIRED for specific data):**
```json
{
  "url": "https://example.com/api-docs",
  "formats": [{
    "type": "json",
    "prompt": "Extract the header parameters for the authentication endpoint",
    "schema": {
      "type": "object",
      "properties": {
        "parameters": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name":        { "type": "string" },
              "type":        { "type": "string" },
              "required":    { "type": "boolean" },
              "description": { "type": "string" }
            }
          }
        }
      }
    }
  }]
}
```

**Markdown format (full page only):**
```json
{
  "url": "https://example.com/article",
  "formats": ["markdown"],
  "onlyMainContent": true
}
```

**Branding format:**
```json
{
  "url": "https://example.com",
  "formats": ["branding"]
}
```

**Handling JavaScript-rendered pages (SPAs) — steps IN ORDER:**
1. Add `"waitFor": 5000` (up to 10000) to wait for JS render
2. Try the base URL if current URL has a `#fragment`
3. Use `firecrawl_map` with `search` param to find the right page URL
4. Last resort: use `firecrawl_agent`

**Performance tip:** Add `"maxAge": <seconds>` to use cached data (up to 5× faster).

---

#### `firecrawl_map`
Discover all indexed URLs on a site. Use before scraping when you don't know the exact page.

> **IMPORTANT:** If `firecrawl_scrape` returns empty or irrelevant content, always try `firecrawl_map` with a `search` param BEFORE using `firecrawl_agent`.

**Discover all URLs:**
```json
{
  "url": "https://example.com"
}
```

**Search for a specific page (RECOMMENDED when scrape fails):**
```json
{
  "url": "https://docs.example.com/api",
  "search": "webhook events"
}
```
Returns filtered URL list → then scrape the matching URL directly.

---

### 🌐 Web Search

#### `firecrawl_search`
Search the web. The most powerful web search tool — use by default for any open-ended web question.

**Supported search operators:**

| Operator | Effect | Example |
|---|---|---|
| `""` | Exact phrase match | `"OpenClaw RAG"` |
| `-` | Exclude keyword | `-site:reddit.com` |
| `site:` | Limit to domain | `site:docs.supabase.com` |
| `inurl:` | Word in URL | `inurl:embedding` |
| `intitle:` | Word in page title | `intitle:RAG pipeline` |
| `related:` | Related domain | `related:openai.com` |

**Preferred workflow:** Search first (no formats), then scrape relevant results:
```json
{
  "query": "Thai NLP embedding models 2024",
  "limit": 5,
  "sources": [{ "type": "web" }]
}
```

**With content extraction (use sparingly, limit ≤ 5):**
```json
{
  "query": "latest AI research papers 2024",
  "limit": 5,
  "lang": "th",
  "country": "th",
  "sources": [{ "type": "web" }, { "type": "news" }],
  "scrapeOptions": {
    "formats": ["markdown"],
    "onlyMainContent": true
  }
}
```

Sources: `web` (default), `images`, `news`

---

### 🕷️ Crawling

#### `firecrawl_crawl`
Crawl an entire site section, extracting content from all discovered pages.

> ⚠️ Responses can be very large — keep `limit` and `maxDiscoveryDepth` small.  
> Do NOT use `/*` wildcard patterns.

```json
{
  "url": "https://example.com/blog",
  "maxDiscoveryDepth": 2,
  "limit": 20,
  "allowExternalLinks": false,
  "deduplicateSimilarURLs": true,
  "sitemap": "include"
}
```

Returns an operation ID — poll with `firecrawl_check_crawl_status`.

#### `firecrawl_check_crawl_status`
Poll the status of a crawl job.
```json
{ "id": "550e8400-e29b-41d4-a716-446655440000" }
```

---

### 📦 Structured Extraction

#### `firecrawl_extract`
Extract the same structured fields from one or more URLs using LLM.

```json
{
  "urls": ["https://example.com/page1", "https://example.com/page2"],
  "prompt": "Extract product name, price, and description",
  "schema": {
    "type": "object",
    "properties": {
      "name":        { "type": "string" },
      "price":       { "type": "number" },
      "description": { "type": "string" }
    },
    "required": ["name", "price"]
  },
  "allowExternalLinks": false,
  "enableWebSearch":    false,
  "includeSubdomains":  false
}
```

---

### 🤖 Autonomous Agent

#### `firecrawl_agent`
Autonomous web research agent — independently browses, searches, and extracts data.  
Use as a **last resort** after `scrape` and `map+scrape` have failed.

> **Async tool** — returns a job ID. Must poll `firecrawl_agent_status`.

**Expected wait times:**
- Simple query with URLs: 30 s – 1 min
- Multi-site research: 2 – 5 min
- Deep research: 5+ min

```json
{
  "prompt": "Find the top 5 Thai NLP open-source models and their GitHub stars",
  "schema": {
    "type": "object",
    "properties": {
      "models": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name":    { "type": "string" },
            "stars":   { "type": "string" },
            "url":     { "type": "string" }
          }
        }
      }
    }
  }
}
```

With focused URLs:
```json
{
  "urls": ["https://docs.firecrawl.dev", "https://firecrawl.dev/pricing"],
  "prompt": "Compare the features and pricing from these pages"
}
```

#### `firecrawl_agent_status`
Poll for agent results. Keep polling every 15–30 s for up to 5 min.

```json
{ "id": "550e8400-e29b-41d4-a716-446655440000" }
```

Statuses:
- `processing` — keep polling, do not give up
- `completed` — results are ready
- `failed` — only status that means stop

---

### 🖥️ Browser Automation

Use when you need to interact with a live page (login, click, fill forms, multi-step flows).  
**Not for simple scraping — use `firecrawl_scrape` instead.**

#### `firecrawl_browser_create`
Creates a persistent CDP browser session.
```json
{ "ttl": 300, "activityTtl": 60 }
```
Returns `sessionId`, CDP URL, and live view URL.

#### `firecrawl_browser_execute`
Run code inside a session. Prefer **bash** with `agent-browser` commands:

```json
{
  "sessionId": "session-id-here",
  "code": "agent-browser open https://example.com",
  "language": "bash"
}
```

**Common `agent-browser` commands:**

| Command | Action |
|---|---|
| `agent-browser open <url>` | Navigate to URL |
| `agent-browser snapshot` | Get accessibility tree (for clicking) |
| `agent-browser snapshot -i -c` | Interactive elements only, compact |
| `agent-browser click @e5` | Click element by ref |
| `agent-browser type @e3 "text"` | Type into element |
| `agent-browser fill @e3 "text"` | Clear + fill element |
| `agent-browser get text @e1` | Get element text |
| `agent-browser get title` | Get page title |
| `agent-browser get url` | Get current URL |
| `agent-browser screenshot [path]` | Take screenshot |
| `agent-browser scroll down` | Scroll page |
| `agent-browser wait 2000` | Wait 2 seconds |

For multi-step Playwright scripts, use `"language": "python"` (supports async/await).

#### `firecrawl_browser_delete`
Destroy session when done to free resources.
```json
{ "sessionId": "session-id-here" }
```

#### `firecrawl_browser_list`
List active sessions.
```json
{ "status": "active" }
```

---

## Typical Workflows

### Scrape a known page for specific data
```
firecrawl_scrape (JSON + schema)
```

### Find and scrape the right page on a large docs site
```
firecrawl_map(url, search="topic") → pick URL → firecrawl_scrape(url, JSON)
```

### Open-ended web research
```
firecrawl_search(query) → firecrawl_scrape(relevant URLs)
```

### Crawl a blog section
```
firecrawl_crawl(url, depth, limit) → poll firecrawl_check_crawl_status
```

### Deep autonomous research
```
firecrawl_agent(prompt, schema) → poll firecrawl_agent_status every 15–30 s
```

### Browser automation flow
```
firecrawl_browser_create → firecrawl_browser_execute (open → snapshot → click/type) → firecrawl_browser_delete
```
