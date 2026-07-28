---
name: apple-design
description: Apple's approach to fluid, physical interface motion, adapted for React Native. Use when building or reviewing gesture-driven UI, spring animations, drag/swipe/sheet interactions, momentum and interruptible transitions, rubber-banding, velocity handoff, haptics, reduced-motion, typography tracking and leading, or the design foundations (feedback, spatial consistency, restraint) behind Apple-style interfaces. Triggers on "feels laggy", "the drag feels off", "make the sheet feel native", spring config, damping, bounce, Reanimated, Gesture Handler, hitSlop, momentum, flick, snap points.
---

# Apple Design

How Apple builds interfaces that stop feeling like a computer and start feeling like an extension of you. This knowledge comes from Apple's WWDC design talks — chiefly *Designing Fluid Interfaces* (WWDC 2018) — distilled into the physics of interaction.

The through-line: **an interface feels alive when motion starts from the current on-screen value, inherits the user's velocity, projects momentum forward, and can be grabbed and reversed at any instant.** Springs are the tool that makes all of this natural, because they are inherently interruptible and velocity-aware.

## Scope and stack

**Target: React Native** with `react-native-reanimated` and `react-native-gesture-handler`.
This skill has been adapted from its web original; CSS-only guidance has been removed.

| Signal | What to do |
| --- | --- |
| `react-native`, `View`/`Pressable`, Reanimated, Gesture Handler | Full skill applies |
| `.kt` `@Composable`, `themes.xml`, launcher icon, splash | §1, §3, §7, §8, §10, §15, §16 only. Compose animations are interruptible by default; hand Material theming and insets to the `styles`, `edge-to-edge`, and `android-jetpack-compose` skills |
| Business logic, backend, build config, tests | Not a review surface |

**The legacy `Animated` API and `PanResponder` defeat this skill.** §3 (interruptibility) and §5
(velocity handoff) depend on retargeting a live value from the UI thread. If the code uses
`Animated.timing` or `PanResponder` for a gesture-driven surface, say so as the first finding —
no amount of tuning fixes it downstream.

**Removed from this skill.** The original had a *Materials & depth* section built on
`backdrop-filter` (translucent chrome, vibrancy, scroll edge effects). It is gone: React Native
has no `backdrop-filter`, and on Android an efficient blur needs SDK 31+ RenderNode, Expo warns
against rendering more than a few `BlurView`s at once, and `BlurView` does not work inside an RN
`Modal` — which is exactly the sheet/drawer backdrop this guidance recommends. Do not
reintroduce translucent-material advice, and do not report its absence as a gap.

**Precedence over `make-interfaces-feel-better`.** That skill states spring `bounce` must always
be `0`. **This skill wins for gesture-driven motion:** default to no overshoot, and add bounce
only when the gesture itself carried momentum (§4). For non-gesture state toggles — hover, press,
open/close — its rule stands.

## The Core Idea

> "When we align the interface to the way we think and move, something magical happens — it stops feeling like a computer and starts feeling like a seamless extension of us."

An interface is fluid when it behaves like the physical world: things respond instantly, move continuously, carry momentum, resist at boundaries, and can be redirected mid-motion. Everything below is a way to get closer to that.

Apple frames design as serving four human needs: **safety/predictability, understanding, achievement, and joy.** Every rule here serves one of them.

## 1. Response — kill latency

The moment lag appears, the feeling of directness "falls off a cliff." Response is the foundation everything else is built on.

- **Respond on press-in, not on release.** Use `onPressIn`, never `onPress`, for the visual reaction. Waiting for touch-up to show feedback feels dead.
- **Be vigilant about every latency.** Audit debounces, artificial timers, and any feedback that waits on a network round-trip or a JS-thread render. Anything on the input path that isn't essential is a regression.
- **Feedback must be continuous *during* the interaction, not just at the end.** For a drag, slider, or drawer, update the UI 1:1 with the finger the whole way through — never animate only when the gesture completes.

```tsx
// Feedback lives on the press, runs on the UI thread, and is interruptible
const scale = useSharedValue(1);
const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

<Pressable
  onPressIn={() => (scale.value = withTiming(0.97, { duration: 100 }))}
  onPressOut={() => (scale.value = withTiming(1, { duration: 100 }))}
>
  <Animated.View style={style}>{children}</Animated.View>
</Pressable>
```

> `Pressable`'s `style={({ pressed }) => …}` callback sets the value with no transition — it
> snaps in and out. Use it only when you want an instant, un-animated state change.

## 2. Direct manipulation — 1:1 tracking

> "Touch and content should move together."

When the user drags something, it must stay glued to the finger — and respect the offset from *where they grabbed it*. Snapping to the element's center on grab breaks the illusion immediately.

- Tracking must continue when the finger leaves the element's bounds. Native recognizers keep
  delivering `onUpdate` after activation, so there is no pointer-capture step to write — but
  verify it on device rather than assuming, especially inside scrollables.
- Capture the grab offset in `onBegin` (called when the handler starts recognizing) and subtract
  it from every `translationX` / `translationY`, so the element follows the point the user
  actually grabbed rather than snapping to its center.
- You do not need to track a velocity history by hand. `onEnd` hands you `velocityX` / `velocityY`
  directly; pass them straight to the spring (§5).

## 3. Interruptibility — the single most important principle

> "The thought and the gesture happen in parallel."

Every animation must be interruptible and redirectable at any moment. A user must be able to grab a moving element mid-flight and reverse it without waiting for the animation to finish. A closing modal the user grabs again should follow the finger — not finish closing first, then reopen.

- **Never lock out input during a transition.**
- **Always animate from the *presentation* (current) value, never the target value.** On interrupt, read the element's live on-screen transform and start the new animation from there. Starting from the logical/target value causes a visible jump.
- **Avoid fixed-duration timelines for anything gesture-driven.** `Animated.timing`, `Animated.sequence`, and looped keyframe-style animations can't be grabbed and reversed mid-flight. `withSpring` animates from the current value by default, which is exactly what interruption needs.
- **When a gesture reverses, blend velocity — don't hard-cut it.** Replacing one animation with another at a reversal creates a velocity discontinuity, a "brick wall." Spring libraries that carry velocity through a re-target avoid it. (This is what iOS's *additive animations* do natively; on the web, choose a spring library that re-targets from the current velocity.)
- **Decompose 2D motion into independent X and Y springs.** A single spring on a 2D distance desyncs when X and Y have different velocities.

## 4. Behavior over animation — use springs

> "Think of animation as a conversation between you and the object, not something prescribed by the interface."

A pre-scripted, fixed-duration animation can't respond to new input. A spring can — new input just changes the target, and the motion stays continuous. Reach for springs for anything a user can touch.

Apple deliberately replaced the physics triplet (mass/stiffness/damping) with two designer-friendly parameters. Think in these:

- **Damping ratio** — controls overshoot. `1.0` = critically damped, no bounce, smooth settle. `< 1.0` = overshoots and oscillates. Lower = bouncier.
- **Response** — how quickly the value reaches the target, in seconds. Lower = snappier. **This is not "duration"** — a spring has no fixed duration; its settle time emerges from the parameters.

**Defaults:**
- Start most UI at **damping `1.0`** (critically damped) — graceful and non-distracting.
- Add bounce (**damping ~`0.8`**) **only when the gesture itself carried momentum** (a flick, a throw, a drag release). Overshoot on a menu that just faded in feels wrong; overshoot on a card you flicked feels right.

**Concrete values Apple ships:**

| Interaction | Damping | Response (Apple, seconds) | Reanimated |
| --- | --- | --- | --- |
| Move / reposition (e.g. PiP) | `1.0` | `0.4` | `{ duration: 400, dampingRatio: 1.0 }` |
| Rotation | `0.8` | `0.4` | `{ duration: 400, dampingRatio: 0.8 }` |
| Drawer / sheet | `0.8` | `0.3` | `{ duration: 300, dampingRatio: 0.8 }` |

**Reanimated mapping — this is a direct translation, not an approximation.** Reanimated's
duration-based spring config takes exactly Apple's two parameters: `dampingRatio` is the damping
ratio, `duration` is the response. The values in the table above go in unchanged.

```tsx
// Critically damped default (no overshoot) — most UI
offset.value = withSpring(0, { duration: 400, dampingRatio: 1.0 });

// Momentum interaction — overshoot only because a flick preceded it
offset.value = withSpring(target, { duration: 400, dampingRatio: 0.8, velocity });
```

**Units: `duration` is in milliseconds.** Apple states response in seconds, so multiply by 1000 —
response `0.4` becomes `duration: 400`. Writing `duration: 0.4` produces a 0.4 ms animation, i.e.
an instant snap with no spring at all. This is the most common way this translation goes wrong.

`duration` + `dampingRatio` form one pair and `stiffness` + `damping` form the other; the two sets
are mutually exclusive and the duration-based pair takes precedence if both are supplied.
Reviewing existing code: hand-tuned `stiffness`/`damping` values are a smell — restate them in the
two-parameter form so the intent is legible.

> **Reanimated 4 changed spring behaviour.** `duration` is now a *perceptual* duration: actual
> completion takes about **1.5×** the value, so a `duration: 400` spring settles near 600 ms.
> `restDisplacementThreshold` / `restSpeedThreshold` were replaced by a single `energyThreshold`,
> and the defaults changed. Check the installed version before porting values between projects;
> Reanimated 3 defaults can be imported as `Reanimated3DefaultSpringConfigWithDuration`.

## 5. Velocity handoff — the seam between drag and animation

When a gesture ends, the animation must **continue at the finger's exact velocity**, so there's no visible seam between dragging and animating. This is the detail that most separates "fluid" from "fine."

Pass the pointer's release velocity as the spring's initial velocity. Some spring APIs want **relative** velocity — normalize it by the remaining distance to the target:

```
relativeVelocity = gestureVelocity / (targetValue − currentValue)
```

Example: element at `y=50`, target `y=150` (100px to go), finger moving 50px/s → normalized velocity = `50 / 100 = 0.5`. **Reanimated takes absolute px/s directly**, so hand it the raw value from the gesture — no normalization needed:

```tsx
Gesture.Pan().onEnd((e) => {
  offset.value = withSpring(target, { duration: 300, dampingRatio: 0.8, velocity: e.velocityY });
});
```

Dropping `velocity` is the single most common way this seam breaks: the drag stops dead, then a fresh animation starts from zero speed.

## 6. Momentum projection — animate to where the gesture is *going*

> "Take a small input and make a big output."

Don't snap to the nearest boundary from the *release point*. Use velocity to **project the resting position** — exactly like scroll deceleration — then snap to the target nearest that projected point. This is what makes a flick feel like it throws the element.

Apple's exact projection function (from the *Designing Fluid Interfaces* sample code):

```js
// decelerationRate ≈ 0.998 for normal scroll feel; 0.99 for snappier
function project(initialVelocity /* px/s */, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

const projectedEndpoint = currentPosition + project(releaseVelocity);
const target = nearestSnapPoint(projectedEndpoint);   // choose target from the projection
animateSpringTo(target, { velocity: releaseVelocity }); // then hand off velocity (§5)
```

Note: the physics-textbook `v²/(2·decel)` is *not* what Apple ships — use the exponential-decay form above.

If `@gorhom/bottom-sheet` is already in the project, do not hand-roll a competing snap. Its
`animationConfigs` hook has the signature `(point, velocity, callback) => number`, so the library
already receives release velocity and drives the snap from it; supply a spring config there rather
than intercepting the gesture yourself. Whether its internal landing calculation matches the
formula above is not documented — match the library's feel, and reserve the projection function
for surfaces you are building from scratch.

## 7. Spatial consistency — symmetric paths, anchored origins

> "If something disappears one way, we expect it to emerge from where it came."

- **Enter and exit along the same path.** A panel that slides in from the right must dismiss to the right. In-from-right / out-the-bottom feels disconnected and confusing.
- **Anchor interactions to their source.** A menu, popover, or sheet should originate from the element that triggered it, so the spatial relationship between button and content is obvious — scale from the trigger, not from the center. React Native does expose a `transformOrigin` style prop (numeric, percentage, or array form), but it is a relatively recent addition — confirm it exists in the installed version before relying on it, and otherwise offset the element and compensate with `translate` to fake the origin.
- **Mirror the easing on reversible transitions** so the outbound path matches the return path (use inverse cubic-bézier control points for the two directions).

## 8. Hint in the direction of the gesture

Humans predict a final state from a trajectory. Intermediate motion should telegraph where things are going — Control Center modules "grow up and out toward your finger." Make the in-between frames point at the outcome, not just interpolate blindly to it.

## 9. Rubber-banding — soft boundaries

At an edge, resist progressively instead of stopping hard. A hard stop reads as "frozen"; continuous resistance reads as "responsive, but there's nothing more here." Apply damping that increases the further past the boundary the user drags.

```js
// The further past the bound, the less the element follows — real things slow before they stop
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

## 10. Gesture design details (the "feel" checklist)

- **Tap:** highlight on touch-*down* (instant), commit on touch-*up*. Add ~10px of hysteresis/hit padding around the target, and allow cancel-by-dragging-away and back.
- **Drag/swipe:** require a small movement threshold (hysteresis, ~10px) before committing to a direction, then track 1:1.
- **Detect all plausible gestures in parallel from the first move**, then confidently cancel the losers once intent is clear. Avoid recognizers that only report a *final* state (`swipeleft`-type events) — they throw away the continuous tracking you need for feedback.
- **Minimize disambiguation delays.** Double-tap detection unavoidably delays single taps; only pay that cost where double-tap truly exists.

## 11. Frame-level smoothness

Smoothness is about *what's in the frames*, not just the frame rate.

- Keep the per-frame positional change below the perception threshold to avoid strobing.
- For very fast motion, a subtle **motion blur / stretch** encodes speed and reads better than a hard sharp streak.
- Keep animation off the JS thread. Reanimated worklets run on the UI thread and stay smooth while JS is busy; the legacy `Animated` API without `useNativeDriver` does not. Animate `transform` and `opacity` — the properties the native driver can handle. There is no `will-change` equivalent and none is needed.

## 12. Multimodal feedback — motion + sound + haptics

Three rules for combining senses (from *Designing Audio-Haptic Experiences*):

1. **Causality** — it must be obvious what caused the feedback. Trigger it on the actual causal event (the toggle flipping, the item snapping home), and match its character to the action's physicality.
2. **Harmony** — the visual, the sound, and the haptic must fire on the **same frame**. Latency between them destroys the illusion. Fire the haptic from the same gesture callback that starts the animation, not from a completion handler.

**Android caveat — do not reach for `impactAsync` by reflex.** `Haptics.impactAsync()` and
`Haptics.notificationAsync()` map directly to iOS's `UIImpactFeedbackGenerator` /
`UINotificationFeedbackType`, but on Android they are **simulated with the `Vibrator` API**,
which needs the `VIBRATE` permission and does not feel like real haptics. Expo's own docs
recommend **`Haptics.performAndroidHapticsAsync()`** on Android instead — it is closer to iOS
behaviour and requires no permission. On an Android-first app, branch on `Platform.OS` or
default to the Android-native call.
3. **Utility** — add feedback only where it earns its place. Reserve haptics/sound for meaningful moments (success, error, commit, snap). Over-feedback trains users to ignore all of it.

## 13. Reduced motion & accessibility

Reduced motion doesn't mean *no* feedback — it means a gentler, non-vestibular equivalent. Read the signal from `AccessibilityInfo` and bake the response into your components:

- **Reduce motion** (`AccessibilityInfo.isReduceMotionEnabled()`, plus the `reduceMotionChanged` listener) — replace slides/springs/parallax with a short opacity cross-fade. Drop elastic/overshoot. Keep opacity/color changes that aid comprehension. Reanimated also accepts a `reduceMotion` option per animation and a global `ReducedMotionConfig`.
- **Reduce transparency** (`AccessibilityInfo.isReduceTransparencyEnabled(): Promise<boolean>`, **iOS only**) — raise background opacity and drop the blur on any translucent surface. There is no Android equivalent, so guard the call with `Platform.OS === 'ios'` and treat Android as "setting unavailable" rather than "setting off".

```tsx
const [reduceTransparency, setReduceTransparency] = useState(false);
useEffect(() => {
  if (Platform.OS !== 'ios') return;
  AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
}, []);
```

Also: avoid full-viewport moving backgrounds, slow looping oscillations (near 0.2 Hz / one cycle per 5s), and abrupt brightness jumps (ease dark↔light theme changes). Make large moving objects semi-transparent while they travel, and fade big surfaces out during a large reposition and back in once settled.

```tsx
const [reduceMotion, setReduceMotion] = useState(false);
useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
  return () => sub.remove();
}, []);

// Remove the movement, keep the state change
offset.value = reduceMotion
  ? target
  : withSpring(target, { duration: 400, dampingRatio: 1 });
```

> The web `prefers-contrast: more` signal has no direct React Native equivalent. Android exposes
> `isHighTextContrastEnabled()`; iOS does not expose a matching API. Do not report its absence
> as a finding.

## 14. Typography — optical sizing, tracking, leading

Apple designs type to change shape with size; the same discipline applies here. (From *The Details of UI Typography*, WWDC 2020.)

- **Tracking (`letterSpacing`) is size-specific — never one value for all sizes.** Large display text wants *negative* tracking (letters read too far apart as they grow); small text wants slightly *positive* tracking for legibility. A single shared value is wrong somewhere. Tighten headings, leave body near `0`.
- **Leading (`lineHeight`) tracks size inversely.** Tight on large headings, looser on body copy. Tighten it for dense, information-heavy UI.
- **Build hierarchy from weight + size + leading as a set,** not size alone. Emphasize with weight — it adds presence without taking more space.
- **Respect the user's text-size setting.** React Native scales text by the OS font setting unless you set `allowFontScaling={false}` — do not disable it to protect a layout. Read `PixelRatio.getFontScale()` and let containers grow instead of clipping.
- **Default to the platform's system font** before a custom face; it already ships optical sizing, tracking tables, and legibility tuning. Override only with a reason.

```tsx
const styles = StyleSheet.create({
  display: { fontSize: 34, lineHeight: 36, letterSpacing: -0.7, fontWeight: '700' },
  body:    { fontSize: 16, lineHeight: 24, letterSpacing: 0 },
});
```

> React Native takes `letterSpacing` and `lineHeight` in **px only** — there is no `em`,
> unitless leading, `clamp()`, or `font-optical-sizing`. Convert proportional values by hand:
> `-0.02em` at 34px ≈ `letterSpacing: -0.7`. Do not report the missing CSS features as findings.

## 15. Design foundations — the eight principles

The motion and craft above serve Apple's eight design principles (*Principles of Great Design*, WWDC 2026). Use these as the names you reason with:

1. **Purpose.** Make with intention; decide what *not* to build. Every feature asks for the user's time, attention, and trust — spend that budget only where it pays off.
2. **Agency.** Keep people in control: offer choices, don't force a single path. Back it with forgiveness — easy undo for slips, a confirmation dialog only for genuinely destructive, irreversible actions (use sparingly; overusing it trains people to click through).
3. **Responsibility.** Act in the user's interest. Privacy: ask at the right moment, only for what's needed, transparently. Safety: anticipate misuse and harm — especially with AI (an allergy-aware recipe app must not suggest a harmful ingredient). Add previews, confirmations, disclaimers; cut a feature whose risk outweighs its value.
4. **Familiarity.** Build on what people already know. Use metaphors that are neither too literal nor too abstract (a trash can means delete), and honor their physics. Be consistent: things that look the same must behave the same and live in the same place (close is always top-left on macOS) so people can predict what happens next. Only break a familiar pattern if you can prove it's better — then test it, don't assume.
5. **Flexibility.** Design for different contexts, devices, and the full range of abilities. Adapt to the platform (iPhone = quick touch; desktop = deep workflows with precise pointer control) and to the situation. Design inclusively (age, language, expertise, accessibility). When no single layout fits everyone, let people personalize — rearrange controls, hide what they don't use.
6. **Simplicity — not minimalism.** Strip the unnecessary so the core purpose shines; burying everything in one place looks minimal but isn't simple. Be concise (plain language, no jargon, fewer steps) and clear (use hierarchy — order, spacing, contrast — so the most important thing is the most obvious). Every element earns its place; sometimes *adding* context simplifies (a video scrubber that shows time remaining). Show the common path first, advanced options one level deeper.
7. **Craft.** Uncompromising attention to detail builds trust. Beautiful typography, colors that adapt to light/dark, clear iconography, and responsive animations that give immediate, natural feedback. Nothing is random — every spacing, timing, and alignment value is a deliberate choice you can defend. Jittery scroll, misaligned icons, and layouts that break on rotation read as carelessness. Craft needs iteration and longevity — keep evolving the design as features and hardware change.
8. **Delight.** The result of getting the other seven right, not confetti tacked on top. Decide the emotion you want people to feel (calm, confident, excited) and reinforce it in every decision.

Tactical rules that serve these:

- **Feedback comes in four kinds:** status, completion, warning, error. Confirm meaningful actions, expose ongoing status, warn before problems, validate inline (not on submit).
- **Wayfinding.** Every screen should answer: Where am I? Where can I go? What's there? How do I get out? Never trap the user.
- **Grouping & mapping.** Proximity implies relationship; place a control near what it affects and arrange controls to mirror what they change. If you need a label to explain a control, the mapping is weak.
- **Direct, specific labels beat safe generic ones.** Name nav items for their contents ("Progress", "Library"), not vague umbrellas ("Home"). Specificity creates predictability.

## 16. Process

- **Prototype interactively — an interactive demo is worth "a million static designs."** You discover the interface by building and playing with it; a working prototype also sets a concrete bar that prevents a mediocre final implementation.
- **Design interaction and visuals together.** "You shouldn't be able to tell where one ends and the other begins." Motion is not a layer added after the pixels.
- **Test with real people in real context**, and review motion with fresh eyes — play it in slow motion / frame-by-frame to catch what's invisible at full speed.

## Quick Reference

| Need | Technique | Concrete value |
| --- | --- | --- |
| Default UI spring | Critically damped, no overshoot | `withSpring(t, { duration: 400, dampingRatio: 1.0 })` |
| Momentum / flick spring | Under-damped, slight bounce | `withSpring(t, { duration: 300, dampingRatio: 0.8 })` |
| Gesture → spring velocity | Hand off release velocity | `velocity: e.velocityY` from `onEnd` (absolute px/s) |
| Flick landing point | Project momentum | `current + (v/1000)·d/(1−d)`, `d ≈ 0.998` |
| Interrupt cleanly | Retarget the live shared value | `withSpring` starts from the current value by default |
| Avoid reversal "brick wall" | Carry velocity through re-target | pass `velocity` on every retarget |
| Decide reverse vs. commit | Use velocity **sign**, not position | at `onEnd` |
| 1:1 drag | `Gesture.Pan()` | subtract the grab offset captured in `onBegin` |
| Feedback | On `onPressIn`, continuous | never only at the end |
| Boundary | Rubber-band, don't hard-stop | `(o·d·c)/(d+c·\|o\|)`, `c = 0.55` |
| Gesture hysteresis | Commit only past a threshold | `activeOffsetX([-10, 10])`, `failOffsetY()` |
| Haptics | Fire with the visual, not after | `expo-haptics` from the gesture callback |
| Type tracking | Size-specific, never fixed | px only: `-0.7` at 34px, body `0` |
| Reduced motion | Cross-fade, not slide/spring | `AccessibilityInfo.isReduceMotionEnabled()` |
| Off the JS thread | Reanimated worklets | not `Animated.timing` / `PanResponder` |
