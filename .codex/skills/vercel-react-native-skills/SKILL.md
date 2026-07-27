---
name: vercel-react-native-skills
description:
  Selective React Native and Expo UI guidance for this prototype. Use when
  implementing React Native UI or investigating a concrete performance,
  animation, rendering, or interaction problem. Read only the relevant rule and
  do not add a dependency solely because a rule recommends it.
license: MIT
metadata:
  author: vercel
  adaptation: project-prototype
---

# React Native Prototype Guidance

Treat the bundled Vercel rules as an on-demand reference, not a project-wide
standard.

## Default approach

- Follow the dependencies and patterns already present in the project.
- Prefer a simple React Native implementation that proves the user flow.
- Run the affected type, lint, and test checks.
- Optimize after observing a real bottleneck or when the task explicitly asks
  for production hardening.

## Load rules selectively

- List jank or large data: read the relevant `rules/list-performance-*.md`.
- Animation or gesture work: read the relevant `rules/animation-*.md`.
- Safe areas, presses, images, or rendering defects: read only the matching
  `rules/ui-*.md` or `rules/rendering-*.md`.
- Excessive rerenders or subscriptions: read the matching
  `rules/react-state-*.md`.
- Read monorepo, font, design-system, or React Compiler rules only when the
  current project actually uses that setup.

## Prototype guardrails

- Do not install FlashList, Expo Image, Galeria, NativeWind, Reanimated, or
  another library unless the project need justifies it.
- Confirm an Expo-specific rule applies before using it in a bare React Native
  app.
- The source rule priorities describe general guidance, not mandatory project
  requirements.
- Do not load the compiled `AGENTS.md` unless a broad performance audit is
  explicitly requested.
