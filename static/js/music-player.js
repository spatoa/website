/**
 * music-player.js - Winamp-style Procedural Chiptune Audio Deck
 * Lachlan's World (Web 2.0)
 *
 * Uses the Web Audio API to generate authentic retro 8-bit chiptune melodies
 * with spectrum equalizer visualizer, volume control, and track switcher.
 */

(function () {
  'use strict';

  const tracks = [
    {
      title: '1. SPATOA - TEST 1 [8-BIT CHIPTUNE]',
      tempo: 135,
      notes: [
        { freq: 261.63, dur: 0.25 }, // C4
        { freq: 329.63, dur: 0.25 }, // E4
        { freq: 392.00, dur: 0.25 }, // G4
        { freq: 523.25, dur: 0.25 }, // C5
        { freq: 392.00, dur: 0.25 }, // G4
        { freq: 440.00, dur: 0.25 }, // A4
        { freq: 523.25, dur: 0.25 }, // C5
        { freq: 587.33, dur: 0.25 }, // D5
        { freq: 329.63, dur: 0.25 }, // E4
        { freq: 392.00, dur: 0.25 }, // G4
        { freq: 523.25, dur: 0.25 }, // C5
        { freq: 659.25, dur: 0.50 }, // E5
        { freq: 587.33, dur: 0.25 }, // D5
        { freq: 523.25, dur: 0.25 }, // C5
        { freq: 440.00, dur: 0.50 }  // A4
      ]
    },
    {
      title: '2. SPATOA - TEST 2 [DEMO ARPEGGIO]',
      tempo: 120,
      notes: [
        { freq: 220.00, dur: 0.30 }, // A3
        { freq: 261.63, dur: 0.30 }, // C4
        { freq: 329.63, dur: 0.30 }, // E4
        { freq: 440.00, dur: 0.30 }, // A4
        { freq: 349.23, dur: 0.30 }, // F4
        { freq: 440.00, dur: 0.30 }, // A4
        { freq: 523.25, dur: 0.30 }, // C5
        { freq: 392.00, dur: 0.30 }, // G4
        { freq: 329.63, dur: 0.30 }, // E4
        { freq: 261.63, dur: 0.30 }, // C4
        { freq: 293.66, dur: 0.30 }, // D4
        { freq: 220.00, dur: 0.60 }  // A3
      ]
    },
    {
      title: '3. SPATOA - TEST 3 [SYNTHWAVE FAST]',
      tempo: 145,
      notes: [
        { freq: 293.66, dur: 0.20 }, // D4
        { freq: 349.23, dur: 0.20 }, // F4
        { freq: 440.00, dur: 0.20 }, // A4
        { freq: 587.33, dur: 0.20 }, // D5
        { freq: 523.25, dur: 0.20 }, // C5
        { freq: 440.00, dur: 0.20 }, // A4
        { freq: 392.00, dur: 0.20 }, // G4
        { freq: 349.23, dur: 0.20 }, // F4
        { freq: 440.00, dur: 0.20 }, // A4
        { freq: 523.25, dur: 0.40 }, // C5
        { freq: 587.33, dur: 0.40 }  // D5
      ]
    }
  ];

  let currentTrackIdx = 0;
  let isPlaying = false;
  let isPaused = false;
  let audioCtx = null;
  let masterGain = null;
  let analyser = null;
  let noteIndex = 0;
  let synthTimer = null;
  let elapsedSeconds = 0;
  let clockTimer = null;
  let volumeVal = 0.65;

  const titleEl = document.getElementById('music-track-title');
  const timeEl = document.getElementById('music-time');
  const statusEl = document.getElementById('music-status-txt');
  const volSlider = document.getElementById('music-volume');
  const visCanvas = document.getElementById('winamp-visualizer');
  const visCtx = visCanvas ? visCanvas.getContext('2d') : null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      masterGain = audioCtx.createGain();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      masterGain.gain.setValueAtTime(volumeVal, audioCtx.currentTime);
      masterGain.connect(analyser);
      analyser.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playNote(freq, dur) {
    if (!audioCtx || !isPlaying) return;

    // Lead Square Wave Oscillator
    const osc = audioCtx.createOscillator();
    const noteGain = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    // Chiptune envelope
    const now = audioCtx.currentTime;
    noteGain.gain.setValueAtTime(0.01, now);
    noteGain.gain.linearRampToValueAtTime(0.25, now + 0.03);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(noteGain);
    noteGain.connect(masterGain);

    osc.start(now);
    osc.stop(now + dur);

    // Sub Bass Oscillator (Triangle Wave)
    const subOsc = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(freq / 2, now);

    subGain.gain.setValueAtTime(0.01, now);
    subGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    subOsc.connect(subGain);
    subGain.connect(masterGain);

    subOsc.start(now);
    subOsc.stop(now + dur);
  }

  function scheduleNextNote() {
    if (!isPlaying) return;

    const track = tracks[currentTrackIdx];
    const n = track.notes[noteIndex];
    playNote(n.freq, n.dur);

    noteIndex = (noteIndex + 1) % track.notes.length;
    synthTimer = setTimeout(scheduleNextNote, n.dur * 1000);
  }

  function startPlayback() {
    initAudio();
    isPlaying = true;
    isPaused = false;

    if (titleEl) titleEl.textContent = tracks[currentTrackIdx].title;
    if (statusEl) statusEl.textContent = '▶ PLAYING: ' + tracks[currentTrackIdx].title;

    clearTimeout(synthTimer);
    scheduleNextNote();

    if (!clockTimer) {
      clockTimer = setInterval(function () {
        if (isPlaying) {
          elapsedSeconds++;
          const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
          const secs = String(elapsedSeconds % 60).padStart(2, '0');
          if (timeEl) timeEl.textContent = `${mins}:${secs}`;
        }
      }, 1000);
    }
  }

  function pausePlayback() {
    isPlaying = false;
    isPaused = true;
    clearTimeout(synthTimer);
    if (statusEl) statusEl.textContent = '❚❚ PAUSED';
  }

  function stopPlayback() {
    isPlaying = false;
    isPaused = false;
    clearTimeout(synthTimer);
    clearInterval(clockTimer);
    clockTimer = null;
    elapsedSeconds = 0;
    noteIndex = 0;
    if (timeEl) timeEl.textContent = '00:00';
    if (statusEl) statusEl.textContent = '■ STOPPED';
  }

  function nextTrack() {
    currentTrackIdx = (currentTrackIdx + 1) % tracks.length;
    noteIndex = 0;
    elapsedSeconds = 0;
    if (titleEl) titleEl.textContent = tracks[currentTrackIdx].title;
    if (isPlaying) {
      clearTimeout(synthTimer);
      scheduleNextNote();
    }
  }

  function prevTrack() {
    currentTrackIdx = (currentTrackIdx - 1 + tracks.length) % tracks.length;
    noteIndex = 0;
    elapsedSeconds = 0;
    if (titleEl) titleEl.textContent = tracks[currentTrackIdx].title;
    if (isPlaying) {
      clearTimeout(synthTimer);
      scheduleNextNote();
    }
  }

  // Wire Button Controls
  const btnPlay = document.getElementById('music-play');
  const btnPause = document.getElementById('music-pause');
  const btnStop = document.getElementById('music-stop');
  const btnNext = document.getElementById('music-next');
  const btnPrev = document.getElementById('music-prev');

  if (btnPlay) btnPlay.addEventListener('click', startPlayback);
  if (btnPause) btnPause.addEventListener('click', pausePlayback);
  if (btnStop) btnStop.addEventListener('click', stopPlayback);
  if (btnNext) btnNext.addEventListener('click', nextTrack);
  if (btnPrev) btnPrev.addEventListener('click', prevTrack);

  if (volSlider) {
    volSlider.addEventListener('input', function (e) {
      volumeVal = parseFloat(e.target.value) / 100;
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(volumeVal, audioCtx.currentTime);
      }
    });
  }

  // Expose playback controls for Desktop Window Manager
  window.stopMusicPlayback = stopPlayback;

  // Visualizer Animation
  const numBars = 18;
  const barWidth = 14;
  const barSpacing = 4;
  const peaks = new Array(numBars).fill(0);

  function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    if (!visCtx || !visCanvas) return;

    visCtx.fillStyle = '#000000';
    visCtx.fillRect(0, 0, visCanvas.width, visCanvas.height);

    let freqData = new Uint8Array(numBars);
    if (analyser && isPlaying) {
      analyser.getByteFrequencyData(freqData);
    }

    const startX = 6;
    for (let i = 0; i < numBars; i++) {
      let rawVal = isPlaying ? freqData[i] || Math.sin(Date.now() / 150 + i) * 30 + 50 : 0;
      let barHeight = Math.floor((rawVal / 255) * (visCanvas.height - 4));
      barHeight = Math.max(1, barHeight);

      if (barHeight > peaks[i]) {
        peaks[i] = barHeight;
      } else {
        peaks[i] = Math.max(0, peaks[i] - 0.4);
      }

      const x = startX + i * (barWidth + barSpacing);
      const y = visCanvas.height - barHeight - 2;

      // Draw Green / Amber / Red segmented retro meter
      for (let segY = visCanvas.height - 3; segY >= y; segY -= 3) {
        const ratio = (visCanvas.height - segY) / visCanvas.height;
        if (ratio > 0.8) {
          visCtx.fillStyle = '#ff3333'; // Red
        } else if (ratio > 0.5) {
          visCtx.fillStyle = '#ffcc00'; // Amber
        } else {
          visCtx.fillStyle = '#00ff66'; // Green
        }
        visCtx.fillRect(x, segY, barWidth, 2);
      }

      // Draw peak dot
      if (peaks[i] > 1) {
        visCtx.fillStyle = '#ffffff';
        visCtx.fillRect(x, visCanvas.height - peaks[i] - 2, barWidth, 1.5);
      }
    }
  }

  drawVisualizer();
})();
