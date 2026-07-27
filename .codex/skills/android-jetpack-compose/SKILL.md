---
name: android-jetpack-compose
description: Build and review native Android UI written with Jetpack Compose. Use this skill for composable APIs, UI state ownership, state hoisting, lifecycle-aware state collection, effects, recomposition, lazy layouts, adaptive UI, accessibility, previews, and Compose UI tests. Do not use it to choose dependency versions or to duplicate specialized navigation, edge-to-edge, camera, styling, or test-infrastructure guidance.
---

# Jetpack Compose UI

Implement Compose UI that follows the project's existing architecture, theme,
dependency versions, and test conventions. Inspect those sources before writing
code. When an exact API or version matters, consult the current official Android
documentation instead of relying on a version embedded in this skill.

## Route specialized work

Keep this skill focused on general Compose UI:

- Use `navigation-3` for Navigation 3 setup, migration, back stacks, and scenes.
- Use `edge-to-edge` for system bars, display cutouts, IME, and window insets.
- Use `styles` only when the project has explicitly adopted the experimental
  Compose Styles API.
- Use `testing-setup` when selecting or installing test infrastructure.
- Use `camerax` for camera previews, capture, analysis, and lifecycle binding.

If a task crosses these boundaries, apply this skill only to the Compose UI
portion and follow the specialized skill for the rest.

## Implementation workflow

1. Inspect the feature's existing composables, state holder or `ViewModel`,
   theme tokens, navigation boundary, and tests.
2. Decide who owns each piece of state before creating composables.
3. Separate the stateful route from reusable, stateless UI where practical.
4. Model user actions as callbacks and keep data flow unidirectional.
5. Account for adaptive layout, accessibility, and state restoration.
6. Add or update focused previews and tests, then run the smallest relevant
   project verification commands.

Prefer the smallest change that matches the surrounding code. Do not introduce
a new architecture, dependency, or design system solely to implement one screen.

## Own state at the right level

- Use `remember` for values that should survive recomposition while the
  composable remains in the composition.
- Use `rememberSaveable` for small, saveable UI state that should survive
  activity recreation and system-initiated process recreation. Use a `Saver`
  when the value is not directly saveable.
- Use a plain state holder when UI behavior is complex but does not require a
  `ViewModel`.
- Use a `ViewModel` for screen-level state and business operations that should
  outlive composition.
- Use `SavedStateHandle` for minimal screen state needed to reconstruct a
  `ViewModel`; do not store large objects or full caches in saved state.
- Collect Android `Flow` state with `collectAsStateWithLifecycle()` at the
  Android UI boundary.

Do not pass a `ViewModel` into reusable leaf composables. Pass immutable state
and event callbacks so the UI is previewable and testable.

```kotlin
@Composable
fun ProfileRoute(
    viewModel: ProfileViewModel,
    onBack: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    ProfileScreen(
        uiState = uiState,
        onRetry = viewModel::retry,
        onBack = onBack,
    )
}

@Composable
fun ProfileScreen(
    uiState: ProfileUiState,
    onRetry: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Render state and emit user actions through callbacks.
}
```

Use `rememberSaveable` for user-entered values only when the composable owns
them. If the value is authoritative screen state, hoist it instead of creating
a second source of truth.

## Use effects deliberately

Composition should describe UI, not perform work directly.

- `LaunchedEffect(key)` runs suspend work tied to the composition and restarts
  when its key changes.
- `DisposableEffect(key)` registers something that requires matching cleanup.
- `SideEffect` publishes successful composition state to non-Compose code.
- `rememberUpdatedState(value)` lets a long-lived effect observe the latest
  callback or value without restarting.

Choose effect keys that express when the work must restart. Avoid using
`LaunchedEffect(Unit)` as a default data-loading mechanism: prefer an
idempotent `ViewModel` operation or an effect keyed to the actual input and
lifecycle requirement.

Do not launch navigation, analytics, repository calls, or mutable state changes
directly in the composable body.

## Control recomposition with evidence

- Cache an expensive calculation with `remember(inputs)`, or move it to the
  state holder when it is part of state production.
- Use `derivedStateOf` when inputs change more often than the UI-relevant
  derived result, such as converting continuous scroll state into a threshold.
- Give lazy-list items stable, unique keys when items can move or change.
- Prefer immutable UI state and avoid passing mutable collections.
- Defer rapidly changing state reads to the narrowest composable that needs
  them.
- Do not add `@Stable`, `@Immutable`, or manual memoization speculatively.
  Diagnose a real recomposition or stability problem first.

```kotlin
val showScrollToTop by remember {
    derivedStateOf { listState.firstVisibleItemIndex > 0 }
}

val filteredItems = remember(items, query) {
    items.filter { it.matches(query) }
}
```

`derivedStateOf` is not a general cache for filtering, sorting, or other
expensive work.

## Design reusable composables

- Put `modifier: Modifier = Modifier` after required parameters and before
  optional callbacks or content where the surrounding project follows that
  convention.
- Apply the provided modifier to the composable's outermost meaningful node.
- Hoist state that callers need to control.
- Prefer slot APIs when callers need to supply UI content.
- Use Material theme tokens or the project's design system instead of local
  hardcoded colors and typography.
- Use stable keys in `LazyColumn`, `LazyRow`, and grids.
- Keep list items focused; avoid nesting unbounded lazy layouts in the same
  direction.

Do not over-generalize a one-off screen into a framework. Extract a composable
when reuse, independent testing, or readability justifies it.

## Build adaptive and accessible UI

- Design from available constraints rather than assuming a phone portrait
  width.
- Preserve meaningful behavior for compact, medium, and expanded windows.
- Use canonical adaptive layouts when the product calls for list-detail or
  supporting-pane behavior.
- Support font scaling and avoid clipping text with fixed heights.
- Give meaningful non-decorative icons a localized content description.
- Do not communicate state by color alone.
- Provide semantics for custom controls and preserve appropriate touch targets.
- Keep focus order and keyboard or switch access usable.

Delegate system-bar and inset handling to `edge-to-edge` instead of duplicating
inset recipes here.

## Preview and test behavior

- Preview stateless content with representative loading, content, empty, and
  error states when useful.
- Test behavior through visible text, roles, state descriptions, and other
  semantics rather than internal node structure.
- Test user actions and important state transitions.
- Add accessibility checks when the project's Compose test stack supports them.
- Keep business logic tests outside Compose UI tests.

Use `testing-setup` when the task requires choosing runners, screenshot tools,
Robolectric, instrumentation, or CI infrastructure.

## Review checklist

- State has one clear owner and survives only as long as required.
- Flow collection is lifecycle-aware at the Android UI boundary.
- Effects have correct keys and cleanup.
- Expensive work is not repeated during composition.
- Lazy content uses stable keys where identity matters.
- The UI adapts without clipping and exposes usable semantics.
- Specialized work is delegated to the corresponding project skill.
- Relevant module build, lint, and focused tests pass.
