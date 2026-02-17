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
  const itemLoad = root.querySelector("#itemLoad");
  const itemSave = root.querySelector("#itemSave");
  const itemExportTile = root.querySelector("#itemExportTile");
  const itemExportWallpaper = root.querySelector("#itemExportWallpaper");
  const toolSeg = root.querySelector("#toolSeg");
  const itemUndo = root.querySelector("#itemUndo");
  const itemRedo = root.querySelector("#itemRedo");
  const itemClear = root.querySelector("#itemClear");
  const itemGrid = root.querySelector("#itemGrid");
  const itemToolSnap = root.querySelector("#itemToolSnap");
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
  const exportDialogBackdrop = root.querySelector("#exportDialogBackdrop");
  const exportDialog = root.querySelector("#exportDialog");
  const exportDialogForm = root.querySelector("#exportDialogForm");
  const exportWidthInput = root.querySelector("#exportWidthInput");
  const exportHeightInput = root.querySelector("#exportHeightInput");
  const btnExportClose = root.querySelector("#btnExportClose");
  const btnExportCancel = root.querySelector("#btnExportCancel");
  const loadFileInput = root.querySelector("#loadFileInput");

  if (!(menuBar instanceof HTMLElement) ||
      !(itemNew instanceof HTMLElement) ||
      !(itemLoad instanceof HTMLElement) ||
      !(itemSave instanceof HTMLElement) ||
      !(itemExportTile instanceof HTMLElement) ||
      !(itemExportWallpaper instanceof HTMLElement) ||
      !(toolSeg instanceof HTMLElement) ||
      !(itemUndo instanceof HTMLElement) ||
      !(itemRedo instanceof HTMLElement) ||
      !(itemClear instanceof HTMLElement) ||
      !(itemGrid instanceof HTMLElement) ||
      !(itemToolSnap instanceof HTMLElement) ||
      !(itemSnap instanceof HTMLElement) ||
      !(itemViewTools instanceof HTMLElement) ||
      !(toolPalette instanceof HTMLElement) ||
      !(palUndo instanceof HTMLButtonElement) ||
      !(palRedo instanceof HTMLButtonElement) ||
      !(shapeDialogBackdrop instanceof HTMLElement) ||
      !(shapeOptionList instanceof HTMLElement) ||
      !(btnShapeClose instanceof HTMLButtonElement) ||
      !(exportDialogBackdrop instanceof HTMLElement) ||
      !(exportDialog instanceof HTMLElement) ||
      !(exportDialogForm instanceof HTMLFormElement) ||
      !(exportWidthInput instanceof HTMLInputElement) ||
      !(exportHeightInput instanceof HTMLInputElement) ||
      !(btnExportClose instanceof HTMLButtonElement) ||
      !(btnExportCancel instanceof HTMLButtonElement) ||
      !(loadFileInput instanceof HTMLInputElement) ||
      !menuRoots.length ||
      !paletteToolButtons.length ||
      !shapeOptionButtons.length ||
      !gridSizeItems.length) {
    throw new Error("Designer mount failed: one or more menu elements are missing.");
  }

  const TAU = Math.PI * 2;
  const SHAPES = ["triangle", "square", "hexagon", "octagon"];
  const TILING_OPTIONS = {
    triangle: { shapes: ["triangle"] },
    square: { shapes: ["square"] },
    hexagon: { shapes: ["hexagon"] },
    "tiling-3464": { shapes: ["hexagon", "triangle", "square"] },
    "tiling-48-2": { shapes: ["octagon", "square"] },
    "tiling-33-434": { shapes: ["square", "triangle"] },
  };
  const DEFAULT_TILING = "triangle";
  const SHAPE_GRID_MODE = {
    triangle: "tri",
    square: "square",
    hexagon: "tri",
    octagon: "square",
  };
  const GRID_DIVISION_OPTIONS = [48, 24, 16, 12, 8];
  const ROTS_BY_SHAPE = {
    triangle: [0, TAU / 3, (2 * TAU) / 3],
    square: [0, TAU / 4, TAU / 2, (3 * TAU) / 4],
    hexagon: [0, TAU / 6, (2 * TAU) / 6, (3 * TAU) / 6, (4 * TAU) / 6, (5 * TAU) / 6],
    octagon: [0, TAU / 8, (2 * TAU) / 8, (3 * TAU) / 8, (4 * TAU) / 8, (5 * TAU) / 8, (6 * TAU) / 8, (7 * TAU) / 8],
  };
  const BG_SCALE = 0.165;
  const BG_SEED = 1337;
  const SAVE_DOC_VERSION = 2;
  const TILESET_CONTROL_BUTTON_SIZE_PX = 30;
  const TILESET_CONTROL_BUTTON_RADIUS_PX = 7;
  const TILESET_CONTROL_PANEL_PADDING_PX = 7;
  const TILESET_CONTROL_PANEL_RADIUS_PX = 10;
  const TILESET_CONTROL_GAP_PX = 18;

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

  function createEmptyDesign() {
    return { ink: [], fills: [] };
  }

  const state = {
    dpr: 1,
    vw: 0,
    vh: 0,
    tool: "line",
    tilingId: DEFAULT_TILING,
    tileShape: "triangle",
    pendingTilingId: DEFAULT_TILING,
    shapeDialogOpen: true,
    shapeDialogRequired: true,
    exportDialogOpen: false,
    exportWidth: 1920,
    exportHeight: 1080,

    showGrid: false,
    snap: false,
    toolSnap: true,
    gridDivisions: 16,
    showToolsPalette: true,
    grid: null,

    primaryTiles: [],
    tri: null,
    activePrimaryTileId: null,
    nextPrimaryTileId: 2,
    singleTileVariants: [{ id: 1, design: createEmptyDesign() }],
    shapeDesigns: Object.fromEntries(SHAPES.map((shape) => [shape, createEmptyDesign()])),

    ink: [],
    fills: [],
    nextInkId: 1,
    inkRevision: 0,
    geomRevision: 0,

    undoStack: [],
    redoStack: [],

    pointerDown: false,
    drawing: null,
    selectedInkIndex: -1,
    selectionDrag: null,

    hover: null,
    hoverTileControl: null,
    hoverArcPick: null,
    hoverDeleteInkIndex: -1,

    rafPending: false,
  };

  let rafId = 0;
  const unsubs = [];
  let fillCache = new WeakMap();
  let mixed33434Cache = null;
  const menuState = {
    openMenu: null,
  };

  function on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    unsubs.push(() => target.removeEventListener(type, handler, options));
  }

  function isShape(shape) {
    return SHAPES.includes(shape);
  }

  function isTilingOption(id) {
    return Object.hasOwn(TILING_OPTIONS, id);
  }

  function getTilingOption(id) {
    return TILING_OPTIONS[id] || TILING_OPTIONS[DEFAULT_TILING];
  }

  function getShapeDesign(shape) {
    return state.shapeDesigns[shape];
  }

  function isSingleShapeLayout(tilingId = state.tilingId) {
    return getTilingOption(tilingId).shapes.length === 1;
  }

  function getSingleTileVariantById(id) {
    return state.singleTileVariants.find((variant) => variant.id === id) || null;
  }

  function cloneSingleTileVariants(variants = state.singleTileVariants) {
    return variants.map((variant) => ({
      id: variant.id,
      design: cloneDesign(variant.design || createEmptyDesign()),
    }));
  }

  function ensureSingleTileVariants(minCount = 1) {
    if (!Array.isArray(state.singleTileVariants)) state.singleTileVariants = [];
    while (state.singleTileVariants.length < minCount) {
      const id = state.nextPrimaryTileId++;
      state.singleTileVariants.push({ id, design: createEmptyDesign() });
    }
  }

  function getDesignForTile(tile) {
    if (!tile) return null;
    if (!isSingleShapeLayout()) return getShapeDesign(tile.shape);
    return getSingleTileVariantById(tile.id)?.design || null;
  }

  function getActiveDesign() {
    return getDesignForTile(state.tri) || getShapeDesign(state.tileShape) || createEmptyDesign();
  }

  function isValidInkId(id) {
    return Number.isInteger(id) && id > 0;
  }

  function ensureDesignInkIds(design) {
    if (!design) return;
    for (const ink of design.ink) {
      if (isValidInkId(ink.id)) {
        if (ink.id >= state.nextInkId) state.nextInkId = ink.id + 1;
        continue;
      }
      ink.id = state.nextInkId;
      state.nextInkId += 1;
    }
  }

  function ensureAllInkIds() {
    for (const shape of SHAPES) {
      ensureDesignInkIds(getShapeDesign(shape));
    }
    for (const variant of state.singleTileVariants) {
      ensureDesignInkIds(variant.design);
    }
  }

  function createInk(ink) {
    return {
      id: state.nextInkId++,
      ...ink,
    };
  }

  function syncActiveDesignRefs() {
    ensureAllInkIds();
    const design = getActiveDesign();
    state.ink = design.ink;
    state.fills = design.fills;
  }

  function cloneFill(f) {
    const out = { x: f.x, y: f.y };
    if (Array.isArray(f.boundaryInkIds)) out.boundaryInkIds = [...f.boundaryInkIds];
    if (f.usesTileBoundary) out.usesTileBoundary = true;
    return out;
  }

  function cloneDesign(design) {
    return {
      ink: design.ink.map((o) => JSON.parse(JSON.stringify(o))),
      fills: design.fills.map(cloneFill),
    };
  }

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function toFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function toInkId(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  function sanitizePoint(rawPoint) {
    if (!isRecord(rawPoint)) return null;
    const x = toFiniteNumber(rawPoint.x);
    const y = toFiniteNumber(rawPoint.y);
    if (x === null || y === null) return null;
    return v(x, y);
  }

  function sanitizeInkEntry(rawInk) {
    if (!isRecord(rawInk)) return null;
    const type = rawInk.type;
    if (type === "line") {
      const a = sanitizePoint(rawInk.a);
      const b = sanitizePoint(rawInk.b);
      if (!a || !b) return null;
      const out = { type: "line", a, b };
      const id = toInkId(rawInk.id);
      if (id !== null) out.id = id;
      return out;
    }
    if (type === "circle") {
      const c = sanitizePoint(rawInk.c);
      const r = toFiniteNumber(rawInk.r);
      if (!c || r === null || r <= 0) return null;
      const out = { type: "circle", c, r };
      const id = toInkId(rawInk.id);
      if (id !== null) out.id = id;
      return out;
    }
    if (type === "arc") {
      const c = sanitizePoint(rawInk.c);
      const r = toFiniteNumber(rawInk.r);
      const a0 = toFiniteNumber(rawInk.a0);
      const a1 = toFiniteNumber(rawInk.a1);
      if (!c || r === null || r <= 0 || a0 === null || a1 === null) return null;
      const out = { type: "arc", c, r, a0, a1 };
      const id = toInkId(rawInk.id);
      if (id !== null) out.id = id;
      return out;
    }
    return null;
  }

  function allocateInkId(localIds, globalIds, nextRef) {
    let id = Math.max(1, Math.trunc(Number(nextRef.value) || 1));
    while (localIds.has(id) || globalIds.has(id)) id += 1;
    nextRef.value = id + 1;
    return id;
  }

  function sanitizeFillEntry(rawFill, validInkIds, idMap) {
    if (!isRecord(rawFill)) return null;
    const x = toFiniteNumber(rawFill.x);
    const y = toFiniteNumber(rawFill.y);
    if (x === null || y === null) return null;
    const out = { x, y };
    if (Array.isArray(rawFill.boundaryInkIds)) {
      const ids = [];
      for (const rawId of rawFill.boundaryInkIds) {
        const id = toInkId(rawId);
        if (id === null) continue;
        const mapped = idMap.get(id) ?? id;
        if (!validInkIds.has(mapped)) continue;
        if (ids.includes(mapped)) continue;
        ids.push(mapped);
      }
      out.boundaryInkIds = ids;
    }
    if (rawFill.usesTileBoundary === true) out.usesTileBoundary = true;
    return out;
  }

  function sanitizeDesignEntry(rawDesign, globalInkIds, nextInkIdRef) {
    const empty = { ink: [], fills: [] };
    if (!isRecord(rawDesign)) return empty;
    const localInkIds = new Set();
    const idMap = new Map();
    const inks = [];
    const rawInk = Array.isArray(rawDesign.ink) ? rawDesign.ink : [];

    for (const raw of rawInk) {
      const ink = sanitizeInkEntry(raw);
      if (!ink) continue;
      const oldId = isValidInkId(ink.id) ? ink.id : null;
      let nextId = oldId;
      if (!isValidInkId(nextId) || localInkIds.has(nextId) || globalInkIds.has(nextId)) {
        nextId = allocateInkId(localInkIds, globalInkIds, nextInkIdRef);
      } else if (nextId >= nextInkIdRef.value) {
        nextInkIdRef.value = nextId + 1;
      }
      ink.id = nextId;
      if (oldId !== null && !idMap.has(oldId)) idMap.set(oldId, nextId);
      localInkIds.add(nextId);
      globalInkIds.add(nextId);
      inks.push(ink);
    }

    const validInkIds = new Set(inks.map((ink) => ink.id));
    const fills = [];
    const rawFills = Array.isArray(rawDesign.fills) ? rawDesign.fills : [];
    for (const rawFill of rawFills) {
      const fill = sanitizeFillEntry(rawFill, validInkIds, idMap);
      if (fill) fills.push(fill);
    }

    return { ink: inks, fills };
  }

  function sanitizeLoadedDocument(rawDoc) {
    if (!isRecord(rawDoc)) return null;
    const tilingId = isTilingOption(rawDoc.tilingId) ? rawDoc.tilingId : DEFAULT_TILING;
    const modeShapes = getTilingOption(tilingId).shapes;
    const shapeDesigns = createEmptyShapeDesigns();
    const globalInkIds = new Set();
    const nextInkIdRef = { value: 1 };

    let rawDesigns = isRecord(rawDoc.designs) ? rawDoc.designs : null;
    if (!rawDesigns && isRecord(rawDoc.shapeDesigns)) rawDesigns = rawDoc.shapeDesigns;
    if (!rawDesigns) {
      rawDesigns = {};
      const fallbackShape = modeShapes.includes(rawDoc.tileShape) ? rawDoc.tileShape : modeShapes[0];
      if (Array.isArray(rawDoc.ink) || Array.isArray(rawDoc.fills)) {
        rawDesigns[fallbackShape] = {
          ink: Array.isArray(rawDoc.ink) ? rawDoc.ink : [],
          fills: Array.isArray(rawDoc.fills) ? rawDoc.fills : [],
        };
      }
    }

    for (const shape of modeShapes) {
      shapeDesigns[shape] = sanitizeDesignEntry(rawDesigns[shape], globalInkIds, nextInkIdRef);
    }

    const tileShape = modeShapes.includes(rawDoc.tileShape) ? rawDoc.tileShape : modeShapes[0];
    let singleTileVariants = [{ id: 1, design: cloneDesign(shapeDesigns[tileShape] || createEmptyDesign()) }];
    let activePrimaryTileId = 1;
    let nextPrimaryTileId = 2;

    if (modeShapes.length === 1) {
      const rawSingleTiles = Array.isArray(rawDoc.singleTiles) ? rawDoc.singleTiles : [];
      const parsedSingles = [];
      for (const rawEntry of rawSingleTiles) {
        const rawDesign = isRecord(rawEntry) && isRecord(rawEntry.design) ? rawEntry.design : rawEntry;
        parsedSingles.push(sanitizeDesignEntry(rawDesign, globalInkIds, nextInkIdRef));
      }
      if (parsedSingles.length) {
        singleTileVariants = parsedSingles.map((design, idx) => ({ id: idx + 1, design }));
      }
      nextPrimaryTileId = singleTileVariants.length + 1;
      const activeIdxRaw = Number(rawDoc.activeSingleTileIndex);
      const activeIdx = Number.isInteger(activeIdxRaw)
        ? clamp(activeIdxRaw, 0, singleTileVariants.length - 1)
        : 0;
      activePrimaryTileId = singleTileVariants[activeIdx]?.id || 1;
      shapeDesigns[tileShape] = cloneDesign(singleTileVariants[0]?.design || createEmptyDesign());
    }

    return {
      tilingId,
      tileShape,
      shapeDesigns,
      singleTileVariants,
      activePrimaryTileId,
      nextPrimaryTileId,
      nextInkId: Math.max(1, nextInkIdRef.value),
    };
  }

  function createSaveDocument() {
    ensureAllInkIds();
    const shapes = getTilingOption(state.tilingId).shapes;
    const designs = {};
    const singleLayout = shapes.length === 1;

    if (singleLayout) {
      const baseShape = shapes[0] || state.tileShape;
      const variants = cloneSingleTileVariants();
      const firstDesign = variants[0]?.design || createEmptyDesign();
      designs[baseShape] = cloneDesign(firstDesign);
      return {
        app: "tile-designer",
        version: SAVE_DOC_VERSION,
        tilingId: state.tilingId,
        tileShape: state.tileShape,
        designs,
        singleTiles: variants.map((variant) => cloneDesign(variant.design)),
        activeSingleTileIndex: Math.max(0, variants.findIndex((variant) => variant.id === state.activePrimaryTileId)),
      };
    }

    for (const shape of shapes) {
      const design = getShapeDesign(shape) || createEmptyDesign();
      designs[shape] = cloneDesign(design);
    }
    return {
      app: "tile-designer",
      version: SAVE_DOC_VERSION,
      tilingId: state.tilingId,
      tileShape: state.tileShape,
      designs,
    };
  }

  function snapshot() {
    const designs = {};
    for (const shape of SHAPES) {
      designs[shape] = cloneDesign(getShapeDesign(shape));
    }
    return {
      tileShape: state.tileShape,
      activePrimaryTileId: state.activePrimaryTileId,
      nextPrimaryTileId: state.nextPrimaryTileId,
      singleTileVariants: cloneSingleTileVariants(),
      designs,
    };
  }

  function pushUndo() {
    state.undoStack.push(snapshot());
    if (state.undoStack.length > 200) state.undoStack.shift();
    state.redoStack.length = 0;
    syncHUD();
  }

  function restoreSnap(snap) {
    const nextDesigns = Object.fromEntries(
      SHAPES.map((shape) => {
        const design = snap.designs?.[shape] || createEmptyDesign();
        return [shape, cloneDesign(design)];
      })
    );
    state.shapeDesigns = nextDesigns;
    state.singleTileVariants = Array.isArray(snap.singleTileVariants) && snap.singleTileVariants.length
      ? cloneSingleTileVariants(snap.singleTileVariants)
      : [{ id: 1, design: cloneDesign(nextDesigns[snap.tileShape] || createEmptyDesign()) }];
    let maxVariantId = 0;
    for (const variant of state.singleTileVariants) {
      if (variant.id > maxVariantId) maxVariantId = variant.id;
    }
    state.nextPrimaryTileId = Math.max(maxVariantId + 1, Number(snap.nextPrimaryTileId) || 1);
    state.activePrimaryTileId = snap.activePrimaryTileId ?? state.singleTileVariants[0]?.id ?? null;
    recomputeBigTriangle();
    const snappedTile = state.primaryTiles.find((tile) => tile.id === state.activePrimaryTileId);
    if (snappedTile) {
      setActivePrimaryTile(snappedTile, false);
    } else {
      setActiveShape(snap.tileShape, false);
    }
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

  function shapePolyLocal(shape, side) {
    if (shape === "triangle") {
      const h = (side * Math.sqrt(3)) / 2;
      return [v(0, -(2 / 3) * h), v(-side / 2, (1 / 3) * h), v(side / 2, (1 / 3) * h)];
    }
    if (shape === "square") {
      const hh = side / 2;
      return [v(-hh, -hh), v(hh, -hh), v(hh, hh), v(-hh, hh)];
    }
    if (shape === "hexagon") {
      const poly = [];
      for (let i = 0; i < 6; i += 1) {
        const ang = -Math.PI / 2 + (i * TAU) / 6;
        poly.push(v(Math.cos(ang) * side, Math.sin(ang) * side));
      }
      return poly;
    }
    const poly = [];
    const rotOffset = Math.PI / 8;
    for (let i = 0; i < 8; i += 1) {
      const ang = -Math.PI / 2 + rotOffset + (i * TAU) / 8;
      poly.push(v(Math.cos(ang) * side, Math.sin(ang) * side));
    }
    return poly;
  }

  function polyBounds(polyLocal) {
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
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  function buildPrimaryTile(id, shape, side, center) {
    const polyLocal = shapePolyLocal(shape, side);
    const bounds = polyBounds(polyLocal);
    const poly = polyLocal.map((p) => add(center, p));
    return { id, shape, side, center, polyLocal, poly, bounds };
  }

  function getSingleLayoutSizing(shape, variantCount = 1, viewW = state.vw, viewH = state.vh, dpr = state.dpr) {
    const count = Math.max(1, Math.trunc(Number(variantCount) || 1));
    const minDim = Math.min(viewW, viewH);
    const templateBounds = polyBounds(shapePolyLocal(shape, 1));
    const availW = Math.max(1, viewW * 0.5);
    const availH = Math.max(1, viewH * 0.5);
    const baseGap = clamp(minDim * 0.038, 10 * dpr, 30 * dpr);
    const gap = count > 1 ? Math.min(baseGap, availW / (count * 2)) : 0;
    const sideFromW = (availW - gap * (count - 1)) / Math.max(1, templateBounds.w * count);
    const sideFromH = availH / Math.max(1, templateBounds.h);
    const side = Math.max(1e-3, Math.min(sideFromW, sideFromH));
    return { templateBounds, gap, side };
  }

  function recomputeBigTriangle() {
    const mode = getTilingOption(state.tilingId);
    const modeShapes = mode.shapes;
    const minDim = Math.min(state.vw, state.vh);
    const centerY = state.vh * 0.57;
    const centerX = state.vw * 0.5;
    const tiles = [];

    if (!modeShapes.includes(state.tileShape)) {
      state.tileShape = modeShapes[0];
    }

    if (modeShapes.length === 1) {
      const shape = modeShapes[0];
      ensureSingleTileVariants(1);
      const variantCount = Math.max(1, state.singleTileVariants.length);
      const { templateBounds, gap, side } = getSingleLayoutSizing(shape, variantCount);
      const totalW = templateBounds.w * side * variantCount + gap * (variantCount - 1);
      let x = centerX - totalW / 2;
      for (const variant of state.singleTileVariants) {
        const cx = x - templateBounds.minX * side;
        tiles.push(buildPrimaryTile(variant.id, shape, side, v(cx, centerY)));
        x += templateBounds.w * side + gap;
      }
    } else {
      const templates = modeShapes.map((shape) => {
        const b = polyBounds(shapePolyLocal(shape, 1));
        return { shape, bounds: b };
      });
      const gap = minDim * 0.06;
      const availW = state.vw * 0.84;
      const availH = Math.min(state.vh * 0.34, minDim * 0.43);
      const sumW = templates.reduce((acc, t) => acc + t.bounds.w, 0);
      const maxH = Math.max(...templates.map((t) => t.bounds.h));
      const sideFromW = (availW - gap * (templates.length - 1)) / Math.max(1, sumW);
      const sideFromH = availH / Math.max(1, maxH);
      const side = Math.max(28 * state.dpr, Math.min(sideFromW, sideFromH));
      const totalW = sumW * side + gap * (templates.length - 1);
      let x = centerX - totalW / 2;
      for (const t of templates) {
        const cx = x - t.bounds.minX * side;
        tiles.push(buildPrimaryTile(`shape:${t.shape}`, t.shape, side, v(cx, centerY)));
        x += t.bounds.w * side + gap;
      }
    }

    const prevActiveTileId = state.activePrimaryTileId;
    state.primaryTiles = tiles;
    state.tri = state.primaryTiles.find((tile) => tile.id === prevActiveTileId) ||
      state.primaryTiles.find((tile) => tile.shape === state.tileShape) ||
      state.primaryTiles[0] ||
      null;
    if (state.tri) state.tileShape = state.tri.shape;
    state.activePrimaryTileId = state.tri?.id ?? null;
    syncActiveDesignRefs();
    state.geomRevision += 1;
    invalidateFillCache();
  }

  function computeGridForShape(shape, side) {
    let N = GRID_DIVISION_OPTIONS[0];
    let bestErr = Infinity;
    for (const candidate of GRID_DIVISION_OPTIONS) {
      const err = Math.abs(candidate - state.gridDivisions);
      if (err < bestErr) {
        bestErr = err;
        N = candidate;
      }
    }
    const mode = SHAPE_GRID_MODE[shape] === "square" ? "square" : "tri";
    const step = side / N;
    if (mode === "square") {
      let halfExtent = side / 2;
      if (shape === "octagon") {
        // Octagon `side` is circumradius; grid should span the octagon's axis-aligned bounding square.
        halfExtent = side * Math.cos(Math.PI / 8);
      }
      const span = halfExtent * 2;
      return {
        mode,
        N,
        step: span / N,
        origin: v(-halfExtent, -halfExtent),
      };
    }

    const dy = (step * Math.sqrt(3)) / 2;
    let angle = 0;
    let origin = v(side / 2, (side * Math.sqrt(3)) / 6);
    if (shape === "hexagon") {
      angle = Math.PI / 6;
      origin = v((-Math.sqrt(3) * side) / 2, -side / 2);
    }
    const b1 = rot(v(step, 0), angle);
    const b2 = rot(v(step / 2, dy), angle);
    const det = b1.x * b2.y - b1.y * b2.x || 1;
    return {
      mode,
      N,
      step,
      dy,
      origin,
      b1,
      b2,
      det,
    };
  }

  function recomputeGrid() {
    if (!state.tri) return;
    state.grid = computeGridForShape(state.tri.shape, state.tri.side);
  }

  function setActivePrimaryTile(tile, shouldRender = true) {
    if (!tile) return;
    state.tileShape = tile.shape;
    state.tri = tile;
    state.activePrimaryTileId = tile.id;
    syncActiveDesignRefs();
    recomputeGrid();
    clearSelection();
    state.hover = null;
    state.hoverTileControl = null;
    state.hoverArcPick = null;
    state.hoverDeleteInkIndex = -1;
    if (shouldRender) requestRender();
  }

  function setActiveShape(shape, shouldRender = true) {
    if (!isShape(shape)) return;
    const tile = state.primaryTiles.find((t) => t.shape === shape) || state.primaryTiles[0];
    if (!tile) return;
    setActivePrimaryTile(tile, shouldRender);
  }

  const screenToLocal = (p) => sub(p, state.tri.center);
  const localToScreen = (p) => add(p, state.tri.center);
  const localToScreenForTile = (tile, p) => add(p, tile.center);
  const screenToLocalForTile = (tile, p) => sub(p, tile.center);

  function getTileScale(tile = state.tri) {
    return tile?.side || 1;
  }

  function pointLocalToWorld(pLocal, tile = state.tri) {
    const s = getTileScale(tile);
    return v(pLocal.x / s, pLocal.y / s);
  }

  function pointWorldToLocal(pWorld, tile = state.tri) {
    const s = getTileScale(tile);
    return v(pWorld.x * s, pWorld.y * s);
  }

  function lengthLocalToWorld(lenLocal, tile = state.tri) {
    return lenLocal / getTileScale(tile);
  }

  function lengthWorldToLocal(lenWorld, tile = state.tri) {
    return lenWorld * getTileScale(tile);
  }

  function inkWorldToLocal(ink, tile = state.tri) {
    if (ink.type === "line") {
      return {
        type: "line",
        a: pointWorldToLocal(ink.a, tile),
        b: pointWorldToLocal(ink.b, tile),
      };
    }
    if (ink.type === "circle") {
      return {
        type: "circle",
        c: pointWorldToLocal(ink.c, tile),
        r: lengthWorldToLocal(ink.r, tile),
      };
    }
    if (ink.type === "arc") {
      return {
        type: "arc",
        c: pointWorldToLocal(ink.c, tile),
        r: lengthWorldToLocal(ink.r, tile),
        a0: ink.a0,
        a1: ink.a1,
      };
    }
    return JSON.parse(JSON.stringify(ink));
  }

  function inkLocalToWorld(ink, tile = state.tri) {
    if (ink.type === "line") {
      return {
        type: "line",
        a: pointLocalToWorld(ink.a, tile),
        b: pointLocalToWorld(ink.b, tile),
      };
    }
    if (ink.type === "circle") {
      return {
        type: "circle",
        c: pointLocalToWorld(ink.c, tile),
        r: lengthLocalToWorld(ink.r, tile),
      };
    }
    if (ink.type === "arc") {
      return {
        type: "arc",
        c: pointLocalToWorld(ink.c, tile),
        r: lengthLocalToWorld(ink.r, tile),
        a0: ink.a0,
        a1: ink.a1,
      };
    }
    return JSON.parse(JSON.stringify(ink));
  }

  function snapToTriGrid(local) {
    if (!state.snap) return local;
    if (state.grid.mode === "square") {
      const { step, origin } = state.grid;
      return v(
        origin.x + Math.round((local.x - origin.x) / step) * step,
        origin.y + Math.round((local.y - origin.y) / step) * step
      );
    }
    const { origin, b1, b2, det } = state.grid;
    const rx = local.x - origin.x;
    const ry = local.y - origin.y;
    const uCoord = (rx * b2.y - ry * b2.x) / det;
    const vCoord = (ry * b1.x - rx * b1.y) / det;
    const ur = Math.round(uCoord);
    const vr = Math.round(vCoord);
    return v(origin.x + b1.x * ur + b2.x * vr, origin.y + b1.y * ur + b2.y * vr);
  }

  function pointInPrimaryShape(local) {
    return pointInTile(local, state.tri);
  }

  function pointInTile(local, tile) {
    if (!tile) return false;
    if (tile.shape === "triangle") {
      const [a, b, c] = tile.polyLocal;
      return pointInTri(local, a, b, c);
    }
    return pointInPoly(local, tile.polyLocal);
  }

  function findPrimaryTileAtScreen(pScreen) {
    for (let i = state.primaryTiles.length - 1; i >= 0; i -= 1) {
      const tile = state.primaryTiles[i];
      const local = screenToLocalForTile(tile, pScreen);
      if (pointInTile(local, tile)) return tile;
    }
    return null;
  }

  function distanceToTileAtScreen(tile, pScreen) {
    if (!tile) return Infinity;
    const local = screenToLocalForTile(tile, pScreen);
    if (pointInTile(local, tile)) return 0;
    let best = Infinity;
    for (let i = 0; i < tile.polyLocal.length; i += 1) {
      const a = tile.polyLocal[i];
      const b = tile.polyLocal[(i + 1) % tile.polyLocal.length];
      best = Math.min(best, pointToSegmentDistance(local, a, b));
    }
    return best;
  }

  function findNearestPrimaryTileAtScreen(pScreen) {
    let bestTile = null;
    let bestDist = Infinity;
    for (const tile of state.primaryTiles) {
      const d = distanceToTileAtScreen(tile, pScreen);
      if (d < bestDist) {
        bestDist = d;
        bestTile = tile;
      }
    }
    return bestTile;
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

  const TILE_BOUNDARY_CODE = 1;
  const INK_CODE_OFFSET = 2;

  function fillBoundaryInkList(design, boundaryInkIds = null) {
    if (!Array.isArray(boundaryInkIds)) return design.ink;
    if (!boundaryInkIds.length) return [];
    const ids = new Set(boundaryInkIds);
    return design.ink.filter((ink) => ids.has(ink.id));
  }

  function drawLocalInkStroke(g, localInk, toPix, scale) {
    if (localInk.type === "line") {
      const a = toPix(localInk.a);
      const b = toPix(localInk.b);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      return;
    }
    if (localInk.type === "circle") {
      const c = toPix(localInk.c);
      g.beginPath();
      g.arc(c.x, c.y, localInk.r * scale, 0, TAU);
      g.stroke();
      return;
    }
    if (localInk.type === "arc") {
      const c = toPix(localInk.c);
      g.beginPath();
      g.arc(c.x, c.y, localInk.r * scale, localInk.a0, localInk.a1, false);
      g.stroke();
    }
  }

  function colorForCode(code) {
    const r = code & 255;
    const g = (code >>> 8) & 255;
    const b = (code >>> 16) & 255;
    return `rgb(${r}, ${g}, ${b})`;
  }

  function codeForInkId(inkId) {
    return INK_CODE_OFFSET + Math.max(0, inkId | 0);
  }

  function inkIdFromCode(code) {
    return code - INK_CODE_OFFSET;
  }

  function discoverFillBoundaryDefinition(seedWorld, tile = state.tri, design = { ink: state.ink, fills: state.fills }) {
    if (!tile || !design) return null;
    ensureDesignInkIds(design);
    const allIds = design.ink
      .map((ink) => ink.id)
      .filter((id) => isValidInkId(id));

    const full = computeFillMaskAtSeed(seedWorld, tile, design, allIds);
    if (!full) return null;

    const boundaryInkIds = [];
    for (const id of allIds) {
      const without = allIds.filter((candidate) => candidate !== id);
      const candidateData = computeFillMaskAtSeed(seedWorld, tile, design, without);
      if (!candidateData || candidateData.sig !== full.sig) {
        boundaryInkIds.push(id);
      }
    }

    const boundaryData = computeFillMaskAtSeed(seedWorld, tile, design, boundaryInkIds);
    if (!boundaryData) return null;
    return {
      boundaryInkIds,
      usesTileBoundary: !!boundaryData.usesTileBoundary,
      data: boundaryData,
    };
  }

  function includeInkBounds(bounds, localInk) {
    if (localInk.type === "line") {
      bounds.minX = Math.min(bounds.minX, localInk.a.x, localInk.b.x);
      bounds.minY = Math.min(bounds.minY, localInk.a.y, localInk.b.y);
      bounds.maxX = Math.max(bounds.maxX, localInk.a.x, localInk.b.x);
      bounds.maxY = Math.max(bounds.maxY, localInk.a.y, localInk.b.y);
      return;
    }
    if (localInk.type === "circle" || localInk.type === "arc") {
      bounds.minX = Math.min(bounds.minX, localInk.c.x - localInk.r);
      bounds.minY = Math.min(bounds.minY, localInk.c.y - localInk.r);
      bounds.maxX = Math.max(bounds.maxX, localInk.c.x + localInk.r);
      bounds.maxY = Math.max(bounds.maxY, localInk.c.y + localInk.r);
    }
  }

  function isSeedClosedByBoundaryInk(seedLocal, tile, boundaryInk) {
    if (!boundaryInk.length) return false;
    const bounds = {
      minX: seedLocal.x,
      minY: seedLocal.y,
      maxX: seedLocal.x,
      maxY: seedLocal.y,
    };
    const localInk = boundaryInk.map((ink) => inkWorldToLocal(ink, tile));
    for (const ink of localInk) includeInkBounds(bounds, ink);

    const margin = 18 * state.dpr;
    bounds.minX -= margin;
    bounds.minY -= margin;
    bounds.maxX += margin;
    bounds.maxY += margin;
    const wLocal = Math.max(1, bounds.maxX - bounds.minX);
    const hLocal = Math.max(1, bounds.maxY - bounds.minY);

    const target = 700;
    let s = Math.min(target / wLocal, target / hLocal);
    s = clamp(s, 1.0, 3.2);

    const w = Math.max(1, Math.ceil(wLocal * s));
    const h = Math.max(1, Math.ceil(hLocal * s));
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const g = off.getContext("2d");

    const toPix = (p) => v((p.x - bounds.minX) * s, (p.y - bounds.minY) * s);
    const seedPix = toPix(seedLocal);

    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#000";
    g.lineJoin = "round";
    g.lineCap = "round";
    g.lineWidth = 1.15;
    for (const ink of localInk) drawLocalInkStroke(g, ink, toPix, s);

    const img = g.getImageData(0, 0, w, h).data;
    const idx = (x, y) => (y * w + x) * 4;
    const isWall = (x, y) => {
      const i = idx(x, y);
      return img[i] < 170 || img[i + 1] < 170 || img[i + 2] < 170;
    };

    const sx = Math.floor(seedPix.x);
    const sy = Math.floor(seedPix.y);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return false;
    if (isWall(sx, sy)) return false;

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
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return false;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let k = 0; k < 4; k += 1) {
        const nx = x + n[k][0];
        const ny = y + n[k][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const vi = ny * w + nx;
        if (visited[vi]) continue;
        if (isWall(nx, ny)) continue;
        push(nx, ny);
      }
    }

    return true;
  }

  function computeFillMaskAtSeed(
    seedWorld,
    tile = state.tri,
    design = { ink: state.ink, fills: state.fills },
    boundaryInkIds = null
  ) {
    if (!tile) return null;
    const seedLocal = pointWorldToLocal(seedWorld, tile);
    if (!pointInTile(seedLocal, tile)) return null;

    const boundaryInk = fillBoundaryInkList(design, boundaryInkIds);
    const verts = tile.polyLocal;
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

    const offCodes = document.createElement("canvas");
    offCodes.width = w;
    offCodes.height = h;
    const cg = offCodes.getContext("2d");

    const toPix = (p) => v((p.x - minX) * s, (p.y - minY) * s);
    const seedPix = toPix(seedLocal);
    const strokeTilePoly = (targetCtx) => {
      targetCtx.beginPath();
      targetCtx.moveTo(toPix(verts[0]).x, toPix(verts[0]).y);
      for (let i = 1; i < verts.length; i += 1) {
        const pp = toPix(verts[i]);
        targetCtx.lineTo(pp.x, pp.y);
      }
      targetCtx.closePath();
      targetCtx.stroke();
    };

    g.clearRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#000";
    g.lineJoin = "round";
    g.lineCap = "round";
    g.lineWidth = 1.15;
    strokeTilePoly(g);

    cg.clearRect(0, 0, w, h);
    cg.fillStyle = "#000";
    cg.fillRect(0, 0, w, h);
    cg.lineJoin = "round";
    cg.lineCap = "round";
    cg.lineWidth = 1.15;
    cg.strokeStyle = colorForCode(TILE_BOUNDARY_CODE);
    strokeTilePoly(cg);

    for (const ink of boundaryInk) {
      const localInk = inkWorldToLocal(ink, tile);
      drawLocalInkStroke(g, localInk, toPix, s);
      if (!isValidInkId(ink.id)) continue;
      cg.strokeStyle = colorForCode(codeForInkId(ink.id));
      drawLocalInkStroke(cg, localInk, toPix, s);
    }

    const data = g.getImageData(0, 0, w, h).data;
    const codeData = cg.getImageData(0, 0, w, h).data;
    const idx = (x, y) => (y * w + x) * 4;

    const insideShape = (x, y) => {
      const lx = x / s + minX;
      const ly = y / s + minY;
      return pointInTile(v(lx, ly), tile);
    };

    const isWall = (x, y) => {
      const i = idx(x, y);
      return data[i] < 170 || data[i + 1] < 170 || data[i + 2] < 170;
    };

    const wallCode = (x, y) => {
      const i = idx(x, y);
      return codeData[i] + (codeData[i + 1] << 8) + (codeData[i + 2] << 16);
    };

    const sx = Math.floor(seedPix.x);
    const sy = Math.floor(seedPix.y);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
    if (!insideShape(sx, sy)) return null;
    if (isWall(sx, sy)) return null;

    const touchedInkIds = new Set();
    let usesTileBoundary = false;
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
        if (isWall(nx, ny)) {
          const code = wallCode(nx, ny);
          if (code === TILE_BOUNDARY_CODE) usesTileBoundary = true;
          if (code >= INK_CODE_OFFSET) touchedInkIds.add(inkIdFromCode(code));
          continue;
        }
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

    // Include touched tile-boundary wall pixels to avoid seams when tiling fills in the wallpaper background.
    if (usesTileBoundary) {
      let nextCur = cur;
      for (let it = 0; it < 4; it += 1) {
        const next = new Uint8Array(nextCur);
        for (let y = 1; y < h - 1; y += 1) {
          for (let x = 1; x < w - 1; x += 1) {
            const vi = y * w + x;
            if (next[vi]) continue;
            if (wallCode(x, y) !== TILE_BOUNDARY_CODE) continue;
            if (
              nextCur[vi - 1] ||
              nextCur[vi + 1] ||
              nextCur[vi - w] ||
              nextCur[vi + w] ||
              nextCur[vi - w - 1] ||
              nextCur[vi - w + 1] ||
              nextCur[vi + w - 1] ||
              nextCur[vi + w + 1]
            ) {
              next[vi] = 1;
            }
          }
        }
        nextCur = next;
      }
      cur = nextCur;
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

    const boundaryIds = [...touchedInkIds].sort((a, b) => a - b);
    const closedByInk = isSeedClosedByBoundaryInk(seedLocal, tile, boundaryInk);
    const sig = `${w}:${h}:${count}:${hash >>> 0}`;
    return {
      bmp: mask,
      minX,
      minY,
      wLocal,
      hLocal,
      sig,
      boundaryInkIds: boundaryIds,
      usesTileBoundary,
      closedByInk,
    };
  }

  function getFillRenderData(fill, tile = state.tri, design = { ink: state.ink, fills: state.fills }) {
    if (!tile) return null;
    let discoveredData = null;
    const designInkIdSet = new Set(design.ink.map((ink) => ink.id).filter((id) => isValidInkId(id)));
    const hasBoundaryIds = Array.isArray(fill.boundaryInkIds);
    const boundaryIdsValid = hasBoundaryIds && fill.boundaryInkIds.every((id) => designInkIdSet.has(id));

    if (!hasBoundaryIds || !boundaryIdsValid) {
      const discovered = discoverFillBoundaryDefinition(fill, tile, design);
      if (!discovered) return null;
      fill.boundaryInkIds = discovered.boundaryInkIds;
      fill.usesTileBoundary = !!discovered.usesTileBoundary;
      discoveredData = discovered.data;
    }

    const boundaryKey = fill.boundaryInkIds.join(",");
    const key = `${getFillCacheKey()}:${tile.shape}:${tile.side}:${boundaryKey}:${fill.usesTileBoundary ? 1 : 0}`;
    const cached = fillCache.get(fill);
    if (cached && cached.key === key) return cached.data;
    const data = discoveredData || computeFillMaskAtSeed(fill, tile, design, fill.boundaryInkIds);
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

  function renderBackgroundTiling(
    targetCtx = ctx,
    viewW = state.vw,
    viewH = state.vh,
    sourceTiles = state.primaryTiles,
    renderDpr = state.dpr,
    drawTileOutlines = true
  ) {
    if (!sourceTiles.length) return;
    const ctx = targetCtx;
    const vw = viewW;
    const vh = viewH;
    const dpr = renderDpr;
    const mode = getTilingOption(state.tilingId);
    const sourceTilesByShape = new Map();
    for (const tile of sourceTiles) {
      if (!sourceTilesByShape.has(tile.shape)) sourceTilesByShape.set(tile.shape, []);
      sourceTilesByShape.get(tile.shape).push(tile);
    }
    const singleShapeTilesetMode = mode.shapes.length === 1 && sourceTiles.length > 1;
    const rnd = mulberry32(BG_SEED >>> 0);

    function chooseRot(shape, base = 0) {
      const rots = ROTS_BY_SHAPE[shape] || [0];
      return base + rots[Math.floor(rnd() * rots.length)];
    }

    function pathPoly(points) {
      if (!points.length) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
    }

    function getUnitForShape(shape, fallback = 72 * dpr) {
      if (mode.shapes.length === 1) {
        const { side } = getSingleLayoutSizing(shape, 1, vw, vh, dpr);
        return side * BG_SCALE;
      }
      const tile = sourceTilesByShape.get(shape)?.[0];
      if (!tile) return fallback;
      return tile.side * BG_SCALE;
    }

    function chooseSourceTile(shape) {
      const tiles = sourceTilesByShape.get(shape);
      if (!tiles?.length) return null;
      if (!singleShapeTilesetMode) return tiles[0];
      return tiles[Math.floor(rnd() * tiles.length)];
    }

    function drawShapeTile(primary, center, side, geomAng = 0, designAng = geomAng) {
      const design = getDesignForTile(primary);
      if (!primary || !design) return;
      const shape = primary.shape;
      const points = shapePolyLocal(shape, side).map((p) => add(center, rot(p, geomAng)));
      const clipPad = 0.9 * dpr;
      const clipPoints = points.map((p) => {
        const dv = sub(p, center);
        const L = len(dv) || 1;
        return add(center, mul(dv, (L + clipPad) / L));
      });

      ctx.save();
      pathPoly(clipPoints);
      ctx.clip();

      const scale = side / primary.side;
      const prevSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      for (const fill of design.fills) {
        const f = getFillRenderData(fill, primary, design);
        if (!f) continue;
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(designAng);
        ctx.scale(scale, scale);
        ctx.drawImage(f.bmp, f.minX, f.minY, f.wLocal, f.hLocal);
        ctx.restore();
      }
      ctx.imageSmoothingEnabled = prevSmoothing;

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2 * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const o of design.ink) {
        const localInk = inkWorldToLocal(o, primary);
        if (localInk.type === "line") {
          const p0 = rot(localInk.a, designAng);
          const p1 = rot(localInk.b, designAng);
          ctx.beginPath();
          ctx.moveTo(center.x + p0.x * scale, center.y + p0.y * scale);
          ctx.lineTo(center.x + p1.x * scale, center.y + p1.y * scale);
          ctx.stroke();
        } else if (localInk.type === "circle") {
          const cc = rot(localInk.c, designAng);
          ctx.beginPath();
          ctx.arc(center.x + cc.x * scale, center.y + cc.y * scale, localInk.r * scale, 0, TAU);
          ctx.stroke();
        } else if (localInk.type === "arc") {
          const cc = rot(localInk.c, designAng);
          ctx.beginPath();
          ctx.arc(
            center.x + cc.x * scale,
            center.y + cc.y * scale,
            localInk.r * scale,
            localInk.a0 + designAng,
            localInk.a1 + designAng,
            false
          );
          ctx.stroke();
        }
      }

      ctx.restore();
      return points;
    }

    const outlineTiles = drawTileOutlines ? [] : null;

    function stamp(shape, center, side, geomAng = 0, designAng = null) {
      const primary = chooseSourceTile(shape);
      if (!primary) return;
      const finalDesignAng = designAng ?? chooseRot(shape, geomAng);
      const points = drawShapeTile(primary, center, side, geomAng, finalDesignAng);
      if (outlineTiles && points?.length) outlineTiles.push(points);
    }

    function lineIntersection(a0, a1, b0, b1) {
      const r = sub(a1, a0);
      const s = sub(b1, b0);
      const den = r.x * s.y - r.y * s.x;
      if (Math.abs(den) < 1e-9) return null;
      const qp = sub(b0, a0);
      const t = (qp.x * s.y - qp.y * s.x) / den;
      return add(a0, mul(r, t));
    }

    function drawSingleShapeBackground(shape) {
      const unit = getUnitForShape(shape);
      if (shape === "triangle") {
        const S = unit;
        const H = (S * Math.sqrt(3)) / 2;
        const x0 = -S;
        const y0 = -2 * H;
        const x1 = vw + S;
        const y1 = vh + 2 * H;

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
            stamp("triangle", v((up0.x + up1.x + up2.x) / 3, (up0.y + up1.y + up2.y) / 3), S, 0);
            stamp("triangle", v((dn0.x + dn1.x + dn2.x) / 3, (dn0.y + dn1.y + dn2.y) / 3), S, Math.PI);
          }
        }
        return;
      }
      if (shape === "square") {
        const S = unit;
        for (let y = -S; y <= vh + S; y += S) {
          for (let x = -S; x <= vw + S; x += S) {
            stamp("square", v(x + S / 2, y + S / 2), S, 0);
          }
        }
        return;
      }
      if (shape === "hexagon") {
        const s = unit;
        const w = Math.sqrt(3) * s;
        const rowH = 1.5 * s;
        const cols = Math.ceil(vw / w) + 8;
        const rows = Math.ceil(vh / rowH) + 8;
        const cx0 = vw * 0.5;
        const cy0 = vh * 0.5;
        for (let r = -rows; r <= rows; r += 1) {
          for (let q = -cols; q <= cols; q += 1) {
            const cx = cx0 + Math.sqrt(3) * s * (q + r / 2);
            const cy = cy0 + rowH * r;
            if (cx < -w || cx > vw + w || cy < -2 * s || cy > vh + 2 * s) continue;
            stamp("hexagon", v(cx, cy), s, 0);
          }
        }
        return;
      }
      const s = unit;
      const step = s * 2.2;
      for (let y = -step; y <= vh + step; y += step) {
        for (let x = -step; x <= vw + step; x += step) {
          stamp("octagon", v(x, y), s, 0);
        }
      }
    }

    function drawMixed3464() {
      const a = Math.max(8 * dpr, Math.min(getUnitForShape("hexagon"), getUnitForShape("triangle"), getUnitForShape("square")));
      const D = a * (Math.sqrt(3) + 1);
      const rowH = D * Math.sqrt(3) / 2;
      const pad = D * 2.6;
      const origin = v(vw * 0.5, vh * 0.5);
      const spanI = Math.ceil((vw + 2 * pad) / D) + 6;
      const spanJ = Math.ceil((vh + 2 * pad) / rowH) + 6;

      const lattice = (i, j) => v(origin.x + i * D + j * D * 0.5, origin.y + j * rowH);
      const onScreen = (p, margin = pad) =>
        p.x >= -margin && p.x <= vw + margin && p.y >= -margin && p.y <= vh + margin;

      function inwardSquareEdgeLine(p0, p1, faceCenter) {
        const c = mul(add(p0, p1), 0.5);
        const edgeDir = sub(p1, p0);
        const L = len(edgeDir) || 1;
        const n = mul(edgeDir, 1 / L);
        const t = v(-n.y, n.x);
        const sideSign = dot(sub(faceCenter, c), t) >= 0 ? 1 : -1;
        const o = add(c, mul(t, sideSign * a * 0.5));
        return [add(o, mul(n, a * 0.5)), add(o, mul(n, -a * 0.5))];
      }

      function stampFaceTriangle(A, B, C) {
        const center = mul(add(add(A, B), C), 1 / 3);
        if (!onScreen(center)) return;
        const [ab0, ab1] = inwardSquareEdgeLine(A, B, center);
        const [bc0, bc1] = inwardSquareEdgeLine(B, C, center);
        const [ca0, ca1] = inwardSquareEdgeLine(C, A, center);
        const v0 = lineIntersection(ab0, ab1, bc0, bc1);
        const v1 = lineIntersection(bc0, bc1, ca0, ca1);
        const v2 = lineIntersection(ca0, ca1, ab0, ab1);
        if (!v0 || !v1 || !v2) return;
        const triCenter = mul(add(add(v0, v1), v2), 1 / 3);
        const geomAng = Math.atan2(v0.y - triCenter.y, v0.x - triCenter.x) + Math.PI / 2;
        stamp("triangle", triCenter, a, geomAng);
      }

      const edgeDirs = [[1, 0], [0, 1], [-1, 1]];

      for (let j = -spanJ; j <= spanJ; j += 1) {
        for (let i = -spanI; i <= spanI; i += 1) {
          const A = lattice(i, j);
          if (onScreen(A, pad * 0.7)) {
            stamp("hexagon", A, a, 0);
          }

          for (const [di, dj] of edgeDirs) {
            const B = lattice(i + di, j + dj);
            const sqCenter = mul(add(A, B), 0.5);
            if (!onScreen(sqCenter)) continue;
            const geomAng = Math.atan2(B.y - A.y, B.x - A.x);
            stamp("square", sqCenter, a, geomAng);
          }

          const B = lattice(i + 1, j);
          const C = lattice(i, j + 1);
          const Dn = lattice(i + 1, j - 1);
          stampFaceTriangle(A, B, C);
          stampFaceTriangle(A, B, Dn);
        }
      }
    }

    function drawMixed48_2() {
      const sin8 = Math.sin(Math.PI / 8);
      const cos8 = Math.cos(Math.PI / 8);
      const octR = getUnitForShape("octagon");
      const edge = 2 * octR * sin8;
      // For the centered 45-degree squares in 4.8^2, adjacent octagon centers are 2R*cos(pi/8) apart.
      const pitch = 2 * octR * cos8;
      const x0 = -pitch;
      const y0 = -pitch;
      const x1 = vw + pitch;
      const y1 = vh + pitch;
      const octDesignRots = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      const sqGeomAng = Math.PI / 4;

      for (let y = y0; y <= y1; y += pitch) {
        for (let x = x0; x <= x1; x += pitch) {
          const octDesignAng = octDesignRots[Math.floor(rnd() * octDesignRots.length)];
          stamp("octagon", v(x, y), octR, 0, octDesignAng);
          stamp("square", v(x + pitch / 2, y + pitch / 2), edge, sqGeomAng);
        }
      }
    }

    function drawMixed33_434() {
      const a = Math.max(8 * dpr, Math.min(getUnitForShape("square"), getUnitForShape("triangle")));
      const cacheKey = `${vw}:${vh}:${dpr}:${a.toFixed(3)}`;

      function snapFloat(x) {
        const s = Math.round(x * 1e6) / 1e6;
        return Math.abs(s) < 1e-9 ? 0 : s;
      }

      function pointKeyXY(x, y) {
        return `${snapFloat(x).toFixed(6)},${snapFloat(y).toFixed(6)}`;
      }

      function normAngleDeg(degAng) {
        let aDeg = degAng % 360;
        if (aDeg < 0) aDeg += 360;
        return (Math.round(aDeg / 30) * 30) % 360;
      }

      function edgeKeyByIds(aId, bId) {
        return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
      }

      function polyAreaFromIds(faceIds, vertices) {
        let s = 0;
        for (let i = 0; i < faceIds.length; i += 1) {
          const p0 = vertices[faceIds[i]];
          const p1 = vertices[faceIds[(i + 1) % faceIds.length]];
          s += p0.x * p1.y - p0.y * p1.x;
        }
        return s * 0.5;
      }

      function buildMixed33434Tiles() {
        const rootCenter = v(vw * 0.5, vh * 0.5);
        const radius = Math.hypot(vw, vh) * 0.5 / a + 3.5;
        const dirsByType = {
          A: [0, 60, 120, 210, 270],
          B: [0, 90, 150, 240, 300],
        };
        const slotMap = [7, 9, 3, 2, 8, 6, 5, 0, 4, 1];
        const vertices = [];
        const vertexMap = new Map();
        const queue = [];

        function addVertex(x, y, type, phi) {
          const xx = snapFloat(x);
          const yy = snapFloat(y);
          const pp = normAngleDeg(phi);
          const k = pointKeyXY(xx, yy);
          const existing = vertexMap.get(k);
          if (existing !== undefined) {
            const cur = vertices[existing];
            if (cur.type === type && cur.phi === pp) return existing;
            return null;
          }
          const id = vertices.length;
          vertices.push({
            id,
            x: xx,
            y: yy,
            type,
            phi: pp,
            nbr: [-1, -1, -1, -1, -1],
          });
          vertexMap.set(k, id);
          queue.push(id);
          return id;
        }

        addVertex(0, 0, "A", 0);

        for (let qi = 0; qi < queue.length; qi += 1) {
          const vid = queue[qi];
          const vv = vertices[vid];
          for (let i = 0; i < 5; i += 1) {
            const slotId = (vv.type === "A" ? 0 : 5) + i;
            const mapped = slotMap[slotId];
            const nextType = mapped < 5 ? "A" : "B";
            const nextSlot = mapped % 5;
            const edgeDeg = vv.phi + dirsByType[vv.type][i];
            const nx = vv.x + Math.cos((edgeDeg * Math.PI) / 180);
            const ny = vv.y + Math.sin((edgeDeg * Math.PI) / 180);
            if (Math.hypot(nx, ny) > radius) continue;
            const nextPhi = normAngleDeg(edgeDeg + 180 - dirsByType[nextType][nextSlot]);
            const nid = addVertex(nx, ny, nextType, nextPhi);
            if (nid === null) continue;
            vv.nbr[i] = nid;
            if (vertices[nid].nbr[nextSlot] === -1) {
              vertices[nid].nbr[nextSlot] = vid;
            }
          }
        }

        for (const vv of vertices) {
          for (let i = 0; i < 5; i += 1) {
            if (vv.nbr[i] !== -1) continue;
            const slotId = (vv.type === "A" ? 0 : 5) + i;
            const mapped = slotMap[slotId];
            const nextType = mapped < 5 ? "A" : "B";
            const nextSlot = mapped % 5;
            const edgeDeg = vv.phi + dirsByType[vv.type][i];
            const nx = vv.x + Math.cos((edgeDeg * Math.PI) / 180);
            const ny = vv.y + Math.sin((edgeDeg * Math.PI) / 180);
            const nid = vertexMap.get(pointKeyXY(nx, ny));
            if (nid === undefined) continue;
            const nv = vertices[nid];
            if (nv.type !== nextType) continue;
            vv.nbr[i] = nid;
            if (nv.nbr[nextSlot] === -1) nv.nbr[nextSlot] = vv.id;
          }
        }

        const edges = [];
        const edgeSet = new Set();
        for (const vv of vertices) {
          for (const nid of vv.nbr) {
            if (nid < 0) continue;
            const k = edgeKeyByIds(vv.id, nid);
            if (edgeSet.has(k)) continue;
            edgeSet.add(k);
            edges.push([Math.min(vv.id, nid), Math.max(vv.id, nid)]);
          }
        }

        const neighborOrder = vertices.map((vv) => vv.nbr
          .filter((nid) => nid >= 0)
          .map((nid) => ({
            nid,
            ang: Math.atan2(vertices[nid].y - vv.y, vertices[nid].x - vv.x),
          }))
          .sort((a0, b0) => a0.ang - b0.ang)
          .map((o) => o.nid));

        const usedHalfEdges = new Set();
        const faces = [];

        function halfKey(aId, bId) {
          return `${aId}>${bId}`;
        }

        for (const [aId, bId] of edges) {
          for (const [u0, v0] of [[aId, bId], [bId, aId]]) {
            const startKey = halfKey(u0, v0);
            if (usedHalfEdges.has(startKey)) continue;
            const face = [];
            let u = u0;
            let v0cur = v0;
            let closed = false;
            for (let step = 0; step < 96; step += 1) {
              usedHalfEdges.add(halfKey(u, v0cur));
              face.push(u);
              const nbrs = neighborOrder[v0cur];
              const idx = nbrs.indexOf(u);
              if (idx < 0) break;
              const w = nbrs[(idx - 1 + nbrs.length) % nbrs.length];
              u = v0cur;
              v0cur = w;
              if (u === u0 && v0cur === v0) {
                closed = true;
                break;
              }
            }
            if (closed) faces.push(face);
          }
        }

        const tiles = [];
        for (const face of faces) {
          if (face.length !== 3 && face.length !== 4) continue;
          const area = polyAreaFromIds(face, vertices);
          if (area <= 1e-7) continue;
          const center = face.reduce((acc, id) => add(acc, v(vertices[id].x, vertices[id].y)), v(0, 0));
          center.x /= face.length;
          center.y /= face.length;

          const p0 = vertices[face[0]];
          const p1 = vertices[face[1]];
          const edgeAng = Math.atan2(p1.y - p0.y, p1.x - p0.x);

          if (face.length === 3) {
            tiles.push({
              shape: "triangle",
              center: v(rootCenter.x + center.x * a, rootCenter.y + center.y * a),
              geomAng: edgeAng - Math.PI / 3,
            });
          } else {
            tiles.push({
              shape: "square",
              center: v(rootCenter.x + center.x * a, rootCenter.y + center.y * a),
              geomAng: edgeAng,
            });
          }
        }

        return tiles;
      }

      if (!mixed33434Cache || mixed33434Cache.key !== cacheKey) {
        mixed33434Cache = {
          key: cacheKey,
          tiles: buildMixed33434Tiles(),
        };
      }

      for (const tile of mixed33434Cache.tiles) {
        stamp(tile.shape, tile.center, a, tile.geomAng);
      }
    }

    if (mode.shapes.length === 1) {
      drawSingleShapeBackground(mode.shapes[0]);
    } else if (state.tilingId === "tiling-3464") {
      drawMixed3464();
    } else if (state.tilingId === "tiling-48-2") {
      drawMixed48_2();
    } else if (state.tilingId === "tiling-33-434") {
      drawMixed33_434();
    } else {
      drawSingleShapeBackground(mode.shapes[0] || "triangle");
    }

    if (outlineTiles && outlineTiles.length) {
      ctx.save();
      ctx.strokeStyle = "#bdbdbd";
      ctx.lineWidth = 1 * dpr;
      ctx.globalAlpha = 0.82;
      for (const points of outlineTiles) {
        pathPoly(points);
        ctx.stroke();
      }
      ctx.restore();
    }

  }

  function pathPrimaryTile(tile) {
    if (!tile || !tile.poly?.length) return;
    ctx.beginPath();
    ctx.moveTo(tile.poly[0].x, tile.poly[0].y);
    for (let i = 1; i < tile.poly.length; i += 1) {
      ctx.lineTo(tile.poly[i].x, tile.poly[i].y);
    }
    ctx.closePath();
  }

  function clipPrimaryTile(tile) {
    pathPrimaryTile(tile);
    ctx.clip();
  }

  function strokePrimaryTile(tile, isActive = false) {
    if (!tile) return;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#d0d0d0";
    ctx.lineWidth = 1.25 * state.dpr;
    ctx.globalAlpha = isActive ? 0.96 : 0.86;
    pathPrimaryTile(tile);
    ctx.stroke();

    ctx.restore();
  }

  function fillPrimaryTileWhite(tile) {
    if (!tile) return;
    ctx.save();
    ctx.fillStyle = "#fff";
    pathPrimaryTile(tile);
    ctx.fill();
    ctx.restore();
  }

  function drawPrimaryTileShadow(tile, isActive = false) {
    if (!tile) return;
    ctx.save();
    ctx.shadowColor = isActive ? "rgba(0, 0, 0, 0.22)" : "rgba(0, 0, 0, 0.17)";
    ctx.shadowBlur = (isActive ? 12 : 10) * state.dpr;
    ctx.shadowOffsetY = 3 * state.dpr;
    ctx.fillStyle = "#fff";
    pathPrimaryTile(tile);
    ctx.fill();
    ctx.restore();
  }

  function drawInnerTriGrid(tile, isActive = false) {
    if (!state.showGrid) return;
    if (!tile) return;
    const grid = isActive ? state.grid : computeGridForShape(tile.shape, tile.side);
    const { step, mode } = grid;

    ctx.save();
    clipPrimaryTile(tile);
    ctx.strokeStyle = "#d0d0d0";
    ctx.globalAlpha = isActive ? 0.55 : 0.35;
    ctx.lineWidth = 1 * state.dpr;

    function drawLocalLine(p, dir) {
      const L = tile.side * 2;
      const p0 = localToScreenForTile(tile, add(p, mul(dir, -L)));
      const p1 = localToScreenForTile(tile, add(p, mul(dir, L)));
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    const { minX, minY, maxX, maxY } = tile.bounds;
    if (mode === "square") {
      const { origin } = grid;
      for (let x = origin.x + Math.floor((minX - origin.x) / step) * step; x <= maxX + 1e-6; x += step) {
        drawLocalLine(v(x, 0), v(0, 1));
      }
      for (let y = origin.y + Math.floor((minY - origin.y) / step) * step; y <= maxY + 1e-6; y += step) {
        drawLocalLine(v(0, y), v(1, 0));
      }
    } else {
      const { origin, b1, b2, det } = grid;
      const b1Len = len(b1) || 1;
      const b2Len = len(b2) || 1;
      const w = sub(b2, b1);
      const wLen = len(w) || 1;
      const dirU = mul(b2, 1 / b2Len);
      const dirV = mul(b1, 1 / b1Len);
      const dirW = mul(w, 1 / wLen);

      function toUV(p) {
        const rx = p.x - origin.x;
        const ry = p.y - origin.y;
        const u = (rx * b2.y - ry * b2.x) / det;
        const vv = (ry * b1.x - rx * b1.y) / det;
        return { u, v: vv };
      }

      let minU = Infinity;
      let maxU = -Infinity;
      let minV = Infinity;
      let maxV = -Infinity;
      let minK = Infinity;
      let maxK = -Infinity;
      for (const p of tile.polyLocal) {
        const uv = toUV(p);
        minU = Math.min(minU, uv.u);
        maxU = Math.max(maxU, uv.u);
        minV = Math.min(minV, uv.v);
        maxV = Math.max(maxV, uv.v);
        minK = Math.min(minK, uv.u + uv.v);
        maxK = Math.max(maxK, uv.u + uv.v);
      }

      const pad = 2;
      for (let u = Math.floor(minU) - pad; u <= Math.ceil(maxU) + pad; u += 1) {
        drawLocalLine(add(origin, mul(b1, u)), dirU);
      }
      for (let vv = Math.floor(minV) - pad; vv <= Math.ceil(maxV) + pad; vv += 1) {
        drawLocalLine(add(origin, mul(b2, vv)), dirV);
      }
      for (let k = Math.floor(minK) - pad; k <= Math.ceil(maxK) + pad; k += 1) {
        drawLocalLine(add(origin, mul(b1, k)), dirW);
      }
    }

    ctx.restore();
  }

  function drawGridCenterMarker(tile, isActive = false) {
    if (!state.showGrid) return;
    if (!tile) return;
    const p = tile.center;
    const r = (isActive ? 2.8 : 2.2) * state.dpr;
    ctx.save();
    ctx.fillStyle = "#111";
    ctx.globalAlpha = isActive ? 0.95 : 0.7;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function pointInRectScreen(p, rect) {
    return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
  }

  function pathRoundedRect(x, y, w, h, radius) {
    const r = clamp(radius, 0, Math.min(w, h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function buildTileSetControlGeom(center) {
    const buttonSize = TILESET_CONTROL_BUTTON_SIZE_PX * state.dpr;
    const panelPad = TILESET_CONTROL_PANEL_PADDING_PX * state.dpr;
    const panelSize = buttonSize + panelPad * 2;
    return {
      center,
      panelRect: {
        x: center.x - panelSize / 2,
        y: center.y - panelSize / 2,
        w: panelSize,
        h: panelSize,
      },
      buttonRect: {
        x: center.x - buttonSize / 2,
        y: center.y - buttonSize / 2,
        w: buttonSize,
        h: buttonSize,
      },
    };
  }

  function buildSingleTileSetControls() {
    if (!isSingleShapeLayout()) return null;
    if (!state.primaryTiles.length) return null;
    const controls = { add: null, remove: [] };
    const gap = TILESET_CONTROL_GAP_PX * state.dpr;
    const panelSize = (TILESET_CONTROL_BUTTON_SIZE_PX + TILESET_CONTROL_PANEL_PADDING_PX * 2) * state.dpr;
    const lastTile = state.primaryTiles[state.primaryTiles.length - 1];
    const addCenter = v(lastTile.center.x + lastTile.bounds.maxX + gap + panelSize / 2, lastTile.center.y);
    controls.add = {
      type: "add",
      ...buildTileSetControlGeom(addCenter),
    };
    if (state.primaryTiles.length > 1) {
      for (const tile of state.primaryTiles) {
        const removeCenter = v(tile.center.x, tile.center.y + tile.bounds.minY - gap - panelSize / 2);
        controls.remove.push({
          type: "remove",
          tileId: tile.id,
          ...buildTileSetControlGeom(removeCenter),
        });
      }
    }
    return controls;
  }

  function findSingleTileControlHit(pScreen) {
    const controls = buildSingleTileSetControls();
    if (!controls) return null;
    if (controls.add && pointInRectScreen(pScreen, controls.add.panelRect)) {
      return controls.add;
    }
    for (const btn of controls.remove) {
      if (pointInRectScreen(pScreen, btn.panelRect)) return btn;
    }
    return null;
  }

  function drawTileSetControlButton(btn, symbol, hovered = false) {
    const lineW = Math.max(1, 1.85 * state.dpr);
    const panelRadius = TILESET_CONTROL_PANEL_RADIUS_PX * state.dpr;
    const buttonRadius = TILESET_CONTROL_BUTTON_RADIUS_PX * state.dpr;
    const panel = btn.panelRect;
    const button = btn.buttonRect;
    ctx.save();
    pathRoundedRect(panel.x, panel.y, panel.w, panel.h, panelRadius);
    ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
    ctx.shadowBlur = 22 * state.dpr;
    ctx.shadowOffsetY = 9 * state.dpr;
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = "#d7d7d7";
    ctx.lineWidth = 1 * state.dpr;
    ctx.stroke();

    pathRoundedRect(button.x, button.y, button.w, button.h, buttonRadius);
    ctx.fillStyle = hovered ? "#f3f3f3" : "#fff";
    ctx.fill();
    ctx.strokeStyle = "#cbcbcb";
    ctx.lineWidth = 1 * state.dpr;
    ctx.stroke();

    const cx = btn.center.x;
    const cy = btn.center.y;
    const arm = button.w * 0.26;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = lineW;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy);
    ctx.lineTo(cx + arm, cy);
    if (symbol === "+") {
      ctx.moveTo(cx, cy - arm);
      ctx.lineTo(cx, cy + arm);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSingleTileSetControls() {
    const controls = buildSingleTileSetControls();
    if (!controls) return;
    for (const btn of controls.remove) {
      const hovered = state.hoverTileControl?.type === "remove" && state.hoverTileControl.tileId === btn.tileId;
      drawTileSetControlButton(btn, "-", hovered);
    }
    if (controls.add) {
      const hovered = state.hoverTileControl?.type === "add";
      drawTileSetControlButton(controls.add, "+", hovered);
    }
  }

  function addSingleLayoutPrimaryTile() {
    if (!isSingleShapeLayout()) return false;
    pushUndo();
    const nextVariant = {
      id: state.nextPrimaryTileId++,
      design: createEmptyDesign(),
    };
    state.singleTileVariants.push(nextVariant);
    state.activePrimaryTileId = nextVariant.id;
    recomputeBigTriangle();
    const activeTile = state.primaryTiles.find((tile) => tile.id === nextVariant.id) || state.primaryTiles[state.primaryTiles.length - 1];
    if (activeTile) setActivePrimaryTile(activeTile, false);
    updateHoverPick();
    requestRender();
    return true;
  }

  function removeSingleLayoutPrimaryTile(tileId) {
    if (!isSingleShapeLayout()) return false;
    const idx = state.singleTileVariants.findIndex((variant) => variant.id === tileId);
    if (idx < 0) return false;
    if (state.singleTileVariants.length <= 1) return false;
    pushUndo();
    const prevActiveId = state.activePrimaryTileId;
    state.singleTileVariants.splice(idx, 1);
    const activeStillExists = state.singleTileVariants.some((variant) => variant.id === prevActiveId);
    const nextIdx = clamp(idx, 0, state.singleTileVariants.length - 1);
    const fallbackId = activeStillExists
      ? prevActiveId
      : state.singleTileVariants[nextIdx]?.id ?? state.singleTileVariants[state.singleTileVariants.length - 1]?.id ?? null;
    state.activePrimaryTileId = fallbackId;
    recomputeBigTriangle();
    const activeTile = state.primaryTiles.find((tile) => tile.id === fallbackId) || state.primaryTiles[state.primaryTiles.length - 1];
    if (activeTile) setActivePrimaryTile(activeTile, false);
    updateHoverPick();
    requestRender();
    return true;
  }

  function drawNearestGridPoint() {
    if (!state.hover) return;
    if (state.tool === "fill" || state.tool === "delete" || state.tool === "select") return;
    if (!state.snap) return;
    if (state.toolSnap && state.hover.toolSnapLocal && (state.tool === "line" || state.tool === "circle")) return;

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

  function drawNearestToolSnapPoint() {
    if (!state.hover) return;
    if (!state.toolSnap) return;
    if (state.tool === "fill" || state.tool === "delete") return;
    const p = state.hover.toolSnapLocal;
    if (!p) return;
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

  function drawFillsBig(tile, design) {
    if (!tile || !design) return;
    ctx.save();
    clipPrimaryTile(tile);
    for (const fill of design.fills) {
      const f = getFillRenderData(fill, tile, design);
      if (!f) continue;
      ctx.save();
      ctx.translate(tile.center.x, tile.center.y);
      ctx.drawImage(f.bmp, f.minX, f.minY, f.wLocal, f.hLocal);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawInkBig(tile, design, widthPx) {
    if (!tile || !design) return;
    ctx.save();
    clipPrimaryTile(tile);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = widthPx * state.dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const o of design.ink) {
      const localInk = inkWorldToLocal(o, tile);
      if (localInk.type === "line") {
        const a = localToScreenForTile(tile, localInk.a);
        const b = localToScreenForTile(tile, localInk.b);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (localInk.type === "circle") {
        const c = localToScreenForTile(tile, localInk.c);
        ctx.beginPath();
        ctx.arc(c.x, c.y, localInk.r, 0, TAU);
        ctx.stroke();
      } else if (localInk.type === "arc") {
        const c = localToScreenForTile(tile, localInk.c);
        ctx.beginPath();
        ctx.arc(c.x, c.y, localInk.r, localInk.a0, localInk.a1, false);
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

  function isSelectableInkType(type) {
    return type === "line" || type === "circle";
  }

  function clearSelection() {
    state.selectedInkIndex = -1;
    state.selectionDrag = null;
  }

  function getSelectableInkLocalAtIndex(index) {
    if (index < 0 || index >= state.ink.length) return null;
    const localInk = inkWorldToLocal(state.ink[index]);
    if (!isSelectableInkType(localInk.type)) return null;
    return localInk;
  }

  function getSelectedInkLocal() {
    return getSelectableInkLocalAtIndex(state.selectedInkIndex);
  }

  function cloneSelectableInkLocal(ink) {
    if (!ink) return null;
    if (ink.type === "line") {
      return {
        type: "line",
        a: { x: ink.a.x, y: ink.a.y },
        b: { x: ink.b.x, y: ink.b.y },
      };
    }
    if (ink.type === "circle") {
      return {
        type: "circle",
        c: { x: ink.c.x, y: ink.c.y },
        r: ink.r,
      };
    }
    return null;
  }

  function normalizeOr(vec, fallback = v(1, 0)) {
    const l = len(vec);
    if (l < 1e-6) return { x: fallback.x, y: fallback.y };
    return v(vec.x / l, vec.y / l);
  }

  function circleRadiusHandlePoint(circle, dir = v(1, 0)) {
    return add(circle.c, mul(dir, circle.r));
  }

  function defaultCircleRadiusDir(circle) {
    if (!circle) return v(1, 0);
    return normalizeOr(mul(circle.c, -1), v(1, 0));
  }

  function dedupeHandlePoints(points, eps = 1e-4) {
    const out = [];
    for (const p of points) {
      if (out.some((q) => len(sub(p, q)) <= eps)) continue;
      out.push({ x: p.x, y: p.y });
    }
    return out;
  }

  function clipLineSelectionHandles(line, tile = state.tri) {
    if (!tile?.polyLocal?.length) return { a: line.a, b: line.b };
    const insideA = pointInTile(line.a, tile);
    const insideB = pointInTile(line.b, tile);
    if (insideA && insideB) return { a: line.a, b: line.b };

    const hits = [];
    for (let i = 0; i < tile.polyLocal.length; i += 1) {
      const e0 = tile.polyLocal[i];
      const e1 = tile.polyLocal[(i + 1) % tile.polyLocal.length];
      const pts = lineSegmentIntersection(line.a, line.b, e0, e1);
      for (const p of pts) hits.push(p);
    }
    const uniqHits = dedupeHandlePoints(hits);
    if (!uniqHits.length) return { a: line.a, b: line.b };

    const sorted = uniqHits
      .map((p) => ({ p, t: lineParamAt(line.a, line.b, p) }))
      .sort((u, w) => u.t - w.t);

    if (!insideA && !insideB) {
      if (sorted.length >= 2) {
        return { a: sorted[0].p, b: sorted[sorted.length - 1].p };
      }
      return { a: sorted[0].p, b: sorted[0].p };
    }

    function nearestTo(point) {
      let best = sorted[0].p;
      let bestDist = len(sub(best, point));
      for (let i = 1; i < sorted.length; i += 1) {
        const cand = sorted[i].p;
        const d = len(sub(cand, point));
        if (d < bestDist) {
          best = cand;
          bestDist = d;
        }
      }
      return best;
    }

    return {
      a: insideA ? line.a : nearestTo(line.a),
      b: insideB ? line.b : nearestTo(line.b),
    };
  }

  function getControlPointsForInk(ink, circleRadiusDir = null, tile = state.tri) {
    if (!ink) return [];
    if (ink.type === "line") {
      const handles = clipLineSelectionHandles(ink, tile);
      return [
        { kind: "line-a", point: handles.a },
        { kind: "line-b", point: handles.b },
      ];
    }
    if (ink.type === "circle") {
      const radiusDir = circleRadiusDir || defaultCircleRadiusDir(ink);
      return [
        { kind: "circle-center", point: ink.c },
        { kind: "circle-radius", point: circleRadiusHandlePoint(ink, radiusDir) },
      ];
    }
    return [];
  }

  function findSelectionControlHit(pLocal) {
    const selected = getSelectedInkLocal();
    if (!selected) return null;
    const thresh = 12 * state.dpr;
    let best = null;
    for (const cp of getControlPointsForInk(selected, null, state.tri)) {
      const d = len(sub(pLocal, cp.point));
      if (d > thresh) continue;
      if (!best || d < best.dist) best = { kind: cp.kind, dist: d };
    }
    return best?.kind || null;
  }

  function findSelectableInkHit(pLocal) {
    const thresh = 10 * state.dpr;
    let best = null;
    for (let i = state.ink.length - 1; i >= 0; i -= 1) {
      const ink = getSelectableInkLocalAtIndex(i);
      if (!ink) continue;
      let dist = Infinity;
      if (ink.type === "line") dist = pointToSegmentDistance(pLocal, ink.a, ink.b);
      if (ink.type === "circle") dist = Math.abs(len(sub(pLocal, ink.c)) - ink.r);
      if (dist > thresh) continue;
      if (!best || dist < best.dist) best = { index: i, inkLocal: ink, dist };
    }
    return best;
  }

  function selectableInkDelta(a, b) {
    if (!a || !b || a.type !== b.type) return Infinity;
    if (a.type === "line") {
      return Math.max(len(sub(a.a, b.a)), len(sub(a.b, b.b)));
    }
    if (a.type === "circle") {
      return Math.max(len(sub(a.c, b.c)), Math.abs(a.r - b.r));
    }
    return Infinity;
  }

  function collectSnapTargets(excludeInkIndex = -1) {
    const points = [];
    for (let i = 0; i < state.ink.length; i += 1) {
      if (i === excludeInkIndex) continue;
      const ink = getSelectableInkLocalAtIndex(i);
      if (!ink) continue;
      for (const cp of getControlPointsForInk(ink, null, state.tri)) {
        points.push(cp.point);
      }
    }
    return points;
  }

  function findNearestSnapTarget(point, targets, maxDist) {
    let best = null;
    for (const target of targets) {
      const d = len(sub(point, target));
      if (d > maxDist) continue;
      if (!best || d < best.dist) best = { point: target, dist: d };
    }
    return best;
  }

  function findHoverToolSnapPoint(pLocal) {
    if (!state.toolSnap) return null;
    if (state.tool === "fill" || state.tool === "delete") return null;
    const excludeInkIndex = state.selectionDrag ? state.selectionDrag.index : -1;
    const targets = collectSnapTargets(excludeInkIndex);
    if (!targets.length) return null;
    const hit = findNearestSnapTarget(pLocal, targets, 12 * state.dpr);
    if (!hit) return null;
    return { x: hit.point.x, y: hit.point.y };
  }

  function translateSelectableInkLocal(ink, delta) {
    if (!ink) return;
    if (ink.type === "line") {
      ink.a = add(ink.a, delta);
      ink.b = add(ink.b, delta);
      return;
    }
    if (ink.type === "circle") {
      ink.c = add(ink.c, delta);
    }
  }

  function snapSelectionPreviewToControlPoints(drag, preview) {
    if (!state.toolSnap || !preview) return preview;
    const targets = collectSnapTargets(drag.index);
    if (!targets.length) return preview;
    const snapDist = 12 * state.dpr;

    if (drag.handle === "move") {
      const cps = getControlPointsForInk(preview, null, state.tri);
      let best = null;
      for (const cp of cps) {
        const hit = findNearestSnapTarget(cp.point, targets, snapDist);
        if (!hit) continue;
        if (!best || hit.dist < best.dist) best = { from: cp.point, to: hit.point, dist: hit.dist };
      }
      if (!best) return preview;
      const snapped = cloneSelectableInkLocal(preview);
      if (!snapped) return preview;
      const delta = sub(best.to, best.from);
      translateSelectableInkLocal(snapped, delta);
      return snapped;
    }

    if (preview.type === "line" && (drag.handle === "line-a" || drag.handle === "line-b")) {
      const key = drag.handle === "line-a" ? "a" : "b";
      const hit = findNearestSnapTarget(preview[key], targets, snapDist);
      if (!hit) return preview;
      const snapped = cloneSelectableInkLocal(preview);
      if (!snapped) return preview;
      snapped[key] = { x: hit.point.x, y: hit.point.y };
      return snapped;
    }

    if (preview.type === "circle") {
      if (drag.handle === "circle-center") {
        const hit = findNearestSnapTarget(preview.c, targets, snapDist);
        if (!hit) return preview;
        const snapped = cloneSelectableInkLocal(preview);
        if (!snapped) return preview;
        snapped.c = { x: hit.point.x, y: hit.point.y };
        return snapped;
      }
      if (drag.handle === "circle-radius") {
        const baseDir = drag.previewRadiusDir || drag.radiusDir || v(1, 0);
        let snapPoint = null;
        const hoverPoint = state.hover?.toolSnapLocal;
        if (hoverPoint) {
          snapPoint = hoverPoint;
        } else {
          const rp = circleRadiusHandlePoint(preview, baseDir);
          const hit = findNearestSnapTarget(rp, targets, snapDist);
          if (hit) snapPoint = hit.point;
        }
        if (!snapPoint) return preview;
        const snapped = cloneSelectableInkLocal(preview);
        if (!snapped) return preview;
        const radiusVec = sub(snapPoint, snapped.c);
        snapped.r = Math.max(0.5 * state.dpr, len(radiusVec));
        drag.previewRadiusDir = normalizeOr(radiusVec, baseDir);
        return snapped;
      }
    }

    return preview;
  }

  function previewInkFromDrag(drag, pLocal) {
    const next = cloneSelectableInkLocal(drag.startInkLocal);
    if (!next) return null;
    if (drag.handle === "move") {
      const delta = sub(pLocal, drag.startPointerLocal);
      if (next.type === "line") {
        next.a = add(next.a, delta);
        next.b = add(next.b, delta);
      } else if (next.type === "circle") {
        next.c = add(next.c, delta);
      }
      return next;
    }

    if (next.type === "line") {
      if (drag.handle === "line-a") next.a = { x: pLocal.x, y: pLocal.y };
      if (drag.handle === "line-b") next.b = { x: pLocal.x, y: pLocal.y };
      return next;
    }

    if (next.type === "circle") {
      if (drag.handle === "circle-center") {
        next.c = { x: pLocal.x, y: pLocal.y };
      } else if (drag.handle === "circle-radius") {
        const radiusVec = sub(pLocal, next.c);
        next.r = Math.max(0.5 * state.dpr, len(radiusVec));
        drag.previewRadiusDir = normalizeOr(radiusVec, drag.previewRadiusDir || drag.radiusDir || v(1, 0));
      }
      return next;
    }

    return null;
  }

  function startSelectionDrag(index, handle, inkLocal, pLocal) {
    const startInkLocal = cloneSelectableInkLocal(inkLocal);
    if (!startInkLocal) return false;
    const drag = {
      index,
      handle,
      startInkLocal,
      previewInkLocal: cloneSelectableInkLocal(startInkLocal),
      startPointerLocal: { x: pLocal.x, y: pLocal.y },
      moved: false,
    };
    if (startInkLocal.type === "circle" && handle === "circle-radius") {
      const radiusDir = normalizeOr(sub(pLocal, startInkLocal.c), v(1, 0));
      drag.radiusDir = radiusDir;
      drag.previewRadiusDir = radiusDir;
    }
    state.selectionDrag = drag;
    return true;
  }

  function updateSelectionDrag(pLocal) {
    if (!state.selectionDrag) return;
    const basePreview = previewInkFromDrag(state.selectionDrag, pLocal);
    const preview = snapSelectionPreviewToControlPoints(state.selectionDrag, basePreview);
    if (!preview) return;
    state.selectionDrag.previewInkLocal = preview;
    state.selectionDrag.moved = selectableInkDelta(state.selectionDrag.startInkLocal, preview) > 0.25 * state.dpr;
  }

  function commitSelectionDrag() {
    const drag = state.selectionDrag;
    if (!drag || !drag.moved || !drag.previewInkLocal) return;
    if (drag.index < 0 || drag.index >= state.ink.length) return;
    if (!getSelectableInkLocalAtIndex(drag.index)) return;
    pushUndo();
    const movedInkId = state.ink[drag.index]?.id;
    const updatedInk = inkLocalToWorld(drag.previewInkLocal);
    if (isValidInkId(movedInkId)) updatedInk.id = movedInkId;
    state.ink[drag.index] = updatedInk;
    markInkChanged();
    if (isValidInkId(movedInkId)) {
      pruneInvalidFillsAfterInkChange([movedInkId], []);
    } else {
      pruneInvalidFillsAfterInkChange();
    }
    state.selectedInkIndex = drag.index;
    updateHoverPick();
  }

  function drawSelectionInkPreview(tile, ink) {
    if (!tile || !ink) return;
    ctx.save();
    clipPrimaryTile(tile);
    ctx.strokeStyle = "#2b66ff";
    ctx.lineWidth = 2 * state.dpr;
    ctx.globalAlpha = 0.95;
    ctx.setLineDash([7 * state.dpr, 5 * state.dpr]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (ink.type === "line") {
      const a = localToScreenForTile(tile, ink.a);
      const b = localToScreenForTile(tile, ink.b);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (ink.type === "circle") {
      const c = localToScreenForTile(tile, ink.c);
      ctx.beginPath();
      ctx.arc(c.x, c.y, ink.r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSelectionControlPoints(tile, ink, activeHandle = null, circleRadiusDir = v(1, 0)) {
    if (!tile || !ink) return;
    const points = getControlPointsForInk(ink, circleRadiusDir, tile);
    if (!points.length) return;
    const r = 5 * state.dpr;
    ctx.save();
    for (const cp of points) {
      const s = localToScreenForTile(tile, cp.point);
      const active = cp.kind === activeHandle;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, TAU);
      ctx.fillStyle = active ? "#2b66ff" : "#fff";
      ctx.fill();
      ctx.strokeStyle = "#2b66ff";
      ctx.lineWidth = 2 * state.dpr;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSelectionOverlay(tile) {
    if (state.tool !== "select") return;
    if (!tile || tile !== state.tri) return;
    const preview = state.selectionDrag?.previewInkLocal || null;
    const selected = preview || getSelectedInkLocal();
    if (!selected) return;
    if (preview) drawSelectionInkPreview(tile, preview);
    const defaultRadiusDir = selected.type === "circle" ? defaultCircleRadiusDir(selected) : v(1, 0);
    const circleRadiusDir = state.selectionDrag?.previewRadiusDir || state.selectionDrag?.radiusDir || defaultRadiusDir;
    drawSelectionControlPoints(tile, selected, state.selectionDrag?.handle || null, circleRadiusDir);
  }

  function onSelectPointerDown(local) {
    const controlHit = findSelectionControlHit(local);
    if (controlHit) {
      const selected = getSelectedInkLocal();
      if (!selected) return false;
      return startSelectionDrag(state.selectedInkIndex, controlHit, selected, local);
    }

    if (!pointInPrimaryShape(local)) {
      clearSelection();
      return false;
    }

    const inkHit = findSelectableInkHit(local);
    if (!inkHit) {
      clearSelection();
      return false;
    }
    state.selectedInkIndex = inkHit.index;
    return startSelectionDrag(inkHit.index, "move", inkHit.inkLocal, local);
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
      const o = inkWorldToLocal(state.ink[i]);
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

  function replaceActiveFills(nextFills) {
    const activeDesign = getActiveDesign();
    const target = activeDesign?.fills || state.fills;
    target.length = 0;
    for (const fill of nextFills) target.push(fill);
    if (activeDesign) activeDesign.fills = target;
    state.fills = target;
  }

  function pruneInvalidFillsAfterInkChange(changedInkIds = [], deletedInkIds = []) {
    const changedSet = new Set(changedInkIds);
    const deletedSet = new Set(deletedInkIds);
    const kept = [];

    for (const fill of state.fills) {
      if (!Array.isArray(fill.boundaryInkIds)) {
        const discovered = getFillRenderData(fill);
        if (!discovered) continue;
      }

      const boundaryIds = fill.boundaryInkIds || [];
      if (boundaryIds.some((id) => deletedSet.has(id))) continue;
      const hasBoundaryChange = changedSet.size && boundaryIds.some((id) => changedSet.has(id));
      if (changedSet.size && !hasBoundaryChange) {
        kept.push(fill);
        continue;
      }

      const data = getFillRenderData(fill);
      if (!data) continue;
      if (hasBoundaryChange && !data.closedByInk) continue;
      kept.push(fill);
    }

    replaceActiveFills(kept);
  }

  function deleteAtPoint(pLocal) {
    const inkIdx = findDeletableInkIndex(pLocal);
    if (inkIdx >= 0) {
      pushUndo();
      const deletedInkId = state.ink[inkIdx]?.id;
      state.ink.splice(inkIdx, 1);
      if (state.selectedInkIndex === inkIdx) {
        clearSelection();
      } else if (state.selectedInkIndex > inkIdx) {
        state.selectedInkIndex -= 1;
      }
      markInkChanged();
      pruneInvalidFillsAfterInkChange([], deletedInkId ? [deletedInkId] : []);
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
      const circle = inkWorldToLocal(o);
      if (circle.type !== "circle") continue;
      const d = len(sub(pLocal, circle.c));
      const distToCirc = Math.abs(d - circle.r);
      if (distToCirc > thresh) continue;
      if (!best || distToCirc < best.distToCirc) best = { circle, distToCirc, d };
    }
    return best;
  }

  function updateHoverPick() {
    state.hoverArcPick = null;
    state.hoverDeleteInkIndex = -1;
    if (!state.hover) return;
    if (state.tool === "delete") {
      state.hoverDeleteInkIndex = findDeletableInkIndex(state.hover.local);
      return;
    }
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

  function drawHoverDeleteHighlight() {
    if (state.tool !== "delete") return;
    if (!state.tri) return;
    const idx = state.hoverDeleteInkIndex;
    if (idx < 0 || idx >= state.ink.length) return;
    const o = inkWorldToLocal(state.ink[idx]);

    ctx.save();
    ctx.strokeStyle = "#2b66ff";
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = 3 * state.dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    clipPrimaryTile(state.tri);

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

    ctx.restore();
  }

  function drawHoverArcHighlight() {
    if (!state.hoverArcPick || !state.tri) return;
    const a = state.hoverArcPick.arc;

    ctx.save();
    ctx.strokeStyle = "#2b66ff";
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3 * state.dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    clipPrimaryTile(state.tri);

    const c = localToScreen(a.c);
    ctx.beginPath();
    ctx.arc(c.x, c.y, a.r, a.a0, a.a1, false);
    ctx.stroke();

    ctx.restore();
  }

  function render() {
    clearScreen();

    renderBackgroundTiling();
    if (!state.primaryTiles.length) return;
    const tiles = [...state.primaryTiles];
    tiles.sort((a, b) => (a.id === state.activePrimaryTileId ? 1 : 0) - (b.id === state.activePrimaryTileId ? 1 : 0));

    for (const tile of tiles) {
      drawPrimaryTileShadow(tile, tile.id === state.activePrimaryTileId);
    }
    for (const tile of tiles) {
      fillPrimaryTileWhite(tile);
    }
    for (const tile of tiles) {
      drawInnerTriGrid(tile, tile.id === state.activePrimaryTileId);
      drawGridCenterMarker(tile, tile.id === state.activePrimaryTileId);
    }
    drawNearestGridPoint();
    drawNearestToolSnapPoint();

    for (const tile of tiles) {
      const design = getDesignForTile(tile);
      drawInkBig(tile, design, 1);
      drawFillsBig(tile, design);
      drawInkBig(tile, design, 2);
    }

    drawSelectionOverlay(state.tri);
    drawHoverDeleteHighlight();
    drawHoverArcHighlight();
    for (const tile of tiles) {
      strokePrimaryTile(tile, tile.id === state.activePrimaryTileId);
    }
    drawSingleTileSetControls();

    drawPreviewUnclippedBlue();
  }

  function getPointer(e) {
    const rect = canvas.getBoundingClientRect();
    return v((e.clientX - rect.left) * state.dpr, (e.clientY - rect.top) * state.dpr);
  }

  function updateHover(pScreen) {
    state.hoverTileControl = findSingleTileControlHit(pScreen);
    if (!state.tri) {
      state.hover = null;
      state.hoverArcPick = null;
      state.hoverDeleteInkIndex = -1;
      return;
    }
    const local = screenToLocal(pScreen);
    const snapLocal = snapToTriGrid(local);
    const toolSnapLocal = findHoverToolSnapPoint(local);
    state.hover = { screen: pScreen, local, snapLocal, toolSnapLocal };
    updateHoverPick();
  }

  function shouldSnapForTool(tool) {
    if (!state.snap) return false;
    if (tool === "fill" || tool === "delete" || tool === "select") return false;
    return true;
  }

  function localForToolFromHover(tool) {
    const doGridSnap = shouldSnapForTool(tool);
    const baseLocal = doGridSnap ? state.hover.snapLocal : state.hover.local;
    if (state.toolSnap && state.hover.toolSnapLocal && (tool === "line" || tool === "circle")) {
      return state.hover.toolSnapLocal;
    }
    return baseLocal;
  }

  function onPointerDown(e) {
    if (state.shapeDialogOpen || state.exportDialogOpen) return;
    const p = getPointer(e);
    const controlHit = findSingleTileControlHit(p);
    if (controlHit?.type === "add") {
      addSingleLayoutPrimaryTile();
      return;
    }
    if (controlHit?.type === "remove") {
      removeSingleLayoutPrimaryTile(controlHit.tileId);
      return;
    }

    const hitTile = findPrimaryTileAtScreen(p);
    if (hitTile && hitTile.id !== state.activePrimaryTileId) {
      setActivePrimaryTile(hitTile, false);
    }
    if (!state.tri) return;
    canvas.setPointerCapture?.(e.pointerId);
    state.pointerDown = true;

    updateHover(p);

    const local = localForToolFromHover(state.tool);

    if (state.tool === "select") {
      const dragStarted = onSelectPointerDown(local);
      if (!dragStarted) state.pointerDown = false;
      state.drawing = null;
      requestRender();
      return;
    }

    if (state.tool === "fill") {
      if (!pointInPrimaryShape(local)) {
        state.pointerDown = false;
        return;
      }
      pushUndo();
      const seed = pointLocalToWorld(local);
      const discovered = discoverFillBoundaryDefinition(seed, state.tri, { ink: state.ink, fills: state.fills });
      if (discovered) {
        const fill = {
          x: seed.x,
          y: seed.y,
          boundaryInkIds: discovered.boundaryInkIds,
          usesTileBoundary: discovered.usesTileBoundary,
        };
        state.fills.push(fill);
        fillCache.set(fill, {
          key: `${getFillCacheKey()}:${state.tri.shape}:${state.tri.side}:${fill.boundaryInkIds.join(",")}:${fill.usesTileBoundary ? 1 : 0}`,
          data: discovered.data,
        });
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

    const startScreen = localToScreen(local);
    state.drawing = {
      tool: state.tool,
      startLocal: local,
      curLocal: local,
      startScreen,
      curScreen: startScreen,
    };
    requestRender();
  }

  function onPointerMove(e) {
    if (state.shapeDialogOpen || state.exportDialogOpen) return;
    if (!state.tri) return;
    const p = getPointer(e);
    updateHover(p);

    if (state.pointerDown) {
      if (state.selectionDrag) {
        updateSelectionDrag(state.hover.local);
      } else if (state.drawing) {
        const local = localForToolFromHover(state.drawing.tool);
        state.drawing.curLocal = local;
        state.drawing.curScreen = localToScreen(local);
      }
    }
    requestRender();
  }

  function onPointerUp(e) {
    if (state.shapeDialogOpen || state.exportDialogOpen) return;
    if (!state.pointerDown) return;
    state.pointerDown = false;

    let releaseScreen = null;
    if (e && typeof e.clientX === "number" && typeof e.clientY === "number" && state.tri) {
      releaseScreen = getPointer(e);
      updateHover(releaseScreen);
    }

    if (state.selectionDrag) {
      if (state.hover) updateSelectionDrag(state.hover.local);
      commitSelectionDrag();
      state.selectionDrag = null;
      requestRender();
      return;
    }

    const d = state.drawing;
    state.drawing = null;

    if (!d) {
      requestRender();
      return;
    }

    if ((d.tool === "line" || d.tool === "circle") && state.tri) {
      const releaseTile = releaseScreen
        ? findPrimaryTileAtScreen(releaseScreen) || findNearestPrimaryTileAtScreen(releaseScreen)
        : null;
      if (releaseTile && releaseTile.id !== state.activePrimaryTileId) {
        setActivePrimaryTile(releaseTile, false);
      }
      const targetTile = state.tri;
      if (targetTile) {
        const startScreen = d.startScreen || localToScreen(d.startLocal);
        d.startLocal = screenToLocalForTile(targetTile, startScreen);
        const endScreen = releaseScreen || d.curScreen || localToScreen(d.curLocal);
        if (releaseScreen) updateHover(releaseScreen);
        if (state.hover) {
          d.curLocal = localForToolFromHover(d.tool);
        } else {
          d.curLocal = screenToLocalForTile(targetTile, endScreen);
        }
      }
    } else if (state.hover) {
      d.curLocal = localForToolFromHover(d.tool);
    }

    if (d.tool === "circle") {
      const dragDist = len(sub(d.curLocal, d.startLocal));
      const CLICK_EPS = 6 * state.dpr;

      if (dragDist <= CLICK_EPS && state.hoverArcPick) {
        pushUndo();
        state.ink.push(createInk(inkLocalToWorld(state.hoverArcPick.arc)));
        markInkChanged();
        requestRender();
        return;
      }

      if (dragDist > 0.5 * state.dpr) {
        pushUndo();
        state.ink.push(createInk(inkLocalToWorld({ type: "circle", c: d.startLocal, r: dragDist })));
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
        state.ink.push(createInk(inkLocalToWorld({ type: "line", a: d.startLocal, b: d.curLocal })));
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
    state.selectionDrag = null;
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
    setSelectableState(itemToolSnap, state.toolSnap);
  }

  function syncGridMenu() {
    setSelectableState(itemGrid, state.showGrid);
    setSelectableState(itemSnap, state.snap);
    for (const item of gridSizeItems) {
      if (!(item instanceof HTMLElement)) continue;
      setSelectableState(item, Number(item.dataset.gridSize) === state.gridDivisions);
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

  function syncExportDialog() {
    exportDialogBackdrop.classList.toggle("open", state.exportDialogOpen);
  }

  function setPendingTilingOption(optionId) {
    if (!isTilingOption(optionId)) return;
    state.pendingTilingId = optionId;
    for (const option of shapeOptionButtons) {
      if (!(option instanceof HTMLElement)) continue;
      const selected = option.dataset.shapeOption === optionId;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", selected ? "true" : "false");
    }
  }

  function createEmptyShapeDesigns() {
    return Object.fromEntries(SHAPES.map((shape) => [shape, createEmptyDesign()]));
  }

  function openShapeDialog(required = false) {
    state.shapeDialogOpen = true;
    state.shapeDialogRequired = required;
    state.exportDialogOpen = false;
    state.pointerDown = false;
    state.drawing = null;
    state.selectionDrag = null;
    setPendingTilingOption(state.tilingId);
    openMenu(null);
    syncShapeDialog();
    syncExportDialog();
    requestRender();
  }

  function closeShapeDialog() {
    if (state.shapeDialogRequired) return;
    state.shapeDialogOpen = false;
    syncShapeDialog();
  }

  function openExportDialog() {
    state.shapeDialogOpen = false;
    state.shapeDialogRequired = false;
    state.exportDialogOpen = true;
    state.pointerDown = false;
    state.drawing = null;
    state.selectionDrag = null;
    const fallbackW = Math.max(64, Math.round(state.vw / Math.max(1, state.dpr)));
    const fallbackH = Math.max(64, Math.round(state.vh / Math.max(1, state.dpr)));
    if (!Number.isFinite(state.exportWidth) || state.exportWidth < 64) state.exportWidth = fallbackW;
    if (!Number.isFinite(state.exportHeight) || state.exportHeight < 64) state.exportHeight = fallbackH;
    exportWidthInput.value = String(Math.round(state.exportWidth));
    exportHeightInput.value = String(Math.round(state.exportHeight));
    openMenu(null);
    syncShapeDialog();
    syncExportDialog();
    requestAnimationFrame(() => {
      exportWidthInput.focus();
      exportWidthInput.select();
    });
  }

  function closeExportDialog() {
    if (!state.exportDialogOpen) return;
    state.exportDialogOpen = false;
    syncExportDialog();
  }

  function parseExportDimension(raw, fallback) {
    const num = Math.round(Number(raw));
    if (!Number.isFinite(num)) return fallback;
    return clamp(num, 64, 12000);
  }

  function triggerPngDownload(pngCanvas, width, height) {
    const filename = `tile-designer-wallpaper-${width}x${height}.png`;
    if (pngCanvas.toBlob) {
      pngCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, "image/png");
      return;
    }
    const link = document.createElement("a");
    link.href = pngCanvas.toDataURL("image/png");
    link.download = filename;
    link.click();
  }

  function triggerTextDownload(content, filename, mimeType = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function applyLoadedDocument(rawDoc) {
    const loaded = sanitizeLoadedDocument(rawDoc);
    if (!loaded) throw new Error("Invalid tile design JSON.");

    state.tilingId = loaded.tilingId;
    state.pendingTilingId = loaded.tilingId;
    state.tileShape = loaded.tileShape;
    state.shapeDesigns = loaded.shapeDesigns;
    state.singleTileVariants = loaded.singleTileVariants;
    state.activePrimaryTileId = loaded.activePrimaryTileId;
    state.nextPrimaryTileId = loaded.nextPrimaryTileId;
    state.nextInkId = loaded.nextInkId;
    state.pointerDown = false;
    state.drawing = null;
    state.selectionDrag = null;
    clearSelection();
    state.hover = null;
    state.hoverTileControl = null;
    state.hoverArcPick = null;
    state.hoverDeleteInkIndex = -1;
    state.shapeDialogOpen = false;
    state.shapeDialogRequired = false;
    state.exportDialogOpen = false;
    state.undoStack.length = 0;
    state.redoStack.length = 0;
    openMenu(null);

    recomputeBigTriangle();
    recomputeGrid();
    markInkChanged();

    setPendingTilingOption(state.tilingId);
    syncShapeDialog();
    syncExportDialog();
    syncToolMenu();
    syncGridMenu();
    syncViewMenu();
    syncToolPalette();
    syncHUD();
    updateHoverPick();
    requestRender();
  }

  function saveDesignJson() {
    const doc = createSaveDocument();
    const modeId = String(doc.tilingId || doc.tileShape || "tile").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
    const json = `${JSON.stringify(doc, null, 2)}\n`;
    triggerTextDownload(json, `tile-designer-${modeId}.json`, "application/json;charset=utf-8");
  }

  function openLoadDialog() {
    loadFileInput.value = "";
    loadFileInput.click();
  }

  async function onLoadFileChange(e) {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    target.value = "";
    if (!file) return;
    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      applyLoadedDocument(parsed);
    } catch {
      window.alert("Unable to load this file. Please choose a valid Tile Designer JSON export.");
    }
  }

  function fmtSvgNum(n) {
    const v = Math.abs(n) < 1e-8 ? 0 : n;
    return Number(v.toFixed(4)).toString();
  }

  function svgPt(p) {
    return `${fmtSvgNum(p.x)} ${fmtSvgNum(p.y)}`;
  }

  function svgPathFromPoly(points) {
    if (!points?.length) return "";
    let d = `M ${svgPt(points[0])}`;
    for (let i = 1; i < points.length; i += 1) d += ` L ${svgPt(points[i])}`;
    return `${d} Z`;
  }

  function angleDeltaCCW(a0, a1) {
    const s = angleWrap(a0);
    const e = angleWrap(a1);
    let d = e - s;
    if (d < 0) d += TAU;
    return d;
  }

  function angleDeltaCW(a0, a1) {
    return angleDeltaCCW(a1, a0);
  }

  function pointOnCircle(c, r, ang) {
    return v(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r);
  }

  function svgPathForInkLocal(localInk) {
    if (!localInk) return "";
    if (localInk.type === "line") {
      return `M ${svgPt(localInk.a)} L ${svgPt(localInk.b)}`;
    }
    if (localInk.type === "circle") {
      const p0 = pointOnCircle(localInk.c, localInk.r, 0);
      const p1 = pointOnCircle(localInk.c, localInk.r, Math.PI);
      const rr = fmtSvgNum(localInk.r);
      return `M ${svgPt(p0)} A ${rr} ${rr} 0 1 1 ${svgPt(p1)} A ${rr} ${rr} 0 1 1 ${svgPt(p0)}`;
    }
    if (localInk.type === "arc") {
      const a0 = angleWrap(localInk.a0);
      const a1 = angleWrap(localInk.a1);
      const p0 = pointOnCircle(localInk.c, localInk.r, a0);
      const p1 = pointOnCircle(localInk.c, localInk.r, a1);
      const d = angleDeltaCCW(a0, a1);
      if (d <= 1e-6) return "";
      const largeArc = d > Math.PI ? 1 : 0;
      const sweep = 1;
      const rr = fmtSvgNum(localInk.r);
      return `M ${svgPt(p0)} A ${rr} ${rr} 0 ${largeArc} ${sweep} ${svgPt(p1)}`;
    }
    return "";
  }

  function cross2(a, b) {
    return a.x * b.y - a.y * b.x;
  }

  function pointKey(p) {
    return `${Math.round(p.x * 10000) / 10000},${Math.round(p.y * 10000) / 10000}`;
  }

  function pushUniqueNumber(arr, value, eps = 1e-6) {
    for (const v0 of arr) {
      if (Math.abs(v0 - value) <= eps) return;
    }
    arr.push(value);
  }

  function normalizeAngleList(angles) {
    const vals = angles.map((a) => angleWrap(a)).sort((a, b) => a - b);
    const out = [];
    for (const a of vals) {
      if (!out.length || Math.abs(a - out[out.length - 1]) > 1e-6) out.push(a);
    }
    if (out.length > 1 && Math.abs(out[0] + TAU - out[out.length - 1]) < 1e-6) {
      out.pop();
    }
    return out;
  }

  function dedupePoints(points, eps = 1e-6) {
    const out = [];
    for (const p of points) {
      if (out.some((q) => len(sub(p, q)) <= eps)) continue;
      out.push(p);
    }
    return out;
  }

  function lineSegmentIntersection(a0, a1, b0, b1) {
    const r = sub(a1, a0);
    const s = sub(b1, b0);
    const den = cross2(r, s);
    if (Math.abs(den) < 1e-9) return [];
    const qp = sub(b0, a0);
    const t = cross2(qp, s) / den;
    const u = cross2(qp, r) / den;
    if (t < -1e-7 || t > 1 + 1e-7 || u < -1e-7 || u > 1 + 1e-7) return [];
    return [add(a0, mul(r, t))];
  }

  function lineCircleIntersections(a, b, c, r) {
    const d = sub(b, a);
    const f = sub(a, c);
    const A = dot(d, d);
    if (A < 1e-10) return [];
    const B = 2 * dot(f, d);
    const C = dot(f, f) - r * r;
    let disc = B * B - 4 * A * C;
    if (disc < -1e-8) return [];
    disc = Math.max(0, disc);
    const sDisc = Math.sqrt(disc);
    const ts = disc <= 1e-8 ? [(-B) / (2 * A)] : [(-B - sDisc) / (2 * A), (-B + sDisc) / (2 * A)];
    const pts = [];
    for (const t of ts) {
      if (t < -1e-7 || t > 1 + 1e-7) continue;
      pts.push(add(a, mul(d, t)));
    }
    return dedupePoints(pts);
  }

  function circleCircleIntersections(c0, r0, c1, r1) {
    const dVec = sub(c1, c0);
    const d = len(dVec);
    if (d < 1e-8) return [];
    if (d > r0 + r1 + 1e-8) return [];
    if (d < Math.abs(r0 - r1) - 1e-8) return [];
    const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    const h2 = r0 * r0 - a * a;
    if (h2 < -1e-8) return [];
    const h = Math.sqrt(Math.max(0, h2));
    const m = add(c0, mul(dVec, a / d));
    const rx = (-dVec.y * h) / d;
    const ry = (dVec.x * h) / d;
    const pA = v(m.x + rx, m.y + ry);
    if (h <= 1e-8) return [pA];
    const pB = v(m.x - rx, m.y - ry);
    return [pA, pB];
  }

  function primitiveAngleAt(prim, p) {
    return angleWrap(Math.atan2(p.y - prim.c.y, p.x - prim.c.x));
  }

  function lineParamAt(a, b, p) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx ? (p.x - a.x) / dx : 0;
    return dy ? (p.y - a.y) / dy : 0;
  }

  function primitiveParamAt(prim, p) {
    if (prim.kind === "line") return lineParamAt(prim.a, prim.b, p);
    return primitiveAngleAt(prim, p);
  }

  function pointOnPrimitive(prim, p) {
    if (prim.kind === "line") {
      const d = pointToSegmentDistance(p, prim.a, prim.b);
      const t = lineParamAt(prim.a, prim.b, p);
      return d <= 1e-4 && t >= -1e-6 && t <= 1 + 1e-6;
    }
    const dr = Math.abs(len(sub(p, prim.c)) - prim.r);
    if (dr > 1e-4) return false;
    if (prim.kind === "arc") {
      const ang = primitiveAngleAt(prim, p);
      return angleInArc(ang, prim.a0, prim.a1);
    }
    return true;
  }

  function primitiveIntersections(a, b) {
    let pts = [];
    if (a.kind === "line" && b.kind === "line") {
      pts = lineSegmentIntersection(a.a, a.b, b.a, b.b);
    } else if (a.kind === "line" && (b.kind === "circle" || b.kind === "arc")) {
      pts = lineCircleIntersections(a.a, a.b, b.c, b.r);
    } else if (b.kind === "line" && (a.kind === "circle" || a.kind === "arc")) {
      pts = lineCircleIntersections(b.a, b.b, a.c, a.r);
    } else {
      pts = circleCircleIntersections(a.c, a.r, b.c, b.r);
    }
    return dedupePoints(pts).filter((p) => pointOnPrimitive(a, p) && pointOnPrimitive(b, p));
  }

  function makeFillMaskTester(fillData) {
    if (!fillData?.bmp || !fillData.wLocal || !fillData.hLocal) return () => false;
    const g = fillData.bmp.getContext("2d", { willReadFrequently: true });
    if (!g) return () => false;
    const w = fillData.bmp.width;
    const h = fillData.bmp.height;
    const px = g.getImageData(0, 0, w, h).data;
    return (pLocal) => {
      if (pLocal.x < fillData.minX || pLocal.y < fillData.minY) return false;
      if (pLocal.x > fillData.minX + fillData.wLocal || pLocal.y > fillData.minY + fillData.hLocal) return false;
      const ux = (pLocal.x - fillData.minX) / fillData.wLocal;
      const uy = (pLocal.y - fillData.minY) / fillData.hLocal;
      if (ux < 0 || uy < 0 || ux > 1 || uy > 1) return false;
      const sx = Math.floor(ux * w);
      const sy = Math.floor(uy * h);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) return false;
      return px[(sy * w + sx) * 4 + 3] > 0;
    };
  }

  function boundarySideForEdge(mid, normalLeft, sampleBase, isInsideFill) {
    const scales = [1, 2, 4];
    for (const mulS of scales) {
      const d = sampleBase * mulS;
      const insideL = isInsideFill(add(mid, mul(normalLeft, d)));
      const insideR = isInsideFill(add(mid, mul(normalLeft, -d)));
      if (insideL !== insideR) return insideL ? "left" : "right";
    }
    return null;
  }

  function buildFillBoundarySvgPath(fill, tile, design) {
    if (!fill || !tile || !design) return "";
    const fillData = getFillRenderData(fill, tile, design);
    if (!fillData || !Array.isArray(fill.boundaryInkIds)) return "";
    const boundaryInk = fillBoundaryInkList(design, fill.boundaryInkIds).map((ink) => inkWorldToLocal(ink, tile));
    const primitives = [];
    for (const ink of boundaryInk) {
      if (ink.type === "line") {
        if (len(sub(ink.b, ink.a)) > 1e-6) primitives.push({ kind: "line", a: ink.a, b: ink.b });
      } else if (ink.type === "circle") {
        if (ink.r > 1e-6) primitives.push({ kind: "circle", c: ink.c, r: ink.r });
      } else if (ink.type === "arc") {
        if (ink.r > 1e-6) primitives.push({ kind: "arc", c: ink.c, r: ink.r, a0: angleWrap(ink.a0), a1: angleWrap(ink.a1) });
      }
    }
    if (fill.usesTileBoundary && tile.polyLocal?.length) {
      for (let i = 0; i < tile.polyLocal.length; i += 1) {
        const a = tile.polyLocal[i];
        const b = tile.polyLocal[(i + 1) % tile.polyLocal.length];
        if (len(sub(b, a)) > 1e-6) primitives.push({ kind: "line", a, b, tileEdge: true });
      }
    }
    if (!primitives.length) return "";

    const splitParams = primitives.map(() => []);
    for (let i = 0; i < primitives.length; i += 1) {
      const prim = primitives[i];
      if (prim.kind === "line") {
        pushUniqueNumber(splitParams[i], 0);
        pushUniqueNumber(splitParams[i], 1);
      } else if (prim.kind === "arc") {
        pushUniqueNumber(splitParams[i], angleWrap(prim.a0));
        pushUniqueNumber(splitParams[i], angleWrap(prim.a1));
      }
    }

    for (let i = 0; i < primitives.length; i += 1) {
      for (let j = i + 1; j < primitives.length; j += 1) {
        const pts = primitiveIntersections(primitives[i], primitives[j]);
        for (const p of pts) {
          pushUniqueNumber(splitParams[i], primitiveParamAt(primitives[i], p));
          pushUniqueNumber(splitParams[j], primitiveParamAt(primitives[j], p));
        }
      }
    }

    const rawEdges = [];
    for (let i = 0; i < primitives.length; i += 1) {
      const prim = primitives[i];
      if (prim.kind === "line") {
        const ts = [...splitParams[i]].sort((a, b) => a - b)
          .filter((t, idx, arr) => idx === 0 || Math.abs(t - arr[idx - 1]) > 1e-6);
        if (!ts.length) continue;
        if (Math.abs(ts[0]) > 1e-6) ts.unshift(0);
        if (Math.abs(ts[ts.length - 1] - 1) > 1e-6) ts.push(1);
        for (let k = 0; k < ts.length - 1; k += 1) {
          const t0 = clamp(ts[k], 0, 1);
          const t1 = clamp(ts[k + 1], 0, 1);
          if (t1 - t0 <= 1e-6) continue;
          rawEdges.push({
            kind: "line",
            p0: add(prim.a, mul(sub(prim.b, prim.a), t0)),
            p1: add(prim.a, mul(sub(prim.b, prim.a), t1)),
          });
        }
        continue;
      }

      if (prim.kind === "arc") {
        const s = angleWrap(prim.a0);
        const e = angleWrap(prim.a1);
        const total = angleDeltaCCW(s, e);
        if (total <= 1e-6) continue;
        const vals = normalizeAngleList(
          splitParams[i].filter((a) => angleInArc(a, s, e)).concat([s, e])
        );
        const sorted = vals
          .map((a) => ({ a, p: (() => { let d = a - s; if (d < 0) d += TAU; return d; })() }))
          .sort((u, v0) => u.p - v0.p);
        for (let k = 0; k < sorted.length - 1; k += 1) {
          const a0 = sorted[k].a;
          const a1 = sorted[k + 1].a;
          if (angleDeltaCCW(a0, a1) <= 1e-6) continue;
          rawEdges.push({ kind: "arc", c: prim.c, r: prim.r, a0, a1, dir: 1 });
        }
        continue;
      }

      const vals0 = normalizeAngleList(splitParams[i]);
      const vals = vals0.length === 0
        ? [0, Math.PI]
        : (vals0.length === 1 ? normalizeAngleList([vals0[0], vals0[0] + Math.PI]) : vals0);
      if (vals.length < 2) continue;
      for (let k = 0; k < vals.length; k += 1) {
        const a0 = vals[k];
        const a1 = k === vals.length - 1 ? vals[0] + TAU : vals[k + 1];
        if (a1 - a0 <= 1e-6) continue;
        rawEdges.push({ kind: "arc", c: prim.c, r: prim.r, a0, a1, dir: 1 });
      }
    }

    if (!rawEdges.length) return "";
    const isInsideFill = makeFillMaskTester(fillData);
    const sampleBase = Math.max(0.8 * state.dpr, tile.side * 0.0025);
    const edges = [];

    for (const edge of rawEdges) {
      if (edge.kind === "line") {
        if (len(sub(edge.p1, edge.p0)) <= 1e-6) continue;
        const dir = normalizeOr(sub(edge.p1, edge.p0), v(1, 0));
        const mid = mul(add(edge.p0, edge.p1), 0.5);
        const normalLeft = v(-dir.y, dir.x);
        const side = boundarySideForEdge(mid, normalLeft, sampleBase, isInsideFill);
        if (!side) continue;
        const start = side === "left" ? edge.p0 : edge.p1;
        const end = side === "left" ? edge.p1 : edge.p0;
        const startDir = normalizeOr(sub(end, start), v(1, 0));
        edges.push({
          kind: "line",
          start,
          end,
          startDir,
          endDir: startDir,
        });
        continue;
      }

      const delta = angleDeltaCCW(edge.a0, edge.a1);
      if (delta <= 1e-6) continue;
      const midAng = edge.a0 + delta * 0.5;
      const mid = pointOnCircle(edge.c, edge.r, midAng);
      const tanCCW = v(-Math.sin(midAng), Math.cos(midAng));
      const normalLeft = v(-tanCCW.y, tanCCW.x);
      const side = boundarySideForEdge(mid, normalLeft, sampleBase, isInsideFill);
      if (!side) continue;

      const dir = side === "left" ? 1 : -1;
      const aStart = side === "left" ? edge.a0 : edge.a1;
      const aEnd = side === "left" ? edge.a1 : edge.a0;
      const start = pointOnCircle(edge.c, edge.r, aStart);
      const end = pointOnCircle(edge.c, edge.r, aEnd);
      const startDir = dir === 1
        ? normalizeOr(v(-Math.sin(aStart), Math.cos(aStart)), v(1, 0))
        : normalizeOr(v(Math.sin(aStart), -Math.cos(aStart)), v(1, 0));
      const endDir = dir === 1
        ? normalizeOr(v(-Math.sin(aEnd), Math.cos(aEnd)), v(1, 0))
        : normalizeOr(v(Math.sin(aEnd), -Math.cos(aEnd)), v(1, 0));
      edges.push({
        kind: "arc",
        c: edge.c,
        r: edge.r,
        a0: aStart,
        a1: aEnd,
        dir,
        start,
        end,
        startDir,
        endDir,
      });
    }

    if (!edges.length) return "";
    const outByNode = new Map();
    for (let i = 0; i < edges.length; i += 1) {
      const edge = edges[i];
      edge.startKey = pointKey(edge.start);
      edge.endKey = pointKey(edge.end);
      if (!outByNode.has(edge.startKey)) outByNode.set(edge.startKey, []);
      outByNode.get(edge.startKey).push(i);
    }

    const used = new Array(edges.length).fill(false);
    const loops = [];

    function pickNextEdge(nodeKey, prevDir) {
      const candidates = (outByNode.get(nodeKey) || []).filter((idx) => !used[idx]);
      if (!candidates.length) return -1;
      if (candidates.length === 1) return candidates[0];
      let bestIdx = -1;
      let bestTurn = Infinity;
      for (const idx of candidates) {
        const dir = edges[idx].startDir;
        let turn = Math.atan2(cross2(prevDir, dir), dot(prevDir, dir));
        if (turn < 0) turn += TAU;
        if (turn < bestTurn) {
          bestTurn = turn;
          bestIdx = idx;
        }
      }
      return bestIdx;
    }

    for (let i = 0; i < edges.length; i += 1) {
      if (used[i]) continue;
      const loop = [];
      let cur = i;
      const startKey = edges[i].startKey;
      let closed = false;
      for (let guard = 0; guard < edges.length + 5; guard += 1) {
        if (used[cur]) break;
        const edge = edges[cur];
        used[cur] = true;
        loop.push(cur);
        if (edge.endKey === startKey) {
          closed = true;
          break;
        }
        const next = pickNextEdge(edge.endKey, edge.endDir);
        if (next < 0) break;
        cur = next;
      }
      if (closed && loop.length) loops.push(loop);
    }

    if (!loops.length) return "";
    const parts = [];
    for (const loop of loops) {
      const first = edges[loop[0]];
      let d = `M ${svgPt(first.start)}`;
      for (const idx of loop) {
        const edge = edges[idx];
        if (edge.kind === "line") {
          d += ` L ${svgPt(edge.end)}`;
        } else {
          const delta = edge.dir === 1 ? angleDeltaCCW(edge.a0, edge.a1) : angleDeltaCW(edge.a0, edge.a1);
          const largeArc = delta > Math.PI ? 1 : 0;
          const sweep = edge.dir === 1 ? 1 : 0;
          const rr = fmtSvgNum(edge.r);
          d += ` A ${rr} ${rr} 0 ${largeArc} ${sweep} ${svgPt(edge.end)}`;
        }
      }
      d += " Z";
      parts.push(d);
    }
    return parts.join(" ");
  }

  function exportTileSvg() {
    if (!state.primaryTiles.length) return;
    ensureAllInkIds();

    const tiles = [...state.primaryTiles];
    const pad = 4;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const tile of tiles) {
      if (!tile?.poly?.length) continue;
      for (const p of tile.poly) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const vbW = Math.max(1, maxX - minX);
    const vbH = Math.max(1, maxY - minY);

    const defs = [];
    const body = [];

    for (let i = 0; i < tiles.length; i += 1) {
      const tile = tiles[i];
      const design = getDesignForTile(tile);
      if (!design) continue;
      const tilePath = svgPathFromPoly(tile.polyLocal);
      if (!tilePath) continue;

      const cx = fmtSvgNum(tile.center.x);
      const cy = fmtSvgNum(tile.center.y);
      const clipId = `tileClip${i}`;
      defs.push(`    <clipPath id="${clipId}">`);
      defs.push(`      <path d="${tilePath}" transform="translate(${cx} ${cy})"/>`);
      defs.push("    </clipPath>");

      const fillPaths = [];
      for (const fill of design.fills) {
        const d = buildFillBoundarySvgPath(fill, tile, design);
        if (!d) continue;
        fillPaths.push(`      <path d="${d}" fill="#000" fill-rule="evenodd"/>`);
      }

      const inkPaths = [];
      for (const ink of design.ink) {
        const localInk = inkWorldToLocal(ink, tile);
        const d = svgPathForInkLocal(localInk);
        if (!d) continue;
        inkPaths.push(`      <path d="${d}" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
      }

      body.push(`  <g clip-path="url(#${clipId})">`);
      body.push(`    <g transform="translate(${cx} ${cy})">`);
      body.push(...fillPaths);
      body.push(...inkPaths);
      body.push("    </g>");
      body.push("  </g>");
      body.push(`  <path d="${tilePath}" transform="translate(${cx} ${cy})" fill="none" stroke="#bdbdbd" stroke-width="1"/>`);
    }

    const lines = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmtSvgNum(minX)} ${fmtSvgNum(minY)} ${fmtSvgNum(vbW)} ${fmtSvgNum(vbH)}">`,
      "  <defs>",
      ...defs,
      "  </defs>",
      ...body,
      "</svg>",
    ];

    const modeId = String(state.tilingId || state.tileShape || "tile").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
    const svg = `${lines.join("\n")}\n`;
    triggerTextDownload(svg, `tile-designer-${modeId}.svg`, "image/svg+xml;charset=utf-8");
  }

  function exportWallpaper() {
    const fallbackW = Math.max(64, Math.round(state.vw / Math.max(1, state.dpr)));
    const fallbackH = Math.max(64, Math.round(state.vh / Math.max(1, state.dpr)));
    const width = parseExportDimension(exportWidthInput.value, fallbackW);
    const height = parseExportDimension(exportHeightInput.value, fallbackH);
    if (width * height > 96000000) {
      window.alert("Export size is too large. Please choose a smaller width/height.");
      return;
    }
    state.exportWidth = width;
    state.exportHeight = height;
    exportWidthInput.value = String(width);
    exportHeightInput.value = String(height);

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;
    const exportCtx = exportCanvas.getContext("2d", { alpha: false });
    if (!exportCtx) return;
    exportCtx.fillStyle = "#fff";
    exportCtx.fillRect(0, 0, width, height);

    const exportTiles = state.primaryTiles.map((tile) =>
      buildPrimaryTile(tile.id, tile.shape, tile.side / Math.max(1, state.dpr), v(width * 0.5, height * 0.5))
    );
    renderBackgroundTiling(exportCtx, width, height, exportTiles, 1, false);
    triggerPngDownload(exportCanvas, width, height);
    closeExportDialog();
  }

  function applyTilingOption(optionId) {
    if (!isTilingOption(optionId)) return;
    const mode = getTilingOption(optionId);
    state.tilingId = optionId;
    state.pendingTilingId = optionId;
    state.tileShape = mode.shapes[0] || "triangle";
    state.pointerDown = false;
    state.drawing = null;
    clearSelection();
    state.hover = null;
    state.hoverTileControl = null;
    state.hoverArcPick = null;
    state.hoverDeleteInkIndex = -1;
    state.shapeDesigns = createEmptyShapeDesigns();
    state.singleTileVariants = [{ id: 1, design: createEmptyDesign() }];
    state.activePrimaryTileId = 1;
    state.nextPrimaryTileId = 2;
    state.nextInkId = 1;
    syncActiveDesignRefs();
    state.undoStack.length = 0;
    state.redoStack.length = 0;
    markInkChanged();
    recomputeBigTriangle();
    recomputeGrid();
    syncHUD();
    requestRender();
  }

  function selectTilingOption(optionId) {
    if (!state.shapeDialogOpen) return;
    if (!isTilingOption(optionId)) return;
    setPendingTilingOption(optionId);
    applyTilingOption(optionId);
    state.shapeDialogOpen = false;
    state.shapeDialogRequired = false;
    syncShapeDialog();
  }

  function onShapeDialogCancel() {
    closeShapeDialog();
  }

  function onExportDialogCancel() {
    closeExportDialog();
  }

  function onExportDialogSubmit(e) {
    e.preventDefault();
    exportWallpaper();
  }

  function onExportBackdropPointerDown(e) {
    if (e.target === exportDialogBackdrop) closeExportDialog();
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

  function onToolSnapToggle() {
    state.toolSnap = !state.toolSnap;
    syncToolMenu();
    requestRender();
  }

  function onGridSizeChange(divisions) {
    let next = GRID_DIVISION_OPTIONS[0];
    let bestErr = Infinity;
    for (const candidate of GRID_DIVISION_OPTIONS) {
      const err = Math.abs(candidate - divisions);
      if (err < bestErr) {
        bestErr = err;
        next = candidate;
      }
    }
    state.gridDivisions = next;
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
    if (isSingleShapeLayout()) {
      for (const variant of state.singleTileVariants) {
        variant.design.ink.length = 0;
        variant.design.fills.length = 0;
      }
    } else {
      const modeShapes = getTilingOption(state.tilingId).shapes;
      for (const shape of modeShapes) {
        const design = getShapeDesign(shape);
        if (!design) continue;
        design.ink.length = 0;
        design.fills.length = 0;
      }
    }
    clearSelection();
    syncActiveDesignRefs();
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
    if (item.dataset.action === "load") {
      openLoadDialog();
      return;
    }
    if (item.dataset.action === "save") {
      saveDesignJson();
      return;
    }
    if (item.dataset.action === "export-tile") {
      exportTileSvg();
      return;
    }
    if (item.dataset.action === "export-wallpaper") {
      openExportDialog();
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
    if (item.dataset.toggle === "tool-snap") {
      onToolSnapToggle();
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
    const optionId = btn.dataset.shapeOption;
    if (optionId) selectTilingOption(optionId);
  }

  function inTextEntryTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest("input, textarea, select, [contenteditable=\"true\"]");
  }

  function onKeyDown(e) {
    if (state.exportDialogOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeExportDialog();
      }
      return;
    }
    if (state.shapeDialogOpen) {
      if (e.key === "Escape" && !state.shapeDialogRequired) {
        onShapeDialogCancel();
      }
      return;
    }
    if (inTextEntryTarget(e.target)) return;
    const key = e.key.toLowerCase();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (key === "1") {
      setTool("select");
      return;
    }
    if (key === "2") {
      setTool("line");
      return;
    }
    if (key === "3") {
      setTool("circle");
      return;
    }
    if (key === "4") {
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
      state.selectionDrag = null;
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
    state.hoverTileControl = null;
    state.hoverArcPick = null;
    state.hoverDeleteInkIndex = -1;
    requestRender();
  });

  on(menuBar, "pointermove", onMenuPointerMove);
  on(menuBar, "pointerleave", onMenuPointerLeave);
  on(menuBar, "click", onMenuClick);
  on(toolPalette, "click", onPaletteClick);
  on(shapeOptionList, "click", onShapeOptionClick);
  on(btnShapeClose, "click", onShapeDialogCancel);
  on(exportDialogBackdrop, "pointerdown", onExportBackdropPointerDown);
  on(exportDialogForm, "submit", onExportDialogSubmit);
  on(btnExportClose, "click", onExportDialogCancel);
  on(btnExportCancel, "click", onExportDialogCancel);
  on(loadFileInput, "change", onLoadFileChange);
  on(window, "pointerdown", onWindowPointerDown);
  on(window, "keydown", onKeyDown);

  function init() {
    syncActiveDesignRefs();
    setPendingTilingOption(state.pendingTilingId);
    syncShapeDialog();
    syncExportDialog();
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
