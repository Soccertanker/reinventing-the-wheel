# Reinventing the Wheel

Idle/incremental game built around the literal idiom. The player reinvents a wheel over and over. The output is always a plain wheel; progression is the *process* becoming absurdly more elaborate.

**Primary goal of this repo:** learn to build a scalable game-dev pipeline that ships updates to web and Google Play. The game is the vehicle. Favor pipeline quality and repeatability over game polish.

## Game design (summary)
- Grinding game with real progression: unlock/upgrade production steps, automate them, repeat.
- Five-era arc: Stone Age, Industrial, Modern Lab, Sci-fi Supercomputer (run AI models that take forever; the funniest era), Post-singularity/Cosmic.
- Each era is a content drop, shippable as its own release.
- Rejected: corporate satire, many biomes (scope), pure repetition without progress.
- Keep production scope small. UI-driven; minimal art.

## Stack
- TypeScript + Vite. Phaser or PixiJS only if needed; DOM/canvas is fine for an idle game.
- PWA for web (service worker, offline).
- Capacitor Android shell wrapping the web build (no Ionic CLI needed).
- **iOS = the PWA for now** (Safari, Add to Home Screen). No native iOS app: the owner has no Mac/iPhone and isn't paying Apple's $99/yr yet. Keep everything iOS-ready so a native `ios/` project later is config plus one macOS CI job, not a rewrite.
- Output for Play Store is an **AAB** (not APK). Debug APKs are for sideloading/testing only.
- Web hosting: Cloudflare Pages and/or itch.io (via `butler`).

## Architecture rules
- **Content is data.** Eras, upgrades, costs, balance live in JSON under `content/`. A content update must not require code changes.
- **Versioned saves.** Save format has a `schemaVersion` and migration functions. Updates must never wipe progress. Test migrations.
- **Offline-first.** All assets bundled in the Android app. Game state is local.
- Pure game logic (no DOM) in its own module so it is unit-testable and can simulate offline progress deterministically.
- **No per-platform duplication.** Write things once and keep platform-specific parts thin:
  - `src/core/`: pure logic. May not import `platform` or `ui` (lint-enforced).
  - `src/platform/`: the only code that imports `@capacitor/*` (lint-enforced). Native features (storage, haptics, notifications) go here, through Capacitor plugins that cover Android, iOS and web.
  - `scripts/version.mjs`: the one version source for web, Gradle and later iOS.
  - CI: shared setup in `.github/actions/setup`. The web job builds and tests `dist/` once, and platform jobs package that same artifact.
  - Icons: generated from `assets/icon.svg`.
- Android builds run only in CI (no local Android SDK).

## Pipeline goals (build in this order)
Status: 1–4 done, plus the PWA and the platform layer. 5–6 (Android signing and Play upload) are deferred until the game is worth the $25 Play fee. Next: 7–8, and game content.

1. Repo + scaffold: Vite TS app, Capacitor Android added, runs in browser and emulator/device.
2. CI (GitHub Actions) on every PR: lint, typecheck, unit tests, web build. Build matrix adds the Android debug build.
3. Web CD: auto-deploy `main` to hosting, with preview deploys per PR.
4. Versioning: semver from git tags; auto-increment Android `versionCode`; show version in-game.
5. Android signing: release keystore never committed. Use CI secrets and Play App Signing.
6. Android CD: build signed AAB in CI and upload to Play Console via fastlane or Gradle Play Publisher. Promote internal, then closed, then production, with staged rollouts.
7. Ops: crash reporting (Sentry or Crashlytics), basic analytics, feature flags/remote config for rollback.
8. Release automation: changelog generation from commits, tag-triggered release workflow.

## Constraints and cautions
- Play requires a new-app review path (personal accounts have a closed-testing requirement before production). Verify current Play Console requirements before planning launch dates.
- Avoid a "thin website wrapper" rejection: bundle assets, work offline, add a few native touches (haptics, notifications).
- WebView performance: test on a low-end Android device early; avoid heavy particle/canvas effects.
- No secrets in the repo. Keystores, service-account JSON and API keys go in CI secrets.

## Working agreements
- Keep replies concise.
- Prefer small, reviewable commits. Explain any pipeline step you add: what it does and why.
- Ask before adding heavy dependencies or switching engines.
- Run lint/typecheck/tests before committing.
