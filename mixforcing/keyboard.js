// Recorded-input display only: never captures or changes the viewer's keyboard input.
(function (root) {
  'use strict';

  function keysAt(track, seconds) {
    if (!track?.changes?.length) return [];
    const safeTime = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const frame = Math.min(track.frameCount - 1, Math.floor(safeTime * track.fps + 1e-7));
    let low = 0;
    let high = track.changes.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (track.changes[middle][0] <= frame) low = middle + 1;
      else high = middle;
    }
    return low ? track.changes[low - 1][1] : [];
  }

  function bind(video, track, render) {
    let disposed = false;
    let pending = null;
    const decodedFrames = typeof video.requestVideoFrameCallback === 'function';
    const update = () => render(keysAt(track, video.currentTime));
    const cancel = () => {
      if (pending === null) return;
      if (decodedFrames) video.cancelVideoFrameCallback(pending);
      else cancelAnimationFrame(pending);
      pending = null;
    };
    const schedule = () => {
      if (disposed || video.paused || video.ended || pending !== null) return;
      if (decodedFrames) {
        pending = video.requestVideoFrameCallback((_, metadata) => {
          pending = null;
          if (disposed) return;
          render(keysAt(track, metadata.mediaTime));
          schedule();
        });
      } else {
        pending = requestAnimationFrame(() => {
          pending = null;
          if (disposed) return;
          update();
          schedule();
        });
      }
    };
    const play = () => { update(); schedule(); };
    const pause = () => { cancel(); update(); };
    const timeupdate = () => { if (video.paused || !decodedFrames) update(); };
    const listeners = { play, playing: play, pause, ended: pause, timeupdate,
      seeking: update, seeked: update, loadedmetadata: update, ratechange: update };
    Object.entries(listeners).forEach(([name, handler]) => video.addEventListener(name, handler));
    update();
    schedule();
    return () => {
      disposed = true;
      cancel();
      Object.entries(listeners).forEach(([name, handler]) => video.removeEventListener(name, handler));
    };
  }

  function mount(video, track) {
    const element = document.createElement('div');
    element.className = `keyed-video${video.controls ? ' has-native-controls' : ''}`;
    const overlay = document.createElement('div');
    overlay.className = 'keyboard-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    const caps = new Map();
    for (const keys of [['w', 'a', 's', 'd'], ['i', 'j', 'k', 'l']]) {
      const group = document.createElement('div');
      group.className = 'keyboard-group';
      keys.forEach((key, index) => {
        const cap = document.createElement('kbd');
        cap.className = 'keyboard-key';
        cap.dataset.key = key;
        cap.textContent = key.toUpperCase();
        cap.style.gridColumn = String(index === 0 ? 2 : index);
        cap.style.gridRow = index === 0 ? '1' : '2';
        group.append(cap);
        caps.set(key, cap);
      });
      overlay.append(group);
    }
    element.append(video, overlay);
    let previous = null;
    const dispose = bind(video, track, keys => {
      const signature = keys.join(' ');
      if (signature === previous) return;
      previous = signature;
      overlay.dataset.keys = signature;
      caps.forEach((cap, key) => cap.classList.toggle('is-pressed', keys.includes(key)));
    });
    return { element, dispose };
  }

  const api = { keysAt, bind, mount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MixForcingKeyboard = api;
})(typeof window !== 'undefined' ? window : globalThis);
