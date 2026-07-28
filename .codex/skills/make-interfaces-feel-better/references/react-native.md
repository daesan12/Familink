# React Native

The other reference files in this skill are written for the web DOM. React Native
implements a **subset of CSS with different names and no cascade**. This file maps every
core principle to RN so a review never proposes a property that does not exist.

Read this file before reviewing any project with `react-native` in `package.json`.

## Verdict table

| # | Principle | RN status | Replacement |
| --- | --- | --- | --- |
| 1 | Concentric border radius | ✅ Same | `borderRadius` on nested `View`s; identical math |
| 2 | Optical alignment | ✅ Same | Asymmetric `paddingLeft` / `paddingRight`, `marginLeft` on the glyph |
| 3 | Shadows for elevation | ⚠️ Different API | See [Shadows](#shadows) — no multi-layer `box-shadow` before RN 0.76 |
| 4 | Interruptible animations | ✅ Same idea | Reanimated `withTiming` / `withSpring` retarget mid-flight; avoid `Animated.sequence` for interactive state |
| — | **Duration units differ by library** | ⚠️ **Read this** | Motion / Framer Motion take `duration` in **seconds** (`0.3`); Reanimated takes it in **milliseconds** (`300`). The web examples in these reference files use Motion values — multiply by 1000 before putting them in `withTiming` / `withSpring`. Copying `duration: 0.3` into Reanimated yields a 0.3 ms animation, i.e. an instant snap |
| 5 | Split and stagger enter | ✅ Same | Reanimated `FadeInDown.delay(n)` or `entering` per child |
| 6 | Subtle exit animations | ✅ Same | Reanimated `exiting={FadeOut.duration(150)}`; keep exits shorter than enters |
| 7 | Contextual icon animations | ⚠️ Partial | `opacity` + `transform: [{ scale }]` transfer. **`blur` does not** — see [Blur](#blur) |
| 8 | Tabular numbers | ✅ Same | `fontVariant: ['tabular-nums']` on the `Text` style |
| 9 | Scale on press | ✅ Same | See [Scale on press](#scale-on-press) |
| 10 | Skip animation on page load | ✅ Same idea | Gate `entering` behind a mounted ref, or use `layout` without `entering` |
| 11 | Never `transition: all` | ➖ Moot | RN has no `transition` property; you animate explicit shared values. The underlying rule (animate only what changes) still holds |
| 12 | Minimum hit area | ✅ **More important** | Use `hitSlop` — see [Hit area](#hit-area). No pseudo-elements in RN |
| 13 | Icon stroke to text weight | ✅ Same | `react-native-svg` `strokeWidth`; same 1.5 / 2 / 2.5 mapping |
| 14 | One SVG, recolored per state | ⚠️ Different API | No `currentColor` inheritance. Pass an explicit `color`/`fill` prop from state |
| 15 | Motion restraint | ✅ Same | Plus `AccessibilityInfo.isReduceMotionEnabled()` — see [Reduced motion](#reduced-motion) |

**Summary of the 15 remaining principles:** 9 transfer unchanged, 5 need a different API,
1 is moot.

### Removed from this skill

Four principles from the upstream skill were **deleted** because React Native implements
nothing equivalent. They are listed here so nobody re-adds them as a "missing" rule:

| Upstream principle | Why it is gone | If you need the behaviour anyway |
| --- | --- | --- |
| Font smoothing | No `-webkit-font-smoothing`; RN uses platform text rendering | Nothing to do — omit |
| Text wrapping (`balance` / `pretty`) | No `text-wrap` property | `numberOfLines`, `adjustsFontSizeToFit`, or rewrite the copy |
| Image outlines | No `outline` / `outline-offset` | `borderWidth: 1` + `borderColor: 'rgba(0,0,0,0.1)'` on the `Image` — RN borders are inset, so layout is unaffected |
| `will-change` | No compositor hint property | Nothing to do. `renderToHardwareTextureAndroid` / `shouldRasterizeIOS` exist but cost memory — do not add preemptively |

---

## Hit area

RN has no pseudo-elements, so the `::after` technique in `surfaces.md` does not apply.
`hitSlop` is the direct replacement and expands the touch target without affecting layout.

```tsx
// Good — 20×20 visual, 44×44 touch target
<Pressable
  hitSlop={12}                      // 20 + 12 + 12 = 44
  style={{ width: 20, height: 20 }}
>
  <CheckIcon />
</Pressable>
```

```tsx
// Per-side control when a neighbour is close
<Pressable hitSlop={{ top: 12, bottom: 12, left: 12, right: 4 }}>
  <CheckIcon />
</Pressable>
```

### `hitSlop` is clipped by the parent — check this first

**The extended touch area never reaches past the parent view's bounds.** A `hitSlop` of 12 on a
20×20 control inside a tightly-sized parent expands nothing: the parent clips it. This is the
React Native equivalent of the replaced-element trap in `surfaces.md`, and it fails the same
way — silently, with no warning.

When reviewing, do not accept the presence of a `hitSlop` prop as evidence the target is large
enough. Trace up to the nearest parent with a fixed `width` / `height` / `padding` and confirm
there is room for the slop to expand into. If there isn't, the fix is padding on the parent (or
moving the `Pressable` up a level), not a bigger `hitSlop`.

Two further constraints:

- **Sibling Z-index wins.** If two views overlap, the higher sibling takes the touch regardless
  of whose `hitSlop` covers the point.
- **Touch area only, not visual.** `hitSlop` does not satisfy a requirement to make the control
  itself bigger, and it does not enlarge the focus or hover surface.

The collision rule from `surfaces.md` still applies: two touch targets must never overlap.
`hitSlop` regions are invisible, so overlap is easy to introduce and hard to notice — when two
controls sit closer than the combined slop, shrink the facing sides.

## Scale on press

```tsx
// Reanimated — interruptible, matches the 0.96 value from animations.md
const scale = useSharedValue(1);
const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

<Pressable
  onPressIn={() => (scale.value = withTiming(0.96, { duration: 150 }))}
  onPressOut={() => (scale.value = withTiming(1, { duration: 150 }))}
>
  <Animated.View style={style}>{children}</Animated.View>
</Pressable>
```

Do not use `Pressable`'s `style={({ pressed }) => ...}` callback with a raw scale value for
this — it snaps instead of transitioning, which is the RN equivalent of the transition
placement bug described in `animations.md`.

## Shadows

RN before 0.76 has no multi-layer shadow, so the three-layer `--shadow-border` recipe in
`surfaces.md` cannot be reproduced directly.

```tsx
// RN 0.76+ AND New Architecture — boxShadow accepts CSS-like string or object syntax
style={{ boxShadow: '0px 0px 0px 1px rgba(0,0,0,0.06), 0px 1px 2px -1px rgba(0,0,0,0.06)' }}
```

> **`boxShadow` is New Architecture-exclusive.** It shipped in 0.76 alongside `filter` as a
> New-Architecture-only style prop. On a 0.76+ app still running the old architecture it does
> nothing. Check `newArchEnabled` before proposing it — a silently ignored style is worse than
> the platform-split fallback.

```tsx
// Older RN, or old architecture — single shadow, platform-split
style={Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  android: { elevation: 2 },
})}
```

Android `elevation` renders a system shadow you cannot fully control, so exact parity with
an iOS or web shadow is not achievable. When a design demands identical depth across
platforms, say so in the review rather than proposing values that will diverge.

The "shadows for elevation, borders for structure" split still holds. Dividers stay
`borderBottomWidth`.

## Blur

`filter: blur()` is not a React Native style. The `blur` half of the contextual icon
animation in `animations.md` has no equivalent without a native dependency.

- **Default:** animate `opacity` and `scale` only. Keep the same values — scale `0.25 → 1`,
  opacity `0 → 1`. Drop the blur rather than substituting something else.
- Do not add `@react-native-community/blur` or `expo-blur` just to animate an icon. Those
  render a blur *view*, not a blur *filter* on a subtree, and cost real performance.

## Reduced motion

`animations.md` states the reduced-motion rule but gives no code. In RN:

```tsx
import { AccessibilityInfo } from 'react-native';

const [reduceMotion, setReduceMotion] = useState(false);
useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
  return () => sub.remove();
}, []);

// Preserve the static cue, remove the movement
const entering = reduceMotion ? undefined : FadeInDown.duration(300);
```

For layout animations there is a shorter path — every entering/exiting preset takes a
`.reduceMotion()` modifier, so you often do not need the state above at all:

```tsx
<Animated.View entering={FadeInDown.duration(300).reduceMotion(ReduceMotion.System)} />
```

`ReduceMotion` is an enum of `System` / `Always` / `Never`. `<ReducedMotionConfig mode={…} />`
sets the default app-wide. The rule from `animations.md` is unchanged: **remove the movement,
keep the static cue** (color, icon, or label). Never remove the state change itself.

## RTL

`icons.md` uses `scale: -1 1`. In RN:

```tsx
import { I18nManager } from 'react-native';

<Icon style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
```

The flip / don't-flip table in `icons.md` applies unchanged. Note that RN already mirrors
`flexDirection: 'row'` and `start`/`end` insets automatically in RTL, so flipping a
container manually usually double-mirrors it.

## Styling system detection

The instruction in `SKILL.md` — express fixes in the project's existing styling system —
matters more in RN because there are several in common use:

| Signal | Write fixes as |
| --- | --- |
| `StyleSheet.create` in the files being reviewed | `StyleSheet` objects |
| `nativewind` in `package.json` | Tailwind classes, but verify the NativeWind version supports the utility |
| `tamagui`, `@shopify/restyle`, `styled-components/native` | That library's tokens and props |

If the project uses NativeWind, the Tailwind v3 / v4 caveat in `SKILL.md` still applies and
is harder to check: NativeWind's supported utility set trails upstream Tailwind. Prefer
`StyleSheet` for anything using an arbitrary value like `scale-[0.96]` unless you have
confirmed NativeWind compiles it.

## What to report when the platform is RN

Principle 11 (`transition: all`) is moot on RN — there is no `transition` property to
misuse. Do not spend a finding on it; the underlying "animate only what changes" rule is
already satisfied by Reanimated's explicit shared values.

The four removed principles above are not findings either. Never report "this component is
missing font smoothing / text-wrap / an image outline / `will-change`" on a React Native
surface — those properties do not exist and the advice cannot be applied.

**Performance** is the category most likely to come back empty on RN, since its only
remaining section is transition specificity. When that happens, mark it `Not reviewed` with
the reason "no React Native equivalent" rather than padding the report to fill the cap.
