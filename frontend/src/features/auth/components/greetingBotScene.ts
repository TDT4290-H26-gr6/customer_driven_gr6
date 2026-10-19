// An interactive 3D greeting robot for the login page, drawn with three.js.
// It follows the pointer with its head and eyes, blinks, waves on load, every
// few seconds and when clicked, and stops rendering while it's off screen.
// Only GreetingBot.tsx imports this, lazily, so three stays out of the main
// bundle.
//
//   const bot = createGreetingBot(container);
//   bot.wave();               // wave on demand
//   bot.setEyesClosed(true);  // e.g. while a password field is focused
//   bot.dispose();            // on unmount

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export type GreetingBotOptions = {
  /** Eyes, antenna, chest light. */
  accent?: number;
  /** Shell colour. */
  body?: number;
  /** Joints and neck. */
  trim?: number;
  /** Face screen. */
  visor?: number;
  /** Wave on load and every `waveEvery` seconds. */
  autoWave?: boolean;
  waveEvery?: number;
  waveOnClick?: boolean;
};

export type GreetingBot = {
  wave: (duration?: number) => void;
  setEyesClosed: (closed: boolean) => void;
  dispose: () => void;
};

type Disposable = { dispose: () => void };

export function createGreetingBot(
  container: HTMLElement,
  options: GreetingBotOptions = {},
): GreetingBot {
  const o = {
    accent: 0x5ee7ff,
    body: 0xf3f5fa,
    trim: 0x2a3142,
    visor: 0x080b14,
    autoWave: true,
    waveEvery: 8,
    waveOnClick: true,
    ...options,
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { display: "block", width: "100%", height: "100%" });
  if (o.waveOnClick) canvas.style.cursor = "pointer";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const LOOK_Y = 0.55;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a8, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(o.accent), 1.2);
  rim.position.set(-4, 3, -4);
  scene.add(rim);

  // ---------- materials ----------
  const disposables: Disposable[] = [];
  const track = <T extends Disposable>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const shell = track(
    new THREE.MeshPhysicalMaterial({
      color: o.body,
      roughness: 0.28,
      metalness: 0.0,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
    }),
  );
  const trim = track(
    new THREE.MeshStandardMaterial({ color: o.trim, roughness: 0.45, metalness: 0.3 }),
  );
  const visorMat = track(
    new THREE.MeshPhysicalMaterial({
      color: o.visor,
      roughness: 0.08,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
  );
  const glow = track(
    new THREE.MeshStandardMaterial({
      color: o.accent,
      emissive: o.accent,
      emissiveIntensity: 2.2,
      roughness: 0.3,
    }),
  );

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => new THREE.Mesh(track(geo), mat);

  // ---------- robot ----------
  const root = new THREE.Group(); // intro scale + hover bob
  const bot = new THREE.Group(); // body sway
  root.add(bot);
  scene.add(root);

  // torso
  const torso = mesh(new THREE.SphereGeometry(0.82, 48, 32), shell);
  torso.scale.set(1, 1.08, 0.86);
  bot.add(torso);
  const chest = mesh(new THREE.TorusGeometry(0.13, 0.035, 12, 40), glow);
  chest.position.set(0, 0.1, 0.71);
  bot.add(chest);
  const chestDot = mesh(new THREE.CircleGeometry(0.06, 24), glow);
  chestDot.position.set(0, 0.1, 0.715);
  bot.add(chestDot);
  // hover base under torso
  const skirt = mesh(new THREE.CylinderGeometry(0.42, 0.28, 0.22, 40), trim);
  skirt.position.y = -0.92;
  bot.add(skirt);
  const thruster = mesh(new THREE.CircleGeometry(0.24, 32), glow);
  thruster.rotation.x = Math.PI / 2;
  thruster.position.y = -1.035;
  bot.add(thruster);

  // neck + head
  const neck = mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.3, 32), trim);
  neck.position.y = 0.9;
  bot.add(neck);

  const head = new THREE.Group();
  head.position.y = 1.62;
  bot.add(head);

  const skull = mesh(new RoundedBoxGeometry(2.0, 1.42, 1.45, 8, 0.5), shell);
  head.add(skull);

  const visor = mesh(new RoundedBoxGeometry(1.66, 1.02, 0.3, 8, 0.14), visorMat);
  visor.position.z = 0.62;
  head.add(visor);
  const FACE_Z = 0.78;

  const eyes = new THREE.Group();
  eyes.position.z = FACE_Z;
  head.add(eyes);
  const eyeGeo = track(new THREE.CapsuleGeometry(0.1, 0.2, 8, 20));
  const eyeL = new THREE.Mesh(eyeGeo, glow);
  const eyeR = new THREE.Mesh(eyeGeo, glow);
  eyeL.position.set(-0.36, 0.08, 0);
  eyeR.position.set(0.36, 0.08, 0);
  eyes.add(eyeL, eyeR);

  const mouth = mesh(new THREE.TorusGeometry(0.13, 0.028, 10, 32, Math.PI), glow);
  mouth.rotation.z = Math.PI; // smile
  mouth.position.set(0, -0.2, 0);
  eyes.add(mouth);

  // ears
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 32), trim);
    ear.rotation.z = Math.PI / 2;
    ear.position.x = s * 1.02;
    head.add(ear);
    const ring = mesh(new THREE.TorusGeometry(0.15, 0.03, 10, 32), glow);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = s * 1.11;
    head.add(ring);
  }

  // antenna
  const antenna = new THREE.Group();
  antenna.position.y = 0.7;
  head.add(antenna);
  const stalk = mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.42, 12), trim);
  stalk.position.y = 0.2;
  antenna.add(stalk);
  const bulbMat = track(glow.clone());
  const bulb = mesh(new THREE.SphereGeometry(0.11, 24, 16), bulbMat);
  bulb.position.y = 0.45;
  antenna.add(bulb);

  // arms: shoulder group → upper arm → elbow group → forearm + hand
  function makeArm(side: number) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.86, 0.28, 0);
    const joint = mesh(new THREE.SphereGeometry(0.2, 24, 16), trim);
    shoulder.add(joint);
    const upper = mesh(new THREE.CapsuleGeometry(0.15, 0.4, 8, 16), shell);
    upper.position.y = -0.38;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.7;
    shoulder.add(elbow);
    const ej = mesh(new THREE.SphereGeometry(0.13, 20, 14), trim);
    elbow.add(ej);
    const fore = mesh(new THREE.CapsuleGeometry(0.14, 0.3, 8, 16), shell);
    fore.position.y = -0.3;
    elbow.add(fore);
    const hand = mesh(new THREE.SphereGeometry(0.21, 28, 20), shell);
    hand.scale.set(1, 1.05, 0.8);
    hand.position.y = -0.6;
    elbow.add(hand);
    bot.add(shoulder);
    return { shoulder, elbow };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // soft contact shadow
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const g = shadowCanvas.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(0,0,0,0.45)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const shadowTex = track(new THREE.CanvasTexture(shadowCanvas));
  const shadowMat = track(
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  const shadow = mesh(new THREE.PlaneGeometry(2.2, 2.2), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.55;
  scene.add(shadow);

  // ---------- sizing ----------
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole robot (incl. raised arm) in frame for any aspect ratio
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(2.6 / t, 2.2 / (t * camera.aspect));
    camera.position.set(0, LOOK_Y + 0.4, dist);
    camera.lookAt(0, LOOK_Y, 0);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // ---------- input ----------
  const pointer = { x: 0, y: 0, active: false };
  function onMove(e: PointerEvent) {
    const r = container.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.35; // roughly where the face sits
    pointer.x = THREE.MathUtils.clamp((e.clientX - cx) / (window.innerWidth * 0.5), -1, 1);
    pointer.y = THREE.MathUtils.clamp(-(e.clientY - cy) / (window.innerHeight * 0.5), -1, 1);
    pointer.active = true;
  }
  function onLeave() {
    pointer.active = false;
  }
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  const onClick = () => wave();
  if (o.waveOnClick) canvas.addEventListener("click", onClick);

  // ---------- animation state ----------
  let lastTime: number | null = null;
  let t = 0;
  let waveStart = -1;
  let waveDur = 0;
  let nextAutoWave = o.autoWave ? 0.9 : Infinity;
  let nextBlink = 2.5;
  let blinkT = -1;
  let eyesClosed = false;
  let closeAmt = 0;
  const look = { x: 0, y: 0 };

  function wave(duration = 2.4) {
    if (waveStart >= 0 && t - waveStart < waveDur) return;
    waveStart = t;
    waveDur = duration;
  }
  function setEyesClosed(closed: boolean) {
    eyesClosed = closed;
  }

  const damp = (cur: number, target: number, k: number, dt: number) =>
    THREE.MathUtils.lerp(cur, target, 1 - Math.exp(-k * dt));
  const easeOutBack = (x: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
  };
  const smooth = (x: number) => x * x * (3 - 2 * x);

  // ---------- loop ----------
  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  io.observe(container);

  // `time` is the frame timestamp in ms; dt is capped so a background tab
  // doesn't jump the animation forward.
  function frame(time: number) {
    const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    if (!visible || document.hidden) return;
    t += dt;

    // intro pop
    const intro = Math.min(t / 0.9, 1);
    root.scale.setScalar(0.6 + 0.4 * easeOutBack(intro));

    // hover bob
    const bob = reduceMotion ? 0 : Math.sin(t * 1.8) * 0.07;
    root.position.y = bob;
    shadow.scale.setScalar(1 - bob * 1.2);
    shadowMat.opacity = 0.9 - bob * 2;

    // idle look-around when the cursor is gone
    const tx = pointer.active ? pointer.x : Math.sin(t * 0.5) * 0.25;
    const ty = pointer.active ? pointer.y : Math.sin(t * 0.37) * 0.12;
    look.x = damp(look.x, tx, 6, dt);
    look.y = damp(look.y, ty, 6, dt);

    // head + body follow, eyes lead
    head.rotation.y = look.x * 0.5;
    head.rotation.x = -look.y * 0.28;
    bot.rotation.y = damp(bot.rotation.y, look.x * 0.18, 3, dt);
    eyes.position.x = look.x * 0.14;
    eyes.position.y = look.y * 0.1;
    antenna.rotation.z = damp(antenna.rotation.z, -look.x * 0.25 + Math.sin(t * 3) * 0.04, 4, dt);

    // auto wave
    if (t >= nextAutoWave) {
      wave();
      nextAutoWave = t + o.waveEvery;
    }

    // wave weight with ease in/out
    let w = 0;
    let wt = 0;
    if (waveStart >= 0) {
      wt = t - waveStart;
      if (wt < waveDur) {
        const up = Math.min(wt / 0.35, 1);
        const down = Math.min((waveDur - wt) / 0.4, 1);
        w = smooth(Math.min(up, down));
      }
    }
    const idleSwing = reduceMotion ? 0 : Math.sin(t * 1.8 + 0.6) * 0.05;
    // wave pose: upper arm out to the side, forearm up, swinging from the elbow
    const swing = Math.sin(wt * 10);
    armR.shoulder.rotation.z = THREE.MathUtils.lerp(0.18 + idleSwing, 1.75 + swing * 0.08, w);
    armR.shoulder.rotation.y = THREE.MathUtils.lerp(0, -0.35, w); // bring hand toward the viewer
    armR.elbow.rotation.z = THREE.MathUtils.lerp(0.1, 1.25 + swing * 0.45, w);
    armL.shoulder.rotation.z = -0.18 - idleSwing;
    armL.elbow.rotation.z = -0.1;
    head.rotation.z = damp(head.rotation.z, w * 0.12, 6, dt);

    // blink / closed eyes
    if (t >= nextBlink && blinkT < 0) blinkT = 0;
    let blink = 1;
    if (blinkT >= 0) {
      blinkT += dt;
      const p = blinkT / 0.16;
      blink = p < 1 ? Math.abs(1 - 2 * p) * 0.9 + 0.1 : 1;
      if (p >= 1) {
        blinkT = -1;
        nextBlink = t + 2 + Math.random() * 3.5;
      }
    }
    closeAmt = damp(closeAmt, eyesClosed ? 1 : 0, 10, dt);
    const sy = Math.min(blink, 1 - closeAmt * 0.88);
    eyeL.scale.y = eyeR.scale.y = sy;
    // happy squint while waving
    eyeL.scale.x = eyeR.scale.x = 1 + w * 0.15;

    bulbMat.emissiveIntensity = 1.8 + Math.sin(t * 4) * 0.5;
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  function dispose() {
    renderer.setAnimationLoop(null);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("click", onClick);
    disposables.forEach((d) => d.dispose());
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return { wave, setEyesClosed, dispose };
}
