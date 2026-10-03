import * as THREE from 'three';
import { STATE_VISUALS, QUALITY_TIERS, approachVisual } from './shaheenRuntime.js';

const vertexShader = `
  varying vec3 vLocal;
  varying vec3 vNormal;
  void main() {
    vLocal = position / .64;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;
const fragmentShader = `
  uniform float uTime;
  uniform float uSamples;
  uniform float uEnergy;
  uniform float uAmber;
  uniform float uSaturation;
  uniform vec3 uRay;
  uniform float uRichness;
  uniform vec3 uGreen;
  uniform vec3 uGreenShadow;
  uniform vec3 uGreenLight;
  varying vec3 vLocal;
  varying vec3 vNormal;
  float field(vec3 p) {
    return .5 + .5 * sin(p.x * 5.2 + sin(p.z * 4.1))
      * sin(p.y * 4.8 - p.z * 2.6) * cos(p.z * 4.5 + p.x * 2.);
  }
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = vec3(0., 0., 1.);
    vec3 L = normalize(vec3(-.65, .85, 1.1));
    float diffuse = max(dot(N, L), 0.);
    float facing = max(dot(N, V), 0.);
    vec3 greenBody = uGreen;
    vec3 greenLight = uGreenLight;
    // Branded green fill keeps the unlit hemisphere green, with a soft key light.
    vec3 color = mix(uGreenShadow, greenBody, pow(diffuse, .85));
    color = mix(color, greenLight, diffuse * .24);
    // Actual rotating material coordinates and six samples through a spherical chord.
    // Inner bands move at a different rate than the surface, creating real parallax.
    vec3 ray = normalize(uRay);
    float chord = max(0., 2. * dot(vLocal, ray));
    float density = 0.;
    float bands = 0.;
    for (int i = 0; i < 6; i++) {
      if (float(i) >= uSamples) break;
      float depth = (float(i) + .5) / uSamples;
      vec3 p = vLocal - ray * chord * depth;
      p.x += .12 * sin(uTime * .14 + depth * 2.);
      p.z += uTime * .018;
      float attenuation = (1. - dot(p, p)) * exp(-depth * 1.8);
      density += field(p * 1.25) * attenuation / uSamples;
      float band = p.y + .18 * sin(p.x * 4. + uTime * .17)
        + .14 * sin(p.z * 3.8 - uTime * .11);
      bands += exp(-55. * band * band) * attenuation / uSamples;
    }
    float skin = field(vLocal * 1.8);
    color *= 1. + .06 * uRichness * (skin - .5);
    color += greenBody * density * uRichness * .35;
    color += greenLight * bands * uRichness * .45;
    // Preserve the fixed key light and slowly moving premium reflections.
    vec3 reflectionLight = normalize(vec3(-.65 + .12 * sin(uTime * .19), .85, 1.35));
    vec3 H = normalize(reflectionLight + V);
    float gloss = pow(max(dot(N, H), 0.), 75. + 40. * uRichness);
    float softGloss = pow(max(dot(N, normalize(L + V)), 0.), 15.);
    color += vec3(.94, .98, .85) * softGloss * .09;
    color = mix(color, vec3(.96, .985, .92), gloss * .55);
    float softbox = exp(-95. * pow(N.x + .68 + .035 * sin(uTime * .2), 2.))
      * smoothstep(.0, .65, N.y);
    color = mix(color, vec3(.89, .94, .78), softbox * (.10 + .10 * uRichness));
    float rim = pow(1. - facing, 3.4);
    color += vec3(.722, .812, .459) * rim * (.14 + .46 * diffuse);
    color *= 1. - .15 * pow(1. - facing, 1.5);
    color = max(color, uGreenShadow * .92);
    color *= uEnergy;
    color = mix(color, vec3(.75, .49, .16), uAmber * rim);
    color = mix(vec3(dot(color, vec3(.2126, .7152, .0722))), color, uSaturation);
    gl_FragColor = vec4(clamp(color, 0., 1.), 1.);
  }
`;

/** @param {HTMLButtonElement | null} [hit] */
export function createOrb(host, variant, cap, aura, shadow, hit = null, lifecycle = {}) {
  let failed = false;
  let checked = false;
  const fail = () => { failed = true; lifecycle.onError?.(); };
  const contextLost = event => { event.preventDefault(); fail(); };
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.prepend(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.1, 1.1, 1.1, -1.1, .1, 20);
  camera.position.set(0, 0, 4);
  const styles = getComputedStyle(host);
  const brand = (token, fallback) => styles.getPropertyValue(token).trim() || fallback;
  const palette = {
    green: brand('--color-brand-primary-500', '#8BB83C'),
    shadow: brand('--color-brand-primary-600', '#70952f'),
    light: brand('--color-brand-primary-400', '#a1c04f'),
    navy: brand('--color-brand-navy-500', '#132231'),

  };
  // This custom shader emits display RGB; Three stores parsed colors in linear RGB.
  const displayColor = color => new THREE.Color(color).convertLinearToSRGB();
  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    uniforms: { uSamples: { value: 6 }, uEnergy: { value: 1 }, uAmber: { value: 0 }, uSaturation: { value: 1 }, uTime: { value: 0 }, uRay: { value: new THREE.Vector3(0, 0, 1) }, uRichness: { value: [.25, .85, 1.45][variant - 1] },
      uGreen: { value: displayColor(palette.green) }, uGreenShadow: { value: displayColor(palette.shadow) }, uGreenLight: { value: displayColor(palette.light) } },
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(.64, 64, 48), material);
  scene.add(sphere);
  // Curved emblem: the original Lucide paths, projected onto the actual sphere.
  // Its geometry and texture rotate with the material and use the same depth buffer.
  const emblemCanvas = document.createElement('canvas');
  emblemCanvas.width = emblemCanvas.height = 256;
  const emblemContext = emblemCanvas.getContext('2d');
  emblemContext.scale(256 / 24, 256 / 24);
  emblemContext.strokeStyle = '#ffffff';
  emblemContext.lineWidth = 2;
  emblemContext.lineCap = 'round';
  emblemContext.lineJoin = 'round';
  cap.querySelectorAll('path').forEach(path => emblemContext.stroke(new Path2D(path.getAttribute('d'))));
  const emblemTexture = new THREE.CanvasTexture(emblemCanvas);
  const emblemGeometry = new THREE.PlaneGeometry(.4125, .4125, 20, 20);
  const positions = emblemGeometry.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sqrt(.646 ** 2 - positions.getX(i) ** 2 - positions.getY(i) ** 2));
  emblemGeometry.computeVertexNormals();
  const emblem = new THREE.Mesh(emblemGeometry, new THREE.MeshBasicMaterial({ map: emblemTexture, transparent: true, depthWrite: false }));
  sphere.add(emblem);
  emblem.visible = false;
  const rings = [
    { radius: .98, tilt: Math.acos(34 / 98), angle: THREE.MathUtils.degToRad(22), period: 34 },
    { radius: .92, tilt: -Math.acos(38 / 92), angle: THREE.MathUtils.degToRad(-30), period: 40 },
  ].map((config, index) => {
    const group = new THREE.Group();
    const points = Array.from({ length: 257 }, (_, i) => new THREE.Vector3(config.radius * Math.cos(i * Math.PI * 2 / 256), config.radius * Math.sin(i * Math.PI * 2 / 256), 0));
    const lineMaterial = index === 0
      ? new THREE.LineDashedMaterial({ color: palette.green, dashSize: .07, gapSize: .04, transparent: true, opacity: .72, depthWrite: false })
      : new THREE.LineBasicMaterial({ color: palette.navy, transparent: true, opacity: .76, depthWrite: false });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
    line.computeLineDistances();
    group.add(line);
    scene.add(group);
    return { ...config, group };
  });
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const ctx = glowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(161,192,79,.65)');
  gradient.addColorStop(.3, 'rgba(139,184,60,.24)');
  gradient.addColorStop(1, 'rgba(139,184,60,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const beadGeometry = new THREE.SphereGeometry(1, 14, 10);
  const colors = [palette.green, palette.navy, palette.green, palette.navy, palette.green];
  const beads = [.045, .04, .035, .045, .035].map((radius, i) => {
    const beadMaterial = new THREE.MeshBasicMaterial({ color: colors[i], transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(beadGeometry, beadMaterial);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false, opacity: .6 }));
    scene.add(mesh, glow);
    return { mesh, glow, radius };
  });
  let size = 192;
  let lastTime = 0;
  let reduced = false;
  const interactive = Boolean(hit);
  const settings = { idle: true, orbits: true, particles: true, capMode: 'surface', applicationState: 'idle', quality: 'high', interactionEnabled: true, energy: 1, glow: 1 };
  const visual = { ...STATE_VISUALS.idle };
  let hovering = false;
  let stateAge = 0;
  const orientation = new THREE.Quaternion();
  const viewingOrientation = new THREE.Quaternion();
  const velocity = new THREE.Vector3();
  const stepQuaternion = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const ray = new THREE.Vector3();
  const point = new THREE.Vector3();
  const identity = new THREE.Quaternion();
  const inverseOrientation = new THREE.Quaternion();
  let dragging = false;
  let pointer = null;
  let lastPointer = null;
  let releaseTime = -10;
  let idleBlend = 1;
  let reset = null;
  let orbitTime = 0;
  let particleTime = 0;
  let motionTime = 0;
  function rotate(x, y, z = 0) {
    euler.set(x, y, z);
    stepQuaternion.setFromEuler(euler);
    orientation.premultiply(stepQuaternion).normalize();
  }
  function resetView() {
    dragging = false;
    velocity.set(0, 0, 0);
    idleBlend = 0;
    releaseTime = lastTime + .7;
    reset = { start: lastTime, from: orientation.clone() };
    if (hit) {
      hit.dataset.dragging = 'false';
      if (pointer !== null && hit.hasPointerCapture(pointer)) hit.releasePointerCapture(pointer);
      pointer = null;
    }
  }
  function pointerDown(event) {
    if (!settings.interactionEnabled || settings.applicationState === 'disabled' || event.button !== 0 || pointer !== null || !event.isPrimary) return;
    hit.focus({ preventScroll: true });
    hit.setPointerCapture(event.pointerId);
    pointer = event.pointerId;
    dragging = true;
    reset = null;
    idleBlend = 0;
    velocity.set(0, 0, 0);
    lastPointer = { x: event.clientX, y: event.clientY, time: event.timeStamp, simulation: lastTime };
    hit.dataset.dragging = 'true';
    event.preventDefault();
  }
  function pointerMove(event) {
    if (!dragging || event.pointerId !== pointer) return;
    const factor = 4.5 / size;
    const x = (event.clientY - lastPointer.y) * factor;
    const y = (event.clientX - lastPointer.x) * factor;
    rotate(x, y);
    const elapsed = lastTime - lastPointer.simulation;
    const dt = Math.max(.012, elapsed > 0 ? elapsed : (event.timeStamp - lastPointer.time) / 1000);
    velocity.set(x / dt, y / dt, 0).clampLength(0, 2.2);
    lastPointer = { x: event.clientX, y: event.clientY, time: event.timeStamp, simulation: lastTime };
    releaseTime = lastTime;
    draw(lastTime, reduced, true);
  }
  function pointerUp(event) {
    if (event.pointerId !== pointer) return;
    if (event.type === 'pointercancel' || event.type === 'lostpointercapture' || event.timeStamp - lastPointer.time > 120) velocity.set(0, 0, 0);
    dragging = false;
    pointer = null;
    releaseTime = lastTime;
    hit.dataset.dragging = 'false';
    if (hit.hasPointerCapture(event.pointerId)) hit.releasePointerCapture(event.pointerId);
    if (reduced) velocity.set(0, 0, 0);
  }
  function keyboard(event) {
    if (!settings.interactionEnabled || settings.applicationState === 'disabled') return;
    const axes = { ArrowLeft: [0, -1, 0], ArrowRight: [0, 1, 0], ArrowUp: [-1, 0, 0], ArrowDown: [1, 0, 0], q: [0, 0, 1], e: [0, 0, -1] };
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!axes[key] && key !== 'r' && key !== ' ') return;
    event.preventDefault();
    if (key === 'r') resetView();
    else if (key === ' ') {
      settings.idle = !settings.idle;
      host.dispatchEvent(new CustomEvent('idlechange', { detail: settings.idle }));
    } else {
      reset = null;
      idleBlend = 0;
      releaseTime = lastTime;
      if (reduced) rotate(...axes[key].map(value => value * .09));
      else velocity.add(new THREE.Vector3(...axes[key]).multiplyScalar(.8)).clampLength(0, 2.2);
    }
    draw(lastTime, reduced, true);
  }
  const enter = () => { hovering = true; };
  const leave = () => { hovering = false; };
  if (hit) {
    hit.addEventListener('pointerenter', enter);
    hit.addEventListener('pointerleave', leave);
    hit.addEventListener('pointerdown', pointerDown);
    hit.addEventListener('pointermove', pointerMove);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => hit.addEventListener(event, pointerUp));
    hit.addEventListener('keydown', keyboard);
    hit.addEventListener('dblclick', resetView);
  }
  function draw(seconds, still = false, paused = false) {
    if (failed) return;
    const dt = Math.max(0, seconds - lastTime);
    lastTime = seconds;
    reduced = still;
    if (!paused && !still) stateAge += Math.min(dt, .1);
    const target = STATE_VISUALS[settings.applicationState] || STATE_VISUALS.idle;
    if (still) Object.assign(visual, target);
    else approachVisual(visual, target, Math.min(dt, .1));
    material.uniforms.uEnergy.value = visual.energy * settings.energy * (hovering && !still ? 1.025 : 1);
    material.uniforms.uAmber.value = visual.amber;
    material.uniforms.uSaturation.value = visual.saturation;
    if (!still && !paused) motionTime += dt * visual.orbitSpeed;
    const t = motionTime;
    if (!still && !paused) {
      if (settings.orbits) orbitTime += dt * visual.orbitSpeed;
      if (settings.particles) particleTime += dt * visual.activity;
    }
    if (interactive) {
      if (reset) {
        const progress = Math.min(1, (seconds - reset.start) / .7);
        const ease = progress * progress * (3 - 2 * progress);
        orientation.slerpQuaternions(reset.from, identity, ease);
        if (progress === 1) reset = null;
      } else if (!dragging && !still && !paused) {
        const damping = Math.exp(-3.1 * dt);
        const travel = (1 - damping) / 3.1;
        rotate(velocity.x * travel, velocity.y * travel, velocity.z * travel);
        velocity.multiplyScalar(damping);
        if (velocity.length() < .002) velocity.set(0, 0, 0);
        const target = settings.idle && seconds - releaseTime > 1.1 && velocity.length() < .035 ? 1 : 0;
        idleBlend += (target - idleBlend) * (1 - Math.exp(-3 * dt));
        if (settings.idle) rotate(0, dt * Math.PI * 2 / 36 * idleBlend * visual.orbitSpeed, 0);
      }
      if (still) velocity.set(0, 0, 0);
      sphere.quaternion.copy(orientation);
      viewingOrientation.slerpQuaternions(identity, orientation, .18);
    }
    const successPulse = settings.applicationState === 'success' && !still ? Math.sin(Math.PI * Math.min(1, stateAge / 1.4)) : 0;
    const breath = 1 + (.012 + visual.pulse) * (1 - Math.cos(t * Math.PI * 2 / 9)) / 2 + successPulse * .018;
    material.uniforms.uEnergy.value *= 1 + successPulse * .06;
    const lift = 2.5 * Math.sin(t * Math.PI * 2 / 8);
    const angle = t * Math.PI * 2 / [42, 36, 32][variant - 1];
    if (!interactive) sphere.rotation.y = angle;
    sphere.position.y = lift / size * 2.2;
    sphere.scale.setScalar(breath * 1.10);
    material.uniforms.uTime.value = t;
    inverseOrientation.copy(sphere.quaternion).invert();
    ray.set(0, 0, 1).applyQuaternion(inverseOrientation);
    material.uniforms.uRay.value.copy(ray);
    emblem.visible = settings.capMode === 'surface';
    cap.style.visibility = emblem.visible ? 'hidden' : 'visible';
    cap.style.transform = `translateY(${-lift}px) scale(${breath})`;
    aura.style.opacity = String((.80 + .12 * (1 + Math.sin(t * .45)) / 2) * visual.energy * settings.glow);
    shadow.style.transform = `scale(${1 - lift * .025})`;
    shadow.style.opacity = String(.6 - lift * .05);
    rings.forEach((ring, i) => {
      ring.group.rotation.set(ring.tilt, 0, ring.angle + (i === 0 ? 1 : -1) * orbitTime * Math.PI * 2 / ring.period, 'ZXY');
      if (interactive) ring.group.quaternion.premultiply(viewingOrientation);
    });
    beads.forEach((bead, i) => {
      bead.mesh.visible = settings.particles && i < QUALITY_TIERS[settings.quality].particles && (!still || i < 2);
      bead.glow.visible = bead.mesh.visible && settings.quality !== 'low';
      const ring = rings[i % 2];
      const phase = [2.8, .3, 1.4, 4.7, 5.5][i] + (i === 1 || i === 4 ? -1 : 1) * particleTime * Math.PI * 2 / [8.5, 11, 13, 10, 14][i] + .035 * Math.sin(particleTime * .4 + i);
      const p = point.set(ring.radius * Math.cos(phase), ring.radius * Math.sin(phase), 0);
      p.applyQuaternion(ring.group.quaternion);
      bead.mesh.position.copy(p);
      bead.glow.position.copy(p);
      const depthScale = .88 + .16 * (p.z + 1) / 2;
      bead.mesh.scale.setScalar(bead.radius * depthScale);
      bead.mesh.material.opacity = p.z > 0 ? 1 : .48;
      bead.glow.scale.setScalar(bead.radius * depthScale * 5.5);
      bead.glow.material.opacity = (p.z > 0 ? .72 : .36) * (.9 + .1 * Math.sin(t * .8 + i));
    });
    renderer.render(scene, camera);
    if (!checked) {
      checked = true;
      const gl = renderer.getContext();
      if (renderer.info.programs?.some(program => !gl.getProgramParameter(program.program, gl.LINK_STATUS))) { fail(); return; }
    }
    lifecycle.onFrame?.();
  }
  const observer = new ResizeObserver(entries => {
    size = Math.max(1, entries[0].contentRect.width);
    renderer.setSize(size, size, false);
    draw(lastTime, reduced);
  });
  observer.observe(host);
  draw(0);
  return {
    draw,
    syncTime(seconds) { lastTime = seconds; },
    reset: resetView,
    configure(values) {
      const previousQuality = settings.quality;
      if (values.applicationState && values.applicationState !== settings.applicationState) stateAge = 0;
      Object.assign(settings, values);
      const tier = QUALITY_TIERS[settings.quality] || QUALITY_TIERS.high;
      if (settings.quality !== previousQuality) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr));
        renderer.setSize(size, size, false);
      }
      material.uniforms.uSamples.value = tier.samples;
      if (!settings.interactionEnabled || settings.applicationState === 'disabled') {
        velocity.set(0, 0, 0);
        if (pointer !== null) pointerUp({ pointerId: pointer, type: 'pointercancel' });
      }
      draw(lastTime, reduced, true);
    },
    state: () => ({ geometry: sphere.geometry.type, surfaceAngle: sphere.rotation.y, rings: rings.map(ring => ring.group.rotation.z), reduced, size,
      applicationState: settings.applicationState, interactionState: reduced ? 'reduced-motion' : dragging ? 'interacting' : hovering ? 'hover' : 'resting', quality: settings.quality, dpr: renderer.getPixelRatio(), energy: visual.energy, orbitSpeed: visual.orbitSpeed, amber: visual.amber, webgl: failed ? 'failed' : 'ready',
      interactive, orientation: orientation.toArray(), speed: velocity.length(), dragging, resetting: Boolean(reset), idleBlend, idleEnabled: settings.idle, capMode: settings.capMode, orbitTime, particleTime }),
    dispose() {
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      if (hit) {
        if (pointer !== null) pointerUp({ pointerId: pointer, type: 'pointercancel' });
        hit.removeEventListener('pointerenter', enter);
        hit.removeEventListener('pointerleave', leave);
        hit.removeEventListener('pointerdown', pointerDown);
        hit.removeEventListener('pointermove', pointerMove);
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => hit.removeEventListener(event, pointerUp));
        hit.removeEventListener('keydown', keyboard);
        hit.removeEventListener('dblclick', resetView);
      }
      observer.disconnect();
      const geometries = new Set();
      const materials = new Set();
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(item => item.dispose());
      glowTexture.dispose();
      emblemTexture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
