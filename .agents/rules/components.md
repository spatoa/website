# Component Architecture & Template Rules for AI Agents

These guidelines ensure that all future agents build and maintain features in **Lachlan's World** with complete architectural consistency and zero regressions.

## 1. Template Structure & Partials
- **Keep index.html lean**:
  - `templates/index.html` must remain an assembler of partials via Tera's `{% include "partials/<name>.html" %}`.
  - Never write monolithic blocks of HTML directly inside `index.html` or `base.html`.
- **Location of partials**:
  - All shared panels and widgets live in `templates/partials/`.
  - When creating a new panel, create `templates/partials/<feature>.html` and include it in `templates/index.html`.
- **String localization & fallback**:
  - Always read strings from `zola.toml` with default fallbacks:
    `{{ config.extra.strings.your_key | default(value="Fallback text") }}`

## 2. JavaScript Architectural Contract
- **Zero framework dependencies**: Vanilla ECMAScript only. No React, Vue, jQuery, or bloated npm bundles.
- **Loading behavior**:
  - Scripts must be placed in `static/js/` and loaded in `base.html` using `<script src="..." defer></script>`.
  - Avoid polluting the global namespace; expose only documented APIs under `window` (e.g., `window.switchSiteTheme`, `window.setFontScale`).
- **LocalStorage conventions**:
  - Always prefix keys with `lachlan_` to prevent collisions:
    - `lachlan_site_theme`: Selected theme ID.
    - `lachlan_font_scale`: Selected font scale (`default`, `medium`, `large`).
    - `lachlan_desktop_mode`: Desktop view toggle state (`true` / `false`).
    - `lachlan_stickers`: JSON array of placed stickers and coordinates.
    - `lachlan_window_states`: Saved positions and minimization states of windows.

## 3. Desktop Mode & Window Manager Integration
- **Draggable Window Chrome**:
  - Each portal panel has a `<div class="panel-header">...</div>`.
  - In Desktop Mode (`body.mode-desktop`), `window-manager.js` hooks onto `.panel` elements, injects window controls (`_`, `□`, `✕`), and wires up the taskbar dock.
  - Keep panel headers clean and semantic so they function both in normal portal grid mode and in desktop mode.

## 4. Verification Workflow
- Always test static site builds after modifying templates or static assets using:
  ```bash
  nix develop --command zola build
  ```
- Check that the build completes in under 50ms with zero errors.
