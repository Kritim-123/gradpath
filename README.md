# GradPath

A research discovery and collaboration prototype for the UNM/CNM App Contest.

## Current demo
- Three entry paths: discover an idea from a student profile, develop an existing research question, or find student collaborators as a faculty member.
- Public curated computing questions ranked by major, interests, skills, and time, alongside open faculty demo posts with matching interests.
- **Explore my idea** connects a student's own question to existing catalog sources, individual researchers, related questions, and open demo posts. It explains its limited keyword matching and offers an idea brief download; it does not invent papers or run a live literature search.
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

Existing version 1 demo data gains the new showcase fields without replacing posts, requests, conversations, or profile edits. The initial demo has one editable student profile and one editable faculty profile. Real shared accounts and discovery across visitors require a separately deployed authenticated backend; GitHub Pages remains a static, browser-local prototype.

The frontend adapter never calls the existing server API. The earlier authenticated backend remains protected and preserved for future implementation, including its immutable D1 migration history. Mock identities cannot access it or impersonate existing users. Existing hosted records are untouched. The mock university sign-in is a demonstration, not a production authentication system.

## Hosting and development
The public browser demo is deployed to [GitHub Pages](https://kritim-123.github.io/gradpath/). The existing [Sites deployment](https://gradpath-research-journey.raged-rhombus.chatgpt.site/) remains available separately. Browser activity does not transfer between these addresses.

The `Deploy GradPath to GitHub Pages` workflow runs the prototype tests, exports the static demo, and publishes it after each push to `main`. In repository **Settings > Pages**, set the source to **GitHub Actions**. The workflow can also be started manually from the Actions tab.

To build the Pages artifact locally, run `node scripts/build-pages.mjs` with Node 22.13 or later. It creates `dist/pages/index.html` and an explicit list of public assets, using relative asset paths so the app works under `/gradpath/`. Serve that directory with a static HTTP server to preview it. This export needs no package installation, API keys, or database. Hash-based navigation, mock sign-in, requests, and messages continue to run entirely in the browser.

GitHub Pages does not run the retained API or database. The separate Vinext build produces a Cloudflare Worker with the existing Sites-provisioned D1 binding. Server code, migrations, and hosting settings are excluded from the Pages artifact.

Node 22.13 or later is required. Follow the Sites skill for dependency installation and publishing. Commands: `npm run dev`, `npm run build`, and `node --test tests/accounts.test.mjs tests/mock-university.test.mjs tests/matching.test.mjs`.

The browser demo does not require local database setup. To test the retained backend separately, apply generated migrations using the starter's documented Wrangler local migration command. Hosted migrations and records remain separate from local state.

Mock tests cover the student-to-faculty request and reply journey, research posting and restrictions, persistence, sign-out, reset, separate visitors, and unavailable storage. Backend tests use fresh in-memory SQLite databases and actual migrations to verify authorization, ownership, CSRF, request decisions, message access, rate limits, and faculty matching.

## Source layout
- `public/app.js` and `public/data.js`: discovery and planning flows.
- `public/matching.js`: explainable profile overlap and catalog keyword matching.
- `public/journeys.js`: existing-idea search, student discovery, and profile showcases.
- `public/mock-university.js`: isolated browser-only demo data and sessions.
- `public/community.js` and `public/community.css`: mock sign-in, research, requests, and messaging interfaces.
- `lib/gradpath-api.mjs` and `app/api/[...path]/route.ts`: retained authenticated backend, unused by the demo UI.
- `db/schema.ts` and `drizzle/`: retained schema and immutable migrations.
- `.openai/hosting.json`: existing Site identity and DB binding.

Never commit local environment files, credentials, `.wrangler`, `.sites-runtime`, or `node_modules`.
