# NutriCheck Design Rules

Single source of truth for every UI decision in this app. AI coding sessions and
humans must follow these rules instead of inventing new values.

> **Core principle:** design each screen to help the user finish a job, not to
> look finished. If removing an element loses no information or function,
> remove it. Color communicates — it never decorates.

---

## 1. Page purpose (one job per page)

Every screen answers exactly one question. Anything that does not support that
question belongs on another page or nowhere.

| Page | Primary question |
| --- | --- |
| Home (`index`) | "Can I eat this?" — check one food right now |
| Scan (`scan`) | "Is this dish safe?" — photo-based check |
| History (`search`) | "What have I already checked, and what was the verdict?" |
| Account (`account`) | "How do I configure my profile and app?" |
| Onboarding | "What conditions should checks account for?" |

No KPI cards on pages whose job is not data review. The Home page shows at most
a quiet count of past checks — never a dashboard of repeated stats.

## 2. Color system

Canonical palette lives in `src/theme/tokens.ts` (light) with chrome-level
overrides in `src/theme/darkTokens.ts`. Never hardcode hex values in components.

Hierarchy:

1. **Neutral** — backgrounds, cards, borders, secondary text. ~90% of the UI.
2. **Primary (teal)** — the main CTA per view, selected states, interactive
   links. One primary button per view; it must be the only filled teal control.
3. **Semantic** — safety status only: `safe*`, `moderation*`, `danger*`.
4. **Condition accents** (diabetes/CKD/heart/celiac/allergy colors) appear only
   where they identify a specific condition — chips, selector states.

Forbidden: gradients, glow shadows, colored cards for decoration, colored
section backgrounds, more than one saturated accent fighting for attention.

## 3. Typography

Scale defined in `typography` export of `tokens.ts`. Never introduce a new
font size or weight.

| Token | Size/Weight | Use for |
| --- | --- | --- |
| `display` | 28 / 800 / -0.6 | The ONE page title per screen |
| `heading` | 22 / 800 / -0.4 | Hero content: food name in result card, auth headings |
| `subheading` | 18 / 700 / -0.2 | Sheet/modal titles, empty-state titles |
| `title` | 15 / 700 | Row and card titles |
| `body` | 14 / 500 / lh 20 | Default reading text |
| `bodySmall` | 13 / 500 / lh 18 | Supporting copy |
| `caption` | 12 / 500 | Metadata, timestamps, quiet hints |
| `micro` | 11 / 600 | Badges, chips, tiny labels |

Rules:
- Every screen has exactly one `display` element; hierarchy steps down from it.
- Section labels that group content use `sectionLabel` (12 / 700 / uppercase /
  +0.5 tracking / `slateLight`). Same treatment everywhere.
- Body text is weight 500, not 400/600 — weight is reserved for structure.
- Long text: `numberOfLines={1}` + `ellipsizeMode="tail"` in rows; full value is
  visible on detail views. Never let long strings break layout.

## 4. Spacing & radius

- Spacing tokens only: `spacing.xs…huge` (4/8/12/16/20/24/32/48).
  Standard horizontal page padding: `spacing.xl` (20). No arbitrary values.
- Radius scale: `radius.sm`(8) `md`(12) `lg`(16) `xl`(20) `xxl`(24) `pill`(999).
- Geometry rules:
  - Buttons and inputs: `radius.lg` — always, any size.
  - Cards and large grouped containers: `radius.xl`.
  - Bottom sheets/modals: top corners `radius.xxl`.
  - Icon tiles (square icon containers): `radius.md`; avatars and hero icon
    circles: true circles (`pill`). Do not mix circle/square for the same role.
  - Chips, badges, status dots: `pill`.

## 5. Controls

Heights snap to `controlHeight`: `sm` 40 / `md` 48 / `lg` 52.

### Buttons — use `AppButton`
- **primary**: filled `primaryDark`, white label. Exactly one per view.
- **secondary**: bordered neutral surface, `primaryDark` label. Quieter than
  primary; never competes visually.
- **ghost**: borderless tinted-label action for low-emphasis links.
- **danger**: destructive color only after confirmation context exists.
- Loading state: built into `AppButton` (spinner replaces label). A loading
  button is disabled automatically.
- Icon buttons need a 44pt minimum touch target.

### Cards
Cards group meaningful information — they are not decoration. No nested
card-in-card, no shadows on static cards (borders separate), same radius for
equivalent cards. Dense list rows show: identity → key value → essential
status → overflow. Secondary actions hide behind expandable areas, not button
rows.

## 6. Icons

Ionicons only (`@expo/vector-icons`). No emoji as UI icons — ever.
Sizes: 16 inline-with-text · 18 row/list icons · 20 buttons & inputs ·
22 tab bar. Outline variant by default (`*-outline`); filled variants only for
active tab state and confirmed/success moments.

## 7. Terminology (same action = same word = same style)

| Concept | Label | Notes |
| --- | --- | --- |
| Analyze food by text | **Check Food** | primary CTA on Home |
| Photo flow entry | **Scan Food** | tab title; "Open Camera" / "Upload Photo" inside |
| Retry capture | **Retake** | scan preview |
| Accept captured photo | **Use Photo** | scan preview |
| Erase all saved checks | **Clear history** | destructive confirm required |
| End session | **Log out** | destructive confirm required |
| Dismiss form | **Cancel** | always left, secondary |
| Confirm sheet | **Done** / **Save** | Done = selection sheets, Save = edits |

Never alternate synonyms (delete/remove/trash, log out/sign out) for the same
action across screens.

## 8. States (design them, don't discover them)

- **Empty** — use `EmptyState`: what is empty, why, and the next useful action
  as its CTA. Never ship a blank region.
- **Loading** — multi-step analysis uses `StepProgressState` (evidence of
  progress beats raw speed); quick fetches use an inline `ActivityIndicator`.
  Any button that triggers async work shows its loading state via `AppButton`.
- **Error** — use `ErrorBanner`: explain what failed and how to recover.
  Field-level errors sit next to their field; destructive color only here.
- **Completion** — meaningful actions confirm what happened (toast/notification
  via `notificationStore.push`, success state, or updated UI). Nothing should
  vanish without explanation.
- **Destructive** — confirm before acting. Copy states the consequence plainly,
  includes the count of affected items, and says it cannot be undone when true.
  Destructive confirm buttons use `danger` styling.

## 9. Motion

Motion must communicate state. Allowed: expand/collapse (`LayoutAnimation`
ease-in-ease-out), progress/completion feedback, subtle press states.
Forbidden: decorative entrances, parallax, scroll effects, animation for
animation's sake.

## 10. Data realism QA

Before shipping a screen verify: very long names/titles, missing values
("Not set"), zero results (empty state), single record, many records, slow and
failed requests, small and large screens, keyboard overlap, touch targets ≥44.

## 11. Pre-ship audit

1. Does this page answer its one question within seconds?
2. Is there exactly one primary button?
3. Is every color carrying information?
4. Are radiuses/heights/type from the token scales only?
5. Are secondary actions compressed (overflow/expand), not buttoned rows?
6. Empty / loading / error / completion / destructive-confirm handled?
7. Tested with ugly data?
