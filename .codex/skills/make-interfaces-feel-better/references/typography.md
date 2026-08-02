# Typography

Type system scope and numeral rendering.

> Text wrapping (`text-wrap: balance` / `pretty`) and macOS font smoothing were removed
> from this skill: React Native implements neither. Do not reintroduce them.

## Font Family Scope

This skill does not require a specific font family. Do not introduce a paid or proprietary typeface just to satisfy the polish checklist.

Use the product's existing type system unless the task explicitly asks for a type change. If the design calls for a system-native macOS feel, use the system font stack. If the design calls for a commercial face such as Helvetica Now, treat it as an optional brand decision and keep a practical fallback stack.

```css
/* System-native macOS/iOS feel */
html {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

```css
/* Commercial brand face with safe fallbacks */
html {
  font-family: "Helvetica Now", "Helvetica Neue", Arial, sans-serif;
}
```

**Rule:** font smoothing, text wrapping, and tabular numbers are rendering details. They do not override the project's chosen font family.

## Tabular Numbers

When numbers update dynamically (counters, prices, timers, table columns), use tabular-nums to make all digits equal width. This prevents layout shift as values change.

```css
/* CSS */
.counter {
  font-variant-numeric: tabular-nums;
}
```

```tsx
// Tailwind
<span className="tabular-nums">{count}</span>
```

### When to Use

| Use tabular-nums | Don't use tabular-nums |
| --- | --- |
| Counters and timers | Static display numbers |
| Prices that update | Decorative large numbers |
| Table columns with numbers | Phone numbers, zip codes |
| Animated number transitions | Version numbers (v2.1.0) |
| Scoreboards, dashboards | |

### Caveat

Some fonts (like Inter) change the visual appearance of numerals with this property — specifically, the digit `1` becomes wider and centered. This is expected behavior and usually desirable for alignment, but verify it looks right in your specific font.

```css
/* With Inter font:
   Default:  1234  → proportional, "1" is narrow
   Tabular:  1234  → all digits equal width, "1" centered */
```
