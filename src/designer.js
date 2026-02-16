export function mountDesigner(root) {
  const canvas = root.querySelector("#c");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Designer mount failed: canvas #c not found.");
  }

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Designer mount failed: 2D context unavailable.");
  }

  const menuBar = root.querySelector("#menuBar");
  const menuRoots = [...root.querySelectorAll(".menu-root")];
  const itemNew = root.querySelector("#itemNew");
  const toolSeg = root.querySelector("#toolSeg");
  const itemUndo = root.querySelector("#itemUndo");
  const itemRedo = root.querySelector("#itemRedo");
  const itemClear = root.querySelector("#itemClear");
  const itemGrid = root.querySelector("#itemGrid");
  const itemSnap = root.querySelector("#itemSnap");
  const itemViewTools = root.querySelector("#itemViewTools");
  const toolPalette = root.querySelector("#toolPalette");
  const paletteToolButtons = [...root.querySelectorAll("#toolPalette .palette-btn[data-tool]")];
  const palUndo = root.querySelector("#palUndo");
  const palRedo = root.querySelector("#palRedo");
  const gridSizeItems = [...root.querySelectorAll(".menu-item[data-grid-size]")];
  const shapeDialogBackdrop = root.querySelector("#shapeDialogBackdrop");
  const shapeOptionList = root.querySelector("#shapeOptionList");
  const shapeOptionButtons = [...root.querySelectorAll("[data-shape-option]")];
  const btnShapeClose = root.querySelector("#btnShapeClose");

  if (!(menuBar instanceof HTMLElement) ||
      !(itemNew instanceof HTMLElement) ||
      !(toolSeg instanceof HTMLElement) ||
      !(itemUndo instanceof HTMLElement) ||
      !(itemRedo instanceof HTMLElement) ||
      !(itemClear instanceof HTMLElement) ||
      !(itemGrid instanceof HTMLElement) ||
      !(itemSnap instanceof HTMLElement) ||
      !(itemViewTools instanceof HTMLElement) ||
      !(toolPalette instanceof HTMLElement) ||
      !(palUndo instanceof HTMLButtonElement) ||
      !(palRedo instanceof HTMLButtonElement) ||
      !(shapeDialogBackdrop instanceof HTMLElement) ||
      !(shapeOptionList instanceof HTMLElement) ||
      !(btnShapeClose instanceof HTMLButtonElement) ||
      !menuRoots.length ||
      !paletteToolButtons.length ||
      !shapeOptionButtons.length ||
      !gridSizeItems.length) {
    throw new Error("Designer mount failed: one or more menu elements are missing.");
  }

  const TAU = Math.PI * 2;
  const TILE_SHAPES = ["triangle", "square", "hexagon"];
  const ROTS_BY_SHAPE = {
    triangle: [0, TAU / 3, (2 * TAU) / 3],
    square: [0, TAU / 4, TAU / 2, (3 * TAU) / 4],
    hexagon: [0, TAU / 6, (2 * TAU) / 6, (3 * TAU) / 6, (4 * TAU) / 6, (5 * TAU) / 6],
  };
  const BG_SCALE = 0.165;
  const BG_SEED = 1337;

  const v = (x, y) => ({ x, y });
  const add = (a, b) => v(a.x + b.x, a.y + b.y);
  const sub = (a, b) => v(a.x - b.x, a.y - b.y);
  const mul = (a, s) => v(a.x * s, a.y * s);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const len = (a) => Math.hypot(a.x, a.y);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const rot = (p, ang) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return v(p.x * c - p.y * s, p.x * s + p.y * c);
  };

  function pointInTri(p, a, b, c) {
    const s = (p1, p2, p3) =>
      (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const d1 = s(p, a, b);
    const d2 = s(p, b, c);
    const d3 = s(p, c, a);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  function pointInPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const a = poly[i];
      const b = poly[j];
      const intersects = ((a.y > p.y) !== (b.y > p.y)) &&
        (p.x < ((b.x - a.x) * (p.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  const state = {
    dpr: 1,
    vw: 0,
    vh: 0,
    tool: "line",
    tileShape: "triangle",
    pendingTileShape: "triangle",
    shapeDialogOpen: true,
    shapeDialogRequired: true,

    showGrid: true,
    snap: true,
    gridTargetPx: 24,
    showToolsPalette: true,
    grid: null,

    tri: null,

    ink: [],
    fills: [],
    inkRevision: 0,
    geomRevision: 0,

    undoStack: [],
    redoStack: [],

    pointerDown: false,
    drawing: null,

    hover: null,
    hoverArcPick: null,

    rafPending: false,
  };

  let rafId = 0;
  const unsubs = [];
  let fillCache = new WeakMap();
  const menuState = {
    openMenu: null,
  };

  function on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    unsubs.push(() => target.removeEventListener(type, handler, options));
  }

  function isTileShape(shape) {
    return TILE_SHAPES.includes(shape);
  }

  function cloneFill(f) {
    return { x: f.x, y: f.y };
  }

  function snapshot() {
    return {
      ink: state.ink.map((o) => JSON.parse(JSON.stringify(o))),
      fills: state.fills.map(cloneFill),
    };
  }

  function pushUndo() {
    state.undoStack.push(snapshot());
    if (state.undoStack.length > 200) state.undoStack.shift();
    state.redoStack.length = 0;
    syncHUD();
  }

  function restoreSnap(snap) {
    state.ink = snap.ink.map((o) => JSON.parse(JSON.stringify(o)));
    state.fills = snap.fills.map(cloneFill);
    markInkChanged();
  }

  function invalidateFillCache() {
    fillCache = new WeakMap();
  }

  function getFillCacheKey() {
    return `${state.inkRevision}:${state.geomRevision}:${state.dpr}`;
  }

  function markInkChanged() {
    state.inkRevision += 1;
    invalidateFillCache();
  }

  function resize() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    state.dpr = dpr;
    state.vw = w;
    state.vh = h;
    recomputeBigTriangle();
    recomputeGrid();
    requestRender();
  }

  function recomputeBigTriangle() {
    const center = v(state.vw * 0.5, state.vh * 0.54);
    const minDim = Math.min(state.vw, state.vh);
    let side = minDim * 0.58;
    let polyLocal = [];

    if (state.tileShape === "triangle") {
      const h = (side * Math.sqrt(3)) / 2;
      const A0 = v(0, -(2 / 3) * h);
      const B0 = v(-side / 2, (1 / 3) * h);
      const C0 = v(side / 2, (1 / 3) * h);
      polyLocal = [A0, B0, C0];
    } else if (state.tileShape === "square") {
      side = minDim * 0.54;
      const hh = side / 2;
      polyLocal = [v(-hh, -hh), v(hh, -hh), v(hh, hh), v(-hh, hh)];
    } else {
      side = minDim * 0.34;
      for (let i = 0; i < 6; i += 1) {
        const ang = -Math.PI / 2 + (i * TAU) / 6;
        polyLocal.push(v(Math.cos(ang) * side, Math.sin(ang) * side));
      }
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of polyLocal) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const poly = polyLocal.map((p) => add(center, p));
    state.tri = {
      center,
      side,
      polyLocal,
      poly,
      bounds: { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY },
    };
    state.geomRevision += 1;
    invalidateFillCache();
  }

  function recomputeGrid() {
    const side = state.tri.side;
    const target = Math.max(8, state.gridTargetPx * state.dpr);
    let N = Math.max(12, Math.round(side / target));
    if (state.tileShape !== "square") N = Math.max(12, Math.round(N / 12) * 12);
    const step = side / N;
    const dy = (step * Math.sqrt(3)) / 2;
    state.grid = { step, dy, N, mode: state.tileShape === "square" ? "square" : "tri" };
  }

  const screenToLocal = (p) => sub(p, state.tri.center);
  const localToScreen = (p) => add(p, state.tri.center);

  function snapToTriGrid(local) {
    if (!state.snap) return local;
    if (state.grid.mode === "square") {
      const step = state.grid.step;
      return v(Math.round(local.x / step) * step, Math.round(local.y / step) * step);
    }
    const { step, dy } = state.grid;
    const vCoord = local.y / dy;
    const uCoord = (local.x - (step / 2) * vCoord) / step;
    const ur = Math.round(uCoord);
    const vr = Math.round(vCoord);
    return v(step * ur + (step / 2) * vr, dy * vr);
  }

  function pointInPrimaryShape(local) {
    if (!state.tri) return false;
    if (state.tileShape === "triangle") {
      const [a, b, c] = state.tri.polyLocal;
      return pointInTri(local, a, b, c);
    }
    return pointInPoly(local, state.tri.polyLocal);
  }

  function requestRender() {
    if (state.rafPending) return;
    state.rafPending = true;
    rafId = requestAnimationFrame(() => {
      state.rafPending = false;
      render();
    });
  }

  function clearScreen() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function computeFillMaskAtSeed(seedLocal) {
    const t = state.tri;
    if (!pointInPrimaryShape(seedLocal)) return null;

    const verts = t.polyLocal;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of verts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const margin = 12 * state.dpr;
    minX -= margin;
    minY -= margin;
    maxX += margin;
    maxY += margin;

    const wLocal = maxX - minX;
    const hLocal = maxY - minY;

    const target = 900;
    let s = Math.min(target / Math.max(1, wLocal), target / Math.max(1, hLocal));
    s = clamp(s, 1.0, 3.2);

    const w = Math.max(1, Math.ceil(wLocal * s));
    const h = Math.max(1, Math.ceil(hLocal * s));

    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const g = off.getContext("2d");

    const toPix = (p) => v((p.x - minX) * s, (p.y - minY) * s);
    const seedPix = toPix(seedLocal);

    g.clearRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);

    g.strokeStyle = "#000";
    g.lineJoin = "round";
    g.lineCap = "round";
    g.lineWidth = 1.15;

    g.beginPath();
    g.moveTo(toPix(verts[0]).x, toPix(verts[0]).y);
    for (let i = 1; i < verts.length; i += 1) {
      const pp = toPix(verts[i]);
      g.lineTo(pp.x, pp.y);
    }
    g.closePath();
    g.stroke();

    for (const o of state.ink) {
      if (o.type === "line") {
        const a = toPix(o.a);
        const b = toPix(o.b);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      } else if (o.type === "circle") {
        const c = toPix(o.c);
        g.beginPath();
        g.arc(c.x, c.y, o.r * s, 0, TAU);
        g.stroke();
      } else if (o.type === "arc") {
        const c = toPix(o.c);
        g.beginPath();
        g.arc(c.x, c.y, o.r * s, o.a0, o.a1, false);
        g.stroke();
      }
    }

    const img = g.getImageData(0, 0, w, h);
    const data = img.data;
    const idx = (x, y) => (y * w + x) * 4;

    const insideShape = (x, y) => {
      const lx = x / s + minX;
      const ly = y / s + minY;
      return pointInPrimaryShape(v(lx, ly));
    };

    const WALL_THRESH = 170;
    const isWall = (x, y) => {
      const i = idx(x, y);
      return data[i] < WALL_THRESH || data[i + 1] < WALL_THRESH || data[i + 2] < WALL_THRESH;
    };

    const sx = Math.floor(seedPix.x);
    const sy = Math.floor(seedPix.y);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
    if (!insideShape(sx, sy)) return null;
    if (isWall(sx, sy)) return null;

    const visited = new Uint8Array(w * h);
    const qx = new Int32Array(w * h);
    const qy = new Int32Array(w * h);
    let qh = 0;
    let qt = 0;
    const push = (x, y) => {
      const vi = y * w + x;
      visited[vi] = 1;
      qx[qt] = x;
      qy[qt] = y;
      qt += 1;
    };
    push(sx, sy);

    while (qh < qt) {
      const x = qx[qh];
      const y = qy[qh];
      qh += 1;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let k = 0; k < 4; k += 1) {
        const nx = x + n[k][0];
        const ny = y + n[k][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const vi = ny * w + nx;
        if (visited[vi]) continue;
        if (!insideShape(nx, ny)) continue;
        if (isWall(nx, ny)) continue;
        push(nx, ny);
      }
    }

    let cur = visited;
    const DILATE_ITERS = 2;
    for (let it = 0; it < DILATE_ITERS; it += 1) {
      const next = new Uint8Array(w * h);
      next.set(cur);
      for (let y = 1; y < h - 1; y += 1) {
        for (let x = 1; x < w - 1; x += 1) {
          const vi = y * w + x;
          if (cur[vi]) continue;
          if (!insideShape(x, y)) continue;
          if (isWall(x, y)) continue;
          if (cur[vi - 1] || cur[vi + 1] || cur[vi - w] || cur[vi + w]) next[vi] = 1;
        }
      }
      cur = next;
    }

    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const mg = mask.getContext("2d");
    const out = mg.createImageData(w, h);
    const od = out.data;
    let count = 0;
    let hash = 2166136261;

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const vi = y * w + x;
        if (!cur[vi]) continue;
        count += 1;
        hash ^= vi;
        hash = Math.imul(hash, 16777619);
        const i = idx(x, y);
        od[i] = 0;
        od[i + 1] = 0;
        od[i + 2] = 0;
        od[i + 3] = 255;
      }
    }
    mg.putImageData(out, 0, 0);

    const sig = `${w}:${h}:${count}:${hash >>> 0}`;
    return { bmp: mask, minX, minY, wLocal, hLocal, sig };
  }

  function getFillRenderData(fill) {
    const key = getFillCacheKey();
    const cached = fillCache.get(fill);
    if (cached && cached.key === key) return cached.data;
    const data = computeFillMaskAtSeed(fill);
    fillCache.set(fill, { key, data });
    return data;
  }

  function mulberry32(a) {
    return function next() {
      let t = a += 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function renderBackgroundTiling() {
    const t = state.tri;
    const unit = t.side * BG_SCALE;
    const scale = unit / t.side;
    const rnd = mulberry32(BG_SEED >>> 0);
    const rots = ROTS_BY_SHAPE[state.tileShape] || [0];

    function chooseRot(base = 0) {
      return base + rots[Math.floor(rnd() * rots.length)];
    }

    function pathPoly(points) {
      if (!points.length) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
    }

    function drawTileAt(points, center, ang) {
      ctx.save();
      pathPoly(points);
      ctx.clip();

      for (const fill of state.fills) {
        const f = getFillRenderData(fill);
        if (!f) continue;
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(ang);
        ctx.scale(scale, scale);
        ctx.drawImage(f.bmp, f.minX, f.minY, f.wLocal, f.hLocal);
        ctx.restore();
      }

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2 * state.dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const o of state.ink) {
        if (o.type === "line") {
          const p0 = rot(o.a, ang);
          const p1 = rot(o.b, ang);
          ctx.beginPath();
          ctx.moveTo(center.x + p0.x * scale, center.y + p0.y * scale);
          ctx.lineTo(center.x + p1.x * scale, center.y + p1.y * scale);
          ctx.stroke();
        } else if (o.type === "circle") {
          const cc = rot(o.c, ang);
          ctx.beginPath();
          ctx.arc(center.x + cc.x * scale, center.y + cc.y * scale, o.r * scale, 0, TAU);
          ctx.stroke();
        } else if (o.type === "arc") {
          const cc = rot(o.c, ang);
          ctx.beginPath();
          ctx.arc(center.x + cc.x * scale, center.y + cc.y * scale, o.r * scale, o.a0 + ang, o.a1 + ang, false);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    function strokeTile(points) {
      pathPoly(points);
      ctx.stroke();
    }

    const outlineTiles = [];
    const drawTile = (points, center, ang) => {
      drawTileAt(points, center, ang);
      outlineTiles.push(points);
    };

    if (state.tileShape === "triangle") {
      const S = unit;
      const H = (S * Math.sqrt(3)) / 2;
      const x0 = -S;
      const y0 = -2 * H;
      const x1 = state.vw + S;
      const y1 = state.vh + 2 * H;

      for (let y = y0; y <= y1; y += H) {
        const row = Math.round((y - y0) / H);
        const xOffset = row % 2 === 0 ? 0 : S / 2;
        for (let x = x0 + xOffset; x <= x1; x += S) {
          const up0 = v(x + S / 2, y);
          const up1 = v(x, y + H);
          const up2 = v(x + S, y + H);
          const dn0 = v(x, y + H);
          const dn1 = v(x + S, y + H);
          const dn2 = v(x + S / 2, y + 2 * H);
          drawTile([up0, up1, up2], v((up0.x + up1.x + up2.x) / 3, (up0.y + up1.y + up2.y) / 3), chooseRot(0));
          drawTile([dn0, dn1, dn2], v((dn0.x + dn1.x + dn2.x) / 3, (dn0.y + dn1.y + dn2.y) / 3), chooseRot(Math.PI));
        }
      }
    } else if (state.tileShape === "square") {
      const S = unit;
      for (let y = -S; y <= state.vh + S; y += S) {
        for (let x = -S; x <= state.vw + S; x += S) {
          const points = [v(x, y), v(x + S, y), v(x + S, y + S), v(x, y + S)];
          const center = v(x + S / 2, y + S / 2);
          drawTile(points, center, chooseRot());
        }
      }
    } else {
      const s = unit;
      const w = Math.sqrt(3) * s;
      const rowH = 1.5 * s;
      const cols = Math.ceil(state.vw / w) + 8;
      const rows = Math.ceil(state.vh / rowH) + 8;
      const cx0 = state.vw * 0.5;
      const cy0 = state.vh * 0.5;
      for (let r = -rows; r <= rows; r += 1) {
        for (let q = -cols; q <= cols; q += 1) {
          const cx = cx0 + Math.sqrt(3) * s * (q + r / 2);
          const cy = cy0 + rowH * r;
          if (cx < -w || cx > state.vw + w || cy < -2 * s || cy > state.vh + 2 * s) continue;
          const points = [];
          for (let i = 0; i < 6; i += 1) {
            const ang = -Math.PI / 2 + (i * TAU) / 6;
            points.push(v(cx + Math.cos(ang) * s, cy + Math.sin(ang) * s));
          }
          drawTile(points, v(cx, cy), chooseRot());
        }
      }
    }

    ctx.save();
    ctx.strokeStyle = "#c0c0c0";
    ctx.lineWidth = 1 * state.dpr;
    ctx.globalAlpha = 0.5;
    for (const points of outlineTiles) strokeTile(points);
    ctx.restore();
  }

  function pathBigTriangle() {
    const t = state.tri;
    if (!t || !t.poly?.length) return;
    ctx.beginPath();
    ctx.moveTo(t.poly[0].x, t.poly[0].y);
    for (let i = 1; i < t.poly.length; i += 1) {
      ctx.lineTo(t.poly[i].x, t.poly[i].y);
    }
    ctx.closePath();
  }

  function clipBigTriangle() {
    pathBigTriangle();
    ctx.clip();
  }

  function strokeBigTriangle() {
    ctx.save();
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 2 * state.dpr;
    ctx.globalAlpha = 0.95;
    pathBigTriangle();
    ctx.stroke();
    ctx.restore();
  }

  function fillBigTriangleWhite() {
    ctx.save();
    ctx.fillStyle = "#fff";
    pathBigTriangle();
    ctx.fill();
    ctx.restore();
  }

  function drawBigTriangleShadow() {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
    ctx.shadowBlur = 14 * state.dpr;
    ctx.shadowOffsetY = 4 * state.dpr;
    ctx.fillStyle = "#fff";
    pathBigTriangle();
    ctx.fill();
    ctx.restore();
  }

  function drawInnerTriGrid() {
    if (!state.showGrid) return;
    const t = state.tri;
    const { step, dy, mode } = state.grid;

    ctx.save();
    clipBigTriangle();
    ctx.strokeStyle = "#d0d0d0";
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1 * state.dpr;

    function drawLocalLine(p, dir) {
      const L = t.side * 2;
      const p0 = localToScreen(add(p, mul(dir, -L)));
      const p1 = localToScreen(add(p, mul(dir, L)));
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    const d0 = v(1, 0);
    const d60 = v(0.5, Math.sqrt(3) / 2);
    const d120 = v(-0.5, Math.sqrt(3) / 2);

    const { minX, minY, maxX, maxY } = t.bounds;
    if (mode === "square") {
      for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
        drawLocalLine(v(x, 0), v(0, 1));
      }
      for (let y = Math.floor(minY / step) * step; y <= maxY; y += step) {
        drawLocalLine(v(0, y), v(1, 0));
      }
    } else {
      for (let y = Math.floor(minY / dy) * dy; y <= maxY; y += dy) {
        drawLocalLine(v(0, y), d0);
      }

      const count = Math.ceil((maxX - minX) / step) + 10;
      for (let i = -count; i <= count; i += 1) {
        drawLocalLine(v(i * step, 0), d60);
        drawLocalLine(v(i * step, 0), d120);
      }
    }

    ctx.restore();
  }

  function drawNearestGridPoint() {
    if (!state.hover) return;
    if (state.tool === "fill" || state.tool === "delete") return;
    if (!state.snap) return;

    const p = state.hover.snapLocal;
    if (!pointInPrimaryShape(p)) return;
    const s = localToScreen(p);
    const r = 4 * state.dpr;

    ctx.save();
    ctx.fillStyle = "#2b66ff";
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#2b66ff";
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5 * state.dpr;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawFillsBig() {
    const t = state.tri;
    ctx.save();
    clipBigTriangle();
    for (const fill of state.fills) {
      const f = getFillRenderData(fill);
      if (!f) continue;
      ctx.save();
      ctx.translate(t.center.x, t.center.y);
      ctx.drawImage(f.bmp, f.minX, f.minY, f.wLocal, f.hLocal);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawInkBig(widthPx) {
    ctx.save();
    clipBigTriangle();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = widthPx * state.dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const o of state.ink) {
      if (o.type === "line") {
        const a = localToScreen(o.a);
        const b = localToScreen(o.b);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (o.type === "circle") {
        const c = localToScreen(o.c);
        ctx.beginPath();
        ctx.arc(c.x, c.y, o.r, 0, TAU);
        ctx.stroke();
      } else if (o.type === "arc") {
        const c = localToScreen(o.c);
        ctx.beginPath();
        ctx.arc(c.x, c.y, o.r, o.a0, o.a1, false);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawPreviewUnclippedBlue() {
    if (!state.drawing) return;
    const d = state.drawing;
    ctx.save();
    ctx.strokeStyle = "#2b66ff";
    ctx.lineWidth = 2 * state.dpr;
    ctx.globalAlpha = 0.9;
    ctx.setLineDash([6 * state.dpr, 6 * state.dpr]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (d.tool === "line") {
      const a = localToScreen(d.startLocal);
      const b = localToScreen(d.curLocal);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (d.tool === "circle") {
      const c = localToScreen(d.startLocal);
      const r = len(sub(d.curLocal, d.startLocal));
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function angleWrap(a) {
    while (a < 0) a += TAU;
    while (a >= TAU) a -= TAU;
    return a;
  }

  function pointToSegmentDistance(p, a, b) {
    const ab = sub(b, a);
    const denom = dot(ab, ab) || 1;
    const t = clamp(dot(sub(p, a), ab) / denom, 0, 1);
    const proj = add(a, mul(ab, t));
    return len(sub(p, proj));
  }

  function angleInArc(ang, a0, a1) {
    const aa = angleWrap(ang);
    const s = angleWrap(a0);
    const e = angleWrap(a1);
    if (s <= e) return aa >= s && aa <= e;
    return aa >= s || aa <= e;
  }

  function findDeletableInkIndex(pLocal) {
    const thresh = 10 * state.dpr;
    for (let i = state.ink.length - 1; i >= 0; i -= 1) {
      const o = state.ink[i];
      if (o.type === "line") {
        if (pointToSegmentDistance(pLocal, o.a, o.b) <= thresh) return i;
        continue;
      }
      if (o.type === "circle") {
        const d = len(sub(pLocal, o.c));
        if (Math.abs(d - o.r) <= thresh) return i;
        continue;
      }
      if (o.type === "arc") {
        const d = len(sub(pLocal, o.c));
        const ang = Math.atan2(pLocal.y - o.c.y, pLocal.x - o.c.x);
        if (Math.abs(d - o.r) <= thresh && angleInArc(ang, o.a0, o.a1)) return i;
      }
    }
    return -1;
  }

  function pointInFillMask(fillData, pLocal) {
    if (pLocal.x < fillData.minX || pLocal.y < fillData.minY) return false;
    if (pLocal.x > fillData.minX + fillData.wLocal || pLocal.y > fillData.minY + fillData.hLocal) return false;
    const ux = (pLocal.x - fillData.minX) / fillData.wLocal;
    const uy = (pLocal.y - fillData.minY) / fillData.hLocal;
    if (ux < 0 || uy < 0 || ux > 1 || uy > 1) return false;
    const sx = Math.floor(ux * fillData.bmp.width);
    const sy = Math.floor(uy * fillData.bmp.height);
    if (sx < 0 || sy < 0 || sx >= fillData.bmp.width || sy >= fillData.bmp.height) return false;
    const g = fillData.bmp.getContext("2d", { willReadFrequently: true });
    if (!g) return false;
    const alpha = g.getImageData(sx, sy, 1, 1).data[3];
    return alpha > 0;
  }

  function findFillIndexAtPoint(pLocal) {
    for (let i = state.fills.length - 1; i >= 0; i -= 1) {
      const fillData = getFillRenderData(state.fills[i]);
      if (!fillData) continue;
      if (pointInFillMask(fillData, pLocal)) return i;
    }
    return -1;
  }

  function captureFillSignatures() {
    const sigs = new Map();
    for (const fill of state.fills) {
      const data = getFillRenderData(fill);
      sigs.set(fill, data ? data.sig : null);
    }
    return sigs;
  }

  function pruneFillsAfterInkDelete(previousSignatures) {
    const kept = [];
    for (const fill of state.fills) {
      const before = previousSignatures.get(fill);
      const afterData = getFillRenderData(fill);
      const after = afterData ? afterData.sig : null;
      if (before && after && before === after) kept.push(fill);
    }
    state.fills = kept;
  }

  function deleteAtPoint(pLocal) {
    const inkIdx = findDeletableInkIndex(pLocal);
    if (inkIdx >= 0) {
      pushUndo();
      const prevFillSignatures = captureFillSignatures();
      state.ink.splice(inkIdx, 1);
      markInkChanged();
      pruneFillsAfterInkDelete(prevFillSignatures);
      updateHoverPick();
      requestRender();
      return true;
    }
    const fillIdx = findFillIndexAtPoint(pLocal);
    if (fillIdx >= 0) {
      pushUndo();
      state.fills.splice(fillIdx, 1);
      updateHoverPick();
      requestRender();
      return true;
    }
    return false;
  }

  function quarterArcForPoint(c, r, pLocal) {
    const ang = angleWrap(Math.atan2(pLocal.y - c.y, pLocal.x - c.x));
    const q = Math.floor(ang / (TAU / 4));
    const a0 = q * (TAU / 4);
    const a1 = (q + 1) * (TAU / 4);
    return { type: "arc", c: { x: c.x, y: c.y }, r, a0, a1 };
  }

  function findNearestCircle(pLocal) {
    let best = null;
    const thresh = 16 * state.dpr;
    for (const o of state.ink) {
      if (o.type !== "circle") continue;
      const d = len(sub(pLocal, o.c));
      const distToCirc = Math.abs(d - o.r);
      if (distToCirc > thresh) continue;
      if (!best || distToCirc < best.distToCirc) best = { circle: o, distToCirc, d };
    }
    return best;
  }

  function updateHoverPick() {
    state.hoverArcPick = null;
    if (!state.hover) return;
    if (state.tool !== "circle") return;

    const p = state.snap && state.tool !== "fill" ? state.hover.snapLocal : state.hover.local;
    const hit = findNearestCircle(p);
    if (!hit) return;

    const c = hit.circle.c;
    const r = hit.circle.r;
    const inside = hit.d < r - 1.0 * state.dpr;
    if (!inside) return;

    state.hoverArcPick = { arc: quarterArcForPoint(c, r, p) };
  }

  function drawHoverArcHighlight() {
    if (!state.hoverArcPick) return;
    const a = state.hoverArcPick.arc;

    ctx.save();
    ctx.strokeStyle = "#2b66ff";
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3 * state.dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    clipBigTriangle();

    const c = localToScreen(a.c);
    ctx.beginPath();
    ctx.arc(c.x, c.y, a.r, a.a0, a.a1, false);
    ctx.stroke();

    ctx.restore();
  }

  function render() {
    clearScreen();

    renderBackgroundTiling();
    drawBigTriangleShadow();
    fillBigTriangleWhite();

    drawInnerTriGrid();
    drawNearestGridPoint();

    drawInkBig(1);
    drawFillsBig();
    drawInkBig(2);

    drawHoverArcHighlight();
    strokeBigTriangle();

    drawPreviewUnclippedBlue();
  }

  function getPointer(e) {
    const rect = canvas.getBoundingClientRect();
    return v((e.clientX - rect.left) * state.dpr, (e.clientY - rect.top) * state.dpr);
  }

  function updateHover(pScreen) {
    const local = screenToLocal(pScreen);
    const snapLocal = snapToTriGrid(local);
    state.hover = { screen: pScreen, local, snapLocal };
    updateHoverPick();
  }

  function shouldSnapForTool(tool) {
    if (!state.snap) return false;
    if (tool === "fill" || tool === "delete") return false;
    return true;
  }

  function onPointerDown(e) {
    if (state.shapeDialogOpen) return;
    const p = getPointer(e);
    canvas.setPointerCapture?.(e.pointerId);
    state.pointerDown = true;

    updateHover(p);

    const doSnap = shouldSnapForTool(state.tool);
    const local = doSnap ? state.hover.snapLocal : state.hover.local;

    if (state.tool === "fill") {
      if (!pointInPrimaryShape(local)) {
        state.pointerDown = false;
        return;
      }
      pushUndo();
      const fill = { x: local.x, y: local.y };
      const fillData = computeFillMaskAtSeed(fill);
      if (fillData) {
        state.fills.push(fill);
        fillCache.set(fill, { key: getFillCacheKey(), data: fillData });
      }
      state.pointerDown = false;
      requestRender();
      return;
    }

    if (state.tool === "delete") {
      deleteAtPoint(local);
      state.pointerDown = false;
      state.drawing = null;
      return;
    }

    state.drawing = { tool: state.tool, startLocal: local, curLocal: local };
    requestRender();
  }

  function onPointerMove(e) {
    if (state.shapeDialogOpen) return;
    const p = getPointer(e);
    updateHover(p);

    if (state.pointerDown && state.drawing) {
      const doSnap = shouldSnapForTool(state.drawing.tool);
      const local = doSnap ? state.hover.snapLocal : state.hover.local;
      state.drawing.curLocal = local;
    }
    requestRender();
  }

  function onPointerUp() {
    if (state.shapeDialogOpen) return;
    if (!state.pointerDown) return;
    state.pointerDown = false;

    const d = state.drawing;
    state.drawing = null;

    if (!d) {
      requestRender();
      return;
    }

    if (d.tool === "circle") {
      const dragDist = len(sub(d.curLocal, d.startLocal));
      const CLICK_EPS = 6 * state.dpr;

      if (dragDist <= CLICK_EPS && state.hoverArcPick) {
        pushUndo();
        state.ink.push(state.hoverArcPick.arc);
        markInkChanged();
        requestRender();
        return;
      }

      if (dragDist > 0.5 * state.dpr) {
        pushUndo();
        state.ink.push({ type: "circle", c: d.startLocal, r: dragDist });
        markInkChanged();
        requestRender();
        return;
      }

      requestRender();
      return;
    }

    if (d.tool === "line") {
      const dist = len(sub(d.curLocal, d.startLocal));
      if (dist > 0.5 * state.dpr) {
        pushUndo();
        state.ink.push({ type: "line", a: d.startLocal, b: d.curLocal });
        markInkChanged();
      }
      requestRender();
      return;
    }

    requestRender();
  }

  function setTool(tool) {
    state.tool = tool;
    syncToolMenu();
    syncToolPalette();
    state.pointerDown = false;
    state.drawing = null;
    updateHoverPick();
    requestRender();
  }

  function setSelectableState(el, selected) {
    el.classList.toggle("selected", selected);
    if (el.getAttribute("role") === "menuitemradio" || el.getAttribute("role") === "menuitemcheckbox") {
      el.setAttribute("aria-checked", selected ? "true" : "false");
    }
  }

  function syncToolMenu() {
    [...toolSeg.querySelectorAll(".menu-item[data-tool]")].forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      setSelectableState(item, item.dataset.tool === state.tool);
    });
  }

  function syncGridMenu() {
    setSelectableState(itemGrid, state.showGrid);
    setSelectableState(itemSnap, state.snap);
    for (const item of gridSizeItems) {
      if (!(item instanceof HTMLElement)) continue;
      setSelectableState(item, Number(item.dataset.gridSize) === state.gridTargetPx);
    }
  }

  function syncViewMenu() {
    setSelectableState(itemViewTools, state.showToolsPalette);
    toolPalette.classList.toggle("hidden", !state.showToolsPalette);
  }

  function syncToolPalette() {
    for (const btn of paletteToolButtons) {
      if (!(btn instanceof HTMLButtonElement)) continue;
      const selected = btn.dataset.tool === state.tool;
      btn.classList.toggle("selected", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    }
  }

  function syncShapeDialog() {
    shapeDialogBackdrop.classList.toggle("open", state.shapeDialogOpen);
    btnShapeClose.classList.toggle("hidden", state.shapeDialogRequired);
    btnShapeClose.disabled = state.shapeDialogRequired;
    btnShapeClose.setAttribute("aria-hidden", state.shapeDialogRequired ? "true" : "false");
  }

  function setPendingTileShape(shape) {
    if (!isTileShape(shape)) return;
    state.pendingTileShape = shape;
    for (const option of shapeOptionButtons) {
      if (!(option instanceof HTMLElement)) continue;
      const selected = option.dataset.shapeOption === shape;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", selected ? "true" : "false");
    }
  }

  function openShapeDialog(required = false) {
    state.shapeDialogOpen = true;
    state.shapeDialogRequired = required;
    state.pointerDown = false;
    state.drawing = null;
    setPendingTileShape(state.tileShape);
    openMenu(null);
    syncShapeDialog();
    requestRender();
  }

  function closeShapeDialog() {
    if (state.shapeDialogRequired) return;
    state.shapeDialogOpen = false;
    syncShapeDialog();
  }

  function applyTileShape(shape) {
    if (!isTileShape(shape)) return;
    state.tileShape = shape;
    state.pendingTileShape = shape;
    state.pointerDown = false;
    state.drawing = null;
    state.hover = null;
    state.hoverArcPick = null;
    state.ink = [];
    state.fills = [];
    state.undoStack.length = 0;
    state.redoStack.length = 0;
    markInkChanged();
    recomputeBigTriangle();
    recomputeGrid();
    syncHUD();
    requestRender();
  }

  function selectTileShape(shape) {
    if (!state.shapeDialogOpen) return;
    if (!isTileShape(shape)) return;
    setPendingTileShape(shape);
    applyTileShape(shape);
    state.shapeDialogOpen = false;
    state.shapeDialogRequired = false;
    syncShapeDialog();
  }

  function onShapeDialogCancel() {
    closeShapeDialog();
  }

  function setActionDisabled(el, disabled) {
    el.classList.toggle("disabled", disabled);
    el.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  function syncHUD() {
    setActionDisabled(itemUndo, state.undoStack.length === 0);
    setActionDisabled(itemRedo, state.redoStack.length === 0);
    palUndo.disabled = state.undoStack.length === 0;
    palRedo.disabled = state.redoStack.length === 0;
  }

  function getOpenMenuRoot() {
    if (!menuState.openMenu) return null;
    return menuRoots.find((el) => el.dataset.menu === menuState.openMenu) || null;
  }

  function openMenu(menuName) {
    menuState.openMenu = menuName;
    for (const rootEl of menuRoots) {
      rootEl.classList.toggle("open", rootEl.dataset.menu === menuName);
    }
  }

  function isMenuItemDisabled(item) {
    return item.classList.contains("disabled") || item.getAttribute("aria-disabled") === "true";
  }

  function onGridToggle() {
    state.showGrid = !state.showGrid;
    syncGridMenu();
    requestRender();
  }

  function onSnapToggle() {
    state.snap = !state.snap;
    syncGridMenu();
    updateHoverPick();
    requestRender();
  }

  function onGridSizeChange(sizePx) {
    state.gridTargetPx = sizePx;
    recomputeGrid();
    syncGridMenu();
    updateHoverPick();
    requestRender();
  }

  function onViewToolsToggle() {
    state.showToolsPalette = !state.showToolsPalette;
    syncViewMenu();
  }

  function onClear() {
    pushUndo();
    state.ink = [];
    state.fills = [];
    markInkChanged();
    requestRender();
  }

  function onUndo() {
    if (!state.undoStack.length) return;
    const cur = snapshot();
    state.redoStack.push(cur);
    restoreSnap(state.undoStack.pop());
    syncHUD();
    updateHoverPick();
    requestRender();
  }

  function onRedo() {
    if (!state.redoStack.length) return;
    const cur = snapshot();
    state.undoStack.push(cur);
    restoreSnap(state.redoStack.pop());
    syncHUD();
    updateHoverPick();
    requestRender();
  }

  function activateMenuItem(item) {
    if (isMenuItemDisabled(item)) return;
    if (item.dataset.tool) {
      setTool(item.dataset.tool);
      return;
    }
    if (item.dataset.action === "new") {
      openShapeDialog(false);
      return;
    }
    if (item.dataset.action === "undo") {
      onUndo();
      return;
    }
    if (item.dataset.action === "redo") {
      onRedo();
      return;
    }
    if (item.dataset.action === "clear") {
      onClear();
      return;
    }
    if (item.dataset.toggle === "grid") {
      onGridToggle();
      return;
    }
    if (item.dataset.toggle === "snap") {
      onSnapToggle();
      return;
    }
    if (item.dataset.toggle === "view-tools") {
      onViewToolsToggle();
      return;
    }
    if (item.dataset.gridSize) {
      const nextSize = Number(item.dataset.gridSize);
      if (!Number.isNaN(nextSize) && nextSize > 0) {
        onGridSizeChange(nextSize);
      }
    }
  }

  function onMenuPointerMove(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest("[data-menu-trigger]");
    if (!(trigger instanceof HTMLElement) || !menuBar.contains(trigger)) return;
    const menuName = trigger.dataset.menuTrigger;
    if (!menuName) return;
    if (menuName !== menuState.openMenu) {
      openMenu(menuName);
    }
  }

  function onMenuPointerLeave() {
    openMenu(null);
  }

  function onWindowPointerDown(e) {
    const target = e.target;
    if (!(target instanceof Node)) {
      openMenu(null);
      return;
    }
    if (!menuBar.contains(target)) openMenu(null);
  }

  function onMenuClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const item = target.closest(".menu-item");
    if (!(item instanceof HTMLElement) || !menuBar.contains(item)) return;
    const openRoot = getOpenMenuRoot();
    if (!openRoot || !openRoot.contains(item)) return;
    activateMenuItem(item);
    openMenu(null);
  }

  function onPaletteClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest(".palette-btn");
    if (!(btn instanceof HTMLButtonElement) || !toolPalette.contains(btn) || btn.disabled) return;
    if (btn.dataset.tool) {
      setTool(btn.dataset.tool);
      return;
    }
    if (btn.dataset.paletteAction === "undo") {
      onUndo();
      return;
    }
    if (btn.dataset.paletteAction === "redo") {
      onRedo();
    }
  }

  function onShapeOptionClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest("[data-shape-option]");
    if (!(btn instanceof HTMLButtonElement) || !shapeOptionList.contains(btn)) return;
    const shape = btn.dataset.shapeOption;
    if (shape) selectTileShape(shape);
  }

  function inTextEntryTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest("input, textarea, select, [contenteditable=\"true\"]");
  }

  function onKeyDown(e) {
    if (inTextEntryTarget(e.target)) return;
    if (state.shapeDialogOpen) {
      if (e.key === "Escape" && !state.shapeDialogRequired) {
        onShapeDialogCancel();
      }
      return;
    }
    const key = e.key.toLowerCase();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (key === "1") {
      setTool("line");
      return;
    }
    if (key === "2") {
      setTool("circle");
      return;
    }
    if (key === "3") {
      setTool("fill");
      return;
    }
    if (key === "d") {
      setTool("delete");
      return;
    }
    if (key === "z") {
      onUndo();
      return;
    }
    if (key === "y") {
      onRedo();
      return;
    }
    if (key === "x") {
      onClear();
      return;
    }
    if (e.key === "Escape") {
      openMenu(null);
      state.pointerDown = false;
      state.drawing = null;
      requestRender();
    }
  }

  on(window, "resize", resize);
  on(canvas, "pointerdown", onPointerDown);
  on(canvas, "pointermove", onPointerMove);
  on(canvas, "pointerup", onPointerUp);
  on(canvas, "pointercancel", onPointerUp);
  on(canvas, "pointerleave", () => {
    state.hover = null;
    state.hoverArcPick = null;
    requestRender();
  });

  on(menuBar, "pointermove", onMenuPointerMove);
  on(menuBar, "pointerleave", onMenuPointerLeave);
  on(menuBar, "click", onMenuClick);
  on(toolPalette, "click", onPaletteClick);
  on(shapeOptionList, "click", onShapeOptionClick);
  on(btnShapeClose, "click", onShapeDialogCancel);
  on(window, "pointerdown", onWindowPointerDown);
  on(window, "keydown", onKeyDown);

  function init() {
    setPendingTileShape(state.pendingTileShape);
    syncShapeDialog();
    syncToolMenu();
    syncGridMenu();
    syncViewMenu();
    syncToolPalette();
    syncHUD();
    resize();
    requestRender();
  }

  init();

  return () => {
    openMenu(null);
    state.pointerDown = false;
    state.drawing = null;
    if (rafId) cancelAnimationFrame(rafId);
    for (const off of unsubs.splice(0)) off();
  };
}
