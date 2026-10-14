# Browser Executable & Usage Rules for AI Agents

These rules govern all browser usage, headless operations, automated tests, subagent activities, and scripts across **Lachlan's World**.

## 1. Strict Browser Executable Policy
- **Chromium Binary Only**:
  - Agents must **ONLY** use the Chromium browser installed at:
    `/run/current-system/sw/bin/chromium`
  - **NEVER** use Google Chrome (`google-chrome`, `google-chrome-stable`, `chrome`), Chromium from any other path, or any other browser (Firefox, WebKit, Brave, Edge, etc.).
  - Do **NOT** invoke `google-chrome` or `chrome` from the shell, even if present in `PATH` or wrapper locations.
  - Do **NOT** install, download, or allow frameworks to download separate browser binaries.

## 2. Automation & Script Integration
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

## 3. Headless Verification & DevTools
- **Headless Screenshot & Page Capture**:
  ```bash
  /run/current-system/sw/bin/chromium --headless --disable-gpu --screenshot=<output_path> --window-size=1280,1024 <url>
  ```
- **Remote Debugging & DevTools**:
  ```bash
  /run/current-system/sw/bin/chromium --headless --remote-debugging-port=<port> --user-data-dir=$(mktemp -d) --disable-gpu <url>
  ```
