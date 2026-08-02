# NativeWind v4 usage and interop

## Core and custom components

Use `className` directly on supported React Native core components:

```tsx
import { Text, View } from "react-native";

export function Card() {
  return (
    <View className="rounded-xl bg-white p-4">
      <Text className="text-base font-semibold text-slate-900">
        NativeWind v4
      </Text>
    </View>
  );
}
```

Text styles do not cascade through a React Native `View`. Put color and
typography classes on `Text`.

Custom components should accept and forward `className` when their underlying
component supports it:

```tsx
import type { ComponentProps } from "react";
import { Text } from "react-native";

type LabelProps = ComponentProps<typeof Text>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <Text
      className={`text-slate-900 ${className ?? ""}`}
      {...props}
    />
  );
}
```

Keep complete class names in source so Tailwind v3 can discover them. For
variants, map values to complete strings rather than constructing fragments
such as `bg-${color}-500`. When a class is missing, confirm it appears in the
Tailwind CLI output.

## Third-party components

First inspect the component source or types:

- If it forwards `className` to a supported native component, use it directly.
- If it exposes multiple style-like props, use `remapProps`.
- If it reads the resolved style object or needs a style property moved into a
  native prop, use `cssInterop`.

Use `remapProps` for multiple style props:

```tsx
import { remapProps } from "nativewind";
import { ThirdPartyButton } from "third-party-library";

const StyledButton = remapProps(ThirdPartyButton, {
  buttonClassName: "buttonStyle",
  labelClassName: "labelStyle",
});

<StyledButton
  buttonClassName="rounded-lg bg-blue-600 px-4 py-3"
  labelClassName="font-semibold text-white"
/>;
```

Use `cssInterop` when resolved values or prop extraction are required:

```tsx
import { cssInterop } from "nativewind";
import { ThirdPartyInput } from "third-party-library";

const StyledInput = cssInterop(ThirdPartyInput, {
  className: "style",
  placeholderClassName: {
    target: false,
    nativeStyleToProp: {
      color: "placeholderTextColor",
    },
  },
});
```

`cssInterop` adds runtime work. Do not use it for an ordinary custom component
that can forward `className`.

## Dark mode

For system-driven dark mode, keep Tailwind's default media strategy and use
explicit light and dark classes:

```tsx
<View className="bg-white dark:bg-slate-950">
  <Text className="text-slate-900 dark:text-slate-100">
    System theme
  </Text>
</View>
```

Expo apps that follow the device theme need
`"userInterfaceStyle": "automatic"` in Expo config.

For manual switching, set the v3 Tailwind config to class strategy:

```js
module.exports = {
  darkMode: "class",
  // remaining v4 configuration
};
```

Then use the NativeWind hook:

```tsx
import { useColorScheme } from "nativewind";

export function ThemeToggle() {
  const { colorScheme, setColorScheme, toggleColorScheme } =
    useColorScheme();

  // Render project UI that calls setColorScheme("light" | "dark" | "system")
  // or toggleColorScheme().
}
```

Published v4 source throws when `setColorScheme` or `toggleColorScheme` is
called while the compiled dark-mode strategy is `media`.

## CSS variables

Use `vars()` in a React Native `style` prop. Descendants can consume the
variables through complete NativeWind class strings:

```tsx
import { vars } from "nativewind";
import { Text, View } from "react-native";

export function BrandSection({ brandColor }: { brandColor: string }) {
  return (
    <View style={vars({ "--brand-color": brandColor })}>
      <Text className="text-[--brand-color]">Brand color</Text>
    </View>
  );
}
```

`useUnstableNativeVariable()` is explicitly unstable. Use it only when
JavaScript must read a resolved variable for a non-className API, and isolate
that dependency.

## Platform variants

NativeWind v4 documents these platform modifiers:

- `ios:`
- `android:`
- `web:`
- `windows:`
- `osx:`
- `native:` for non-web native platforms

Apply a modifier only when the component supports the resulting React Native
style and event props on that platform.

