---
name: react-native-android-bridge
description: Connect React Native and Kotlin in this Android prototype. Use for an embedded React Native screen, ReactHost or ReactActivity setup, Gradle integration, Codegen, TurboModules, native events, or any TypeScript-to-Kotlin API.
---

# React Native Android Bridge

Build the smallest typed bridge that proves the prototype flow.

## Inspect first

- Read the installed React Native version, package scripts, Gradle files,
  manifest, `Application`, host `Activity`, and existing native modules.
- Determine whether the task needs a hosted React Native screen, a non-UI
  native module, or a native view.
- Follow the project's actual architecture and Gradle DSL; do not assume Expo.

For version-sensitive integration details, query current official documentation through Context7:

- React Native: `/react/react-native-website`
- Android: `/websites/developer_android`

Use the Community Template matching the installed React Native version as the
implementation reference.

## Implement

- Keep logic in TypeScript when it does not require an Android API or existing Kotlin implementation.
- Use a native module for non-visual Android capabilities.
- Use a native component only when React Native must render or control an Android `View`.
- Follow the current template for the React Native Gradle Plugin, autolinking,
  `ReactHost`, and `ReactActivity`.
- Keep development-only network allowances in the debug manifest.
- Make the `AppRegistry` component name and the Android host component name identical.
- For the New Architecture, define the TypeScript spec first, run Codegen, and
  do not edit generated output.
- Keep names, nullability, results, and events consistent across TypeScript and
  Kotlin. Release native resources when listeners stop.
- Keep legacy APIs only when the inspected project requires them.

## Verify

- Run Codegen when its schema changed.
- Run the existing TypeScript checks and compile the affected Android variant.
- Exercise one real JavaScript-to-Kotlin call or event on a device or emulator.
- Build a release variant only when packaging or release behavior is in scope.
- Report changed files, checks, and anything not verified.

Avoid architecture migrations, new frameworks, or reusable abstractions that
the prototype does not yet need.
