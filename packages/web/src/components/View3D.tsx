import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, ShapeUtils, Spherical, Vector2, Vector3 } from 'three';
import { roomMesh, type Face3, type Mesh3D, type Opening, type RoomModel, type V3 } from '@slabs/core';
import { s } from '../i18n';
import { useStore } from '../state/store';

/** Triangles of a planar polygon (any outline, not only convex ones): project onto the plane it lies in and triangulate. */
function geometry(f: Face3, holes: V3[][] = []): BufferGeometry {
  const p = f.pts;
  const n = [0, 0, 0];
  p.forEach((a, i) => { const b = p[(i + 1) % p.length]!; n[0]! += (a[1] - b[1]) * (a[2] + b[2]); n[1]! += (a[2] - b[2]) * (a[0] + b[0]); n[2]! += (a[0] - b[0]) * (a[1] + b[1]); });
  const drop = Math.abs(n[0]!) > Math.abs(n[1]!) && Math.abs(n[0]!) > Math.abs(n[2]!) ? 0 : Math.abs(n[1]!) > Math.abs(n[2]!) ? 1 : 2;
  const proj = (q: V3) => (drop === 0 ? new Vector2(q[1], q[2]) : drop === 1 ? new Vector2(q[0], q[2]) : new Vector2(q[0], q[1]));
  const all = [...p, ...holes.flat()];
  const tri = ShapeUtils.triangulateShape(p.map(proj), holes.map((h) => h.map(proj)));
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(all.flat(), 3));
  g.setIndex(tri.flat());
  return g;
}

const cssVar = (name: string, fallback: string) => (typeof document === 'undefined' ? fallback : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);

function Scene({ mesh, holes, roof, grid, numbers, refs, selected, onSelect }: { mesh: Mesh3D; holes: Record<number, V3[][]>; roof: boolean; grid: boolean; numbers: boolean; refs: boolean; selected: number; onSelect: (key: number) => void }) {
  const theme = useStore((st) => st.theme);
  const geoms = useMemo(() => mesh.faces.map((f) => geometry(f, f.gableZ === undefined ? [] : Object.entries(mesh.gableZ).filter(([, z]) => z === f.gableZ).flatMap(([k]) => holes[Number(k)] ?? []))), [mesh, holes]);
  const col = useMemo(() => ({ surface: cssVar('--surface', '#faf8f1'), ink: cssVar('--ink', '#1b2129'), chalk: cssVar('--chalk', '#2c64b8'), red: cssVar('--red', '#b3261e'), paper: cssVar('--raised', '#fffdf7') }), [theme]);
  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[300, 600, -200]} intensity={1.2} />
      {mesh.faces.map((f, i) => (f.kind === 'roof' && !roof ? null : (
        <mesh
          key={i}
          geometry={geoms[i]}
          onClick={f.surf === undefined ? undefined : (e) => { if (e.delta > 4) return; e.stopPropagation(); onSelect(f.surf!); }}
          onPointerOver={f.surf === undefined ? undefined : (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = ''; }}
        >
          <meshStandardMaterial color={f.surf === selected ? col.chalk : f.kind === 'floor' ? col.paper : col.surface} side={DoubleSide} transparent opacity={f.surf === selected ? (f.kind === 'roof' ? 0.7 : 0.85) : f.kind === 'roof' ? 0.45 : f.kind === 'wall' ? 0.7 : 1} />
        </mesh>
      )))}
      {mesh.faces.map((f, i) => (f.kind === 'roof' && !roof ? null : <Line key={'e' + i} points={[...f.pts, f.pts[0]!]} color={f.surf === selected ? col.chalk : col.ink} lineWidth={f.surf === selected ? 3 : 1} />))}
      {Object.values(holes).flat().map((h, i) => <Line key={'h' + i} points={[...h, h[0]!]} color={col.ink} lineWidth={2} />)}
      {grid && mesh.lines.map((l, i) => <Line key={'l' + i} points={l.pts} color={l.start ? col.red : col.chalk} lineWidth={l.start ? 3.5 : 1.5} />)}
      {numbers && mesh.labels.map((l, i) => <Html key={'n' + i} position={l.p} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}><span className="v3-num">{l.text}</span></Html>)}
      {refs && mesh.balls.map((b) => (
        <group key={b.ref} position={b.p}>
          <mesh><sphereGeometry args={[7, 16, 12]} /><meshBasicMaterial color={col.red} /></mesh>
          <Html center position={[0, 18, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}><span className="v3-ref">{b.ref}</span></Html>
        </group>
      ))}
    </>
  );
}

/** 3D model of a room, drawn in the frame of the 2D drawing. The options live in the drawing's header; clicking a surface selects it; keyboard orbit and a text summary. */
export default function View3D({ model, name, openings = [], options, selected, onSelect, height }: { model: RoomModel; name: string; openings?: Opening[]; options: { roof: boolean; grid: boolean; numbers: boolean; refs: boolean }; selected: number; onSelect: (key: number) => void; height?: number }) {
  const mesh = useMemo(() => roomMesh(model), [model]);
  // openings on gable walls are cut out of the wall (point (x, height) on the wall at z)
  const holes = useMemo(() => {
    const out: Record<number, V3[][]> = {};
    openings.forEach((o) => { const z = mesh.gableZ[o.surface]; if (z !== undefined) (out[o.surface] ??= []).push(o.pts.map((q): V3 => [q[0], q[1], z])); });
    return out;
  }, [openings, mesh]);
  const ctl = useRef<{ object: { position: Vector3 }; target: Vector3; update: () => void } | null>(null);
  const size = Math.max(mesh.max[0] - mesh.min[0], mesh.max[1] - mesh.min[1], mesh.max[2] - mesh.min[2]);
  const target = useMemo(() => new Vector3((mesh.min[0] + mesh.max[0]) / 2, (mesh.min[1] + mesh.max[1]) / 2, (mesh.min[2] + mesh.max[2]) / 2), [mesh]);
  const home = useMemo(() => target.clone().add(new Vector3(size * 0.7, size * 0.55, -size * 0.95)), [target, size]);
  useEffect(() => { const c = ctl.current; if (c) { c.object.position.copy(home); c.target.copy(target); c.update(); } }, [home, target]);
  const key = (e: React.KeyboardEvent) => {
    const c = ctl.current;
    if (!c) return;
    const off = c.object.position.clone().sub(c.target);
    const sp = new Spherical().setFromVector3(off);
    const step = 0.12;
    if (e.key === 'ArrowLeft') sp.theta -= step; else if (e.key === 'ArrowRight') sp.theta += step;
    else if (e.key === 'ArrowUp') sp.phi = Math.max(0.15, sp.phi - step); else if (e.key === 'ArrowDown') sp.phi = Math.min(Math.PI - 0.15, sp.phi + step);
    else if (e.key === '+' || e.key === '=') sp.radius *= 0.9; else if (e.key === '-') sp.radius *= 1.1;
    else if (e.key === '0' || e.key === 'Home') { c.object.position.copy(home); c.target.copy(target); c.update(); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    c.object.position.copy(c.target).add(new Vector3().setFromSpherical(sp));
    c.update();
  };
  const surfaces = model.refs.length;
  return (
    <div className="view3d">
      <div className="v3-canvas" data-selected-surf={selected} style={height ? { height } : undefined} tabIndex={0} role="group" aria-label={s.view3d.canvasLabel(name)} aria-describedby="v3-help v3-sum" onKeyDown={key}>
        <Canvas frameloop="demand" dpr={[1, 2]} camera={{ position: home.toArray(), fov: 40, near: 10, far: size * 20 }}>
          <Scene mesh={mesh} holes={holes} {...options} selected={selected} onSelect={onSelect} />
          <OrbitControls ref={ctl as never} target={target} makeDefault enableDamping={false} />
        </Canvas>
      </div>
      <p id="v3-sum" className="sr">{s.view3d.summary(name, surfaces, mesh.lines.filter((l) => l.start).length, mesh.labels.length)}</p>
    </div>
  );
}
