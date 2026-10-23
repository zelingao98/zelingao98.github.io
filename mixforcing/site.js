(() => {
  'use strict';
  const data = window.MIXFORCING_ASSETS;
  const keyboardDisplays = new WeakMap();
  function keyboardMedia(v, track) {
    if (!track) return v;
    const display = window.MixForcingKeyboard.mount(v, track);
    keyboardDisplays.set(v, display);
    return display.element;
  }
  function releaseKeyboard(v) {
    keyboardDisplays.get(v)?.dispose();
    keyboardDisplays.delete(v);
  }
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const time = seconds => {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  };
  const image = (src, alt, eager = false) => {
    const img = make('img');
    img.src = src;
    img.alt = alt;
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    return img;
  };
  const video = (item, controls = true, preload = 'none') => {
    const v = make('video');
    v.src = item.src;
    v.poster = item.poster;
    v.controls = controls;
    v.playsInline = true;
    v.muted = true;
    v.preload = preload;
    v.setAttribute('aria-label', item.label || 'Model rollout');
    return v;
  };
  const status = (target, text, error = false) => {
    target.textContent = text;
    target.classList.toggle('error', error);
  };
  if (!data) {
    status($('#comparison-status'), 'The demos could not be loaded. Please reload the page.', true);
    $('#comparison-play').disabled = true;
    return;
  }

  let currentCase = null;
  let videos = [];
  let playing = false;
  let generation = 0;
  let animation = 0;
  let lastCorrection = 0;
  let caseAbort = new AbortController();
  let eventDisplay = null;
  let seekRequest = 0;
  const playButton = $('#comparison-play');
  const seek = $('#comparison-seek');
  const playbackSpeed = $('#comparison-speed');
  const compStatus = $('#comparison-status');

  function buttonState() {
    playButton.replaceChildren(make('span', '', playing ? 'Ⅱ' : '▶'), document.createTextNode(playing ? ' Pause all' : ' Play all'));
    playButton.setAttribute('aria-label', playing ? 'Pause all comparison videos' : 'Play all comparison videos');
  }
  function updateProgress() {
    if (!currentCase) return;
    const now = videos[0]?.currentTime || 0;
    seek.value = String(Math.round(Math.min(1, now / currentCase.duration) * 1000));
    seek.setAttribute('aria-valuetext', `${time(now)} of ${time(currentCase.duration)}`);
    $('#comparison-time').textContent = `${time(now)} / ${time(currentCase.duration)}`;
    eventDisplay?.update(now);
  }
  function stopComparison() {
    playing = false;
    cancelAnimationFrame(animation);
    videos.forEach(v => v.pause());
    buttonState();
  }
  function pauseOtherMedia(keep) {
    if (!keep.includes(memoryVideo) && memoryAbort) {
      memoryAbort.abort();
      memoryAbort = null;
      status($('#memory-status'), '');
    }
    $$('video').forEach(v => {
      if (!keep.includes(v)) v.pause();
    });
  }
  function tick(now) {
    if (!playing) return;
    const master = videos[0];
    if (master.ended || master.currentTime >= currentCase.duration - .025) {
      stopComparison();
      updateProgress();
      status(compStatus, 'End of comparison. Play again to replay all six videos.');
      return;
    }
    if (now - lastCorrection > 400) {
      videos.slice(1).forEach(v => {
        if (!v.seeking && v.readyState >= 2 && Math.abs(v.currentTime - master.currentTime) > .16) {
          v.currentTime = master.currentTime;
        }
      });
      lastCorrection = now;
    }
    updateProgress();
    animation = requestAnimationFrame(tick);
  }
  const ready = window.MixForcingEvents.ready;
  async function startComparison() {
    const token = generation;
    const requested = [...videos];
    playButton.disabled = true;
    status(compStatus, 'Loading all six videos…');
    try {
      pauseOtherMedia(requested);
      await Promise.all(requested.map(v => ready(v, caseAbort.signal)));
      if (token !== generation) return;
      const start = requested[0].currentTime >= currentCase.duration - .15 ? 0 : requested[0].currentTime;
      requested.forEach(v => {
        v.currentTime = start;
        v.playbackRate = Number(playbackSpeed.value);
      });
      await Promise.all(requested.map(v => v.play()));
      if (token !== generation) { requested.forEach(v => v.pause()); return; }
      playing = true;
      buttonState();
      status(compStatus, 'Synchronized playback · shared timeline and speed.');
      animation = requestAnimationFrame(tick);
    } catch (error) {
      if (token !== generation || error.name === 'AbortError') return;
      stopComparison();
      status(compStatus, 'Could not load every video. Click Play all to retry.', true);
    } finally {
      if (token === generation) playButton.disabled = false;
    }
  }
  async function seekComparison(position) {
    const token = generation;
    const request = ++seekRequest;
    const requested = [...videos];
    try {
      await Promise.all(requested.map(v => ready(v, caseAbort.signal)));
      if (token !== generation || request !== seekRequest) return;
      window.MixForcingEvents.seekAll(requested, position);
      updateProgress();
    } catch (error) {
      if (token !== generation || request !== seekRequest || error.name === 'AbortError') return;
      status(compStatus, 'Could not seek every video. Click Play all to retry loading.', true);
    }
  }
  function selectScene(item) {
    stopComparison();
    generation += 1;
    caseAbort.abort();
    caseAbort = new AbortController();
    seekRequest += 1;
    videos.forEach(v => { releaseKeyboard(v); v.removeAttribute('src'); v.load(); });
    videos = [];
    currentCase = item;
    $('#scene-name').textContent = item.title;
    $('#scene-category').textContent = item.category;
    $('#scene-prompt').textContent = item.scene;
    const events = $('#event-timeline');
    events.hidden = item.group !== 'prompt-interaction' || !item.prompts?.entries.length;
    eventDisplay = events.hidden ? null : window.MixForcingEvents.mount(events, item.prompts, item.duration, seekComparison);
    if (events.hidden) events.replaceChildren();
    $$('.scene-button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.case === item.id)));
    const grid = $('#comparison-grid');
    grid.replaceChildren();
    item.videos.forEach(entry => {
      const card = make('figure', `video-card${entry.method === 'ours' ? ' ours' : ''}`);
      const header = make('figcaption', 'video-card-header');
      const title = make('span', '', entry.label);
      if (entry.method === 'ours') title.append(make('span', 'ours-tag', 'OURS'));
      const expand = make('button', 'expand-button', '⤢');
      expand.type = 'button';
      expand.setAttribute('aria-label', `Enlarge ${entry.label}: ${item.title}`);
      const v = video(entry, false, 'none');
      if (videos.length === 0) {
        v.addEventListener('seeked', updateProgress, { signal: caseAbort.signal });
        v.addEventListener('timeupdate', updateProgress, { signal: caseAbort.signal });
      }
      v.addEventListener('error', () => {
        stopComparison();
        status(compStatus, `${entry.label} could not be loaded. Click Play all to retry.`, true);
      });
      expand.addEventListener('click', () => {
        const position = v.currentTime;
        stopComparison();
        showMedia(`${entry.label} · ${item.title}`, { ...entry, keyboard: item.keyboard }, position);
      });
      header.append(title, expand);
      card.append(header, keyboardMedia(v, item.keyboard));
      grid.append(card);
      videos.push(v);
    });
    playButton.disabled = false;
    updateProgress();
    status(compStatus, `${item.title} · ${item.duration.toFixed(1)} seconds · 832 × 480 · ${item.fps} fps`);
  }
  data.comparisonGroups.forEach((group, groupIndex) => {
    const section = make('div', 'scene-group');
    const title = make('h3', 'scene-group-title', group.title);
    title.id = `scene-group-${group.id}`;
    const options = make('div', 'scene-group-options');
    options.setAttribute('role', 'group');
    options.setAttribute('aria-labelledby', title.id);
    data.comparisons.filter(item => item.group === group.id).forEach(item => {
      const button = make('button', 'scene-button');
      button.type = 'button';
      button.dataset.case = item.id;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `Compare ${item.title}`);
      button.append(image(item.videos[0].poster, '', groupIndex === 0), make('span', '', item.title));
      button.addEventListener('click', () => selectScene(item));
      options.append(button);
    });
    section.append(title, options);
    $('#scene-selector').append(section);
  });
  playButton.addEventListener('click', () => {
    if (playing) { stopComparison(); status(compStatus, 'Paused · drag the shared timeline to inspect a moment.'); }
    else startComparison();
  });
  $('#comparison-restart').addEventListener('click', () => {
    seekComparison(0);
    status(compStatus, playing ? 'Restarted synchronized playback.' : 'Back at the first frame.');
  });
  seek.addEventListener('input', () => {
    const position = Number(seek.value) / 1000 * currentCase.duration;
    seekComparison(position);
  });
  playbackSpeed.addEventListener('change', () => videos.forEach(v => { v.playbackRate = Number(playbackSpeed.value); }));

  const dialog = $('#media-dialog');
  function clearDialog() {
    dialog.classList.remove('chart-dialog');
    $$('#dialog-content video').forEach(v => { releaseKeyboard(v); v.pause(); v.removeAttribute('src'); v.load(); });
    $('#dialog-content').replaceChildren();
  }
  function showMedia(title, item, position = 0, still = false) {
    stopComparison();
    pauseOtherMedia([]);
    clearDialog();
    $('#dialog-title').textContent = title;
    if (still) $('#dialog-content').append(image(item.src, title, true));
    else {
      const v = video(item, true, 'metadata');
      v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(position, Math.max(0, v.duration - .01)); }, { once: true });
      $('#dialog-content').append(keyboardMedia(v, item.keyboard));
    }
    dialog.showModal();
  }
  $('#dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', clearDialog);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });

  const longVideo = $('#long-video');
  longVideo.src = data.longRollout.src;
  longVideo.poster = data.longRollout.poster;
  longVideo.muted = true;
  longVideo.defaultPlaybackRate = Number($('#long-speed').value);
  longVideo.playbackRate = longVideo.defaultPlaybackRate;
  let chapterRequest = 0;
  data.longRollout.chapters.forEach((chapter, index) => {
    const button = make('button', 'chapter-button');
    button.type = 'button';
    button.setAttribute('aria-label', `Jump to ${time(chapter.videoSeconds)} in the video`);
    button.setAttribute('aria-pressed', String(index === 0));
    button.append(image(chapter.poster, `Video at ${time(chapter.videoSeconds)}`), make('span', '', time(chapter.videoSeconds)));
    button.addEventListener('click', async () => {
      const request = ++chapterRequest;
      status($('#long-status'), `Loading ${time(chapter.videoSeconds)}…`);
      try {
        if (longVideo.readyState < 1) {
          longVideo.preload = 'metadata';
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => finish(new Error('timeout')), 25000);
            const finish = error => {
              clearTimeout(timer);
              longVideo.removeEventListener('loadedmetadata', loaded);
              longVideo.removeEventListener('error', failed);
              error ? reject(error) : resolve();
            };
            const loaded = () => finish();
            const failed = () => finish(new Error('load error'));
            longVideo.addEventListener('loadedmetadata', loaded, { once: true });
            longVideo.addEventListener('error', failed, { once: true });
            if (longVideo.error) longVideo.load();
          });
        }
        if (request !== chapterRequest) return;
        stopComparison();
        pauseOtherMedia([longVideo]);
        longVideo.currentTime = chapter.videoSeconds;
        await longVideo.play();
        status($('#long-status'), `Playing from ${time(chapter.videoSeconds)} in the video.`);
      } catch (_) {
        if (request === chapterRequest) status($('#long-status'), 'The recording could not be played. Try its native play control or reload the page.', true);
      }
    });
    $('#chapter-grid').append(button);
  });
  longVideo.addEventListener('timeupdate', () => {
    const active = data.longRollout.chapters.reduce((last, chapter, i) => chapter.videoSeconds <= longVideo.currentTime + .1 ? i : last, 0);
    $$('#chapter-grid .chapter-button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === active)));
  });
  $('#long-speed').addEventListener('change', event => { longVideo.playbackRate = Number(event.target.value); });
  longVideo.addEventListener('error', () => status($('#long-status'), 'The full recording is temporarily unavailable. Please reload the page or try again later.', true));

  if (data.longRollout.quality) {
    const quality = data.longRollout.quality;
    const button = make('button', 'quality-chart-button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Enlarge average-quality chart');
    const chart = image(quality.src, quality.alt);
    chart.width = quality.width;
    chart.height = quality.height;
    button.append(chart);
    button.addEventListener('click', () => {
      showMedia('Average quality over the one-hour rollout', quality, 0, true);
      dialog.classList.add('chart-dialog');
    });
    $('#rollout-quality').append(button, make('figcaption', '', quality.caption));
    window.MixForcingQuality.mount(button, chart);
  }

  const memoryVideo = $('#memory-video');
  memoryVideo.src = data.memoryVideo.src;
  memoryVideo.poster = data.memoryVideo.poster;
  memoryVideo.muted = true;
  let memoryAbort = null;
  function updateMemoryTimeline() {
    const active = data.memory.reduce((last, frame, index) => frame.seconds <= memoryVideo.currentTime ? index : last, 0);
    $$('.memory-card').forEach((card, index) => card.setAttribute('aria-pressed', String(index === active)));
  }
  async function jumpMemory(frame) {
    stopComparison();
    pauseOtherMedia([]);
    const controller = memoryAbort = new AbortController();
    status($('#memory-status'), `Loading ${time(frame.seconds)}…`);
    try {
      await ready(memoryVideo, controller.signal);
      if (controller.signal.aborted) return;
      memoryVideo.currentTime = frame.seconds;
      updateMemoryTimeline();
      await ready(memoryVideo, controller.signal);
      if (controller.signal.aborted) return;
      await memoryVideo.play();
      if (!controller.signal.aborted) status($('#memory-status'), '');
    } catch (_) {
      if (!controller.signal.aborted) status($('#memory-status'), 'The memory recording could not be played. Try its native play control or reload the page.', true);
    }
  }
  data.memory.forEach((frame, index) => {
    const card = make('button', 'memory-card');
    card.type = 'button';
    card.dataset.landmark = frame.landmark;
    card.setAttribute('aria-label', `Jump to ${time(frame.seconds)} · ${frame.label}`);
    card.setAttribute('aria-pressed', String(index === 0));
    const media = make('span', 'memory-image');
    media.append(image(frame.src, frame.label));
    if (frame.roi) {
      const roi = make('span', 'roi');
      const [left, top, width, height] = frame.roi;
      Object.assign(roi.style, { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` });
      roi.append(make('b', '', frame.landmark.toUpperCase()));
      roi.setAttribute('aria-hidden', 'true');
      media.append(roi);
    }
    card.append(make('span', 'memory-time', time(frame.seconds)), media, make('span', 'memory-label', frame.label));
    card.addEventListener('click', () => jumpMemory(frame));
    $('#memory-grid').append(card);
  });
  ['timeupdate', 'seeked', 'loadedmetadata'].forEach(name => memoryVideo.addEventListener(name, updateMemoryTimeline));
  memoryVideo.addEventListener('error', () => status($('#memory-status'), 'The scene-revisiting recording is temporarily unavailable. Please reload the page or try again later.', true));

  // Only the selected comparison plays as a group. Standalone players are independent.
  $$('video').forEach(v => {
    if (!videos.includes(v)) v.addEventListener('play', () => {
      stopComparison();
      pauseOtherMedia([v]);
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopComparison(); pauseOtherMedia([]); }
  });
  $$('[data-comparison-scene]').forEach(link => {
    link.addEventListener('click', () => {
      const scene = data.comparisons.find(item => item.id === link.dataset.comparisonScene);
      if (scene) selectScene(scene);
    });
  });
  selectScene(data.comparisons[0]);
})();
