(() => {
  'use strict';
  const heading = document.querySelector('.composition');
  if (!heading) return;
  const segments = [...heading.querySelectorAll('.intro-text')];
  if (!segments.length) return;
  const contact = document.getElementById('contact');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const words = [];
  segments.forEach((segment) => {
    const text = segment.textContent.trim();
    const copy = document.createElement('span');
    copy.className = 'intro-copy';
    copy.setAttribute('aria-hidden', 'true');
    text.split(/\s+/).forEach((word, index) => {
      if (index) copy.append(document.createTextNode(' '));
      const element = document.createElement('span');
      element.className = 'intro-word';
      const node = document.createTextNode(word);
      const baseline = document.createElement('span');
      baseline.className = 'intro-baseline';
      element.append(node, baseline);
      copy.append(element);
      words.push({ element, node, baseline, text: word });
    });
    segment.replaceChildren(copy);
  });
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-surface';
  canvas.setAttribute('aria-hidden', 'true');
  heading.append(canvas);
  let gl;
  try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }); }
  catch { return; }
  if (!gl) return;

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_text;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    uniform vec3 u_color;
    uniform float u_radius;
    uniform float u_depth;
    uniform float u_softness;
    uniform float u_shadow;
    uniform float u_highlight;
    uniform float u_strength;
    float bumpProfile(float normalizedDistance) {
      float x = clamp(1.0 - normalizedDistance, 0.0, 1.0);
      float smoothBump = x * x * (3.0 - 2.0 * x);
      return pow(smoothBump, mix(0.7, 2.4, u_softness));
    }
    float textAlpha(vec2 uv) {
      vec2 insideLow = step(vec2(0.0), uv);
      vec2 insideHigh = step(uv, vec2(1.0));
      float inside = insideLow.x * insideLow.y * insideHigh.x * insideHigh.y;
      return texture2D(u_text, clamp(uv, 0.0, 1.0)).a * inside;
    }
    void main() {
      vec2 safeResolution = max(u_resolution, vec2(1.0));
      vec2 deltaPx = (v_uv - u_mouse / safeResolution) * safeResolution;
      float distancePx = length(deltaPx);
      float normalizedDistance = distancePx / max(u_radius, 1.0);
      float height = bumpProfile(normalizedDistance) * u_strength;
      vec2 direction = deltaPx / max(distancePx, 0.0001);

      // The reference's radial displacement lifts the glyphs around the cursor.
      vec2 warpedUv = v_uv - direction * (vec2(u_radius) / safeResolution) * height * u_depth * 0.105;
      float glyph = textAlpha(warpedUv);
      vec2 texel = 1.0 / safeResolution;
      vec2 shadowUv = v_uv + vec2(2.5, 5.0) * texel;
      vec2 blurX = vec2(6.0, 0.0) * texel;
      vec2 blurY = vec2(0.0, 6.0) * texel;
      float shadowMask = textAlpha(shadowUv) * 0.20;
      shadowMask += textAlpha(shadowUv + blurX) * 0.12;
      shadowMask += textAlpha(shadowUv - blurX) * 0.12;
      shadowMask += textAlpha(shadowUv + blurY) * 0.12;
      shadowMask += textAlpha(shadowUv - blurY) * 0.12;
      shadowMask += textAlpha(shadowUv + blurX + blurY) * 0.08;
      shadowMask += textAlpha(shadowUv + blurX - blurY) * 0.08;
      shadowMask += textAlpha(shadowUv - blurX + blurY) * 0.08;
      shadowMask += textAlpha(shadowUv - blurX - blurY) * 0.08;
      shadowMask *= u_shadow * (1.0 - height * 0.92);

      float x = clamp(1.0 - normalizedDistance, 0.0, 1.0);
      float slope = 6.0 * x * (1.0 - x) * u_depth * u_strength;
      vec3 normal = normalize(vec3(-direction.x * slope, direction.y * slope, 1.7));
      vec3 lightDirection = normalize(vec3(-0.55, -0.78, 1.25));
      float lighting = (dot(normal, lightDirection) - 0.57) * u_highlight * height;
      float rimDirection = max(dot(direction, normalize(vec2(-0.55, -0.84))), 0.0);
      float rim = smoothstep(0.15, 0.62, normalizedDistance)
        * (1.0 - smoothstep(0.66, 1.18, normalizedDistance))
        * rimDirection * u_highlight * u_strength;
      vec3 litText = clamp(u_color + u_color * lighting * 0.52 + vec3(rim * 0.11), 0.0, 1.0);

      // Composite the reference's shadow and raised text over the existing gradient.
      float shadowAlpha = shadowMask * 0.38;
      float alpha = glyph + shadowAlpha * (1.0 - glyph);
      gl_FragColor = vec4(litText * glyph, alpha);
    }
  `;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('Text shader unavailable'); }
    return shader;
  }
  let program;
  try {
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Text program unavailable');
  } catch { return; }
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['u_text','u_resolution','u_mouse','u_color','u_radius','u_depth','u_softness','u_shadow','u_highlight','u_strength'].map((name) => [name, gl.getUniformLocation(program, name)]));
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.uniform1i(uniforms.u_text, 0);
  gl.uniform1f(uniforms.u_depth, .9);
  gl.uniform1f(uniforms.u_softness, .42);
  gl.uniform1f(uniforms.u_shadow, .78);
  gl.uniform1f(uniforms.u_highlight, .68);
  gl.disable(gl.BLEND);
  gl.clearColor(0,0,0,0);

  const padding = 64;
  const raster = document.createElement('canvas');
  const context = raster.getContext('2d');
  if (!context) return;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, targetStrength: 0, active: false };
  let ratio = 1, width = 0, height = 0, ready = false, lost = false, frame = 0, lastTime = 0;
  function render() {
    if (!ready || lost) return;
    gl.uniform2f(uniforms.u_mouse, pointer.x, pointer.y);
    gl.uniform1f(uniforms.u_strength, reducedMotion.matches ? 0 : pointer.strength);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function resetPointer() {
    pointer.active = false;
    pointer.x = pointer.targetX = width / 2;
    pointer.y = pointer.targetY = height / 2;
    pointer.strength = pointer.targetStrength = 0;
  }
  function buildTexture() {
    if (lost) return;
    const bounds = heading.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const style = getComputedStyle(segments[0]);
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = bounds.width + padding * 2;
    height = bounds.height + padding * 2;
    canvas.width = raster.width = Math.ceil(width * ratio);
    canvas.height = raster.height = Math.ceil(height * ratio);
    Object.assign(canvas.style, { left: `${-padding}px`, top: `${-padding}px`, width: `${width}px`, height: `${height}px` });
    context.setTransform(ratio,0,0,ratio,0,0);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';
    context.fillStyle = '#fff';
    if ('fontKerning' in context) context.fontKerning = style.fontKerning;
    if ('letterSpacing' in context) context.letterSpacing = style.letterSpacing;
    for (const word of words) {
      const rect = word.element.getBoundingClientRect();
      const baseline = word.baseline.getBoundingClientRect().top - bounds.top + padding;
      if ('letterSpacing' in context) context.fillText(word.text, rect.left - bounds.left + padding, baseline);
      else {
        const range = document.createRange();
        let offset = 0;
        for (const character of word.text) {
          range.setStart(word.node, offset);
          offset += character.length;
          range.setEnd(word.node, offset);
          context.fillText(character, range.getBoundingClientRect().left - bounds.left + padding, baseline);
        }
      }
    }
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,raster);
    gl.uniform2f(uniforms.u_resolution, width, height);
    gl.uniform1f(uniforms.u_radius, Math.min(220, Math.max(width, height)));
    const color = style.color.match(/[\d.]+/g)?.map(Number) || [245,246,255];
    gl.uniform3f(uniforms.u_color, color[0]/255, color[1]/255, color[2]/255);
    ready = true;
    if (!pointer.active) resetPointer();
    render();
    heading.classList.toggle('surface-ready', !reducedMotion.matches);
  }
  function animate(time) {
    frame = 0;
    if (document.hidden || reducedMotion.matches || lost) return;
    const elapsed = Math.min(time - (lastTime || time - 1000/60), 50);
    lastTime = time;
    const ease = 1 - Math.pow(.82, elapsed / (1000/60));
    pointer.x += (pointer.targetX - pointer.x) * ease;
    pointer.y += (pointer.targetY - pointer.y) * ease;
    pointer.strength += (pointer.targetStrength - pointer.strength) * ease;
    render();
    if (Math.abs(pointer.x - pointer.targetX) > .05 || Math.abs(pointer.y - pointer.targetY) > .05 || Math.abs(pointer.strength - pointer.targetStrength) > .001) frame = requestAnimationFrame(animate);
    else {
      pointer.x = pointer.targetX;
      pointer.y = pointer.targetY;
      pointer.strength = pointer.targetStrength;
      render();
      lastTime = 0;
    }
  }
  function start() {
    if (!frame && ready && !document.hidden && !reducedMotion.matches && !lost) frame = requestAnimationFrame(animate);
  }
  function move(event) {
    if (!ready || reducedMotion.matches || lost) return;
    if (contact?.contains(event.target)) { release(); return; }
    const bounds = heading.getBoundingClientRect();
    pointer.targetX = event.clientX - bounds.left + padding;
    pointer.targetY = event.clientY - bounds.top + padding;
    pointer.targetStrength = 1;
    pointer.active = true;
    start();
  }
  function release() {
    pointer.active = false;
    pointer.targetStrength = 0;
    start();
  }
  heading.addEventListener('pointermove', move, { passive: true });
  heading.addEventListener('pointerdown', move, { passive: true });
  heading.addEventListener('pointerleave', release);
  heading.addEventListener('pointercancel', release);
  heading.addEventListener('pointerup', (event) => { if (event.pointerType === 'touch') release(); }, { passive: true });
  window.addEventListener('blur', release);
  window.addEventListener('resize', buildTexture, { passive: true });
  new ResizeObserver(buildTexture).observe(heading);
  document.fonts.ready.then(buildTexture);
  document.fonts.addEventListener('loadingdone', buildTexture);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (!document.hidden) { resetPointer(); render(); }
  });
  reducedMotion.addEventListener('change', () => {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    resetPointer(); render();
    heading.classList.toggle('surface-ready', ready && !lost && !reducedMotion.matches);
  });
  canvas.addEventListener('webglcontextlost', () => {
    lost = true; cancelAnimationFrame(frame); frame = 0;
    heading.classList.remove('surface-ready');
  });
  buildTexture();
})();
