# Agent Guidelines & Repository Rules

These guidelines apply to all AI agents operating within **Lachlan's World** (`spatoa/website`).

## 1. Browser Executable Policy
- **Strict Chromium Path**: All agents, subagents, test runners, headless checks, and automation scripts **MUST ONLY** use `/run/current-system/sw/bin/chromium`.
- **Forbidden Browsers**: Do **NOT** invoke, configure, or launch `google-chrome`, `google-chrome-stable`, `chrome`, or any other browser binary.
- Full details and framework integration patterns are defined in [.agents/rules/browser.md](file:///home/spatoa/Documents/website/.agents/rules/browser.md).

## 2. Architectural & Development Rules
- **Browser Policy**: [.agents/rules/browser.md](file:///home/spatoa/Documents/website/.agents/rules/browser.md)
- **Component Architecture**: [.agents/rules/components.md](file:///home/spatoa/Documents/website/.agents/rules/components.md)
- **Design System & Aesthetics**: [.agents/rules/style-guide.md](file:///home/spatoa/Documents/website/.agents/rules/style-guide.md)
- **Testing & Verification**: [.agents/rules/testing.md](file:///home/spatoa/Documents/website/.agents/rules/testing.md)
