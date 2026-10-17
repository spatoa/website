/**
 * @module Gimmicks
 * @description Mid-2000s novelty box rotating humorous computing parodies, fake downloaders,
 * and nostalgic Web 1.0/2.0 interactive jokes.
 *
 * @dependencies
 * - DOM: #gimmick-desc, #gimmick-btn, #gimmick-result, etc.
 *
 * @exports
 * - window.LegitSoftware
 *
 * @storageKeys
 * - lachlan_last_gimmick_idx (sessionStorage: index of last shown gimmick)
 */

(function () {
  'use strict';

  // Explicit Unicode characters with \uFE0F Variation Selector-16 where needed for color emoji rendering
  const GIMMICKS = [
    {
      id: 'download-ram',
      icon: '\u{26A1}\u{FE0F}', // ⚡️
      desc: 'Allocates 64 gigabytes of physical memory over HTTP. Please allow three to five business seconds for memory delivery.',
      btnText: 'FREE DOWNLOAD: 64GB_RAM.EXE',
      btnIcon: '\u{2B07}\u{FE0F}',
      successIcon: '\u{2705}',
      successMsg: 'SUCCESS! 64GB DDR5 MEMORY ALLOCATED. (DO NOT CLOSE TAB)'
    },
    {
      id: 'defrag-web',
      icon: '\u{1F5C2}\u{FE0F}', // 🗂️
      desc: 'Defragments the global TCP/IP network. Organizes public internet packets into contiguous sectors for optimal alignment.',
      btnText: 'FREE DOWNLOAD: DEFRAG_INTERNET.BAT',
      btnIcon: '\u{2B07}\u{FE0F}',
      successIcon: '\u{2705}',
      successMsg: 'SUCCESS! THE ENTIRE INTERNET IS NOW IN ALPHABETICAL ORDER.'
    },
    {
      id: 'free-ipod',
      icon: '\u{1F381}', // 🎁
      desc: 'You have been designated as visitor number 1,000,000. An Apple iPod Nano has been reserved for your IP address.',
      btnText: 'CLAIM PRIZE: IPOD_NANO_COUPON.EXE',
      btnIcon: '\u{2B07}\u{FE0F}',
      successIcon: '\u{1F389}', // 🎉
      successMsg: 'SUCCESS! LIME GREEN IPOD NANO DISPATCHED TO 127.0.0.1.'
    },
    {
      id: 'localhost-singles',
      icon: '\u{1F525}', // 🔥
      desc: 'Discovered an active loopback interface on 127.0.0.1. Socket 8080 is listening for an incoming connection.',
      btnText: 'CONNECT NOW: LOCALHOST_MATCH.EXE',
      btnIcon: '\u{2B07}\u{FE0F}',
      successIcon: '\u{2764}\u{FE0F}', // ❤️
      successMsg: 'SUCCESS! SUCCESSFULLY MATCHED WITH YOURSELF ON PORT 8080.'
    },
    {
      id: 'boost-bandwidth',
      icon: '\u{1F680}', // 🚀
      desc: 'Requests additional bandwidth allocation from your local telecommunications provider via copper wire modulation.',
      btnText: 'FREE DOWNLOAD: BANDWIDTH_BOOSTER.EXE',
      btnIcon: '\u{2B07}\u{FE0F}',
      successIcon: '\u{1F680}',
      successMsg: 'SUCCESS! ILLEGAL BANDWIDTH DRAW COMPLETED. COPPER LINES HOT.'
    },
    {
      id: 'overclock-keyboard',
      icon: '\u{2328}\u{FE0F}', // ⌨️
      desc: 'Increases the polling frequency of your PS/2 input device to 4.2 GHz. WPM output remains constrained by user competency.',
      btnText: 'INSTALL UTILITY: KEYBOARD_OVERCLOCK.DLL',
      btnIcon: '\u{2B07}\u{FE0F}',
      successIcon: '\u{26A1}\u{FE0F}',
      successMsg: 'SUCCESS! KEYBOARD OVERCLOCKED TO 4.2 GHz. WPM UNCHANGED.'
    },
    {
      id: 'screen-cleaner',
      icon: '\u{1F9FD}', // 🧽
      desc: 'Removes dust and particles from the interior surface of your cathode-ray tube glass.',
      btnText: 'RUN UTILITY: CRT_CLEANER.EXE',
      btnIcon: '\u{2B07}\u{FE0F}',
      successIcon: '\u{2728}', // ✨
      successMsg: 'SUCCESS! INTERIOR CRT GLASS SQUEEGEED. EXTERIOR STILL DIRTY.'
    },
    {
      id: 'backup-internet',
      icon: '\u{1F4BE}', // 💾
      desc: 'Archives the public internet to a standard 3.5-inch 1.44MB high-density floppy diskette.',
      btnText: 'RESUME DOWNLOAD: INTERNET_BACKUP_DISK1.IMG',
      btnIcon: '\u{2B07}\u{FE0F}',
      successIcon: '\u{1F4BE}',
      successMsg: 'SUCCESS! FLOPPY DISK 1 OF 914,000,000 ARCHIVED TO DISKETTE.'
    },
    {
      id: 'self-destruct',
      icon: '\u{1F6A8}', // 🚨
      desc: 'Initiates emergency system containment termination for this workstation.',
      btnText: 'DO NOT CLICK: SELF_DESTRUCT.EXE',
      btnIcon: '\u{26A0}\u{FE0F}', // ⚠️
      successIcon: '\u{1F6A8}',
      successMsg: 'SUCCESS! SELF-DESTRUCTION ROUTINE ABORTED. SERVICE OFFLINE.'
    },
    {
      id: 'clippy-help',
      icon: '\u{1F4CE}', // 📎
      desc: 'The desktop assistant has detected web browsing activity and wishes to intervene.',
      btnText: 'ENABLE ASSISTANT: CLIPPY_PRO.MSI',
      btnIcon: '\u{2B07}\u{FE0F}',
      successIcon: '\u{1F4CE}',
      successMsg: 'SUCCESS! CLIPPY IS NOW PERMANENTLY WATCHING.'
    },
    {
      id: 'purple-gorilla',
      icon: '\u{1F435}', // 🐵
      desc: 'Installs a purple desktop gorilla utility to supervise outgoing network traffic.',
      btnText: 'FREE DOWNLOAD: GORILLA_FRIEND.EXE',
      btnIcon: '\u{2B07}\u{FE0F}',
      successIcon: '\u{1F435}',
      successMsg: 'SUCCESS! PURPLE GORILLA IS NOW RESIDENT IN MEMORY.'
    }
  ];

  let currentGimmickIndex = 0;
  let isDownloading = false;
  let isCompleted = false;

  // 5-Star color review emojis with explicit variation selector
  const STAR_STRING = '\u{2B50}\u{FE0F}\u{2B50}\u{FE0F}\u{2B50}\u{FE0F}\u{2B50}\u{FE0F}\u{2B50}\u{FE0F}';

  // Randomize the amount of reviews on each page refresh between 1 and 1,000,000
  const randomReviewCount = Math.floor(Math.random() * 1000000) + 1;
  const reviewUnit = randomReviewCount === 1 ? 'user review' : 'user reviews';
  const formattedReviewString = '5.0 (' + randomReviewCount.toLocaleString('en-US') + ' ' + reviewUnit + ')';

  /**
   * Pick a random index, ensuring different item from last refresh if possible
   */
  function pickRandomIndex() {
    let lastIdx = -1;
    try {
      const stored = sessionStorage.getItem('lachlan_last_gimmick_idx');
      if (stored !== null) {
        lastIdx = parseInt(stored, 10);
      }
    } catch (e) {}

    if (GIMMICKS.length <= 1) return 0;

    let newIdx;
    let attempts = 0;
    do {
      newIdx = Math.floor(Math.random() * GIMMICKS.length);
      attempts++;
    } while (newIdx === lastIdx && attempts < 10);

    try {
      sessionStorage.setItem('lachlan_last_gimmick_idx', String(newIdx));
    } catch (e) {}

    return newIdx;
  }

  /**
   * Render a specific gimmick into all instances of the gimmick panel
   */
  function renderGimmick(idx) {
    if (idx < 0 || idx >= GIMMICKS.length) return;
    currentGimmickIndex = idx;
    const item = GIMMICKS[idx];

    const panels = document.querySelectorAll('#legit-software');
    panels.forEach(function (panel) {
      const iconEl = panel.querySelector('#gimmick-icon');
      const starsEl = panel.querySelector('.gimmick-stars');
      const descEl = panel.querySelector('#gimmick-desc');
      const btnIconEl = panel.querySelector('#gimmick-btn-icon');
      const btnTextEl = panel.querySelector('#gimmick-btn-text');
      const reviewEl = panel.querySelector('#gimmick-review-count');

      if (iconEl) iconEl.textContent = item.icon;
      if (starsEl) starsEl.textContent = STAR_STRING;
      if (descEl) descEl.textContent = item.desc;
      if (btnIconEl) btnIconEl.textContent = item.btnIcon;
      if (btnTextEl) btnTextEl.textContent = item.btnText;
      if (reviewEl) reviewEl.textContent = formattedReviewString;

      // Reset state if re-rendered
      const btn = panel.querySelector('#gimmick-action-btn');
      const progressContainer = panel.querySelector('#gimmick-progress-container');
      const successBox = panel.querySelector('#gimmick-success-box');

      if (!isCompleted && !isDownloading) {
        if (btn) btn.removeAttribute('hidden');
        if (progressContainer) progressContainer.setAttribute('hidden', '');
        if (successBox) successBox.setAttribute('hidden', '');
      }

      // Small tactile visual feedback on refresh
      const card = panel.querySelector('#gimmick-active-card');
      if (card) {
        card.classList.remove('gimmick-flash');
        void card.offsetWidth;
        card.classList.add('gimmick-flash');
      }
    });
  }

  /**
   * Trigger non-linear progress bar animation in place of the button:
   * Starts slow, then speeds up, then displays the joke-relevant SUCCESS state.
   */
  function triggerDownloadProgress() {
    if (isDownloading || isCompleted) return;
    isDownloading = true;

    const item = GIMMICKS[currentGimmickIndex];
    const panels = document.querySelectorAll('#legit-software');

    // 1. Swap button out for progress bar
    panels.forEach(function (panel) {
      const btn = panel.querySelector('#gimmick-action-btn');
      const progressContainer = panel.querySelector('#gimmick-progress-container');
      const progressFill = panel.querySelector('#gimmick-progress-fill');
      const progressPct = panel.querySelector('#gimmick-progress-pct');
      const progressLabel = panel.querySelector('#gimmick-progress-label');
      const successBox = panel.querySelector('#gimmick-success-box');

      if (btn) btn.setAttribute('hidden', '');
      if (successBox) successBox.setAttribute('hidden', '');
      if (progressContainer) {
        progressContainer.removeAttribute('hidden');
        progressContainer.setAttribute('aria-valuenow', '0');
      }
      if (progressFill) progressFill.style.width = '0%';
      if (progressPct) progressPct.textContent = '0%';
      if (progressLabel) progressLabel.textContent = 'Connecting to remote host...';
    });

    // Authentic mid-2000s choppy progress steps:
    // Starts slow with long stalls, accelerates in abrupt burst jumps, stalls comically at 99%, then snaps to 100%
    const CHOPPY_STEPS = [
      { pct: 0, hold: 320, label: 'Connecting to remote host...' },
      { pct: 3, hold: 380, label: 'Establishing socket connection...' },
      { pct: 7, hold: 420, label: 'Allocating memory buffers...' },
      { pct: 14, hold: 550, label: 'Negotiating HTTP handshake...' }, // slow stall
      { pct: 23, hold: 260, label: 'Downloading payload headers...' },
      { pct: 38, hold: 220, label: 'Transferring unverified data packets...' },
      { pct: 56, hold: 180, label: 'Transferring unverified data packets...' },
      { pct: 74, hold: 150, label: 'Decompressing binary stream...' },
      { pct: 86, hold: 130, label: 'Injecting payload into system memory...' },
      { pct: 93, hold: 120, label: 'Checking CRC32 integrity...' },
      { pct: 97, hold: 160, label: 'Finalizing installation...' },
      { pct: 99, hold: 580, label: 'Finalizing installation...' }, // iconic 99% stall!
      { pct: 100, hold: 240, label: 'Done!' }
    ];

    let currentStepIdx = 0;

    function applyStep(step) {
      panels.forEach(function (panel) {
        const progressFill = panel.querySelector('#gimmick-progress-fill');
        const progressPct = panel.querySelector('#gimmick-progress-pct');
        const progressLabel = panel.querySelector('#gimmick-progress-label');
        const progressContainer = panel.querySelector('#gimmick-progress-container');

        if (progressContainer) progressContainer.setAttribute('aria-valuenow', String(step.pct));
        if (progressFill) progressFill.style.width = step.pct + '%';
        if (progressPct) progressPct.textContent = step.pct + '%';
        if (progressLabel) progressLabel.textContent = step.label;
      });
    }

    function runNextStep() {
      if (currentStepIdx >= CHOPPY_STEPS.length) {
        // Complete! Switch to joke-relevant SUCCESS state
        isDownloading = false;
        isCompleted = true;

        panels.forEach(function (panel) {
          const progressContainer = panel.querySelector('#gimmick-progress-container');
          const successBox = panel.querySelector('#gimmick-success-box');
          const successIcon = panel.querySelector('#gimmick-success-icon');
          const successText = panel.querySelector('#gimmick-success-text');

          if (progressContainer) progressContainer.setAttribute('hidden', '');
          if (successBox) {
            if (successIcon) successIcon.textContent = item.successIcon || '\u{2705}';
            if (successText) successText.textContent = item.successMsg;
            successBox.removeAttribute('hidden');
          }
        });
        return;
      }

      const step = CHOPPY_STEPS[currentStepIdx];
      applyStep(step);
      currentStepIdx++;

      setTimeout(runNextStep, step.hold);
    }

    runNextStep();
  }

  /**
   * Initialize event listeners
   */
  function init() {
    // Pick initial random gimmick on page load / refresh
    const initialIndex = pickRandomIndex();
    renderGimmick(initialIndex);

    // Global click listener for gimmick button
    document.addEventListener('click', function (e) {
      const actionBtn = e.target.closest('#gimmick-action-btn');
      if (actionBtn) {
        e.preventDefault();
        triggerDownloadProgress();
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose namespace for automated testing & verification
  window.LegitSoftware = {
    getGimmicks: function () { return GIMMICKS; },
    getCurrentIndex: function () { return currentGimmickIndex; },
    renderIndex: renderGimmick,
    triggerDownload: triggerDownloadProgress,
    isCompleted: function () { return isCompleted; }
  };
})();
