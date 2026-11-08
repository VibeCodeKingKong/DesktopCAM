import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PolylineInput, Vec3 } from '@desktopcam/core';
import type { ViewCommand } from '../../store/useAppStore';
import type { StockSurface } from '../../cam/reliefs';

/**
 * Äger all Three.js-logik så att React-komponenten bara skickar in data.
 * Världen är Z-upp i millimeter, precis som maskinen: X/Y på bordet,
 * Z = 0 på materialets ovansida.
 */

export interface SceneTheme {
  background: number;
  bed: number;
  gridMinor: number;
  gridMajor: number;
  vector: number;
  vectorSelected: number;
  cut: number;
  laser: number;
  rapid: number;
}

export const SCENE_THEMES: Record<'light' | 'dark', SceneTheme> = {
  light: { background: 0xeceef2, bed: 0xe2e4ea, gridMinor: 0xd2d5dc, gridMajor: 0xb7bbc5, vector: 0x1d1d1f, vectorSelected: 0x0071e3, cut: 0x0071e3, laser: 0xe87814, rapid: 0xd04040 },
  dark: { background: 0x1a1b1e, bed: 0x232428, gridMinor: 0x303137, gridMajor: 0x45464e, vector: 0xe8e8ec, vectorSelected: 0x0a84ff, cut: 0x0a84ff, laser: 0xff9f0a, rapid: 0xff6961 },
};

export interface VectorDisplay extends PolylineInput {
  selected: boolean;
}

export interface ToolpathDisplay {
  cuts: Float32Array;
  rapids: Float32Array;
  laser: boolean;
  highlighted: boolean;
}

function disposeChildren(group: THREE.Group) {
  for (const child of [...group.children]) {
    child.traverse((o) => {
      const obj = o as THREE.Mesh;
      obj.geometry?.dispose();
      const mat = obj.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    group.remove(child);
  }
}

export class SceneController {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.5, 50000);
  private controls: OrbitControls;
  private bedGroup = new THREE.Group();
  private stockGroup = new THREE.Group();
  private vectorGroup = new THREE.Group();
  private toolpathGroup = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private cursorPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private theme: SceneTheme = SCENE_THEMES.light;
  private bed = { x: 300, y: 300, floor: -18 };

  onCursor?: (p: Vec3 | null) => void;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = true;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-200, -300, 500);
    this.scene.add(sun);

    const axes = new THREE.AxesHelper(25);
    axes.position.z = 0.2;
    this.scene.add(axes, this.bedGroup, this.stockGroup, this.vectorGroup, this.toolpathGroup);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointer);
    this.renderer.domElement.addEventListener('pointerleave', this.handleLeave);
    this.resize();
    this.loop();
  }

  setTheme(theme: SceneTheme) {
    this.theme = theme;
    this.scene.background = new THREE.Color(theme.background);
  }

  /** Bordet: rutnät var 10:e mm, kraftigare linje var 50:e mm. */
  setBed(width: number, depth: number, floorZ: number) {
    this.bed = { x: width, y: depth, floor: floorZ };
    disposeChildren(this.bedGroup);
    const z = floorZ - 0.05;
    const minor: number[] = [];
    const major: number[] = [];
    for (let x = 0; x <= width + 1e-6; x += 10) (x % 50 === 0 ? major : minor).push(x, 0, z, x, depth, z);
    for (let y = 0; y <= depth + 1e-6; y += 10) (y % 50 === 0 ? major : minor).push(0, y, z, width, y, z);
    const lines = (pts: number[], color: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color }));
    };
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: this.theme.bed, roughness: 1 }),
    );
    plate.position.set(width / 2, depth / 2, z - 0.1);
    this.bedGroup.add(plate, lines(minor, this.theme.gridMinor), lines(major, this.theme.gridMajor));
  }

  /**
   * Materialet. Med `surface` byggs ovansidan som ett höjdfält där reliefer
   * syns infrästa; annars ritas en vanlig låda.
   */
  setStock(width: number, height: number, thickness: number, color: string, visible: boolean, surface?: StockSurface | null) {
    disposeChildren(this.stockGroup);
    if (!visible) return;
    const geo = new THREE.BoxGeometry(width, height, thickness);
    const side = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      transparent: !surface,
      opacity: surface ? 1 : 0.92,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    // BoxGeometry-ordning: +x, −x, +y, −y, +z (ovansida), −z
    const materials = surface ? [side, side, side, side, new THREE.MeshBasicMaterial({ visible: false }), side] : side;
    const mesh = new THREE.Mesh(geo, materials);
    mesh.position.set(width / 2, height / 2, -thickness / 2);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
    edges.position.copy(mesh.position);
    this.stockGroup.add(mesh, edges);

    if (surface) {
      const top = new THREE.PlaneGeometry(width, height, surface.nx - 1, surface.ny - 1);
      const pos = top.getAttribute('position') as THREE.BufferAttribute;
      // PlaneGeometry börjar i övre vänstra hörnet, höjdfältet nerifrån.
      for (let row = 0; row < surface.ny; row++) {
        for (let col = 0; col < surface.nx; col++) {
          pos.setZ(row * surface.nx + col, surface.z[(surface.ny - 1 - row) * surface.nx + col]);
        }
      }
      pos.needsUpdate = true;
      top.computeVertexNormals();
      const topMesh = new THREE.Mesh(
        top,
        new THREE.MeshStandardMaterial({ color, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      );
      topMesh.position.set(width / 2, height / 2, 0);
      this.stockGroup.add(topMesh);
    }
  }

  /** Alla vektorer i två LineSegments (vanliga och markerade) – klarar tusentals importerade former. */
  setVectors(vectors: VectorDisplay[]) {
    disposeChildren(this.vectorGroup);
    const buckets: Record<'normal' | 'selected', number[]> = { normal: [], selected: [] };
    for (const v of vectors) {
      const out = buckets[v.selected ? 'selected' : 'normal'];
      const n = v.points.length / 2;
      if (n < 2) continue;
      const segs = v.closed ? n : n - 1;
      for (let k = 0; k < segs; k++) {
        const a = k * 2;
        const b = ((k + 1) % n) * 2;
        out.push(v.points[a], v.points[a + 1], 0.08, v.points[b], v.points[b + 1], 0.08);
      }
    }
    for (const [key, pts] of Object.entries(buckets)) {
      if (!pts.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({ color: key === 'selected' ? this.theme.vectorSelected : this.theme.vector });
      const lines = new THREE.LineSegments(g, mat);
      lines.renderOrder = key === 'selected' ? 2 : 1;
      this.vectorGroup.add(lines);
    }
  }

  setToolpaths(paths: ToolpathDisplay[], showRapids: boolean) {
    disposeChildren(this.toolpathGroup);
    for (const p of paths) {
      if (p.cuts.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(p.cuts, 3));
        this.toolpathGroup.add(
          new THREE.LineSegments(
            g,
            new THREE.LineBasicMaterial({ color: p.laser ? this.theme.laser : this.theme.cut, transparent: true, opacity: p.highlighted ? 1 : 0.55 }),
          ),
        );
      }
      if (showRapids && p.rapids.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(p.rapids, 3));
        this.toolpathGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: this.theme.rapid, transparent: true, opacity: 0.35 })));
      }
    }
  }

  command(kind: ViewCommand) {
    const { x, y } = this.bed;
    const center = new THREE.Vector3(x / 2, y / 2, 0);
    const span = Math.max(x, y);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = (span * 0.62) / Math.tan(fov / 2);
    const offset = this.camera.position.clone().sub(this.controls.target);

    switch (kind) {
      case 'top':
        this.camera.position.set(center.x, center.y - dist * 0.001, dist);
        break;
      case 'front':
        this.camera.position.set(center.x, center.y - dist, dist * 0.18);
        break;
      case 'iso':
      case 'fit':
        this.camera.position.copy(center).add(new THREE.Vector3(-0.45, -0.95, 0.75).normalize().multiplyScalar(dist));
        break;
      case 'zoomIn':
      case 'zoomOut': {
        const f = kind === 'zoomIn' ? 0.8 : 1.25;
        this.camera.position.copy(this.controls.target).add(offset.multiplyScalar(f));
        this.controls.update();
        return;
      }
    }
    this.controls.target.copy(center);
    this.controls.update();
  }

  private handlePointer = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.cursorPlane, hit)) this.onCursor?.({ x: hit.x, y: hit.y, z: 0 });
  };

  private handleLeave = () => this.onCursor?.(null);

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointer);
    this.renderer.domElement.removeEventListener('pointerleave', this.handleLeave);
    this.controls.dispose();
    [this.bedGroup, this.stockGroup, this.vectorGroup, this.toolpathGroup].forEach(disposeChildren);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
