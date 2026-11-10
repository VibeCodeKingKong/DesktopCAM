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
  private simGroup = new THREE.Group();
  private simTop: THREE.Mesh | null = null;
  private simBase = new THREE.Color();
  private toolMarker = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private cursorPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private theme: SceneTheme = SCENE_THEMES.light;
  private bed = { x: 300, y: 300, floor: -18 };

  onCursor?: (p: Vec3 | null) => void;
  /** Anropas efter varje renderad bild – används av ritlagret. */
  onFrame?: () => void;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // CSS-storleken styrs här och inte av setSize, annars blir canvasen
    // devicePixelRatio gånger för stor och hamnar ur fas med ritlagret.
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
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
    this.scene.add(axes, this.bedGroup, this.stockGroup, this.vectorGroup, this.toolpathGroup, this.simGroup, this.toolMarker);
    this.toolMarker.visible = false;

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

  /**
   * Simulerat material: ovansidan som höjdfält (uppdateras med updateSimulation)
   * och sidorna som en låda. null tar bort simuleringen.
   */
  setSimulation(sim: { width: number; height: number; thickness: number; nx: number; ny: number; color: string } | null) {
    disposeChildren(this.simGroup);
    this.simTop = null;
    if (!sim) return;
    const { width, height, thickness } = sim;
    const geo = new THREE.BoxGeometry(width, height, thickness);
    const side = new THREE.MeshStandardMaterial({ color: sim.color, roughness: 0.85 });
    const box = new THREE.Mesh(geo, [side, side, side, side, new THREE.MeshBasicMaterial({ visible: false }), side]);
    box.position.set(width / 2, height / 2, -thickness / 2);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
    edges.position.copy(box.position);
    const top = new THREE.PlaneGeometry(width, height, sim.nx - 1, sim.ny - 1);
    top.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(sim.nx * sim.ny * 3), 3));
    this.simTop = new THREE.Mesh(top, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
    this.simTop.position.set(width / 2, height / 2, 0);
    this.simBase.set(sim.color);
    this.simGroup.add(box, edges, this.simTop);
  }

  /** Läser in höjder (mm, 0 = ovansidan) och bränning (0–1) i simuleringsytan. */
  updateSimulation(heights: Float32Array, burn: Float32Array, nx: number, ny: number, thickness: number) {
    const top = this.simTop;
    if (!top) return;
    const geo = top.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const col = geo.getAttribute('color') as THREE.BufferAttribute;
    const base = this.simBase;
    const burnt = { r: 0.16, g: 0.09, b: 0.05 };
    const cutTint = { r: base.r * 0.62, g: base.g * 0.5, b: base.b * 0.38 };
    for (let row = 0; row < ny; row++) {
      for (let c = 0; c < nx; c++) {
        const v = row * nx + c;
        const k = (ny - 1 - row) * nx + c;
        const z = heights[k];
        pos.setZ(v, z);
        // Fräst yta lite mörkare (nysågat trä), bränt mörkbrunt, genomskuret syns inte.
        const d = z < -1e-3 ? 0.45 + 0.55 * Math.min(1, -z / thickness) : 0;
        const b = burn[k];
        let r = base.r + (cutTint.r - base.r) * d, g = base.g + (cutTint.g - base.g) * d, bl = base.b + (cutTint.b - base.b) * d;
        r += (burnt.r - r) * b; g += (burnt.g - g) * b; bl += (burnt.b - bl) * b;
        col.setXYZ(v, r, g, bl);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /** Verktyget i simuleringen: spetsen i (x, y, z). null döljer det. */
  setToolMarker(p: { x: number; y: number; z: number } | null, tool?: { kind: string; radius: number; angle: number }) {
    if (!p) {
      this.toolMarker.visible = false;
      return;
    }
    const key = tool ? `${tool.kind}:${tool.radius}:${tool.angle}` : '';
    if (tool && this.toolMarker.userData.key !== key) {
      disposeChildren(this.toolMarker);
      this.toolMarker.userData.key = key;
      const metal = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.7, roughness: 0.3 });
      if (tool.kind === 'laser') {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 30, 12), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.7 }));
        beam.rotation.x = Math.PI / 2;
        beam.position.z = 15;
        const head = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 18), new THREE.MeshStandardMaterial({ color: 0x333740 }));
        head.position.z = 39;
        this.toolMarker.add(beam, head);
      } else {
        const r = tool.radius;
        const cutLen = Math.max(6, r * 5);
        const parts: THREE.Mesh[] = [];
        if (tool.kind === 'vbit') {
          const h = r / Math.tan(((tool.angle || 90) * Math.PI) / 360);
          const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24), metal);
          cone.rotation.x = -Math.PI / 2;
          cone.position.z = h / 2;
          const shank = new THREE.Mesh(new THREE.CylinderGeometry(r, r, cutLen, 24), metal);
          shank.rotation.x = Math.PI / 2;
          shank.position.z = h + cutLen / 2;
          parts.push(cone, shank);
        } else {
          const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, cutLen, 24), metal);
          body.rotation.x = Math.PI / 2;
          body.position.z = cutLen / 2 + (tool.kind === 'ballnose' ? r : 0);
          parts.push(body);
          if (tool.kind === 'ballnose') {
            const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12), metal);
            ball.position.z = r;
            parts.push(ball);
          }
        }
        const collet = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(4, r * 2.2), Math.max(4, r * 2.2), 14, 24), new THREE.MeshStandardMaterial({ color: 0x41454f, metalness: 0.4, roughness: 0.5 }));
        collet.rotation.x = Math.PI / 2;
        const top = parts.reduce((m, x) => Math.max(m, x.position.z), 0) + cutLen / 2;
        collet.position.z = top + 7;
        this.toolMarker.add(...parts, collet);
      }
    }
    this.toolMarker.position.set(p.x, p.y, p.z);
    this.toolMarker.visible = true;
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
    const rect = this.container.getBoundingClientRect();
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
    this.onFrame?.();
  };

  get element(): HTMLElement {
    return this.container;
  }

  /** Skärmposition (clientX/Y) → punkt på materialets ovansida (Z = 0). */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.container.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.cursorPlane, hit) ? { x: hit.x, y: hit.y } : null;
  }

  /** Världspunkt → pixelposition i vyn (relativt behållaren). */
  worldToScreen(x: number, y: number, z = 0): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const { clientWidth: w, clientHeight: h } = this.container;
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }

  /** Ungefär hur många mm en skärmpixel motsvarar vid punkten. */
  worldPerPixel(x: number, y: number): number {
    const a = this.worldToScreen(x, y);
    const b = this.worldToScreen(x + 1, y);
    const c = this.worldToScreen(x, y + 1);
    const px = Math.max(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c.x - a.x, c.y - a.y), 1e-6);
    return 1 / px;
  }

  setRotateEnabled(enabled: boolean) {
    this.controls.enableRotate = enabled;
  }

  /** Tittar kameran ungefär rakt ner? */
  isTopView(): boolean {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir.z < -0.97;
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointer);
    this.renderer.domElement.removeEventListener('pointerleave', this.handleLeave);
    this.controls.dispose();
    [this.bedGroup, this.stockGroup, this.vectorGroup, this.toolpathGroup, this.simGroup, this.toolMarker].forEach(disposeChildren);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
