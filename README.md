# GradPath

A research discovery and collaboration prototype for the UNM/CNM App Contest.

## Current demo
- Public curated research directions, research briefs, and a browser-local roadmap.
- Mock university sign-in with fictional student Alex Rivera and faculty Dr. Avery Morgan. No password, real NetID, ChatGPT sign-in, or official UNM authentication.
- Faculty demo can create, edit, and close research posts.
- Student demo can request to join open research; faculty demo can accept or decline; students can withdraw pending requests.
- Student-faculty conversations, inbox, and replies. Switch demo roles to see both sides; no real people are contacted by these messages.
- Real curated UNM profiles link to individual public faculty pages. Email buttons open a draft in the visitor's email app; they do not send automatically or use fictional identities as the sender.
- Original GradPath SVG logo, wordmark, and favicon.

## Storage and isolation
The browser demo uses `gradpath-university-demo-v1` in localStorage. Accounts, posts, requests, conversations, and the active demo role persist only in the same browser and site origin. Visitors cannot see one another's activity. Signing out preserves the demo records; Reset demo activity restores the sample data. Clearing browser storage removes edits. If storage is unavailable, activity lasts only until the page is reloaded.

The planning workspace separately uses `gradpath-v1`; resetting the university demo leaves it intact. All sample profiles and opportunities are fictional and visibly labeled. Requests do not enroll students in real research. No live AI service or university integration is included.

The frontend adapter never calls the existing server API. The earlier authenticated backend remains protected and preserved for future implementation, including its immutable D1 migration history. Mock identities cannot access it or impersonate existing users. Existing hosted records are untouched. The mock university sign-in is a demonstration, not a production authentication system.

## Hosting and development
The current Vinext framework builds a Cloudflare Worker with the existing Sites-provisioned D1 binding. GitHub can hold private source; GitHub Pages cannot run the retained backend. The public Sites URL remains the deployed app.

Node 22.13 or later is required. Follow the Sites skill for dependency installation and publishing. Commands: `npm run dev`, `npm run build`, and `node --test tests/accounts.test.mjs tests/mock-university.test.mjs`.

The browser demo does not require local database setup. To test the retained backend separately, apply generated migrations using the starter's documented Wrangler local migration command. Hosted migrations and records remain separate from local state.

Mock tests cover the student-to-faculty request and reply journey, research posting and restrictions, persistence, sign-out, reset, separate visitors, and unavailable storage. Backend tests use fresh in-memory SQLite databases and actual migrations to verify authorization, ownership, CSRF, request decisions, message access, rate limits, and faculty matching.

## Source layout
- `public/app.js` and `public/data.js`: discovery and planning flows.
- `public/mock-university.js`: isolated browser-only demo data and sessions.
- `public/community.js` and `public/community.css`: mock sign-in, research, requests, and messaging interfaces.
- `lib/gradpath-api.mjs` and `app/api/[...path]/route.ts`: retained authenticated backend, unused by the demo UI.
- `db/schema.ts` and `drizzle/`: retained schema and immutable migrations.
- `.openai/hosting.json`: existing Site identity and DB binding.

Never commit local environment files, credentials, `.wrangler`, `.sites-runtime`, or `node_modules`.
