# Browser Testing & Verification Rules

Guidelines for running browser tests, headless checks, and capturing screenshots in **Lachlan's World**:

## 1. Browser Executable Specification
- Adhere strictly to the project browser policy in [.agents/rules/browser.md](file:///home/spatoa/Documents/website/.agents/rules/browser.md).
- **Strict Chromium Binary**:
  - **ONLY** use `/run/current-system/sw/bin/chromium` instead of `google-chrome` or `chrome` when running tests, headless sessions, or capturing screenshots.
  - Do NOT invoke `google-chrome` or `chrome`.
  - When spawning browser processes in Node.js test scripts or running CLI commands, always specify `/run/current-system/sw/bin/chromium`.

## 2. Headless Verification Pattern
- When capturing headless screenshots or running verification scripts:
  ```bash
  /run/current-system/sw/bin/chromium --headless --disable-gpu --screenshot=<output_path> --window-size=1280,1024 <url>
  ```
- When using DevTools Remote Debugging:
  ```bash
  /run/current-system/sw/bin/chromium --headless --remote-debugging-port=<port> --user-data-dir=$(mktemp -d) --disable-gpu <url>
  ```
