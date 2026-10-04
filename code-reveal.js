(() => {
  'use strict';
  const canvas = document.getElementById('code-reveal');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Code Reveal's displayed settings and glyph progression.
  const fontSize = 12;
  const cellWidth = fontSize * .85;
  const cellHeight = fontSize * 1.15;
  const damping = .95;
  const velocity = .3;
  const glyphs = ['·', '.', '-', '~', '=', '+', 'x', '*', 'o'];
  const colors = Array.from({ length: 15 }, (_, index) => `rgba(255,255,255,${(index / 14 * .35).toFixed(3)})`);
  const stepDuration = 1000 / 60;
  const pointer = { x: -1, y: -1, down: false };
  let width = 0, height = 0, columns = 0, rows = 0;
  let current, previous, frame = 0, lastTime = 0, accumulator = 0, quietFrames = 0;

  function resetPointer() {
    pointer.x = pointer.y = -1;
    pointer.down = false;
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = accumulator = quietFrames = 0;
  }

  function clear() {
    stop();
    current?.fill(0);
    previous?.fill(0);
    context.clearRect(0, 0, width, height);
    resetPointer();
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    columns = Math.ceil(width / cellWidth) + 2;
    rows = Math.ceil(height / cellHeight) + 2;
    current = new Float32Array(columns * rows);
    previous = new Float32Array(columns * rows);
    clear();
  }

  function wake() {
    if (!frame && !motion.matches && !document.hidden) frame = requestAnimationFrame(animate);
  }

  function disturb(x, y, radius, strength) {
    const column = Math.floor(x / cellWidth);
    const row = Math.floor(y / cellHeight);
    const radiusSquared = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = column + dx, cy = row + dy;
        if (cx < 1 || cx >= columns - 1 || cy < 1 || cy >= rows - 1) continue;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < radiusSquared) current[cy * columns + cx] += strength * (1 - distanceSquared / radiusSquared);
      }
    }
    quietFrames = 0;
    wake();
  }

  function step() {
    for (let row = 1; row < rows - 1; row++) {
      const offset = row * columns;
      for (let column = 1; column < columns - 1; column++) {
        const index = offset + column;
        previous[index] = ((current[index - 1] + current[index + 1] + current[index - columns] + current[index + columns]) * velocity - previous[index]) * damping;
      }
    }
    [current, previous] = [previous, current];
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    context.font = `${fontSize}px monospace`;
    context.textBaseline = 'middle';
    context.textAlign = 'center';
    let activeCells = 0;
    for (let row = 1; row < rows - 1; row++) {
      const offset = row * columns;
      for (let column = 1; column < columns - 1; column++) {
        const amplitude = Math.abs(current[offset + column]);
        if (amplitude <= .008) continue;
        activeCells++;
        const glyph = glyphs[Math.min(Math.floor(amplitude * 2.2), glyphs.length - 1)];
        context.fillStyle = colors[Math.min(Math.floor(amplitude * 6), colors.length - 1)];
        context.fillText(glyph, column * cellWidth, row * cellHeight);
      }
    }
    return activeCells;
  }

  function animate(time) {
    frame = 0;
    if (motion.matches || document.hidden) { lastTime = accumulator = 0; return; }
    accumulator += lastTime ? Math.min(time - lastTime, stepDuration * 4) : stepDuration;
    lastTime = time;
    while (accumulator >= stepDuration) {
      step();
      accumulator -= stepDuration;
    }
    if (draw() === 0 && !pointer.down) quietFrames++;
    else quietFrames = 0;
    if (quietFrames > 30) { clear(); return; }
    wake();
  }

  function move(event) {
    if (motion.matches || document.hidden || !current) return;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    if (pointer.x < 0) { pointer.x = x; pointer.y = y; return; }
    const dx = x - pointer.x, dy = y - pointer.y;
    const squaredDistance = dx * dx + dy * dy;
    if (squaredDistance > 2) {
      const distance = Math.sqrt(squaredDistance);
      const samples = Math.min(Math.floor(distance / 6), 8);
      const strength = Math.min(distance * .12, 3.5) * (pointer.down ? 1.8 : 1);
      for (let index = 0; index <= samples; index++) {
        const fraction = samples ? index / samples : 0;
        disturb(pointer.x + dx * fraction, pointer.y + dy * fraction, pointer.down ? 3 : 2, strength);
      }
    }
    pointer.x = x;
    pointer.y = y;
  }

  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerdown', (event) => {
    if (motion.matches || document.hidden || !current) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.down = true;
    disturb(pointer.x, pointer.y, 5, 7);
  }, { passive: true });
  window.addEventListener('pointerup', () => { pointer.down = false; }, { passive: true });
  window.addEventListener('pointercancel', resetPointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', resetPointer, { passive: true });
  window.addEventListener('blur', resetPointer);
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', clear);
  motion.addEventListener('change', clear);
  resize();
})();
