# Design System: Thiết kế Website Việt hóa

## 1. Brand & Style

The design system is anchored in the principles of **Precision, Transparency, and Institutional Trust**. As a tax application, the interface must strip away unnecessary cognitive load while maintaining a sophisticated, high-end feel that reassures users their sensitive financial data is being handled with care.

The chosen style is **Modern Corporate with Minimalist influences**. It leverages generous whitespace, a sophisticated earthy-modern palette, and high-quality typography to transform the often-stressful task of tax management into a calm, guided experience. The aesthetic avoids the sterility of traditional financial software by using warm background tones and deep forest accents, creating a "boutique consultancy" feel rather than a "cold government portal."

## 2. Color Palette

The palette is designed to be grounded and legible.

### Core Colors
- **Primary:** `#284b45` (A deep, forest green used for key brand moments, primary actions, and headers. It signifies stability and growth.)
- **On Primary:** `#ffffff`
- **Primary Container:** `#284b45`
- **Secondary:** `#36675e`
- **On Secondary:** `#ffffff`
- **Secondary Container:** `#b9ede1`
- **Tertiary:** `#46261c`
- **On Tertiary:** `#ffffff`
- **Tertiary Container:** `#603c31`

### Surface & Backgrounds
- **Background:** `#f9f9f8` (A warm, off-white "linen" grey that reduces eye strain compared to pure white and provides a sophisticated, paper-like foundation.)
- **On Background:** `#1a1c1b`
- **Surface:** `#ffffff` (Used for cards and input areas to ensure maximum contrast against the background.)
- **Surface Dim:** `#dadad8`
- **Surface Bright:** `#f9f9f8`
- **Surface Container Lowest:** `#ffffff`
- **Surface Container Low:** `#f3f4f2`
- **Surface Container:** `#eeeeec`
- **Surface Container High:** `#e8e8e6`
- **Surface Container Highest:** `#e2e3e1`
- **On Surface:** `#1a1c1b`
- **On Surface Variant:** `#414846`
- **Inverse Surface:** `#2f3130`
- **Inverse On Surface:** `#f0f1ef`

### Outlines
- **Outline:** `#717976`
- **Outline Variant:** `#c1c8c5`

### Functional Colors
Success and Error states use slightly desaturated tones to remain professional while providing clear feedback for form validation and filing status.
- **Error:** `#ba1a1a`
- **On Error:** `#ffffff`
- **Error Container:** `#ffdad6`
- **On Error Container:** `#93000a`

## 3. Typography

The design system utilizes **Noto Sans** for all interface levels to ensure exceptional legibility across digital screens. Given the complexity of tax terminology in Vietnamese, typography settings prioritize vertical rhythm.

- **Vietnamese Support:** Special attention is paid to line-heights to ensure that Vietnamese diacritics do not collide, especially in multi-line labels or data tables.
- **Hierarchy:** Headlines use a tighter letter-spacing and heavier weights to establish a clear structural anchor. Body text uses a generous line-height (1.5x - 1.6x) to facilitate the reading of long-form tax regulations or instructions.
- **Numerical Data:** For tables and financial figures, ensure the use of tabular num features (tnum) if available to maintain alignment across rows of currency.

### Typography Scale

| Role       | Font Family | Font Size | Font Weight | Line Height | Letter Spacing |
| :--------- | :---------- | :-------- | :---------- | :---------- | :------------- |
| **h1**     | Noto Sans   | 40px      | 700 (Bold)  | 1.2         | -0.02em        |
| **h2**     | Noto Sans   | 32px      | 600 (Semibold)| 1.25        | -0.01em        |
| **h3**     | Noto Sans   | 24px      | 600 (Semibold)| 1.3         | -              |
| **body-lg**| Noto Sans   | 18px      | 400 (Regular) | 1.6         | -              |
| **body-md**| Noto Sans   | 16px      | 400 (Regular) | 1.5         | -              |
| **label-md**| Noto Sans  | 14px      | 500 (Medium)  | 1.4         | 0.01em         |
| **caption**| Noto Sans   | 12px      | 400 (Regular) | 1.4         | -              |

## 4. Elevation & Depth

This design system uses **Tonal Layering** combined with **Ambient Shadows** to create hierarchy.

- **Low Elevation:** The main background is `#f4f1ea`. Cards and primary containers sit on top in `#ffffff`.
- **Shadows:** Use extremely soft, tinted shadows for cards to make them feel integrated into the surface. Shadow color: `rgba(40, 75, 69, 0.08)` (Primary color at 8% opacity) with a 20px blur and 4px Y-offset.
- **Interactivity:** On hover, buttons and cards should slightly increase their shadow spread or lift by 2px to provide tactile feedback. Modals utilize a darker backdrop blur (12px) to focus the user's attention on the critical task at hand.

## 5. Shapes

The shape language is **distinctly rounded**, moving away from the sharp, aggressive corners of traditional finance tools to feel more approachable and modern.

- **Main Containers:** Large cards, sections, and modals must use a corner radius of **24px** (xl).
- **Interactive Elements:** Buttons, input fields, and dropdowns use a radius of **16px** (lg).
- **Small Accents:** Chips and tags use a fully rounded (pill/9999px) style to distinguish them from actionable buttons.
- **Consistency:** All borders should be thin (1px) and use a soft neutral color (`#e0ddd7`) to define boundaries without adding visual noise.

## 6. Layout & Spacing

The layout philosophy follows a **Fixed-Width Grid** for desktop (12-column) and a **Fluid Margin** system for mobile.

- **8px Baseline:** All spacing, padding, and margins are multiples of 8px to ensure a consistent visual rhythm.
- **Visual Grouping:** Use larger gaps (32px+) to separate distinct sections of a tax form, and smaller gaps (8px-16px) to relate labels to their respective input fields.
- **Information Density:** While the overall style is minimalist, data-heavy views (like transaction lists) may scale down to a 4px "Compact" rhythm to allow more information to be visible without scrolling.

**Spacing Scale:**
- `xs`: 4px
- `sm`: 8px
- `base`: 8px
- `md`: 16px
- `lg`: 24px
- `gutter`: 24px
- `xl`: 32px
- `xxl`: 48px
- `container-max`: 1200px
