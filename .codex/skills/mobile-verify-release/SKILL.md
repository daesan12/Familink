---
name: mobile-verify-release
description: Run proportionate checks for this Kotlin plus React Native Android prototype. Use for pre-merge verification, bridge smoke tests, CI failures, or an explicit Android release-readiness check. Local verification is the default; uploading or publishing requires a separate request.
---

# Mobile Verify and Release

Use the shortest existing check that can catch the likely failure.

## Prototype loop

- Read the lockfile, package scripts, Gradle wrapper, variants, and existing
  tests before choosing commands.
- For TypeScript or UI changes, run the relevant type, lint, and focused test
  scripts that already exist.
- For Kotlin or bridge changes, compile the affected Android variant and smoke
  test the real bridge call on a device or emulator.
- Use broader Android tests or existing end-to-end tests only for affected
  critical flows or when a failure cannot be covered more cheaply.
- Report commands, outcomes, and skipped checks.

Do not install a test framework or rewrite CI merely to expand prototype
coverage.

## Release check

Run this section only when release readiness, packaging, signing, or R8 is in
scope:

1. Query current official docs through Context7 when version-sensitive details
   matter: React Native `/react/react-native-website`, Android
   `/websites/developer_android`.
2. Build the actual release variant or flavor with the checked-in Gradle
   wrapper.
3. Confirm the expected app bundle exists and includes the packaged JavaScript
   and resources.
4. If shrinking is enabled, test that build. Check signing without printing
   secrets.
5. Report `pass`, `partial`, or `fail`, artifact path, and missing evidence.

Stop before Play Console upload, track promotion, publishing, key rotation, or
shared CI changes unless the user explicitly requests that action.
