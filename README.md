# GradPath

A research discovery and collaboration prototype for the UNM/CNM App Contest.

## Current demo
- Three entry paths: discover an idea from a student profile, develop an existing research question, or find student collaborators as a faculty member.
- The home page shows both student paths for a student, only the recruiting path for faculty, and all three paths for signed-out visitors. Navigation follows the same roles, with a grouped sidebar, a persistent desktop icon rail, and a mobile drawer that supports Escape and keyboard focus containment.
- Public curated computing questions ranked by major, interests, skills, and time, alongside open faculty demo posts with matching interests.
- **Explore my idea** searches real publication metadata from OpenAlex using editable keywords from a question or a selected profile interest. Students can filter for open access, sort by relevance or newest, read available abstracts, follow publication/open-version links, and download a reading list. Curated sources, local researchers, related questions, and demo posts remain separately labeled.
- **Find students** lets faculty select an open research post, review matching student interests and skills, view a profile, and start a demo conversation.
- Student and faculty profiles showcase skills, projects, achievements, availability, and an optional HTTPS portfolio or lab link. Profile discovery is configurable. Research preferences and the student account's major, interests, and skills stay in sync when saved.
- Research briefs and a browser-local roadmap remain available for curated questions.
- Mock university sign-in with fictional student Alex Rivera and faculty Dr. Avery Morgan. No password, real NetID, ChatGPT sign-in, or official UNM authentication.
- Faculty demo can create, edit, and close research posts.
- Student demo can request to join open research; faculty demo can accept or decline; students can withdraw pending requests.
- Student-faculty conversations, inbox, and replies. Switch demo roles to see both sides; no real people are contacted by these messages.
- Real curated UNM profiles link to individual public faculty pages. Email buttons open a draft in the visitor's email app; they do not send automatically or use fictional identities as the sender.
- Original GradPath SVG logo, wordmark, and favicon.

## Storage and isolation
The browser demo uses `gradpath-university-demo-v1` in localStorage. Accounts, posts, requests, conversations, and the active demo role persist only in the same browser and site origin. Visitors cannot see one another's activity. Signing out preserves the demo records; Reset demo activity restores the sample data. Clearing browser storage removes edits. If storage is unavailable, activity lasts only until the page is reloaded.

The planning workspace separately uses `gradpath-v1`; resetting the university demo leaves it intact. All sample profiles and opportunities are fictional and visibly labeled. Requests do not enroll students in real research. No live AI service or university integration is included.

Existing version 1 demo data gains the new showcase fields without replacing posts, requests, conversations, or profile edits. The initial demo has one editable student profile and one editable faculty profile. Real shared accounts and discovery across visitors require a separately deployed authenticated backend; GitHub Pages serves the static interface, with demo account activity in the browser and paper search on the separately hosted backend.

The community adapter never calls the retained account and messaging API. Paper search separately calls the public, rate-limited `/api/papers` endpoint. The earlier authenticated backend remains protected and preserved for future implementation, including its immutable D1 migration history. Mock identities cannot access it or impersonate existing users. Existing hosted records are untouched. The mock university sign-in is a demonstration, not a production authentication system.

## Hosting and development
The public browser demo is deployed to [GitHub Pages](https://kritim-123.github.io/gradpath/). The existing [Sites deployment](https://gradpath-research-journey.raged-rhombus.chatgpt.site/) remains available separately. Browser activity does not transfer between these addresses.

The `Deploy GradPath to GitHub Pages` workflow runs the prototype tests, exports the static demo, and publishes it after each push to `main`. In repository **Settings > Pages**, set the source to **GitHub Actions**. The workflow can also be started manually from the Actions tab.

To build the Pages artifact locally, run `node scripts/build-pages.mjs` with Node 22.13 or later. It creates `dist/pages/index.html` and an explicit list of public assets, using relative asset paths so the app works under `/gradpath/`. Serve that directory with a static HTTP server to preview it. This export needs no package installation, API keys, or database. Hash-based navigation, mock sign-in, requests, and messages continue to run entirely in the browser.

GitHub Pages does not run the retained API or database. The separate Vinext build produces a Cloudflare Worker with the existing Sites-provisioned D1 binding. Server code, migrations, and hosting settings are excluded from the Pages artifact.

Node 22.13 or later is required. Follow the Sites skill for dependency installation and publishing. Commands: `npm run dev`, `npm run build`, and `node --test tests/accounts.test.mjs tests/mock-university.test.mjs tests/matching.test.mjs tests/navigation.test.mjs tests/openalex.test.mjs tests/papers-api.test.mjs tests/researchers.test.mjs`.

The browser demo does not require local database setup. To test the retained backend separately, apply generated migrations using the starter's documented Wrangler local migration command. Hosted migrations and records remain separate from local state.

Mock tests cover the student-to-faculty request and reply journey, research posting and restrictions, persistence, sign-out, reset, separate visitors, and unavailable storage. Backend tests use fresh in-memory SQLite databases and actual migrations to verify authorization, ownership, CSRF, request decisions, message access, rate limits, and faculty matching.

## OpenAlex paper search

The browser calls `https://gradpath-research-journey.raged-rhombus.chatgpt.site/api/papers` after an explicit search or interest selection. Page loads and typing do not transmit searches. The public GitHub Pages export contains only this endpoint URL, never an OpenAlex key. `OPENALEX_API_KEY` is configured as a secret in the existing Sites production runtime and read only by `app/api/papers/route.ts`. An environment change takes effect after deploying a Sites version.

The backend accepts a 2–320 character query, an open-access flag, and relevance/newest sorting. It fixes the upstream host, endpoint, six-result page size, returned fields, and retraction filter. It sends the key in an Authorization header, refuses upstream redirects, limits response size/time, and returns only publication fields. Upstream error bodies, headers, credentials, and internal errors are never passed to visitors. A missing key or database fails closed; there is no anonymous fallback.

Browser origins are restricted to the GitHub Pages origin and the existing GradPath Sites origin. CORS is not authentication: this is an intentionally public research search endpoint. D1 enforces atomic limits of 60 requests/minute per network, 90 uncached searches per five-minute window globally, and 900 uncached searches per UTC day globally. Reservations are conservative: failures can consume a local reservation even when OpenAlex does not charge. The provider's own allowance and new-account pacing also apply. Cached searches remain available after the upstream daily cap, subject to the network request limit.

`paper_cache` holds only public publication metadata for up to 24 hours, keyed by a hash of the exact query and filters. `paper_limits` holds expiring counters; network identifiers are HMAC-hashed using the server secret, and raw IPs are not written to these tables. Expired rows are removed during successful uncached searches. The frontend also caches at most twelve successful searches in memory for ten minutes. No student identity, full profile, private notes, or messages are sent to this endpoint or OpenAlex. Hosting providers still handle normal connection information, and search terms travel to the backend and OpenAlex. Reset workspace clears the browser cache, not the shared public-paper cache.

Keywords are editable and are not an AI/semantic interpretation. Papers, abstracts, and links are external metadata and may be incomplete. Curated faculty matches remain separate; a paper's author is not automatically a GradPath account or an available advisor. The app has explicit empty, offline, timeout, unavailable-service, and quota states without substituting sample papers. A new search replaces older in-flight results.

Deploy the Sites backend (including the appended D1 migration) before pushing the frontend switch to GitHub. Keep the existing account tables and migrations unchanged. Configure or rotate `OPENALEX_API_KEY` using Sites secret tools, never source files, build-time Pages variables, client storage, or the GitHub repository. Both secrets and frontend changes require their respective deployment workflows. API references: https://help.openalex.org/api/authentication/ and https://help.openalex.org/api/searching/.

## OpenAlex researcher discovery

Faculty connections opens with live OpenAlex authors whose last-known institution includes UNM (`I169521973`, ROR `05fs6jp91`). The Outside UNM switch excludes that institution, including dual affiliations; unknown affiliations are excluded. These are publication-derived affiliations, not verified current appointments, professor titles, GradPath membership, or availability to supervise. No contact addresses are invented or inferred from names.

The `/api/researchers` endpoint accepts an optional 2–120 character name, inside/outside scope, all fields or Computer Science (`topics.field.id:17`), and pages 1–20 (12 authors each). Author name search does not search research keywords. Unnamed lists sort by publication count and are labeled accordingly, not presented as personal fit rankings. Cards link to OpenAlex publications and ORCID when available. Snapshots can be saved in `gradpath-v1` (up to 100) and reset with the planning workspace. The curated UNM email directory and browser-only demo account are retained in a separate collapsible section.

The view loads UNM records automatically on first visit; later name searches are submitted explicitly. Only the name and selected filters leave the browser, never account profiles or private notes. The secret remains in the backend. Researchers and papers share the **same** network, burst and daily quotas and cache tables, with distinct cache keys. Adding author search does not double the free-key allowance. Responses are bounded, sanitized and cached for 24 hours. Browser caching lasts ten minutes. Pagination, scope changes, failure/retry and cancellation are covered in the researcher tests; no database migration is needed.

Institution verified using `https://api.openalex.org/institutions/I169521973`. Author field semantics: https://help.openalex.org/data/authors/.

## Source layout
- `public/app.js` and `public/data.js`: discovery and planning flows.
- `public/matching.js`: explainable profile overlap and catalog keyword matching.
- `public/openalex.js`: backend search client, publication normalization, safe URLs, timeout/cancellation, and bounded memory caching.
- `public/papers.js` and `public/papers.css`: explicit search, interest shortcuts, filters, results, and reading-list download.
- `public/journeys.js`: existing-idea search, student discovery, and profile showcases.
- `public/navigation.js` and `public/navigation.css`: role-specific navigation and responsive sidebar controls. The desktop preference uses `gradpath-navigation-v1` and is separate from demo and planning records.
- `public/mock-university.js`: isolated browser-only demo data and sessions.
- `public/community.js` and `public/community.css`: mock sign-in, research, requests, and messaging interfaces.
- `lib/papers-api.mjs` and `app/api/papers/route.ts`: secret-backed OpenAlex search with CORS, validation, D1 caching, and atomic quota limits.
- `lib/gradpath-api.mjs` and `app/api/[...path]/route.ts`: retained authenticated backend, unused by the demo UI.
- `db/schema.ts` and `drizzle/`: retained schema and immutable migrations.
- `.openai/hosting.json`: existing Site identity and DB binding.

Never commit local environment files, credentials, `.wrangler`, `.sites-runtime`, or `node_modules`.
