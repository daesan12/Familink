# Verified NativeWind v4 sources

Verified on 2026-07-27. Recheck live package metadata and the tag matching the
target app before making a version-sensitive recommendation.

## Source hierarchy

The project state and exact published source tag take precedence over prose
examples. This matters because documentation indexes can mix v4 and v5
snippets.

## Official v4 documentation

- Installation:
  https://www.nativewind.dev/docs/getting-started/installation
- Framework-less installation:
  https://www.nativewind.dev/docs/getting-started/installation/frameworkless
- Troubleshooting:
  https://www.nativewind.dev/docs/getting-started/troubleshooting
- Third-party components:
  https://www.nativewind.dev/docs/guides/third-party-components
- `useColorScheme`:
  https://www.nativewind.dev/docs/api/use-color-scheme
- `remapProps`:
  https://www.nativewind.dev/docs/api/remap-props
- `cssInterop`:
  https://www.nativewind.dev/docs/api/css-interop
- `vars`:
  https://www.nativewind.dev/docs/api/vars
- Platform differences:
  https://www.nativewind.dev/docs/core-concepts/differences

The v4 installation source explicitly specifies Tailwind
`tailwindcss@^3.4.17`, `nativewind/preset`, the three `@tailwind` directives,
the Expo Babel pair, Metro `input`, and `nativewind-env.d.ts`:

- https://github.com/nativewind/website/blob/main/content/docs/getting-started/installation/_install.mdx
- https://github.com/nativewind/website/blob/main/content/docs/getting-started/installation/_tailwind.mdx
- https://github.com/nativewind/website/blob/main/content/docs/getting-started/installation/index.mdx
- https://github.com/nativewind/website/blob/main/content/docs/getting-started/installation/frameworkless.mdx
- https://github.com/nativewind/website/blob/main/content/docs/getting-started/installation/_typescript.mdx

## Tagged published-source evidence

NativeWind `4.2.6` was the npm `latest` tag observed on the verification date;
NativeWind v5 was still on the `preview` tag. Treat this as a dated snapshot,
not a permanent assumption.

- v4 rejects non-Tailwind-v3 compilers:
  https://github.com/nativewind/nativewind/blob/nativewind%404.2.6/packages/nativewind/src/metro/tailwind/index.ts
- v4 doctor checks JSX, data, and the NativeWind preset:
  https://github.com/nativewind/nativewind/blob/nativewind%404.2.6/packages/nativewind/src/doctor.ts
- v4 manual color-scheme operations require non-media dark mode:
  https://github.com/nativewind/nativewind/blob/nativewind%404.2.6/packages/nativewind/src/stylesheet.ts
- v4.2 changelog identifies React Native 0.81 and Reanimated 4 work:
  https://github.com/nativewind/nativewind/blob/nativewind%404.2.6/packages/nativewind/CHANGELOG.md
- v4.1.23 Babel chain loads the Reanimated plugin:
  https://github.com/nativewind/nativewind/blob/nativewind%404.1.23/packages/react-native-css-interop/babel.js
- v4.2.6 Babel chain loads the Worklets plugin:
  https://github.com/nativewind/nativewind/blob/nativewind%404.2.6/packages/react-native-css-interop/babel.js
- v4.2.6 pins `react-native-css-interop`:
  https://github.com/nativewind/nativewind/blob/nativewind%404.2.6/packages/nativewind/package.json
- Metro `input`, TypeScript generation, and v4 defaults:
  https://github.com/nativewind/nativewind/blob/nativewind%404.2.6/packages/nativewind/src/metro/index.ts

## Supporting official documentation

- Tailwind CSS v3 content detection:
  https://v3.tailwindcss.com/docs/content-configuration
- Expo color schemes:
  https://docs.expo.dev/develop/user-interface/color-themes/
- Expo Tailwind guide, including root-layout CSS import for Expo Router:
  https://docs.expo.dev/guides/tailwind/

## Known documentation conflict

The official v4 installation source uses the three Tailwind v3 directives.
The current troubleshooting prose says the input CSS contains
`@import 'tailwindcss'`, which is a Tailwind v4 form. For NativeWind v4,
follow the installation source and the published v4 compiler, both of which
require Tailwind v3.

Context7 library `/nativewind/nativewind/nativewind_4.2.0` has also returned
Tailwind v4 imports and incomplete v4 Babel configuration. Use Context7 to find
topics, then verify every instruction against the sources above.

