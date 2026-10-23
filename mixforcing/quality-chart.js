(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MixForcingQuality = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Exact marker coordinates and displayed means from the supplied figure's
  // companion long_rollout_quality5min_after_sr.svg (viewBox 883.74 × 265.128).
  // This is an interaction overlay only: the original PNG remains untouched.
  // Intervals are original rollout minutes, NOT the accelerated media clock.
  const width = 883.74, height = 265.128;
  const plot = { left: 51.42, right: 880.86, top: 25.572, bottom: 214.788 };
  const points = [
    [76.232308, 110.343449, 71.0], [147.124615, 106.885610, 71.4],
    [218.016923, 135.281757, 68.4], [288.909231, 145.626423, 67.3],
    [359.801538, 136.363058, 68.3], [430.693846, 145.320558, 67.3],
    [501.586154, 135.544167, 68.4], [572.478462, 104.866883, 71.6],
    [643.370769, 137.472562, 68.2], [714.263077, 124.346590, 69.6],
    [785.155385, 126.848533, 69.3], [856.047692, 127.163459, 69.3],
  ];

  function hitTest(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < plot.left || x > plot.right || y < plot.top || y > plot.bottom) return -1;
    const index = points.findIndex((point, i) => i === points.length - 1 || x < (point[0] + points[i + 1][0]) / 2);
    return index;
  }

  function describeInterval(index) {
    return { interval: `${index * 5}–${(index + 1) * 5} min`, quality: points[index][2].toFixed(1) };
  }

  function keyboardIndex(index, key) {
    if (key === 'Home') return 0;
    if (key === 'End') return points.length - 1;
    if (key === 'Escape') return -1;
    if (key === 'ArrowRight') return Math.min(points.length - 1, index + 1);
    if (key === 'ArrowLeft') return Math.max(0, index - 1);
    return index;
  }

  function mount(button, chart) {
    const stage = document.createElement('span');
    stage.className = 'quality-chart-stage';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('quality-chart-overlay');
    const shape = (tag, attributes) => {
      const element = document.createElementNS(svg.namespaceURI, tag);
      Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
      svg.append(element);
      return element;
    };
    const band = shape('rect', { y: plot.top, height: plot.bottom - plot.top, class: 'quality-interval-band' });
    const guide = shape('line', { y1: plot.top, y2: plot.bottom, class: 'quality-point-guide' });
    const halo = shape('circle', { r: 9, class: 'quality-point-halo' });
    const dot = shape('circle', { r: 4.5, class: 'quality-point-dot' });
    const tooltip = document.createElement('span');
    tooltip.className = 'quality-tooltip';
    tooltip.id = 'rollout-quality-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    const interval = document.createElement('span');
    interval.className = 'quality-tooltip-interval';
    const score = document.createElement('span');
    score.className = 'quality-tooltip-score';
    tooltip.append(interval, score);
    const instructions = document.createElement('span');
    instructions.className = 'sr-only';
    instructions.id = 'rollout-quality-help';
    instructions.textContent = 'Hover to inspect each five-minute rollout interval, or use the left and right arrow keys. Press Escape to dismiss the tooltip. Click or press Enter to enlarge the original chart.';
    const announcement = document.createElement('span');
    announcement.className = 'sr-only';
    announcement.setAttribute('aria-live', 'polite');
    button.setAttribute('aria-describedby', `${instructions.id} ${tooltip.id}`);
    chart.replaceWith(stage);
    stage.append(chart, svg, tooltip);
    button.after(instructions, announcement);

    let active = -1;
    function update(index, announce = false) {
      active = index;
      stage.classList.toggle('is-inspecting', index >= 0);
      tooltip.hidden = index < 0;
      if (index < 0) { announcement.textContent = ''; return; }
      const [x, y] = points[index];
      const left = index === 0 ? plot.left : (points[index - 1][0] + x) / 2;
      const right = index === points.length - 1 ? plot.right : (x + points[index + 1][0]) / 2;
      band.setAttribute('x', left);
      band.setAttribute('width', right - left);
      guide.setAttribute('x1', x);
      guide.setAttribute('x2', x);
      [halo, dot].forEach(circle => { circle.setAttribute('cx', x); circle.setAttribute('cy', y); });
      stage.style.setProperty('--point-x', `${x / width * 100}%`);
      stage.style.setProperty('--point-y', `${y / height * 100}%`);
      const detail = describeInterval(index);
      interval.textContent = `${detail.interval} · rollout`;
      score.textContent = `Average quality: ${detail.quality}`;
      if (announce) announcement.textContent = `${detail.interval}. Average quality: ${detail.quality}.`;
    }
    update(-1);
    button.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      // Read the current image bounds, including section-hover transforms and
      // responsive scaling; the surrounding button padding is not chart space.
      const bounds = chart.getBoundingClientRect();
      update(hitTest((event.clientX - bounds.left) / bounds.width * width, (event.clientY - bounds.top) / bounds.height * height));
    });
    button.addEventListener('pointerleave', () => update(-1));
    button.addEventListener('blur', () => update(-1));
    button.addEventListener('click', () => update(-1));
    button.addEventListener('focus', () => { if (button.matches(':focus-visible')) update(0, true); });
    // Pointer hover does not focus the button: Escape must also work when the
    // user is inspecting with the mouse and keyboard focus remains elsewhere.
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && active >= 0) update(-1);
    });
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      update(keyboardIndex(active, event.key), true);
    });
  }

  return { hitTest, describeInterval, keyboardIndex, mount };
});
