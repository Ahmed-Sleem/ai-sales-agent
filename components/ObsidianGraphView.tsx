"use client";
/**
 * WHY: Little-Planet drill-down (v3) in the SAME right-panel host.
 * Egypt -> City -> District -> Compound -> UnitType, one planet, levels replace
 * each other (never render the whole tree). Contract with the agent:
 *   drillPath (AppContext) = current level path; both agent and clicks set it.
 *   activeGraphNodeIds / rejectedIds / shortlistedIds = intra-level choreography.
 * Fixes v2 audit: smaller buildings, no building self-rotation (shine instead),
 * front-raised focus camera (not bird-eye), black twinkling starfield, lighter scene.
 */
import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { useApp } from "../context/AppContext";
import { TREE, cityById, findDistrict, findCompound, fmtPrice } from "../data/hierarchy";

const seeded = (i: number) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
const easeInOut = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const R = 15;

export interface PlanetItem { id: string; name: string; sub: string; model: string; cluster?: boolean; }

export function levelItems(path: string[]): { items: PlanetItem[]; title: string } {
  if (path.length === 0) return { title: "Egypt — choose a city", items: TREE.map(c => ({ id: c.id, name: c.name, sub: `${c.districts.reduce((a, d) => a + d.compounds.length, 0)} compounds`, model: "low-a", cluster: true })) };
  const city = cityById(path[0]); if (!city) return { items: [], title: "" };
  if (path.length === 1) return { title: `${city.name} — choose a district`, items: city.districts.map(d => ({ id: d.id, name: d.name, sub: `${d.compounds.length} compounds`, model: "low-b", cluster: true })) };
  const dist = findDistrict(path[0], path[1]); if (!dist) return { items: [], title: "" };
  if (path.length === 2) return { title: `${dist.name} — compounds`, items: dist.compounds.map(c => ({ id: c.id, name: c.name, sub: `from ${fmtPrice(c.fromPrice)}`, model: c.model })) };
  const comp = findCompound(path[0], path[1], path[2]); if (!comp) return { items: [], title: "" };
  return { title: `${comp.name} — unit types`, items: comp.units.map(u => ({ id: u.id, name: u.name, sub: `${fmtPrice(u.price)} • ${u.beds} bd • ${u.bua} m²`, model: u.model })) };
}

interface Rec { item: PlanetItem; group: THREE.Group; ring: THREE.Mesh; normal: THREE.Vector3; basePos: THREE.Vector3;
  scale: number; age: number; state: string; leaveT: number; opacity: number; glow: number; }

export const ObsidianGraphView: React.FC = () => {
  const { language, activeGraphNodeIds, vizPhase, shortlistedIds, rejectedIds, drillPath, setDrillPath,
    setActiveGraphNodeIds, setVizPhase, setShortlistedIds, setRejectedIds, focusedPropertyId, setFocusedPropertyId, setVizSelection, vizColored, vizTransparency } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(0);
  const live = useRef({ active: [] as string[], phase: "IDLE", shortlist: [] as string[], rejected: [] as string[], focused: null as string | null, path: [] as string[], colored: false, transparency: 68 });
  live.current = { active: activeGraphNodeIds, phase: vizPhase, shortlist: shortlistedIds, rejected: rejectedIds, focused: focusedPropertyId, path: drillPath, colored: vizColored, transparency: vizTransparency };
  const mgr = useRef<{ setLevel: (p: string[]) => void; focus: (id: string) => void; resetCam: () => void } | null>(null);
  const { items, title } = levelItems(drillPath);

  useEffect(() => {
    const container = containerRef.current, labelsEl = labelsRef.current;
    if (!container || !labelsEl) return;
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));           // perf cap
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0); // transparent: unified NightSky background shows through
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / Math.max(container.clientHeight, 1), .1, 800);
    camera.position.set(16, 10, 42);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .05;
    controls.maxDistance = 110; controls.minDistance = 9; controls.enablePan = false;
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(25, 30, 18); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x93c5fd, .6); rim.position.set(-25, -8, -20); scene.add(rim);

    const starLayers: THREE.Points[] = []; // sky lives in NightSky (whole app), not duplicated here
    const planet = new THREE.Group(); scene.add(planet);
    const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28),
      new THREE.MeshStandardMaterial({ color: 0xcfe0f2, roughness: .9, transparent: true, opacity: .22 }));
    planet.add(sphereMesh);
    const wire = new THREE.Mesh(new THREE.SphereGeometry(R * 1.002, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .20 }));
    planet.add(wire);
    for (let i = 1; i < 6; i++) {
      const phi = (i / 6) * Math.PI, r = Math.sin(phi) * (R + .03), y = Math.cos(phi) * (R + .03);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .03, 6, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .13 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = y; planet.add(ring);
    }
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.13, 40, 28),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: .09, side: THREE.BackSide, depthWrite: false })));

    const itemsMap = new Map<string, Rec>();
    const labelDivs = new Map<string, HTMLDivElement>();
    const protos: Record<string, THREE.Object3D> = {};
    let protosReady = false;

    /* Zoom v3: front-raised arc flight (target + explicit camera pos) */
    const flight = { active: false, t: 0, dur: 1.8, fromP: new THREE.Vector3(), toP: new THREE.Vector3(), fromT: new THREE.Vector3(), toT: new THREE.Vector3(), arc: 0 };
    const fly = (target: THREE.Vector3, camPos: THREE.Vector3, dur?: number) => {
      flight.fromP.copy(camera.position); flight.toP.copy(camPos);
      flight.fromT.copy(controls.target); flight.toT.copy(target);
      flight.arc = camera.position.distanceTo(camPos) * .14;
      flight.t = 0; flight.dur = dur ?? THREE.MathUtils.clamp(camera.position.distanceTo(camPos) / 26, 1.1, 2.4); flight.active = true;
    };
    // Inspection v4: planet stays centred, camera never pivots to a building.
    // We only rotate the GLOBE (smooth yaw) so the inspected building faces the user; the building just glows.
    let faceId: string | null = null;
    const faceItem = (rec: Rec) => { faceId = rec.item.id; };
    mgr.current = {
      focus: (id) => { const r = itemsMap.get(id); if (r) faceItem(r); },
      resetCam: () => fly(new THREE.Vector3(0, 0, 0), new THREE.Vector3(16, 10, 42), 1.8),
      setLevel: (path) => {
        // old level: sink away fast, then remove
itemsMap.forEach(r => { if (r.state === "alive") r.state = "level-out"; });
        labelDivs.forEach(l => l.remove()); labelDivs.clear();
        setTimeout(() => buildLevel(path), 420);
        fly(new THREE.Vector3(0, 0, 0), new THREE.Vector3(16, 10, 42), 1.5);
      },
    };

    function cloneModel(name: string, footprint: number) {
      const root = protos[name].clone(true);
      root.traverse((o: any) => { if (o.isMesh) { o.material = o.material.clone(); o.userData._map = o.material.map || null; o.userData._color = o.material.color ? o.material.color.clone() : null;
        // SKELETON-FIRST: every clone is born skeleton unless Colours is ON.
        // (Fixes colours/textures coming back on every new drill level.)
        if (!live.current.colored) { o.material.map = null; o.material.color.set(0xdfe9f5); o.material.transparent = true; o.material.opacity = 1 - live.current.transparency / 100; if (o.material.emissive) { o.material.emissive.set(0x1a2a3f); o.material.emissiveIntensity = 0.35; } o.material.needsUpdate = true; } } });
      const box = new THREE.Box3().setFromObject(root); const size = box.getSize(new THREE.Vector3());
      const s = footprint / Math.max(size.x, size.z, .001); root.scale.setScalar(s);
      const c = box.getCenter(new THREE.Vector3()); root.position.set(-c.x * s, -box.min.y * s, -c.z * s);
      const wrap = new THREE.Group(); wrap.add(root); return wrap;
    }
    async function buildLevel(path: string[]) {
      if (disposed || !protosReady) return;
      itemsMap.forEach(r => planet.remove(r.group)); itemsMap.clear();
      const { items: its } = levelItems(path);
      await ensureFamilies([...new Set(its.map(i => i.model)), "low-a", "low-b", "tree"]);
      if (disposed) return;
      its.forEach((item, i) => {
        const y = 1 - (i / Math.max(its.length - 1, 1)) * 1.5 - .2;
        const rad = Math.sqrt(Math.max(0, 1 - y * y)), theta = i * 2.39996 + seeded(i + path.length * 17) * .5;
        const normal = new THREE.Vector3(Math.cos(theta) * rad, y, Math.sin(theta) * rad).normalize();
        const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
        if (item.cluster) {
          // city/district = cluster of TINY buildings + trees around one anchor
          for (let k = 0; k < 7; k++) {
            const m = cloneModel(k % 3 === 2 ? "tree" : (k % 2 ? "low-b" : "low-a"), k % 3 === 2 ? .9 : 1.15);
            const a = seeded(i * 10 + k) * Math.PI * 2, rr = k === 0 ? 0 : 1.15 + seeded(k + i) * .9;
            m.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); m.rotation.y = seeded(k + 40) * 3; inner.add(m);
          }
        } else {
          const fp = path.length === 3 ? (its.length <= 4 ? 2.4 : its.length <= 8 ? 2.0 : 1.7) : (its.length <= 4 ? 1.95 : its.length <= 8 ? 1.7 : its.length <= 14 ? 1.45 : 1.2);
          inner.add(cloneModel(item.model, fp)); // adaptive: shrink as count grows so everything fits the planet
        }
        const basePos = normal.clone().multiplyScalar(R);
        g.position.copy(basePos);
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        g.userData.propId = item.id;
        const ringMesh = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.05, 40),
          new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
        ringMesh.rotation.x = -Math.PI / 2; ringMesh.position.y = .1; g.add(ringMesh);
        planet.add(g);
        const label = document.createElement("div");
        label.style.cssText = "position:absolute;transform:translate(-50%,-100%);background:var(--color-paper);border:1.5px solid var(--color-accent);border-radius:10px;padding:5px 9px;font-size:11px;font-weight:700;line-height:1.5;text-align:center;box-shadow:var(--shadow-elevated);white-space:nowrap;opacity:0;pointer-events:none;color:var(--text-primary)";
        // top levels always show their name label; deeper levels label on inspect/winner/focus
        label.innerHTML = `${item.name}<span style="display:block;font-weight:600;color:var(--text-meta);font-size:10px">${item.sub}</span>`;
        labelsEl.appendChild(label); labelDivs.set(item.id, label);
        const rec: Rec = { item, group: g, ring: ringMesh as any, normal, basePos, scale: 0, age: -i * .14, state: "alive", leaveT: 0, opacity: 1, glow: 0 };
        itemsMap.set(item.id, rec);
      });
      // smart decor: fewer items -> more trees; crowded level -> fewer. Trees always smaller than buildings.
      planet.children.filter((c: any) => c.userData.decor).slice().forEach((c: any) => planet.remove(c));
      const decorCount = Math.max(4, Math.min(30, Math.round(34 - its.length * 2.2)));
      for (let k = 0; k < decorCount; k++) {
        const n = new THREE.Vector3().randomDirection(); if (n.y < -.6) n.y = Math.abs(n.y);
        if (its.some((_, idx) => { const yy = 1 - (idx / Math.max(its.length - 1, 1)) * 1.5 - .2; return false; })) continue;
        const tr = cloneModel("tree", .55 + seeded(k + 90) * .45);
        const holder = new THREE.Group(); holder.add(tr);
        holder.position.copy(n.clone().multiplyScalar(R));
        holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        holder.userData.decor = true; planet.add(holder);
      }
    }

    // LAZY per-level model loading (fast first paint: country level needs only 3 tiny GLBs)
    const loader = new GLTFLoader();
    const loadingFams = new Set<string>();
    async function ensureFamilies(names: string[]) {
      const need = names.filter(n => !protos[n] && !loadingFams.has(n));
      if (!need.length) return;
      need.forEach(n => loadingFams.add(n));
      await Promise.all(need.map(async f => { try { protos[f] = (await loader.loadAsync(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/models/${f}.glb`)).scene; } finally { loadingFams.delete(f); if (!disposed) setLoaded(Object.keys(protos).length); } }));
    }
    (async () => { // initial level only
      try { await ensureFamilies(["low-a", "low-b", "tree"]); protosReady = true; if (!disposed) { setReady(true); buildLevel(live.current.path); } }
      catch (e: any) { if (!disposed) setError(e?.message || "3D failed"); }
    })();

    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    const onClick = (e: PointerEvent) => {
      ptr.x = (e.offsetX / container.clientWidth) * 2 - 1; ptr.y = -(e.offsetY / container.clientHeight) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      const hits = ray.intersectObjects(planet.children, true);
      for (const h of hits) { let o: any = h.object; while (o && !o.userData.propId) o = o.parent; if (o) { const id = o.userData.propId; const path = live.current.path;
              const its2 = levelItems(path).items.find(x => x.id === id); if (its2) setVizSelection({ id, name: its2.name, detail: its2.sub }); if (path.length < 3) { setDrillPath([...path, id]); setVizPhase("THINKING"); } else { setFocusedPropertyId(id); setVizPhase("FOCUS"); } break; } }
    };
    renderer.domElement.addEventListener("pointerdown", onClick);
    // Hover tooltip: small name card that follows the cursor over any place/unit
    const hoverEl = hoverRef.current;
    const onHover = (e: PointerEvent) => {
      if (!hoverEl) return;
      ptr.x = (e.offsetX / container.clientWidth) * 2 - 1; ptr.y = -(e.offsetY / container.clientHeight) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      const hits = ray.intersectObjects(planet.children, true);
      let found: PlanetItem | null = null;
      for (const h of hits) { let o: any = h.object; while (o && !o.userData.propId) o = o.parent; if (o) { found = itemsMap.get(o.userData.propId)?.item || null; if (found) break; } }
      if (found) {
        hoverEl.innerHTML = `<div style="font-weight:800;font-size:12px;line-height:1.35">${found.name}</div><div style="font-weight:600;font-size:10px;color:var(--text-meta);line-height:1.35">${found.sub}</div>`;
        const pad = 14, w = 190, hgt = 52;
        hoverEl.style.left = `${Math.min(e.offsetX + pad, Math.max(container.clientWidth - w, 0))}px`;
        hoverEl.style.top = `${Math.min(e.offsetY + pad, Math.max(container.clientHeight - hgt, 0))}px`;
        hoverEl.style.opacity = "1";
        renderer.domElement.style.cursor = "pointer";
      } else {
        hoverEl.style.opacity = "0";
        renderer.domElement.style.cursor = "";
      }
    };
    const onHoverLeave = () => { if (hoverEl) hoverEl.style.opacity = "0"; renderer.domElement.style.cursor = ""; };
    renderer.domElement.addEventListener("pointermove", onHover);
    renderer.domElement.addEventListener("pointerleave", onHoverLeave);


    let spin = .07, raf = 0;
    const clock = new THREE.Clock(); const _v = new THREE.Vector3();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
      const L = live.current;
      // ---- Bulletproof focus (v8): target captured ONCE per focused id ----
      // Root cause of the 2-3x spin glitch: the old code recomputed the desired
      // angle every frame with a JS % wrap that breaks once planet.rotation.y
      // grows past one turn (idle spin accumulates unbounded turns), so the
      // "shortest" diff flipped sign and the globe looped before settling.
      // Now: when the focused id changes, capture an absolute target rotation
      // once (shortest-path via atan2(sin,cos), always correct for any accumulated
      // rotation), kill idle spin instantly, ease to that fixed target with a
      // clamped angular speed, snap + lock. It can never loop: the target never
      // moves, velocity is one-directional toward it, and lock ends all motion.
      const focusState = (animate as any)._focus || ((animate as any)._focus = { id: null as string | null, target: 0, locked: true });
      if (!L.focused) { focusState.id = null; focusState.locked = true; }
      const targetSpin = flight.active || L.focused ? 0 : L.phase === "THINKING" ? .4 : .06;
      spin = L.focused ? 0 : THREE.MathUtils.lerp(spin, targetSpin, 1 - Math.pow(.01, dt));
      if (!L.focused) planet.rotation.y += spin * dt;
      planet.rotation.z = L.focused ? planet.rotation.z * .9 : Math.sin(t * .05) * .035;
      if (L.focused && itemsMap.get(L.focused)) {
        if (focusState.id !== L.focused) {
          const n = itemsMap.get(L.focused)!.normal;
          const desired = Math.atan2(camera.position.x, camera.position.z) - Math.atan2(n.x, n.z);
          const raw = desired - planet.rotation.y;
          const shortest = Math.atan2(Math.sin(raw), Math.cos(raw)); // true shortest path, any accumulated turns
          focusState.id = L.focused;
          focusState.target = planet.rotation.y + shortest;
          focusState.locked = false;
        }
        if (!focusState.locked) {
          const remaining = focusState.target - planet.rotation.y;
          const step = THREE.MathUtils.clamp(remaining * Math.min(1, dt * 3.2), -Math.max(dt * 1.6, Math.abs(remaining)), Math.max(dt * 1.6, Math.abs(remaining)));
          planet.rotation.y += Math.abs(remaining) < 0.0015 ? remaining : step;
          if (Math.abs(focusState.target - planet.rotation.y) < 0.0015) { planet.rotation.y = focusState.target; focusState.locked = true; }
        }
      }
      if (flight.active) {
        flight.t += dt / flight.dur; const k = easeInOut(Math.min(flight.t, 1));
        camera.position.lerpVectors(flight.fromP, flight.toP, k);
        camera.position.y += Math.sin(k * Math.PI) * flight.arc;
        controls.target.lerpVectors(flight.fromT, flight.toT, k);
        if (flight.t >= 1) flight.active = false;
      }
      // skeleton transparency slider: re-apply to every skeleton mesh on change
      if (!L.colored && (animate as any)._transp !== L.transparency) {
        (animate as any)._transp = L.transparency;
        planet.traverse((o: any) => { if (o.isMesh && o.material && o.userData._color) { o.material.opacity = 1 - L.transparency / 100; o.material.needsUpdate = true; } });
      }
      // skeleton (default) <-> colored, applied once per toggle change
      if ((animate as any)._mode !== L.colored) {
        (animate as any)._mode = L.colored;
        (sphereMesh.material as THREE.MeshStandardMaterial).color.set(L.colored ? 0x3f7d4e : 0xcfe0f2);
        (sphereMesh.material as THREE.MeshStandardMaterial).transparent = !L.colored;
        (sphereMesh.material as THREE.MeshStandardMaterial).opacity = L.colored ? 0.96 : 0.22;
        wire.visible = !L.colored;
        planet.traverse((o: any) => { if (o.isMesh && o.material && o.userData._color) {
          if (L.colored) { o.material.map = o.userData._map; o.material.color.copy(o.userData._color); }
          else { o.material.map = null; o.material.color.set(0xdfe9f5); o.material.transparent = true; o.material.opacity = 1 - live.current.transparency / 100; if (o.material.emissive) { o.material.emissive.set(0x1a2a3f); o.material.emissiveIntensity = 0.35; } }
          o.material.needsUpdate = true;
        }});
      }
      itemsMap.forEach(r => {
        const g = r.group, isActive = L.active.includes(r.item.id), isWinner = L.shortlist.includes(r.item.id),
          isRejected = L.rejected.includes(r.item.id), isFocused = L.focused === r.item.id;
        r.age += dt;
        const born = THREE.MathUtils.clamp(r.age / .7, 0, 1);
        const bornScale = born <= 0 ? 0 : 1 + Math.sin(Math.min(born, 1) * Math.PI) * .12 * (1 - born) + (easeInOut(born) - 1) * 0; // gentle pop-in
        if (r.state === "level-out") { r.leaveT = Math.min(1, r.leaveT + dt / .4); const k = easeInOut(r.leaveT); r.scale = Math.max(.01, 1 - k); r.opacity = 1 - k; g.position.copy(r.basePos).multiplyScalar(1 - k * .25); if (r.leaveT >= 1) { planet.remove(g); itemsMap.delete(r.item.id); } }
        else if (isRejected && r.state === "alive") r.state = "leaving";
        else if (!isRejected && r.state === "leaving") { r.state = "alive"; r.leaveT = 0; g.visible = true; }
        if (r.state === "leaving") {
          r.leaveT = Math.min(1, r.leaveT + dt / 1.5); const k = easeInOut(r.leaveT);
          r.scale = Math.max(.02, 1 - k * .96); r.opacity = 1 - Math.max(0, k - .35) / .65;
          g.position.copy(r.basePos).multiplyScalar(1 - k * .28);
          if (r.leaveT >= 1) { r.state = "gone"; g.visible = false; }
        } else if (r.state === "alive") {
          r.opacity = THREE.MathUtils.lerp(r.opacity, 1, 1 - Math.pow(.005, dt));
          const rise = isWinner ? 1.12 : 1;               // winners rise slightly; inspection = glow only
          g.position.lerp(r.basePos.clone().multiplyScalar(rise), 1 - Math.pow(.0015, dt));
          const target = (isWinner ? 1.4 : 1) * Math.max(bornScale * easeInOut(born), .01); // focused/inspected: glow only, no scale/rise pivot
          r.scale = THREE.MathUtils.lerp(r.scale || .01, target, 1 - Math.pow(.002, dt));
        }
        g.scale.setScalar(Math.max(r.scale, .01));
        const targetGlow = (isActive || isWinner || isFocused) && r.state === "alive" ? 1 : 0;
        r.glow = THREE.MathUtils.lerp(r.glow, targetGlow, 1 - Math.pow(.001, dt));
        const shine = r.glow * (0.55 + 0.45 * Math.sin(t * 4.2));            // SHINE pulse (buildings stay attached, no spin)
        g.traverse((o: any) => { if (o.isMesh && o !== r.ring) { o.material.transparent = true; o.material.opacity = r.opacity * (L.colored ? .97 : 1 - L.transparency / 100); /* skeleton transparency = Settings slider */ if (o.material.emissive) o.material.emissiveIntensity = shine * .65; } });
        (r.ring.material as THREE.MeshBasicMaterial).color.set(isWinner ? 0xf59e0b : 0x22c55e);
        (r.ring.material as THREE.MeshBasicMaterial).opacity = r.glow * .9 * (.7 + Math.sin(t * 5) * .3);
        r.ring.scale.setScalar(1 + r.glow * Math.sin(t * 5) * .13);
        const label = labelDivs.get(r.item.id);
        if (label) {
          const alwaysLabel = L.path.length === 0;
          let show = r.state === "alive" && g.visible && (alwaysLabel || isActive || isWinner || isFocused);
          if (show) {
            g.getWorldPosition(_v);
            const facing = _v.clone().normalize().dot(camera.position.clone().sub(_v).normalize());
            show = facing > -.05;
            _v.addScaledVector(_v.clone().normalize(), 3.2 * Math.max(r.scale, .4)); _v.project(camera);
            label.style.left = ((_v.x * .5 + .5) * container.clientWidth) + "px";
            label.style.top = ((-_v.y * .5 + .5) * container.clientHeight) + "px";
          }
          label.style.opacity = show ? "1" : "0";
        }
      });
      controls.update(); renderer.render(scene, camera);
    };
    animate();
    const onResize = () => { camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1); camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); };
    const ro = new ResizeObserver(onResize); ro.observe(container);
    return () => { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); renderer.domElement.removeEventListener("pointerdown", onClick); renderer.domElement.removeEventListener("pointermove", onHover); renderer.domElement.removeEventListener("pointerleave", onHoverLeave); controls.dispose(); renderer.dispose(); if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement); labelsEl.innerHTML = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevPath = useRef<string>("__init__");
  useEffect(() => {
    const key = drillPath.join("/");
    if (ready && key !== prevPath.current) mgr.current?.setLevel(drillPath);
    if (ready) prevPath.current = key;
  }, [drillPath, ready]);
  const prevShort = useRef("");
  useEffect(() => {
    const key = shortlistedIds.join(",");
    if (key && key !== prevShort.current && shortlistedIds[0]) setTimeout(() => mgr.current?.focus(shortlistedIds[0]), 500);
    prevShort.current = key;
  }, [shortlistedIds]);
  useEffect(() => { if (focusedPropertyId) mgr.current?.focus(focusedPropertyId); }, [focusedPropertyId]);

  function handleSelect(id: string) {
    if (drillPath.length < 3) { setDrillPath([...drillPath, id]); setVizPhase("THINKING"); }
    else { setFocusedPropertyId(id); setVizPhase("FOCUS"); }
  }
  const handleReset = () => { setDrillPath([]); setActiveGraphNodeIds([]); setShortlistedIds([]); setRejectedIds([]); setFocusedPropertyId(null); setVizPhase("IDLE"); mgr.current?.resetCam(); };
  const crumbs: { label: string; path: string[] }[] = [{ label: "Egypt", path: [] }];
  if (drillPath[0]) crumbs.push({ label: cityById(drillPath[0])?.name || "", path: [drillPath[0]] });
  if (drillPath[1]) crumbs.push({ label: findDistrict(drillPath[0], drillPath[1])?.name || "", path: drillPath.slice(0, 2) });
  if (drillPath[2]) crumbs.push({ label: findCompound(drillPath[0], drillPath[1], drillPath[2])?.name || "", path: drillPath.slice(0, 3) });
  const focusedItem = items.find(i => i.id === focusedPropertyId);
  const focusedUnit = drillPath.length === 3 ? findCompound(drillPath[0], drillPath[1], drillPath[2])?.units.find(u => u.id === focusedPropertyId) : undefined;

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", background: "transparent", overflow: "hidden" }}>
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 2 }} />
      <div ref={hoverRef} aria-hidden="true" style={{ position: "absolute", zIndex: 20, pointerEvents: "none", opacity: 0, transition: "opacity .12s ease", maxWidth: 190, background: "var(--glass-bg-strong, var(--color-paper))", border: "1px solid var(--border-med)", borderRadius: 10, padding: "6px 9px", color: "var(--text-primary)", boxShadow: "var(--shadow-elevated)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }} />
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: "#94a3b8", fontSize: 11 }}>›</span>}
              <button type="button" onClick={() => { setDrillPath(c.path); setFocusedPropertyId(null); setShortlistedIds([]); setRejectedIds([]); }}
                style={{ padding: "6px 11px", borderRadius: 999, border: "1px solid var(--border-med)", background: i === crumbs.length - 1 ? "var(--color-accent)" : "var(--color-paper)", color: i === crumbs.length - 1 ? "var(--color-accent-contrast)" : "var(--text-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{c.label}</button>
            </React.Fragment>
          ))}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={handleReset} className="tool-btn" id="resetMapBtn" style={{ width: 34, height: 34, justifyContent: "center", padding: 0 }} title="Back to Egypt & restore everything">
            <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
          </button>
        </div>
      </div>
      {!ready && !error && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: 13, zIndex: 1 }}>Loading the little planet… {loaded} models</div>}
      {error && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", fontSize: 13, zIndex: 1, padding: 20 }}>3D failed: {error}</div>}
      {focusedItem && (
        <div style={{ position: "absolute", right: 12, bottom: 12, width: 280, background: "var(--color-paper)", border: "1px solid var(--border-med)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-elevated)", padding: 14, zIndex: 5, color: "var(--text-primary)" }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{focusedItem.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-meta)", marginBottom: 8 }}>{focusedItem.sub}</div>
          {focusedUnit && [["BUA", focusedUnit.bua + " m²"], ["Beds", String(focusedUnit.beds)], ["Finishing", focusedUnit.finishing], ["Delivery", focusedUnit.delivery]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderTop: "1px solid var(--border-soft)" }}><span>{k}</span><b>{v}</b></div>
          ))}
          {drillPath.length < 3
            ? <button type="button" onClick={() => handleSelect(focusedItem.id)} style={{ marginTop: 10, width: "100%", padding: 9, border: "none", borderRadius: 8, background: "var(--color-accent)", color: "var(--color-accent-contrast)", fontWeight: 700, cursor: "pointer" }}>Enter {focusedItem.name} ↓</button>
            : <button type="button" onClick={() => alert("Demo only — real product: book viewing / WhatsApp sales agent.")} style={{ marginTop: 10, width: "100%", padding: 9, border: "none", borderRadius: 8, background: "var(--color-accent)", color: "var(--color-accent-contrast)", fontWeight: 700, cursor: "pointer" }}>📅 Book a viewing</button>}
        </div>
      )}
    </div>
  );
};
