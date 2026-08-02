---
name: nativewind-v4
description: Verified project-local workflow for installing, configuring, using, auditing, and debugging NativeWind 4.x in Expo or framework-less React Native. Use whenever a task mentions NativeWind v4, Tailwind className styling in React Native, NativeWind Metro or Babel setup, missing styles, dark mode, CSS variables, remapProps, cssInterop, or NativeWind v4 dependency compatibility. Do not use for NativeWind v5, `nativewind@preview`, or web-only Tailwind CSS work.
compatibility: Requires read access to the target package.json, lockfile, Babel, Metro, Tailwind, CSS, TypeScript, and app-entry files. Version-sensitive claims require official NativeWind v4 docs or the source tag matching the installed package.
metadata:
  version: "1.0.0"
  verified_at: "2026-07-27"
  verified_nativewind_tags:
    - "4.1.23"
    - "4.2.6"
---

# NativeWind v4

Handle NativeWind 4.x without mixing in NativeWind v5 or Tailwind CSS v4
instructions.

## Evidence rules

Use this precedence for version-sensitive decisions:

1. The target app's `package.json`, lockfile, installed package metadata, and
   reproducible build output.
2. The official `nativewind/nativewind` source tag matching the installed
   NativeWind version.
3. Official NativeWind v4 pages under `https://www.nativewind.dev/docs/`.
4. Official Tailwind CSS v3 and Expo or React Native documentation.
5. Context7 only for discovery. Cross-check every example because its
   versioned NativeWind index can contain v5 material.

If these sources disagree, do not guess. State the conflict, keep the current
dependency line unchanged, and ask for or run the smallest verification that
can resolve it.

## Inspect before proposing changes

Find the actual JavaScript app root. If there is no `package.json`, report that
there is no NativeWind target in the current scope and stop; do not initialize
or install a new app implicitly.

At the app root, inspect:

- `package.json` and the active package-manager lockfile
- installed or locked versions of `nativewind`, `tailwindcss`,
  `react-native-css-interop`, `react-native-reanimated`,
  `react-native-worklets`, `react-native-safe-area-context`, `react-native`,
  and `expo`
- the active Node.js version and relevant package `engines` constraints
- `babel.config.*`, `metro.config.*`, `tailwind.config.*`, the main CSS file,
  `tsconfig.json`, the app entry, and Expo config when present
- existing scripts and the project's normal lint, typecheck, test, and build
  commands

Do not mutate dependencies or configuration when the user asked only for an
explanation, audit, or diagnosis.

When the user supplies versions or an error without the project files, treat a
matching source-level explanation as the leading diagnosis, not a verified
project root cause. List the missing `package.json`, lockfile, installed graph,
and config evidence and give an exact read-only check that includes Expo, React
Native, NativeWind, Reanimated, and Worklets.

## Establish the v4 boundary

A valid NativeWind v4 setup has all of these characteristics:

- `nativewind` resolves to `4.x`.
- `tailwindcss` resolves to `3.x`. Published v4 source rejects other Tailwind
  major versions.
- `react-native-css-interop` is NativeWind v4's runtime dependency. NativeWind
  pins it, so do not add or upgrade it independently without exact source
  evidence.
- The CSS entry uses `@tailwind base`, `@tailwind components`, and
  `@tailwind utilities`.
- `tailwind.config.js` includes `require("nativewind/preset")`.
- Metro is wrapped with `withNativeWind(config, { input: "<css path>" })`.

Treat NativeWind 4.1 to 4.2 as a real compatibility boundary:

- The `nativewind/babel` chain in `4.1.23` loads
  `react-native-reanimated/plugin`.
- The chain in `4.2.6` loads `react-native-worklets/plugin`.
- The official `4.2.0` changelog describes that line as fixes for React Native
  0.81 and Reanimated 4.

Therefore, do not change between 4.1.x and 4.2.x until the target React Native,
Expo, Reanimated, and Worklets versions are known and the relevant native build
can be run.

Reject these v5 fingerprints in a v4 solution:

- Tailwind CSS `4.x`
- `nativewind@preview` or `5.x`
- `@import "tailwindcss/theme.css"`, `@import "tailwindcss/utilities.css"`, or
  `@import "nativewind/theme"` in the CSS entry
- `@tailwindcss/postcss` added for the NativeWind path
- `react-native-css` used in place of v4's `react-native-css-interop`
- v5's `styled()` replacement for v4 `remapProps` or `cssInterop`

## Choose the relevant reference

- Read [setup.md](references/setup.md) for installation or configuration work.
- Read [usage-and-interop.md](references/usage-and-interop.md) for components,
  dark mode, variables, or third-party libraries.
- Read [troubleshooting.md](references/troubleshooting.md) for missing styles,
  build errors, cache issues, or version conflicts.
- Read [verified-sources.md](references/verified-sources.md) when a claim needs
  a citation, a source conflict appears, or a new NativeWind v4 release may
  have changed the answer.

Load only the references needed for the current task.

## Work in this order

1. Report the detected app root, framework, package manager, and exact relevant
   versions.
2. Classify the setup as v4-consistent, v5-contaminated, or unresolved.
3. Explain the smallest evidence-backed change before editing.
4. Preserve existing Babel, Metro, Tailwind, routing, monorepo, and package
   manager conventions while applying only that change.
5. Verify Tailwind compilation, NativeWind runtime setup, project checks, and
   one visual style path in proportion to the task.
6. Report what was verified and what still needs a device, emulator, native
   build, or user decision.

## Implementation guardrails

- Never replace an existing Babel or Metro config wholesale. Compose
  NativeWind with the existing config.
- Keep Tailwind `content` globs aligned with the directories that actually
  contain complete class strings.
- Import the CSS entry once from the real application entry. In Expo Router,
  use the root layout when that is the project's entry convention.
- Prefer normal `className` forwarding in custom components.
- Use `remapProps` for multiple style-like props.
- Use `cssInterop` only when a native or third-party component needs resolved
  style values or style-to-prop extraction; it has additional runtime cost.
- For manual theme switching, configure Tailwind `darkMode: "class"` before
  using `setColorScheme` or `toggleColorScheme`.
- Do not claim that a configuration works until the relevant command or
  runtime smoke test passes.

## Completion report

Lead with the outcome, then include:

- detected versions and v4 compatibility classification
- files changed and why
- verification commands and results
- any unverified platform or release behavior
- official source links for version-sensitive recommendations
