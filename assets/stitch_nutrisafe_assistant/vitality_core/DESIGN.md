---
name: Vitality Core
colors:
  surface: '#f8f9ff'
  surface-dim: '#d0dbed'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fc'
  surface-container-highest: '#d9e3f6'
  on-surface: '#121c2a'
  on-surface-variant: '#3d4947'
  inverse-surface: '#27313f'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#316763'
  on-secondary: '#ffffff'
  secondary-container: '#b5ede7'
  on-secondary-container: '#376d69'
  tertiary: '#924628'
  on-tertiary: '#ffffff'
  tertiary-container: '#b05e3d'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#b5ede7'
  secondary-fixed-dim: '#9ad1cb'
  on-secondary-fixed: '#00201e'
  on-secondary-fixed-variant: '#144f4b'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#773215'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
typography:
  h1:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  h2:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  h3:
    fontFamily: Outfit
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  h1-mobile:
    fontFamily: Outfit
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  container-padding: 20px
  gutter: 16px
---

## Brand & Style

The design system is rooted in a **Premium Minimalist** aesthetic tailored for high-end health technology. It prioritizes clarity, breathability, and trust, moving away from sterile clinical environments toward a warm, professional "wellness concierge" experience.

The interface leverages heavy whitespace to reduce cognitive load, essential for health data density. The emotional response should be one of calm assurance and precision. Visuals are grounded in reality—no heavy gradients or glassmorphism—relying instead on perfect alignment, generous padding, and a sophisticated, subdued color palette to convey quality.

## Colors

The palette is designed to be "Nature-Tech"—combining the reliability of deep forest greens with the crispness of modern digital surfaces.

- **Primary & Secondary:** Used for brand presence, primary actions, and key active states. Deep Teal (#0D9488) serves as the main interactive color.
- **Neutrals:** The background is a pure White (#FFFFFF), while secondary surfaces like cards use a soft Off-White (#F9FAFB) to create subtle hierarchy without needing heavy borders.
- **Status Colors:** These follow a traffic-light mental model but are slightly desaturated to maintain the premium feel. They should be used sparingly for data indicators and health alerts.
- **Text:** High-contrast Dark Charcoal (#1F2937) ensures maximum legibility for headings, while Slate Gray (#4B5563) provides a softer look for long-form body content.

## Typography

This design system employs a dual-font strategy. **Outfit** is used for headings to provide a modern, geometric, and friendly character. **Inter** is used for all functional and body text due to its exceptional readability and neutral, systematic tone.

- **Headlines:** Use H1 for primary screen titles. On mobile devices, scale H1 down to 28px to ensure word-wrap remains elegant.
- **Body:** Use `body-md` as the default for most content. `body-lg` is reserved for introductory text or key insights.
- **Labels:** Small, uppercase labels with increased letter spacing should be used for category headers or metadata to create clear visual separation.

## Layout & Spacing

The system is built on a strict **8px grid**. All margins, paddings, and component heights must be multiples of 8 (or 4 for micro-adjustments).

- **Mobile Philosophy:** The standard screen margin is set to 20px to allow content to feel "aired out" and avoid hitting the screen edge.
- **Vertical Rhythm:** Use `xl` (32px) or `xxl` (48px) spacing between major sections to emphasize the minimalist, spacious feel.
- **Card Spacing:** Internal padding for cards should be consistently 20px or 24px to match the generous rounded corners.

## Elevation & Depth

This design system avoids heavy shadows and floating effects to maintain a grounded, professional feel.

- **Tonal Layering:** Depth is primarily achieved by placing White cards on top of the #F9FAFB background. 
- **Shadows:** Use only two levels of soft, ambient shadows.
    - **Elevation 1:** `0px 2px 4px rgba(31, 41, 55, 0.04)` (Used for static cards).
    - **Elevation 2:** `0px 10px 20px rgba(31, 41, 55, 0.08)` (Used for active states or floating buttons).
- **Outlines:** In lieu of shadows for interactive elements like input fields, use a 1px solid border in a light gray (#E5E7EB), switching to the Primary Teal on focus.

## Shapes

The shape language is "Soft-Modern." It uses high-radius corners to feel approachable and organic, contrasting with the geometric precision of the typography.

- **Cards:** Use a large 24px radius to create a soft, friendly container for health data.
- **Buttons:** A 12px radius provides a modern, high-end feel that is distinct from standard "pill" buttons while remaining soft.
- **Small Elements:** Chips and badges should use a full "pill" radius (999px) to distinguish them from structural containers.

## Components

- **Buttons:** 
    - *Primary:* Deep Teal background, white text, 12px radius. Minimum height 56px for mobile accessibility.
    - *Secondary:* Ghost style with 1px border or light teal tint.
- **Cards:** 
    - Always use the 24px radius. 
    - Prefer white backgrounds on the #F9FAFB screen surface.
- **Input Fields:** 
    - 8px radius, 56px height. 
    - Labels should be `body-sm` bold, positioned above the field. 
    - Active state uses a 2px Teal border.
- **Chips/Badges:** 
    - Used for health status (e.g., "Active," "Normal"). 
    - Use pill-shaped roundedness and low-opacity background fills of the status colors (e.g., 10% opacity Emerald Green).
- **Lists:** 
    - Use 1px #F3F4F6 dividers that do not touch the screen edges (inset by 20px).
- **Icons:** 
    - 24px bounding box, 1.5pt or 2pt stroke weight. Never use filled icons unless they represent an active "selected" state in a navigation bar.
- **Progress Indicators:** 
    - Use thick (8px) rounded stroke lines for health goals to match the card radius and overall soft aesthetic.