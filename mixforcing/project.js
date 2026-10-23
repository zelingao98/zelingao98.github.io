(() => {
  'use strict';

  function initProjectNavigation() {
    const nav = document.querySelector('.project-nav');
    if (!nav) return;

    const items = [...nav.querySelectorAll('a[href^="#"]')].flatMap(link => {
      let id;
      try {
        id = decodeURIComponent(link.hash.slice(1));
      } catch {
        return [];
      }
      const section = document.getElementById(id);
      return section ? [{ link, section }] : [];
    });
    if (!items.length) return;

    const header = document.querySelector('.site-header');
    let active = null;
    let frame = 0;

    function select(item) {
      if (active === item) return;
      active = item;
      items.forEach(candidate => {
        const current = candidate === item;
        candidate.link.classList.toggle('is-active', current);
        if (current) candidate.link.setAttribute('aria-current', 'location');
        else candidate.link.removeAttribute('aria-current');
      });
    }

    function update() {
      frame = 0;
      const anchorOffset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const threshold = Math.max((header?.getBoundingClientRect().bottom || 0) + 24, anchorOffset) + 1;
      let current = items[0];

      // Keep the section active until the next heading clears the sticky header.
      for (const item of items) {
        if (item.section.getBoundingClientRect().top <= threshold) current = item;
      }

      // The final section may be too short for its heading to reach the header.
      const page = document.scrollingElement || document.documentElement;
      if (page.scrollTop > 0 && page.scrollTop + page.clientHeight >= page.scrollHeight - 2) {
        current = items[items.length - 1];
      }
      select(current);
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    // Preserve ordinary anchor navigation; this script only supplies the highlight.
    select(items.find(item => item.link.hash === window.location.hash) || items[0]);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    window.addEventListener('hashchange', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    window.addEventListener('load', scheduleUpdate, { once: true });
    scheduleUpdate();
  }

  function initTeaserChapters() {
    const video = document.getElementById('teaser-video');
    const grid = document.getElementById('teaser-chapters');
    const status = document.getElementById('teaser-status');
    if (!video || !grid || !status || !window.MixForcingEvents) return;

    const moments = [0, 15, 30, 45, 59];
    let pending = null;
    const cancelPending = () => {
      pending?.abort();
      pending = null;
      status.textContent = '';
    };
    const buttons = moments.map(seconds => {
      const timestamp = `00:${String(seconds).padStart(2, '0')}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chapter-button';
      button.setAttribute('aria-label', `Jump to ${timestamp} in the one-minute rollout`);
      const poster = document.createElement('img');
      poster.src = `assets/teaser/chapter-${String(seconds).padStart(2, '0')}.jpg`;
      poster.alt = '';
      poster.width = 832;
      poster.height = 480;
      poster.loading = 'lazy';
      const label = document.createElement('span');
      label.textContent = timestamp;
      button.append(poster, label);
      button.addEventListener('click', async () => {
        cancelPending();
        const request = new AbortController();
        pending = request;
        status.classList.remove('error');
        status.textContent = `Loading ${timestamp}…`;
        try {
          await window.MixForcingEvents.ready(video, request.signal);
          if (request.signal.aborted) return;
          video.currentTime = Math.min(seconds, Math.max(0, video.duration - .05));
          await video.play();
          if (!request.signal.aborted) status.textContent = '';
        } catch (_) {
          if (!request.signal.aborted) {
            status.textContent = 'The recording could not be played. Try its play control or reload the page.';
            status.classList.add('error');
          }
        } finally {
          if (pending === request) pending = null;
        }
      });
      grid.append(button);
      return button;
    });
    const update = () => {
      const active = moments.reduce((last, seconds, i) => seconds <= video.currentTime + .1 ? i : last, 0);
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === active)));
    };
    ['timeupdate', 'seeked', 'loadedmetadata'].forEach(name => video.addEventListener(name, update));
    document.addEventListener('play', event => {
      if (event.target !== video) cancelPending();
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelPending();
    });
    update();
  }

  function initCitationCopy() {
    const button = document.getElementById('citation-copy');
    const code = document.getElementById('citation-code');
    const status = document.getElementById('citation-status');
    if (!button || !code || !status) return;

    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(code.textContent.trim());
        status.textContent = 'BibTeX copied to clipboard.';
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        code.focus();
        selection?.removeAllRanges();
        selection?.addRange(range);
        status.textContent = 'Citation selected. Press Command+C or Ctrl+C to copy.';
      } finally {
        button.disabled = false;
      }
    });
  }

  function init() {
    initProjectNavigation();
    initTeaserChapters();
    initCitationCopy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
