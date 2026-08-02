# NativeWind v4 troubleshooting

Diagnose in this order so version problems, Tailwind generation, Metro
transformation, and runtime interop are not confused with one another.

## 1. Confirm the exact dependency graph

Use the active package manager without changing the lockfile. On this Windows
host, call the `.cmd` shim when PowerShell blocks an npm or npx script:

```powershell
npm.cmd ls expo react-native nativewind tailwindcss react-native-css-interop react-native-reanimated react-native-worklets react-native-safe-area-context
```

Confirm:

- `package.json`, the lockfile, and the installed graph agree; `npm ls` alone
  does not replace reading the lockfile.
- NativeWind is `4.x`.
- Tailwind CSS is `3.x`.
- `react-native-css-interop` matches the version pinned by NativeWind.
- The selected NativeWind 4.1 or 4.2 line matches the Reanimated or Worklets
  plugin that its own Babel preset loads.

If dependencies are not installed, inspect `package.json` and the active
lockfile instead of running an install merely to diagnose versions.

Do not solve `Cannot find module 'react-native-worklets/plugin'` by installing
an arbitrary similarly named package. First check whether the project has
crossed the NativeWind 4.1-to-4.2 and Reanimated 3-to-4 boundary.

## 2. Reset the relevant cache

Use the framework's cache-reset command when an interactive Metro session is
appropriate:

```powershell
npx.cmd expo start --clear
```

or:

```powershell
npx.cmd react-native start --reset-cache
```

Do not leave a long-running Metro process blocking an automated verification
run. Use the project's existing start/stop workflow.

## 3. Prove Tailwind v3 can generate the class

Compile the actual CSS entry to a temporary file:

```powershell
$nativewindOutput = Join-Path $env:TEMP "nativewind-v4-output.css"
npx.cmd tailwindcss --input .\global.css --output $nativewindOutput
Select-String -LiteralPath $nativewindOutput -Pattern "class-fragment"
```

For NativeWind v4, the input file contains the three `@tailwind` directives,
not Tailwind CSS v4 `@import` statements.

If the rule is absent, inspect:

- Tailwind `content` globs
- whether the source contains a complete class string
- the `nativewind/preset`
- the CSS entry path

Do not debug Metro or runtime interop until Tailwind generates the rule.

## 4. Trace the configuration chain

Check all of these:

- Expo Babel has both `jsxImportSource: "nativewind"` on
  `babel-preset-expo` and the `"nativewind/babel"` preset.
- Framework-less Babel includes `"nativewind/babel"`.
- Metro wraps the final existing config with `withNativeWind`.
- `withNativeWind` receives the real CSS `input` path.
- The app entry imports that same CSS file once.
- TypeScript includes `nativewind-env.d.ts`.

Do not replace custom Metro resolvers, transformers, or Babel plugins while
fixing one missing NativeWind link.

## 5. Run NativeWind's development doctor

Temporarily call `verifyInstallation()` inside a rendered component:

```tsx
import { verifyInstallation } from "nativewind";

export function NativeWindDiagnostic() {
  if (__DEV__) {
    verifyInstallation();
  }

  return null;
}
```

The published v4 doctor verifies the JSX transform, compiled data, and
`nativewind/preset` flag. Remove the temporary diagnostic after the result is
captured.

## 6. Enable debug output when needed

In PowerShell:

```powershell
$env:DEBUG = "nativewind"
npx.cmd expo start --clear
```

For framework-less React Native, replace the start command with the project's
normal reset-cache command. The Community CLI may spawn additional terminals;
each process needs the environment variable.

Clear the session variable after debugging:

```powershell
$env:DEBUG = $null
```

## 7. Verify the real target

Run the project's existing checks, then exercise a minimal component with:

- one layout class
- one background class
- one text class on `Text`
- one state, dark-mode, or platform variant if relevant

Compile the affected Android or iOS target when Babel, Metro, Reanimated,
Worklets, or native dependencies changed. A Tailwind CLI success alone does
not prove the native runtime works.

## Symptom map

### Tailwind CSS v4 or v5 imports appear in a v4 project

Restore Tailwind CSS v3 and the three `@tailwind` directives. Remove only the
v5-specific additions after confirming they are not used by another tool.

### `className` is missing from TypeScript types

Check `nativewind-env.d.ts`, its filename, and `tsconfig.json` inclusion. Then
check the Babel setup; a type declaration does not repair a missing JSX
transform.

### Classes compile but do not apply

Check the CSS import, Metro `input`, Babel transform, and
`verifyInstallation()`. If only a third-party component fails, inspect prop
forwarding before using interop.

### Manual dark-mode switching throws

Confirm Tailwind uses `darkMode: "class"`. The v4 hook intentionally rejects
manual set/toggle operations under media strategy.

### Text color on a parent `View` does nothing

Move the color class to `Text`. React Native text color does not cascade from a
`View`.
