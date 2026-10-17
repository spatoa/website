# Agent Guidelines & Repository Rules

These guidelines apply to all AI agents operating within **Lachlan's World** (`spatoa/website`).

---

## 1. Browser Executable Policy & Usage Rules

These rules govern all browser usage, headless operations, automated tests, subagent activities, and scripts across **Lachlan's World**.

### 1.1 Strict Browser Executable Policy
- **Chromium Binary Only**:
  - Agents must **ONLY** use the Chromium browser installed at:
    `/run/current-system/sw/bin/chromium`
  - **NEVER** use Google Chrome (`google-chrome`, `google-chrome-stable`, `chrome`), Chromium from any other path, or any other browser (Firefox, WebKit, Brave, Edge, etc.).
  - Do **NOT** invoke `google-chrome` or `chrome` from the shell, even if present in `PATH` or wrapper locations.
  - Do **NOT** install, download, or allow frameworks to download separate browser binaries.

### 1.2 Automation & Script Integration
- **Puppeteer / Playwright / Automation Frameworks**:
  - When launching or configuring browser automation, always explicitly configure the executable path:
    ```javascript
    executablePath: '/run/current-system/sw/bin/chromium'
    ```
- **Environment Variables**:
  - When running test runners or CLI tools that detect browsers via environment variables, ensure:
    ```bash
    export CHROME_BIN=/run/current-system/sw/bin/chromium
    export CHROME_PATH=/run/current-system/sw/bin/chromium
    export BROWSER=/run/current-system/sw/bin/chromium
    ```
- **Child Processes & Process Spawning**:
  - When spawning browser processes in Node.js, Python, or shell scripts, hardcode or specify `/run/current-system/sw/bin/chromium` as the executable.

### 1.3 Headless Verification & DevTools
- **Headless Screenshot & Page Capture**:
  ```bash
  /run/current-system/sw/bin/chromium --headless --disable-gpu --screenshot=<output_path> --window-size=1280,1024 <url>
  ```
- **Remote Debugging & DevTools**:
  ```bash
  /run/current-system/sw/bin/chromium --headless --remote-debugging-port=<port> --user-data-dir=$(mktemp -d) --disable-gpu <url>
  ```

---

## 2. Component Architecture & Template Rules

These guidelines ensure that all future agents build and maintain features in **Lachlan's World** with complete architectural consistency and zero regressions.

### 2.1 Template Structure & Partials
- **Keep index.html lean**:
  - `templates/index.html` must remain an assembler of partials via Tera's `{% include "partials/<name>.html" %}`.
  - Never write monolithic blocks of HTML directly inside `index.html` or `base.html`.
- **Location of partials**:
  - All shared panels and widgets live in `templates/partials/`.
  - When creating a new panel, create `templates/partials/<feature>.html` and include it in `templates/index.html`.
- **String localization & fallback**:
  - Always read strings from `zola.toml` with default fallbacks:
    `{{ config.extra.strings.your_key | default(value="Fallback text") }}`

### 2.2 JavaScript Architectural Contract
- **Zero framework dependencies**: Vanilla ECMAScript only. No React, Vue, jQuery, or bloated npm bundles.
- **Loading behavior**:
  - Scripts must be placed in `static/js/` and loaded in `base.html` using `<script src="..." defer></script>`.
  - Avoid polluting the global namespace; expose only documented APIs under `window` (e.g., `window.switchSiteTheme`).
- **LocalStorage conventions**:
  - Always prefix keys with `lachlan_` to prevent collisions:
    - `lachlan_site_theme`: Selected theme ID.
    - `lachlan_desktop_mode`: Desktop view toggle state (`true` / `false`).
    - `lachlan_stickers`: JSON array of placed stickers and coordinates.
    - `lachlan_window_states`: Saved positions and minimization states of windows.

### 2.3 Desktop Mode & Window Manager Integration
- **Draggable Window Chrome**:
  - Each portal panel has a `<div class="panel-header">...</div>`.
  - In Desktop Mode (`body.mode-desktop`), `window-manager.js` hooks onto `.panel` elements, injects window controls (`_`, `□`, `✕`), and wires up the taskbar dock.
  - Keep panel headers clean and semantic so they function both in normal portal grid mode and in desktop mode.

### 2.4 Verification Workflow
- Always test static site builds after modifying templates or static assets using:
  ```bash
  nix develop --command zola build
  ```
- Check that the build completes in under 50ms with zero errors.

---

## 3. Styling & Design System Rules

These guidelines ensure that all future agents and contributors maintain the authentic mid-2000s aesthetic, high accessibility standards, and clean CSS architecture of **Lachlan's World**.

### 3.1 Zero Framework Bloat
- **Vanilla CSS only**: Never introduce Tailwind CSS, Bootstrap, PostCSS plugins, or heavy CSS preprocessors without explicit instruction.
- **Entry point cascade**: All CSS is modularized into `static/css/` and imported in `static/css/style.css`.
  - Design tokens live in `static/css/tokens.css`.
  - Base typography & cursor live in `static/css/base.css`.
  - Layout & breakpoints live in `static/css/layout.css`.
  - Component-specific rules live in `static/css/components/<name>.css`.

### 3.2 Design Tokens & Color Palettes
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

### 3.3 Mid-2000s Aesthetic Principles
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
  - Standard retro typography locked to default 11px body sizing across themes.
  - Always retain the skip-to-content accessibility link.

### 3.4 Wingdings & Iconography Over Emojis
- **Prioritize Wingdings over modern emojis**:
  - Always prioritize the use of authentic Wingdings, Webdings, and retro dingbat symbols over modern emojis across templates, scripts, stylesheets, and content unless explicitly specified otherwise.
  - Never introduce modern color emojis (e.g. `🎮`, `🎵`, `📝`, `📁`, `💾`, `⚡`, `⬇️`, `⭐⭐⭐⭐⭐`, etc.) or Unicode variation selectors (`\uFE0F`) that trigger modern color emoji font renderers (such as Noto Color Emoji or Apple Color Emoji).
- **Retro Font Stack & Emoji Suppression**:
  - All symbols, window icons, desktop shortcut icons, tabs, tree items, and UI dingbats must use the standardized retro font stack:
    ```css
    font-family: "Wingdings", "Wingdings 2", "Wingdings 3", "Webdings", "Segoe MDL2 Assets", "Noto Sans Symbols 2", "Apple Symbols", Tahoma, sans-serif;
    font-variant-emoji: text;
    ```
  - Apply the `.wingdings` class or component-specific icon classes (such as `.win-icon`, `.desktop-icon-img`, `.tab-icon`, `.gimmick-stars`, etc.) to enforce crisp monochrome retro glyph rendering across Linux, Windows, and macOS.
- **Common Wingdings Mapping Reference**:
  - **Window & System Chrome**: `🗔` (U+1F5D4 Win32 Window), `⌧` (U+2327 Ballot X / Recycle Bin)
  - **Workstation & Display**: `🖵` (U+1F5B5 CRT Monitor)
  - **Storage & Floppy**: `🖫` (U+1F5AB 3.5" Diskette), `🖴` (U+1F5B4 Hard Drive)
  - **Folders & Documents**: `🗀` (U+1F5C0 Folder), `🗁` (U+1F5C1 Open Folder), `🗎` (U+1F5CE Document), `🗏` (U+1F5CF Note / Page)
  - **Audio & Media**: `♫` (U+266B Beamed Notes), `♩` (U+2669 Quarter Note)
  - **Hardware & Games**: `⌨` (U+2328 Keyboard), `★` (U+2605 Solid Star), `⚄` (U+2684 Dice / Game)
  - **Controls, Tools & Status**: `⚙` (U+2699 Gear), `⌕` (U+2315 Search Lens), `◷` (U+25F7 Clock), `⌛` (U+231B Hourglass), `☺` (U+263A Classic Smiley), `☞` / `☛` (Hand Pointers), `⚠` (Warning Triangle)
- **Portal Window Headers**:
  - Keep portal panel headers in normal grid mode clean (e.g., `★ About Me / My Profile ★`, `★ Interactive Canvas ★`) without hardcoded emoji glyphs in the HTML templates. In Desktop Mode, `window-manager.js` injects the corresponding Wingdings application icon dynamically.

---

## 4. Browser Testing & Verification Rules

Guidelines for running browser tests, headless checks, and capturing screenshots in **Lachlan's World**:

### 4.1 Browser Executable Specification
- Adhere strictly to the project browser policy defined in Section 1.
- **Strict Chromium Binary**:
  - **ONLY** use `/run/current-system/sw/bin/chromium` instead of `google-chrome` or `chrome` when running tests, headless sessions, or capturing screenshots.
  - Do NOT invoke `google-chrome` or `chrome`.
  - When spawning browser processes in Node.js test scripts or running CLI commands, always specify `/run/current-system/sw/bin/chromium`.

### 4.2 Headless Verification Pattern
- When capturing headless screenshots or running verification scripts:
  ```bash
  /run/current-system/sw/bin/chromium --headless --disable-gpu --screenshot=<output_path> --window-size=1280,1024 <url>
  ```
- When using DevTools Remote Debugging:
  ```bash
  /run/current-system/sw/bin/chromium --headless --remote-debugging-port=<port> --user-data-dir=$(mktemp -d) --disable-gpu <url>
  ```

