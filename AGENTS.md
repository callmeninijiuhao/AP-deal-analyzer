# AP Gap Analyzer — Agent Guide

## Project Overview

AP Gap Analyzer (`ap-shooter`) is a browser-native React single-page application (SPA) that audits publisher monetizing package mappings against a user-provided "wanted deals" distribution list. It is built with **React 19**, **Vite 8**, and vanilla JavaScript (JSX). There is no TypeScript, no backend API, and no test suite.

The application walks the user through a 5-step wizard:

1. **Upload Wanted List** — Upload a CSV or Excel file containing deal IDs, names, owners, and optional revenue.
2. **Configure Target Publishers** — Provide a list of publisher IDs to audit (manually or bulk-imported).
3. **API Config & Fetch** — Configure an external REST endpoint (default is PubMatic), then sequentially fetch live deals per publisher.
4. **Gap Analysis** — Compare wanted deals against fetched deals, compute coverage %, missing mappings, and missed revenue.
5. **Outreach Messages** — Generate consolidated email messages grouped by deal owner, with an editable template and copy-to-clipboard support.

A small **Node.js CORS proxy server** (`server/proxy.js`) is included for local development to bypass browser CORS restrictions when calling third-party APIs.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19.2.6 (with StrictMode) |
| Build Tool | Vite 8.0.12 (`@vitejs/plugin-react` using Oxc) |
| Language | JavaScript (ES modules, `.jsx` for components) |
| Styling | Custom CSS with CSS custom properties (dark glassmorphism theme) |
| Linting | ESLint 10 with `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` |
| Icons | `lucide-react` |
| Parsing | `papaparse` (CSV), `xlsx` (Excel) |

---

## Project Structure

```
├── public/                  # Static assets (favicon.svg, icons.svg)
├── server/
│   └── proxy.js             # Node 18+ CORS proxy (zero-dependency)
├── src/
│   ├── App.jsx              # Root component: 5-step wizard state machine
│   ├── main.jsx             # ReactDOM entry point
│   ├── index.css            # Global styles, design tokens, glassmorphism theme
│   ├── App.css              # Legacy Vite template styles (mostly unused)
│   ├── assets/              # Images and SVGs
│   ├── components/          # React components (PascalCase .jsx)
│   │   ├── StepIndicator.jsx
│   │   ├── WantedListUploader.jsx
│   │   ├── PublisherListInput.jsx
│   │   ├── PublisherUploader.jsx
│   │   ├── APIConfig.jsx
│   │   ├── FetchProgress.jsx
│   │   ├── GapAnalysis.jsx
│   │   └── OutreachMessages.jsx
│   └── utils/               # Pure utility modules (camelCase .js)
│       ├── apiFetcher.js    # HTTP fetching, token management, sequential polling
│       ├── csvParser.js     # CSV/Excel parsing, column auto-detection, mapping
│       ├── exportCsv.js     # Browser CSV download generation
│       ├── gapCalculator.js # Coverage and missing-deal computation
│       └── messageRenderer.js # Template rendering, owner grouping
├── index.html               # HTML entry point
├── package.json             # Dependencies and npm scripts
├── vite.config.js           # Vite configuration (standard React plugin)
├── eslint.config.js         # Flat ESLint config
└── .env.example             # Example env for PROXY_PORT
```

---

## Build and Development Commands

All commands run from the project root.

```bash
# Install dependencies
npm install

# Start the Vite development server
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview the production build locally
npm run preview

# Run ESLint
npm run lint

# Start the local CORS proxy (required for API calls in dev)
npm run proxy
```

### Local Development Workflow

Because the app calls external APIs (e.g., PubMatic) from the browser, CORS blocks direct requests in development. You **must** run the proxy alongside the Vite dev server:

```bash
# Terminal 1
npm run proxy      # Runs on port 3001 by default

# Terminal 2
npm run dev        # Runs on port 5173 by default
```

The fetch logic in `src/utils/apiFetcher.js` automatically routes requests through `http://localhost:3001/proxy?url=<target>` when `import.meta.env.DEV` is true or the hostname is `localhost`/`127.0.0.1`.

---

## Code Style Guidelines

### File Naming
- **Components**: PascalCase, `.jsx` extension (e.g., `GapAnalysis.jsx`).
- **Utilities**: camelCase, `.js` extension (e.g., `gapCalculator.js`).

### Component Conventions
- Use functional components with JSDoc comments describing props.
- Props are destructured in the function signature.
- State is managed with `useState` and `useRef` hooks; no external state library is used.
- Inline styles are used heavily alongside CSS classes. When adding new UI, prefer adding reusable CSS classes in `src/index.css` and only use inline styles for dynamic values.

### JavaScript Style
- ES modules only (`"type": "module"` in `package.json`).
- Prefer `const` and `let`; no `var`.
- Use template literals for string interpolation.
- Error messages are user-facing and descriptive.

### CSS / Theming
- The app uses a **dark glassmorphism** design system defined in `src/index.css` via CSS custom properties (`:root`).
- Key tokens:
  - `--bg-base: #090d16`
  - `--primary: #6366f1` (indigo)
  - `--secondary: #a855f7` (purple)
  - `--success: #10b981`, `--error: #ef4444`, `--warning: #f59e0b`, `--info: #3b82f6`
  - `--glass-shadow`, `--glass-blur`
- Reusable component classes: `.glass-card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.input-text`, `.textarea`, `.data-table`, `.badge`, `.uploader-area`, `.metrics-grid`, `.email-card`.
- Do not introduce new color values directly in inline styles; map them to existing CSS variables for consistency.

---

## Key Architectural Details

### State Machine (App.jsx)
The root component holds all application state. Steps are gated:
- Step 2 requires `hasUploaded`.
- Step 3 requires `hasUploaded && hasPublishers`.
- Steps 4 and 5 require `hasUploaded && hasPublishers && hasFetched`.

### API Fetching (`src/utils/apiFetcher.js`)
- **Token management**: The file contains Base64-obfuscated hardcoded tokens for PubMatic. `getActiveToken()` returns the access token until a hardcoded rotation deadline (`2026-07-10`), after which it returns `null` and triggers `refreshAccessToken()`.
- **Sequential polling**: `fetchAllPublishers()` loops through publisher IDs one at a time with a configurable delay (`delayMs`, default 200ms) to avoid rate limits.
- **Cancellation**: A mutable `controlSignal` object (`{ cancelled: false }`) is passed down and checked between iterations to support user cancellation.
- **URL template**: The base URL must include a `{pub_id}` placeholder that is replaced per publisher.
- **JSON Path**: A dot-notation path (e.g., `rows`) is resolved on the API response to extract the deals array.

### CSV / Excel Parsing (`src/utils/csvParser.js`)
- Supports `.csv`, `.xlsx`, and `.xls`.
- Auto-detects column mappings for Deal ID, Deal Name, Owner, Publisher ID, and Revenue using regex patterns on headers.
- Revenue strings are cleaned of currency symbols and commas before parsing to float.

### Gap Calculation (`src/utils/gapCalculator.js`)
- Deal IDs are normalized to lowercase trimmed strings for comparison.
- Coverage is `Math.round((matched / totalWanted) * 100)`.
- Results are sorted: most missing deals first; failed publishers are deprioritized to the bottom.

---

## Testing Instructions

There is **no testing framework** configured in this project (no Jest, Vitest, Cypress, or Playwright). If you add tests:

1. Install a test runner (e.g., Vitest, since Vite is already used).
2. Place test files adjacent to the source files or in a `tests/` directory at the project root.
3. Update this section in `AGENTS.md` once tests are added.

---

## Security Considerations

- **Hardcoded Tokens**: `src/utils/apiFetcher.js` contains Base64-obfuscated PubMatic API credentials. These are not secrets in the cryptographic sense—they are trivially decodable. If the project is ever published to a public repository, these tokens must be rotated immediately and moved to environment variables or a secure backend.
- **CORS Proxy**: `server/proxy.js` forwards the `Authorization` header blindly. In production, this proxy should not be exposed to the public internet without origin restrictions and request validation.
- **No Input Sanitization**: User-uploaded CSV/Excel content is parsed client-side. While there is no server-side injection risk, be cautious if any parsed data is ever serialized into URLs or HTML without escaping.
- **HTTPS**: The default PubMatic URL in the app uses `http://`. In production, ensure all API communication uses `https://`.

---

## Deployment

The application is a static SPA. The production build is emitted to `dist/`.

1. Run `npm run build`.
2. Serve the contents of `dist/` with any static file server (e.g., Nginx, Vercel, Netlify, GitHub Pages).

The CORS proxy (`server/proxy.js`) is **not** part of the static build. If the deployed app needs to call APIs cross-origin, either:
- Host the proxy server separately, or
- Configure the target API to allow the app's origin via CORS.

---

## Environment Variables

Copy `.env.example` to `.env` to customize the proxy port:

```bash
PROXY_PORT=3001
```

No other environment variables are currently used by the client application.
