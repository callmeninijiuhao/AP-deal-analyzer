# AP Gap Analyzer — Build Plan

## Overview

An internal tool to compare a publisher's **Wanted List** of Auction Package (AP) deals against their **Monetizing List** (live AP deals fetched from an admin API), identify missing deal mappings, and generate templated outreach emails to deal owners requesting the missing mappings.

---

## Workflow Summary

```
Step 1: Upload Wanted List (CSV)
        ↓
Step 2: Fetch Monetizing List per publisher (Admin API)
        ↓
Step 3: Compare → identify gaps (missing deals per publisher)
        ↓
Step 4: Generate outreach messages to deal owners
```

---

## Tech Stack Recommendation

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React (Vite) or plain HTML/JS | Simple enough for single-page tool |
| File parsing | PapaParse (CSV) | Lightweight, browser-native |
| API calls | Native `fetch` or Axios | For admin API requests from browser or a thin backend proxy |
| Backend proxy (optional) | Node.js / Express | Only needed if admin API has CORS restrictions or requires server-side auth |
| Export | Native Blob / FileSaver.js | CSV download of gap report |

> **If CORS is an issue**: wrap the admin API calls in a lightweight Node/Express proxy endpoint (e.g. `POST /api/fetch-publisher-deals`) that forwards requests server-side with the API key stored in an env variable.

---

## File & Folder Structure

```
ap-gap-analyzer/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── StepIndicator.jsx        # Step 1–4 progress bar
│   │   ├── WantedListUploader.jsx   # CSV upload + column mapper
│   │   ├── PublisherListInput.jsx   # Publisher ID input/textarea
│   │   ├── APIConfig.jsx            # Admin API URL, auth, JSON path config
│   │   ├── FetchProgress.jsx        # Per-publisher fetch log + progress bar
│   │   ├── GapAnalysis.jsx          # Summary metrics + gap table
│   │   └── OutreachMessages.jsx     # Template editor + rendered messages
│   ├── utils/
│   │   ├── csvParser.js             # CSV → structured deal objects
│   │   ├── apiFetcher.js            # Fetch monetizing deals per publisher
│   │   ├── gapCalculator.js         # Diff wanted vs monetizing
│   │   ├── messageRenderer.js       # Fill template variables
│   │   └── exportCsv.js             # Export gaps to CSV
│   ├── App.jsx
│   └── main.jsx
├── server/                          # Optional proxy (only if needed for CORS)
│   └── proxy.js
├── .env.example
└── package.json
```

---

## Step-by-Step Feature Spec

### Step 1 — Wanted List Upload

**Input:** CSV file upload (drag & drop or click)

**Behavior:**
- Parse CSV with PapaParse
- Auto-detect columns by common name patterns (`deal_id`, `deal_name`, `owner`, `pub_id`)
- Show column mapper UI: user maps CSV columns → `Deal ID`, `Deal Name`, `Deal Owner`, `Publisher ID (optional)`
- Preview first 3 rows after mapping
- Separately: textarea input for publisher IDs (one per line), or auto-populated if the CSV has a publisher ID column

**Output data shape:**
```js
wantedDeals = [
  { id: "AP-1001", name: "Premium Video Bundle", owner: "alice@example.com" },
  ...
]

publishers = ["PUB-001", "PUB-002", ...]
```

**Validation:**
- At least one deal row must be present
- Deal ID column is required; others optional
- At least one publisher ID must be entered

---

### Step 2 — Fetch Monetizing List

**Input:** Admin API configuration
- `Base URL` — e.g. `https://api.platform.com/publishers/{pub_id}/deals`  
  `{pub_id}` is a placeholder replaced at runtime
- `Authorization header value` — stored in memory only, never persisted
- `JSON path to deal array` — dot-notation path in the response JSON, e.g. `data.deals`

**Behavior:**
- Iterate over the publisher list sequentially
- For each publisher: `GET <base_url>` with `{pub_id}` substituted
- Extract the deal array using the JSON path
- Record the deal IDs from that array as the publisher's monetizing set
- Show per-publisher fetch log: `✓ PUB-001: 12 deals` or `✗ PUB-002: HTTP 403`
- Show a progress bar (completed / total publishers)
- On error for a publisher: record as empty monetizing list, continue

**Fallback / Demo mode:** If no API URL is provided, generate mock data so the rest of the tool can be demoed.

**Output data shape:**
```js
monetizingMap = {
  "PUB-001": ["AP-1001", "AP-1003"],
  "PUB-002": ["AP-1001"],
  ...
}
```

**Admin API contract expected (configurable via JSON path):**
```json
{
  "data": {
    "deals": [
      { "deal_id": "AP-1001", "name": "...", "status": "live" },
      ...
    ]
  }
}
```

---

### Step 3 — Gap Analysis

**Logic:**

```js
// For each publisher:
const missing = wantedDeals.filter(
  deal => !monetizingMap[pubId].includes(deal.id)
)
```

**UI — summary metrics:**
- Total publishers checked
- Publishers with at least one gap
- Total missing deal mappings

**UI — gap table (sorted by most gaps first):**

| Publisher | Coverage | Missing AP Deals | Deal Owner(s) |
|---|---|---|---|
| PUB-002 | 50% | AP-1002 · Sports CTV, AP-1003 · News Bundle | bob@example.com |
| PUB-001 | 100% | ✓ All mapped | — |

**Export:** "Export gaps CSV" button → downloads file with columns:
`Publisher ID, Deal ID, Deal Name, Deal Owner`

---

### Step 4 — Outreach Message Generation

**Logic — grouping:**
- Group gaps by `(deal_owner, deal_id)` — one message per owner per deal
- Each message lists all publishers that are missing that deal

**Template (editable by user):**

```
Hi {owner_name},

I'm reaching out regarding Auction Package deal mapping for some of our publishers.

The following publisher(s) are eligible for your deal "{deal_name}" (ID: {deal_id}) but are not currently mapped:

{publisher_list}

Could you please arrange to map these publishers to the deal? Let me know if you need any additional information.

Thanks,
[Your Name]
```

**Template variables:**

| Variable | Value |
|---|---|
| `{owner_name}` | Part before `@` in owner email, or full value if not an email |
| `{deal_name}` | Deal name from Wanted List |
| `{deal_id}` | Deal ID from Wanted List |
| `{publisher_list}` | Bulleted list of publisher IDs missing this deal |

**UI:**
- Editable textarea for the template (changes apply live on re-generation)
- "Generate messages" button renders all filled messages
- Each rendered message shows: recipient email, deal badge, publisher count badge
- Individual "Copy" button per message
- "Copy all" button copies all messages joined by `---` separator

---

## Data Flow Diagram

```
CSV Upload
    │
    ▼
wantedDeals[]  +  publishers[]
    │                  │
    │         Admin API (per publisher)
    │                  │
    │           monetizingMap{}
    │                  │
    └──────────────────┤
                       ▼
                  gapData[]
              (publisher + missing[])
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
    Gap Table UI            Group by (owner, deal)
    + CSV Export                    │
                                    ▼
                          Rendered outreach messages
                          + Copy / Copy All
```

---

## State Management

All state lives in the parent `App` component (or a single context/store). No server-side persistence needed.

```js
appState = {
  step: 1,                    // current step (1–4)
  wantedDeals: [],            // from CSV
  publishers: [],             // from textarea or CSV
  apiConfig: {
    baseUrl: "",
    authHeader: "",
    jsonPath: "deals"
  },
  monetizingMap: {},          // keyed by pub ID
  fetchLog: [],               // array of log strings
  gapData: [],                // computed from diff
  messageTemplate: "..."      // editable string
}
```

---

## API Fetcher — Implementation Notes

```js
// apiFetcher.js
async function fetchPublisherDeals(pubId, apiConfig) {
  const url = apiConfig.baseUrl.replace("{pub_id}", pubId)
  const res = await fetch(url, {
    headers: { "Authorization": apiConfig.authHeader }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()

  // Resolve dot-notation path e.g. "data.deals"
  const deals = apiConfig.jsonPath
    .split(".")
    .reduce((obj, key) => obj?.[key], json)

  return Array.isArray(deals) ? deals.map(d => d.deal_id || d.id) : []
}
```

- Run requests **sequentially** (not in parallel) to avoid rate-limiting
- Wrap in try/catch; failed publishers get `[]` and are logged
- Optionally: add configurable delay between requests (e.g. 200ms)

---

## Edge Cases to Handle

| Scenario | Handling |
|---|---|
| CSV has no header row | Show warning; ask user to confirm or skip |
| Deal ID column has mixed formats (numeric vs string) | Normalize to string before comparison |
| API returns paginated response | Note in docs; user should configure JSON path to the full deal array, or add pagination config as a future enhancement |
| Publisher returns HTTP 401/403 | Log error, mark publisher as "fetch failed", skip in gap calculation |
| Same deal owned by multiple owners | If `owner` column has multiple values (comma-separated), split and generate a message per owner |
| No gaps found | Show "All deals mapped" success state; hide outreach step |
| Empty wanted list after upload | Block navigation to Step 2, show inline validation error |

---

## Future Enhancements (Out of Scope for V1)

- **Pagination support** in API fetcher (auto-follow `next_page` links)
- **Bulk API mode** — single endpoint that returns all publishers at once
- **Save / load sessions** — export/import full session state as JSON
- **Deal owner directory** — map owner emails to Slack handles for direct messaging
- **Scheduling** — run gap checks on a cron and email/Slack the report
- **Audit log** — track which gaps were actioned and when

---

## Environment Variables

```env
# .env.example
# Only needed if using the optional server-side proxy

PROXY_PORT=3001
ADMIN_API_KEY=your_api_key_here   # Never commit this
ALLOWED_ORIGIN=http://localhost:5173
```

---

## Acceptance Criteria

- [ ] User can upload a CSV and map columns to required fields
- [ ] User can enter publisher IDs manually or load them from the CSV
- [ ] Tool fetches live AP deals for each publisher via the configured API
- [ ] Gap calculation correctly identifies deals in the Wanted List not present in the Monetizing List
- [ ] Gap table displays per-publisher coverage % and lists missing deals
- [ ] CSV export contains all gap rows with publisher, deal ID, deal name, owner
- [ ] Outreach messages are grouped by `(owner, deal)` — one message per group
- [ ] All template variables are correctly substituted
- [ ] Each message has an individual copy button; a "copy all" button is available
- [ ] Tool is usable without a backend (browser-only, with optional proxy for CORS)
- [ ] Demo mode works without an API URL configured
