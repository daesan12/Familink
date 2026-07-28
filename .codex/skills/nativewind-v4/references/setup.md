# NativeWind v4 setup

Use this reference only after inspecting the target app and selecting a
NativeWind 4.x line compatible with its React Native, Expo, Reanimated, and
Worklets versions.

## Dependency selection

For an existing app, preserve the locked NativeWind line unless the user
explicitly requested an upgrade.

For a new Expo app, use its existing package manager and Expo's installer so
Expo-managed native packages resolve to SDK-compatible versions. Replace
`<verified-4.x-version>` with the exact v4 version or range selected after the
compatibility inspection:

```powershell
npx.cmd expo install nativewind@<verified-4.x-version> react-native-reanimated react-native-safe-area-context
npx.cmd expo install --dev tailwindcss@^3.4.17 prettier-plugin-tailwindcss@^0.5.11 babel-preset-expo
```

For a framework-less React Native app, use its package manager to install the
same packages, keep Tailwind on v3, then run the normal iOS pod-install step on
macOS:

```text
nativewind@<verified-4.x-version>
react-native-reanimated
react-native-safe-area-context

dev dependencies:
tailwindcss@^3.4.17
prettier-plugin-tailwindcss@^0.5.11
```

Do not install `react-native-css-interop` separately. The published NativeWind
v4 package pins its matching runtime version.

## Tailwind configuration

Use a JavaScript Tailwind v3 config and include every source directory that
contains NativeWind class strings:

```js
/** @type {import("tailwindcss").Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

Remove globs for directories the project does not use. Add missing real source
directories rather than copying this list blindly.

The v4 CSS entry is:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Do not replace these directives with Tailwind CSS v4 imports.

## Expo Babel configuration

Merge NativeWind into the existing config. The v4 Expo setup needs both the
Expo JSX import source option and the NativeWind Babel preset:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

Preserve unrelated plugins and presets. Do not duplicate Reanimated or
Worklets plugins without inspecting what the selected `nativewind/babel`
version already loads.

## Framework-less Babel configuration

Append the NativeWind preset to the existing preset list:

```js
module.exports = {
  presets: ["<existing React Native preset>", "nativewind/babel"],
};
```

Preserve the project's function/object form and existing settings.

## Expo Metro configuration

Wrap the existing Expo config and point `input` to the actual CSS entry:

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

If the project already customizes Metro, apply those changes to `config` first
and call `withNativeWind` around the final config.

## Framework-less Metro configuration

Preserve existing Metro extensions while wrapping the merged config:

```js
const {
  getDefaultConfig,
  mergeConfig,
} = require("@react-native/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = mergeConfig(getDefaultConfig(__dirname), {
  // Existing project configuration.
});

module.exports = withNativeWind(config, { input: "./global.css" });
```

## CSS import and Expo web

Import the CSS entry once from the app's actual entry:

```ts
import "./global.css";
```

For Expo Router, place the import in the root layout when that is the entry
used by the project.

When Expo web is in scope, configure Metro as the web bundler:

```json
{
  "expo": {
    "web": {
      "bundler": "metro"
    }
  }
}
```

## TypeScript

Create `nativewind-env.d.ts` in a location included by `tsconfig.json`:

```ts
/// <reference types="nativewind/types" />
```

Do not name it `nativewind.d.ts`, match a sibling file or folder name such as
`app.d.ts` beside `app/`, or match a `node_modules` package name.

NativeWind's Metro wrapper can generate this file and update `tsconfig.json`.
Review those generated changes rather than assuming they occurred.

