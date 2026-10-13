# Styling & Design System Rules for AI Agents

These guidelines ensure that all future agents and contributors maintain the authentic mid-2000s aesthetic, high accessibility standards, and clean CSS architecture of **Lachlan's World**.

## 1. Zero Framework Bloat
- **Vanilla CSS only**: Never introduce Tailwind CSS, Bootstrap, PostCSS plugins, or heavy CSS preprocessors without explicit instruction.
- **Entry point cascade**: All CSS is modularized into `static/css/` and imported in `static/css/style.css`.
  - Design tokens live in `static/css/tokens.css`.
  - Base typography & cursor live in `static/css/base.css`.
  - Layout & breakpoints live in `static/css/layout.css`.
  - Component-specific rules live in `static/css/components/<name>.css`.

## 2. Design Tokens & Color Palettes
- **Never hardcode hex values in component stylesheets**:
  - Always use `var(--panel-bg)`, `var(--panel-border)`, `var(--panel-header-top)`, `var(--text-primary)`, `var(--link-color)`, etc.
- **Support all 6 themes**:
  1. `paper`: Default readable warm light theme.
  2. `windows`: Win32 classic 2000/XP workstation theme.
  3. `midnight`: High-contrast dark mode.
  4. `cyber-y2k`: Dark mode with electric lime and cyber violet neon.
  5. `candy-2000`: Aqua gloss, sky blue, and tangerine Web 2.0 candy.
  6. `scene-punk`: Pitch black and hot pink neon.
- If adding a new CSS variable, declare it across all theme blocks in `static/css/tokens.css`.

## 3. Mid-2000s Aesthetic Principles
- **Bevels & Chrome**:
  - Use `2px outset var(--bevel-light)` for buttons, windows, and panels.
  - Use `border-style: inset;` on `:active` buttons to give tactile feedback.
  - Header gradients: Linear top-to-bottom or 90-degree metallic gradients.
- **Retro Typography**:
  - Main body text: `Tahoma, Verdana, Geneva, sans-serif`.
  - Headers & titlebars: `"Impact", "Arial Black", Tahoma, sans-serif`.
  - Terminals, tickers & metadata: `"Lucida Console", Monaco, monospace`.
- **Accessibility & Contrast**:
  - Maintain WCAG AA readability for all text elements.
  - Support font scaling tiers (`[data-font-scale="default"]`, `[data-font-scale="medium"]`, `[data-font-scale="large"]`).
  - Always retain the skip-to-content accessibility link.
