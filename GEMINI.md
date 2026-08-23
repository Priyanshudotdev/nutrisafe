# Expo Mobile App Redesign Specification

## 1. Project Objective

Redesign the existing Expo React Native mobile application to closely match the provided UI/UX design reference.

The implementation must use:

- Expo
- React Native
- TypeScript
- HeroUI Native / HeroUI Expo Native components
- Existing project architecture wherever practical
- Existing business logic, API integrations, authentication, navigation, and data flow unless explicitly instructed otherwise

The primary goal is:

> Rebuild the application's visual design and mobile experience from the provided SVG and CSS design references while keeping the existing application functionality intact.

Do NOT blindly convert the supplied CSS into React Native styles.

The supplied SVG/CSS represents the **visual design specification**, not the implementation technology.

Translate the design into idiomatic React Native + HeroUI Native components.

---

# 2. Design Source of Truth

The project contains two major design references:

1. SVG design export
2. CSS/Figma-style design export

Treat these files as the primary visual source of truth.

The SVG contains the actual visual composition, dimensions, colors, typography, icons, illustrations, charts, and positioning.

The CSS contains detailed measurements and design-token information.

Important examples from the design:

- Mobile viewport: `375 × 812`
- Large desktop/header layouts also exist in the source export.
- Primary dark color: `#030319`
- Primary dark green: `#105D38`
- Primary green: `#4CD080`
- Secondary orange: `#FFAE58`
- Light green: `#E3FFEE`
- Light gray: `#F2F2F2`
- Gray text: `#8F92A1`
- Medium gray: `#BDBDBD`
- White: `#FFFFFF`

The design uses DM Sans extensively for application content and Poppins for some major navigation/header typography.

For example, the Home header uses Poppins with:

- Weight: 600
- Size: 40px
- Letter spacing: 0.08em
- Uppercase
- White text

The transaction UI uses DM Sans with bold 16px text and 12px metadata.
---

# 3. Core Design Philosophy

The redesign should feel:

- Modern
- Minimal
- Premium
- Financial/productivity focused
- Clean
- Spacious
- Mobile-first
- Highly readable
- Consistent
- Native to Android/iOS
- Visually close to the supplied reference

Avoid:

- Excessive gradients
- Excessive shadows
- Random colors
- Generic rounded cards everywhere
- Default React Native components when HeroUI equivalents exist
- Inconsistent border radii
- Inconsistent spacing
- Random font sizes
- Web-style layouts squeezed into mobile
- Desktop-first responsive behavior

The application should look intentionally designed for mobile.

---

# 4. IMPORTANT IMPLEMENTATION RULE

Do NOT recreate the design using hundreds of absolute-positioned elements.

The original CSS contains absolute positions because it was exported from a design tool.

Do not copy that architecture directly.

Instead:

- Use Flexbox
- Use React Native layout primitives
- Use HeroUI Native components
- Use ScrollView / FlatList
- Use SafeAreaView / safe-area handling
- Use responsive dimensions
- Use reusable components
- Use spacing tokens
- Use semantic layouts

Absolute positioning is allowed only where it is genuinely necessary, such as:

- Floating buttons
- Chart overlays
- Decorative elements
- Icon overlays
- Badges
- Custom graph elements

---

# 5. Design Tokens

Create a central theme/token system.

Example:

```ts
export const colors = {
  background: "#FFFFFF",
  dark: "#030319",

  primaryDark: "#105D38",
  primary: "#4CD080",

  secondary: "#FFAE58",

  successBackground: "#E3FFEE",

  gray1: "#F2F2F2",
  gray2: "#E0E0E0",
  gray3: "#BDBDBD",
  gray4: "#8F92A1",

  white: "#FFFFFF",
  black: "#030319",
};
```

Do not scatter raw colors throughout components.

Use the centralized theme wherever possible.

---

# 6. Typography

The application should use the design's typography hierarchy.

Primary application font:

```text
DM Sans
```

Display/navigation font:

```text
Poppins
```

Create reusable typography variants such as:

```text
display
heading1
heading2
heading3
large
normal
medium
small
xsmall
caption
```

Approximate hierarchy:

```text
H1:
32-40px
Bold/Semibold

H2:
24px
Bold

H3:
20px
Bold

Large:
18px

Normal:
16px

Small:
14px

XSmall:
12px
```

Do not arbitrarily introduce new font sizes.

When the reference clearly specifies a size, preserve it.

---

# 7. Spacing System

The reference primarily uses compact multiples of common spacing values.

Create a spacing system:

```ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};
```

Prefer these tokens over arbitrary values.

The main mobile content width is generally:

```text
375 - 32 = 343px
```

This means the standard horizontal page padding is:

```text
16px
```

The statistic screen explicitly uses 343px wide content areas positioned at 16px from each side.

---

# 8. Border Radius System

Create reusable radius tokens.

```ts
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  pill: 999,
};
```

Reference examples include:

- 16px transaction icon radius
- 16px chart elements
- 24px payment icon containers
- 32px payment bottom sheets
- 50px/pill segmented controls

The payment QR bottom sheet uses a `32px 32px 0 0` top radius.

---

# 9. Screen Architecture

Identify and redesign all screens represented by the supplied design.

At minimum, account for these flows:

## Home

Purpose:

- Dashboard
- Current financial information
- Quick actions
- Recent transactions
- Navigation

Reference background:

```text
#FFFFFF
```

There is also a dark header/navigation treatment using:

```text
#030319
```

The exported design contains a Home section with a dark 830×108 header.

---

# 10. Statistics Screen

The Statistics screen is a long mobile screen:

```text
375 × 1192
```

Background:

```text
#FFFFFF
```

Major sections include:

1. Header
2. Chart
3. Income / Expenses segmented control
4. Category chart
5. Category legend
6. Recent Expenses
7. Recent transaction list

The source specifies:

```text
Category Chart:
343px wide

Segmented Bar:
343px wide
54px high

Pie Chart:
200px × 200px

Recent Expenses:
343px wide
```

The category chart contains:

- Transportation
- Shopping
- Coffee

with colors:

```text
Transportation: #FFAE58
Shopping: #4CD080
Coffee: #105D38
```

These colors and chart labels are explicitly present in the source design.
---

# 11. Statistics Chart

Recreate the visual hierarchy of the supplied bar chart.

The reference contains:

- Monday
- Tuesday
- Wednesday
- Thursday
- etc.

Each day can contain two stacked/paired values:

```text
Orange = secondary/category value
Green = primary/category value
```

Reference bar styling:

```text
width: approximately 10px
border-radius: 8px
```

Do not use a generic third-party chart that visibly changes the design.

If a chart library is already installed, evaluate whether it can reproduce the reference.

Otherwise create a lightweight custom React Native chart.

The chart must:

- Scale correctly on different device widths
- Maintain visual proportions
- Have readable labels
- Avoid clipping
- Respect safe areas
- Animate subtly if animation is already supported by the app

Do not add excessive chart animation.

---

# 12. Recent Expenses

Create a reusable transaction component.

Example visual structure:

```text
┌────────────────────────────────────┐
│ [ICON]  Starbucks Coffee   -$156   │
│         Dec 2, 2020 • 3:09 PM      │
├────────────────────────────────────┤
│ [ICON]  Netflix Subscription -$87  │
│         Dec 11, 2020 • 10:02 AM    │
└────────────────────────────────────┘
```

Transaction icon:

```text
48 × 48
border-radius: 16px
```

Transaction title:

```text
DM Sans
16px
700
#030319
```

Metadata:

```text
DM Sans
12px
400
#8F92A1
```

Amount:

```text
DM Sans
16px
700
#030319
```

The reference specifically uses Starbucks and Netflix transaction examples.
Use real application data instead of hardcoded transaction content when the existing app already provides it.

---

# 13. Bottom Navigation

Build a reusable bottom navigation component.

The reference contains navigation items such as:

- Home
- Scan
- Account

The central action uses an orange circular treatment:

```text
#FFAE58
```

with approximately:

```text
56 × 56
```

The source shows a 56px orange circular navigation element around the center action.

Inactive navigation elements use:

```text
#BDBDBD
```

The navigation should:

- Respect device safe area
- Stay fixed at the bottom
- Avoid keyboard overlap
- Have proper touch targets
- Animate only subtly
- Clearly indicate the active route

Do not create tiny touch targets.

Minimum practical touch target:

```text
44 × 44
```

---

# 14. Payment Flow

The payment flow is one of the most important parts of the redesign.

The design uses a strong green background:

```text
#105D38
```

Payment-related screens include:

- Payment
- Payment Summary
- Payment Scan
- Payment Success
- Payment Failure / State
- Payment with QR

Preserve the visual distinction between these states.

---

# 15. Payment Screen

The payment screen should use:

```text
background: #105D38
```

Primary text:

```text
#FFFFFF
```

Secondary/accent information:

```text
#FFAE58
```

The reference contains:

```text
Payment for
Starbucks Coffee
Payment on Dec 2, 2020
```

with:

```text
Starbucks Coffee:
24px
700
white

Payment date:
14px
500
#FFAE58
```

The merchant icon is:

```text
80 × 80
border-radius: 24px
background: #E3FFEE
```

These values come directly from the supplied design.

---

# 16. Payment QR Screen

The QR payment UI uses a white bottom sheet over the green background.

Reference:

```text
width: 375px
height: 241px
background: #FFFFFF
border-radius:
32px 32px 0 0
```

Title:

```text
Payment with QR Code
18px
700
#030319
```

Description:

```text
14px
400
#8F92A1
```

The reference explicitly states:

```text
Hold the code inside the frame, it will be scanned automatically
```

Do not alter the meaning of this instruction.

---

# 17. Scan To Pay

The scan screen uses a dark green background.

Top area:

```text
Back button
Scan to Pay title
Help action
```

The reference shows:

```text
Scan to Pay
20px
700
white
```

Back button:

```text
40 × 40
border-radius: 12px
white border
low opacity
```

Use HeroUI Native buttons where appropriate.

The scanner itself should use the existing camera/scanner implementation if one exists.

Do not break scanner functionality while redesigning the UI.

---

# 18. Payment Success

The successful payment state should maintain the green visual identity.

Use:

```text
#105D38
```

as the dominant background.

Success content should be centered and visually obvious.

Use:

- Success icon
- Merchant information
- Amount
- Date/time
- Transaction summary
- Primary action

Do not introduce unnecessary cards if the reference uses a flat green composition.

---

# 19. Notifications

The notification screen uses the same green visual identity in the supplied Android specification:

```text
#105D38
```

The redesign should preserve this relationship with the payment/success screens while still making notifications readable.

Use HeroUI list/card primitives where appropriate.

Notifications should have:

- Clear hierarchy
- Timestamp
- Read/unread state
- Appropriate icons
- Large touch targets

---

# 20. HeroUI Native Usage

Use HeroUI Native components where they provide a meaningful UI primitive.

Prefer:

```text
Button
Card
Input
Text
Avatar
Divider
Modal
Sheet
Tabs
Spinner
Checkbox
Switch
List-like components
```

Do not force HeroUI components into places where a simple React Native View is better.

The target is:

```text
HeroUI for reusable UI primitives
+
React Native for layout
+
custom components for charts/financial visuals
```

Do not recreate HeroUI components manually if an appropriate HeroUI component already exists.

---

# 21. Component Architecture

Build reusable components instead of duplicating UI.

Suggested structure:

```text
components/
├── ui/
│   ├── AppText.tsx
│   ├── AppButton.tsx
│   ├── Screen.tsx
│   ├── Divider.tsx
│   └── IconButton.tsx
│
├── navigation/
│   └── BottomNavigation.tsx
│
├── transactions/
│   ├── TransactionItem.tsx
│   └── TransactionList.tsx
│
├── charts/
│   ├── WeeklyExpenseChart.tsx
│   ├── CategoryChart.tsx
│   └── ChartLegend.tsx
│
├── payment/
│   ├── MerchantCard.tsx
│   ├── PaymentSummary.tsx
│   ├── PaymentScanner.tsx
│   └── PaymentResult.tsx
│
└── layout/
    ├── ScreenHeader.tsx
    └── SectionHeader.tsx
```

Adapt this structure to the existing project rather than blindly creating a parallel architecture.

---

# 22. Screen Components

Suggested screen organization:

```text
app/
├── home/
├── statistics/
├── notifications/
├── payment/
├── payment-summary/
├── payment-scan/
├── payment-success/
└── account/
```

If the project uses Expo Router, preserve Expo Router conventions.

If it already uses React Navigation, do not migrate navigation unless explicitly requested.

---

# 23. Responsive Design

The reference uses:

```text
375 × 812
```

as the main mobile design.

Do NOT hardcode:

```ts
width: 375;
```

for actual production layouts.

Instead use:

```ts
const { width } = useWindowDimensions();
```

and calculate content widths appropriately.

For example:

```ts
const horizontalPadding = 16;
const contentWidth = width - horizontalPadding * 2;
```

The visual proportions should remain close to the reference.

The application must work on:

- Small Android phones
- Standard Android phones
- Large Android phones
- iPhones with notches
- iPhones with Dynamic Island
- Devices with different safe areas

---

# 24. Safe Areas

Never position important content against the physical screen edges without accounting for safe areas.

Use the project's existing safe-area solution.

Important elements that require safe-area consideration:

- Headers
- Bottom navigation
- Payment screens
- Scanner
- Home indicator
- Modal/sheet content

The design export contains iPhone status-bar/home-indicator measurements, but these are reference measurements, not values that should be manually recreated in production.

Let the operating system render:

- Status bar
- Battery
- Wi-Fi
- Cellular signal
- Home indicator

Do not manually draw these.

---

# 25. Icons

Use the project's existing icon library if one exists.

If HeroUI Native provides the required icon abstraction, use it.

Otherwise use an established icon library.

Do not manually recreate common icons using arbitrary SVG paths unless the reference contains a unique custom icon.

For brand icons such as:

- Starbucks
- Netflix

reuse the supplied project assets if available.

Do not use random replacement icons when an existing asset exists.

---

# 26. SVG Assets

If the project contains SVG assets:

- Reuse them where appropriate
- Do not convert everything into PNG
- Preserve aspect ratio
- Avoid unnecessary duplication
- Keep assets in an organized asset directory

For SVG icons, use the project's existing SVG solution.

Do not embed huge SVG strings directly inside components.

---

# 27. Android Design Reference

The Android design specification confirms several screen backgrounds and dimensions.

Important reference backgrounds include:

```text
Home:
#FFFFFF

Statistic:
#FFFFFF

Notification:
#105D38

Payment:
#FFFFFF / #030319 depending on layout section

Payment Success:
#105D38

Payment Scan:
#105D38

Payment Summary:
#105D38
```

The supplied Android layouts use 375×812 for several mobile screens and 375×1192 for the statistic screen.

Treat those dimensions as design references, not fixed production dimensions.

---

# 28. Visual Consistency Rules

Every screen must share:

- Same typography
- Same spacing system
- Same icon treatment
- Same border-radius system
- Same color tokens
- Same button behavior
- Same navigation
- Same safe-area behavior

Do not let each screen develop its own visual language.

---

# 29. Interaction Design

Interactions should feel native.

Use:

- Press states
- Loading states
- Disabled states
- Error states
- Empty states
- Success states

Buttons should have immediate visual feedback.

Lists should have appropriate touch feedback.

Animations should be subtle.

Preferred animation principles:

```text
150-250ms
ease-out
small scale/opacity/translate transitions
```

Do not animate everything.

---

# 30. Accessibility

All interactive elements must have:

- Accessible labels
- Appropriate roles
- Sufficient touch area
- Readable contrast
- Meaningful states

Do not rely solely on color to communicate state.

For example:

Income vs Expenses should remain understandable through text and layout, not just color.

---

# 31. Data Integration

Do not replace existing application logic with fake data.

During the redesign:

1. Inspect existing API/data hooks.
2. Identify existing transaction data.
3. Identify existing authentication.
4. Identify payment logic.
5. Identify scanner/camera logic.
6. Identify notification logic.
7. Preserve them.
8. Replace only the visual layer where possible.

If real data already exists, map it into reusable UI components.

Example:

```tsx
<TransactionItem
  merchant={transaction.merchant}
  amount={transaction.amount}
  date={transaction.date}
  category={transaction.category}
  icon={transaction.icon}
/>
```

---

# 32. Do Not Break Existing Functionality

Before changing a screen:

1. Understand how the screen currently works.
2. Identify navigation dependencies.
3. Identify state.
4. Identify API calls.
5. Identify hooks.
6. Identify side effects.
7. Identify shared components.
8. Then modify the presentation layer.

Do not rewrite working business logic unnecessarily.

---

# 33. Existing Project First

Before writing code:

```text
1. Inspect package.json
2. Inspect Expo configuration
3. Inspect app.json/app.config.*
4. Inspect routing
5. Inspect existing screens
6. Inspect components
7. Inspect theme configuration
8. Inspect installed HeroUI Native packages
9. Inspect existing icon libraries
10. Inspect existing assets
11. Inspect API/data hooks
12. Inspect authentication/payment logic
```

Do not assume dependencies.

Use what is already installed when practical.

If HeroUI Native is not correctly configured, determine the minimum required setup before modifying every screen.

---

# 34. Implementation Order

Implement in this order:

## Phase 1

Foundation:

- Theme
- Colors
- Typography
- Spacing
- Radius
- Safe-area wrapper
- Reusable text
- Buttons
- Icon buttons
- Dividers

## Phase 2

Navigation:

- Bottom navigation
- Header
- Screen transitions

## Phase 3

Home:

- Dashboard
- Quick actions
- Recent transactions

## Phase 4

Statistics:

- Weekly chart
- Income/Expense selector
- Category chart
- Legend
- Recent expenses

## Phase 5

Payment:

- Payment screen
- Payment summary
- QR screen
- Scan screen
- Success screen
- Error state

## Phase 6

Notifications:

- Notification list
- Read/unread states

## Phase 7

Polish:

- Animations
- Loading states
- Empty states
- Accessibility
- Responsive behavior
- Android/iOS validation

---

# 35. Pixel Accuracy

Aim for high visual similarity, but prioritize production-quality React Native architecture.

Match:

- Relative spacing
- Typography hierarchy
- Colors
- Component sizes
- Border radii
- Alignment
- Visual weight
- Chart proportions
- Navigation structure
- Screen composition

Do not obsess over a single pixel if doing so damages responsiveness.

Priority:

```text
1. Layout
2. Color
3. Typography
4. Spacing
5. Component sizing
6. Icons
7. Micro-details
```

---

# 36. Avoid Generic AI UI

Do NOT produce:

- Generic dashboard cards
- Random gradients
- Purple AI-style colors
- Excessive glassmorphism
- Huge shadows
- Generic Material Design
- Random rounded rectangles
- Default Expo starter UI
- Random emoji icons
- Unrelated illustrations

The result should visibly belong to the supplied design system.

---

# 37. Verification Process

After implementing each screen:

1. Run the Expo app.
2. Open the target screen.
3. Compare against the supplied reference.
4. Check:
   - spacing
   - alignment
   - typography
   - colors
   - icon sizes
   - chart proportions
   - safe areas
   - bottom navigation
5. Fix the largest visual mismatch first.
6. Repeat.

Do not declare a screen finished simply because it compiles.

---

# 38. Build Validation

After implementation run:

```bash
npx expo start
```

Then validate:

```bash
npx expo-doctor
```

and the project's available lint/typecheck commands.

If package scripts exist:

```bash
npm run lint
npm run typecheck
```

or their equivalent.

Fix:

- TypeScript errors
- React warnings
- Navigation errors
- Invalid imports
- Missing assets
- Runtime crashes

before considering the redesign complete.

---

# 39. Final Acceptance Criteria

The redesign is complete only when:

- [ ] Expo app starts successfully
- [ ] Existing functionality still works
- [ ] Navigation works
- [ ] Home matches the reference
- [ ] Statistics matches the reference
- [ ] Notifications match the reference
- [ ] Payment flow matches the reference
- [ ] QR screen matches the reference
- [ ] Scan screen matches the reference
- [ ] Payment success matches the reference
- [ ] Bottom navigation matches the reference
- [ ] Colors match the design tokens
- [ ] Typography is consistent
- [ ] Safe areas work correctly
- [ ] Layout is responsive
- [ ] No unnecessary absolute positioning exists
- [ ] No duplicated design tokens exist
- [ ] Components are reusable
- [ ] Existing APIs/data are preserved
- [ ] No placeholder UI remains
- [ ] No obvious visual mismatch remains

---

# 40. Critical Instruction to Gemini

You are not being asked to create a new application from scratch.

You are redesigning an existing Expo application.

Therefore:

**Inspect first. Understand second. Design third. Implement fourth. Verify fifth.**

Do not immediately start generating components.

First understand the repository and existing architecture.

Then create a concise implementation plan.

Then implement incrementally.

When making design decisions not explicitly specified in the supplied SVG/CSS, choose the option that best preserves the existing design language.

If the supplied reference conflicts with an existing implementation, prefer the supplied visual reference for UI while preserving existing business logic and functionality.

The SVG and CSS are the visual source of truth.

The existing application is the functional source of truth.

HeroUI Native is the component-system source of truth.

The final result should combine all three:

```text
Design Reference
      +
Existing Functionality
      +
HeroUI Native
      ↓
Production-quality Expo Mobile App
```
