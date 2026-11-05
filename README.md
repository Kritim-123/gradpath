# GradPath

An interactive prototype that helps graduate students explore research directions, connect their interests to faculty, and plan their research journey. Built for the UNM/CNM App Contest.

## Run

Open `index.html` in a browser, or serve this folder with a static web server. There are no dependencies, API keys, or build steps.

## Publish with GitHub Pages

1. Use the private `Kritim-123/gradpath` repository. Publishing GitHub Pages from a private repository requires an eligible GitHub plan, such as GitHub Pro. Keep the repository private.
2. Add the contents of this folder to the root of its `main` branch. Keep `index.html` at the repository root; upload the extracted files, not this ZIP.
3. Open the repository's **Settings > Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**, then **main** and **/ (root)**, and save.
5. Wait for GitHub's Pages deployment to complete. Use the URL shown in Settings > Pages.

For the `Kritim-123/gradpath` repository, the expected address is `https://kritim-123.github.io/gradpath/`. This address is only live after successful deployment. No custom DNS settings are needed for GitHub's default address.

The repository is private, while the published prototype is intended to be publicly accessible to judges. The HTML, CSS, and JavaScript served by a public website can be inspected by its visitors.

The `.nojekyll` file marks this as a plain static website. Relative asset paths and hash navigation support a project subdirectory.

## Prototype features

- Editable research interests, skills, goal, and exploration window
- Six curated research directions, local ranking, search, and filters
- Saved directions and comparison
- Faculty discovery with official source links
- Research brief download
- Research roadmap with dates, sequential milestones, notes, and export
- Browser-local persistence and a confirmed reset

## Data and scope

This independent student prototype has no UNM authentication, backend, or live AI service. Selections and notes stay in the current browser's localStorage under `gradpath-v1`. Each visitor has a separate local workspace; information does not automatically transfer from another website address or browser.

Research directions are illustrative starting points, not validated novel proposals. Faculty connections are inferred from public sources; supervision, availability, and funding are unconfirmed. Roadmap dates are draft work dates. Confirm degree requirements against the applicable catalog and program. Sources were checked on November 5, 2026 and are linked in the relevant screens.
