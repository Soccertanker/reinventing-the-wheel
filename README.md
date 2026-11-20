# Reinventing the Wheel

Idle game about reinventing the wheel. Mostly a vehicle for a web + Google Play release pipeline (see `CLAUDE.md`).

## Layout
- `content/` — game data (eras, producers, balance). Edit JSON here; no code changes needed.
- `src/core/` — pure game logic (no DOM). Simulation, saves + migrations. Unit-tested.
- `src/ui/` — DOM rendering and localStorage.
- `android/` — Capacitor Android shell wrapping `dist/`.

## Commands
| | |
|---|---|
| `npm run dev` | dev server |
| `npm run check` | lint + typecheck + tests (run before committing) |
| `npm run build` | production web build → `dist/` |
| `npm run android:sync` | build web and copy it into the Android project |
| `npm run android:debug` | build a debug APK (`android/app/build/outputs/apk/debug/`) |
| `npm run android:open` | open in Android Studio |

## Android prerequisites
- JDK 21 (Gradle 8.14 does not run on JDK 25)
- Android SDK (platform 36): install Android Studio, or the command-line tools, and set `ANDROID_HOME`.

## Changing the save format
See the comment at the top of `src/core/save.ts`. Bump the schema, add a migration and add a fixture test.

## Web deploys (Cloudflare Pages)
| Trigger | Environment | URL |
|---|---|---|
| Release (see below) | production | https://reinventing-the-wheel.pages.dev |
| Merge to `main` | staging | https://staging.reinventing-the-wheel.pages.dev |
| Pull request | preview | `https://<branch>.reinventing-the-wheel.pages.dev` (linked as "View deployment" on the PR) |

- Rollback: Cloudflare dashboard → Workers & Pages → reinventing-the-wheel → Deployments → pick one → Rollback
- Needs repo secrets `CLOUDFLARE_API_TOKEN` (Pages:Edit only) and `CLOUDFLARE_ACCOUNT_ID`

## Versioning
Versions come from git tags (`scripts/version.mjs`, used by both the web build and Gradle). `package.json` version is unused.
- Tagged commit `v1.2.3` → `1.2.3`
- Commits after a tag → `1.2.4-dev.3+g<sha>` (prerelease of the next patch)
- Android `versionCode` = commit count on `main` (always increases: `main` is linear)
- `npm run version:show` prints the current values. The version is shown in the in-game footer.

## Releasing
Actions → **Release** → Run workflow → pick `patch` / `minor` / `major`. This:
1. tags `main` with the next version (`npm run version:show` shows the current one; `node scripts/version.mjs --next minor` previews the next)
2. runs the full CI build from the tag (so the version is exactly `X.Y.Z`)
3. deploys it to production
4. publishes a GitHub Release with notes generated from merged PR titles, plus the web zip and debug APK

Pushing a tag by hand (`git tag v1.2.3 && git push origin v1.2.3`) runs steps 2–4.
