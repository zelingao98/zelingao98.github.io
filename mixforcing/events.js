(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MixForcingEvents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function indexAt(track, seconds) {
    const frame = Math.max(0, Math.min(track.frameCount - 1, Math.floor(seconds * track.fps + 1e-7)));
    let index = -1;
    for (let i = 0; i < track.entries.length && track.entries[i].frame <= frame; i++) index = i;
    return index;
  }
  function seekAll(videos, seconds) {
    videos.forEach(v => { v.currentTime = Math.max(0, Math.min(seconds, v.duration - .01)); });
  }
  function ready(v, signal) {
    if (signal.aborted) return Promise.reject(new DOMException('Scene changed', 'AbortError'));
    if (v.readyState >= 2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let timer;
      const readyEvents = ['loadeddata', 'canplay', 'seeked'];
      const cleanup = () => {
        clearTimeout(timer);
        readyEvents.forEach(name => v.removeEventListener(name, available));
        v.removeEventListener('error', failure);
        signal.removeEventListener('abort', cancelled);
      };
      const available = () => { if (v.readyState >= 2) { cleanup(); resolve(); } };
      const failure = () => { cleanup(); reject(new Error('Video could not be loaded')); };
      const cancelled = () => { cleanup(); reject(new DOMException('Scene changed', 'AbortError')); };
      // loadeddata is initial-only; seeks can return from buffering via the other events.
      readyEvents.forEach(name => v.addEventListener(name, available));
      v.addEventListener('error', failure, { once: true });
      signal.addEventListener('abort', cancelled, { once: true });
      timer = setTimeout(() => { cleanup(); reject(new Error('Video loading timed out')); }, 25000);
      v.preload = 'auto';
      if (v.error) v.load();
    });
  }
  const timestamp = seconds => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, '0')}`;
  function mount(container, track, duration, onSeek) {
    const make = (tag, className, text) => {
      const element = document.createElement(tag);
      element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };
    container.replaceChildren();
    const heading = make('div', 'event-heading');
    const title = make('h3', 'overline', 'EVENT TIMELINE');
    const current = make('span', 'event-current');
    current.setAttribute('aria-live', 'polite');
    heading.append(title, current);
    const note = make('p', 'event-note', 'Prompt-effective times, not measured visual onset. Click a marker to seek all six videos.');
    const axis = make('div', 'event-axis');
    axis.setAttribute('aria-label', 'Event prompt intervals');
    const playhead = make('span', 'event-playhead');
    playhead.setAttribute('aria-hidden', 'true');
    const labels = make('div', 'event-labels');
    const details = make('details', 'event-prompt');
    const summary = make('summary', '', 'Current prompt');
    const prompt = make('p', '');
    details.append(summary, prompt);
    const buttons = track.entries.map((entry, index) => {
      const name = `${timestamp(entry.seconds)} · ${entry.label}`;
      const segment = make('button', `event-segment event-${entry.kind}`);
      segment.type = 'button';
      segment.style.left = `${entry.seconds / duration * 100}%`;
      segment.style.width = `${((track.entries[index + 1]?.seconds ?? duration) - entry.seconds) / duration * 100}%`;
      segment.title = name;
      segment.setAttribute('aria-label', `Jump to ${name}`);
      // The labelled button below provides the same keyboard action with full context.
      segment.tabIndex = -1;
      segment.addEventListener('click', () => onSeek(entry.seconds));
      axis.append(segment);
      const button = make('button', `event-label event-${entry.kind}`);
      button.type = 'button';
      button.append(make('span', 'event-time', timestamp(entry.seconds)), make('span', '', entry.label));
      button.setAttribute('aria-label', `Jump to ${name}`);
      button.addEventListener('click', () => onSeek(entry.seconds));
      labels.append(button);
      return [segment, button];
    });
    axis.append(playhead);
    container.append(heading, note, axis, labels, details);
    let previous = -1;
    return {
      update(seconds) {
        playhead.style.left = `${Math.max(0, Math.min(100, seconds / duration * 100))}%`;
        const index = indexAt(track, seconds);
        if (index === previous) return;
        previous = index;
        buttons.forEach((pair, i) => pair.forEach(button => {
          if (i === index) button.setAttribute('aria-current', 'step');
          else button.removeAttribute('aria-current');
        }));
        const entry = track.entries[index];
        current.textContent = entry ? `${timestamp(entry.seconds)} · ${entry.label}` : '';
        prompt.textContent = entry?.prompt || '';
      },
    };
  }
  return { indexAt, seekAll, ready, mount };
});
