import { h, render } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { mountDesigner } from "./designer.js";

const LUCIDE_BASE = "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons";

function withClass(base, props = {}) {
  return {
    ...props,
    class: `${base}${props.class ? ` ${props.class}` : ""}`,
  };
}

function icon(name, className = "") {
  return h("img", {
    class: `menu-icon${className ? ` ${className}` : ""}`,
    src: `${LUCIDE_BASE}/${name}.svg`,
    alt: "",
    "aria-hidden": "true",
    draggable: "false",
  });
}

function menuSelectableItem(props, label, options = {}) {
  const { iconName = null, iconClass = "", hotkey = "" } = options;
  return h(
    "div",
    withClass("menu-item selectable", props),
    h("span", { class: "menu-checkmark", "aria-hidden": "true" }, "✓"),
    iconName ? icon(iconName, iconClass) : h("span", { class: "menu-icon-slot", "aria-hidden": "true" }),
    h("span", { class: "menu-label" }, label),
    h("span", { class: "menu-hotkey", "aria-hidden": hotkey ? "false" : "true" }, hotkey)
  );
}

function menuActionItem(props, label, options = {}) {
  const { iconName = null, iconClass = "", hotkey = "" } = options;
  return h(
    "div",
    withClass("menu-item action", props),
    h("span", { class: "menu-checkmark blank", "aria-hidden": "true" }, ""),
    iconName ? icon(iconName, iconClass) : h("span", { class: "menu-icon-slot", "aria-hidden": "true" }),
    h("span", { class: "menu-label" }, label),
    h("span", { class: "menu-hotkey", "aria-hidden": hotkey ? "false" : "true" }, hotkey)
  );
}

function paletteButton(props, iconName, label) {
  return h(
    "button",
    withClass("palette-btn", {
      ...props,
      type: "button",
      title: label,
      "aria-label": label,
    }),
    icon(iconName)
  );
}

function shapeGlyph(shape) {
  if (shape === "triangle") {
    return h(
      "svg",
      { class: "shape-option-glyph", viewBox: "0 0 100 100", "aria-hidden": "true" },
      h("polygon", { points: "50,12 12,88 88,88" })
    );
  }
  if (shape === "square") {
    return h(
      "svg",
      { class: "shape-option-glyph", viewBox: "0 0 100 100", "aria-hidden": "true" },
      h("rect", { x: "18", y: "18", width: "64", height: "64" })
    );
  }
  if (shape === "octagon") {
    return h(
      "svg",
      { class: "shape-option-glyph", viewBox: "0 0 100 100", "aria-hidden": "true" },
      h("polygon", { points: "50,10 78,22 90,50 78,78 50,90 22,78 10,50 22,22" })
    );
  }
  return h(
    "svg",
    { class: "shape-option-glyph", viewBox: "0 0 100 100", "aria-hidden": "true" },
    h("polygon", { points: "50,10 82,28 82,72 50,90 18,72 18,28" })
  );
}

function shapeOption(props, shapes, label) {
  return h(
    "button",
    withClass("shape-option", {
      ...props,
      type: "button",
      "aria-label": label,
      title: label,
    }),
    h(
      "span",
      { class: "shape-option-cluster", "aria-hidden": "true" },
      ...shapes.map((shape, idx) => h("span", { class: "shape-option-glyph-wrap", key: `${shape}-${idx}` }, shapeGlyph(shape)))
    ),
    h("span", { class: "sr-only" }, label)
  );
}

function App() {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!rootRef.current) return undefined;
    return mountDesigner(rootRef.current);
  }, []);

  return h(
    "div",
    { ref: rootRef, class: "app-root" },
    h("canvas", { id: "c" }),
    h(
      "header",
      { id: "menuBar", role: "menubar", "aria-label": "Application menu" },
      h(
        "div",
        { class: "menu-root", "data-menu": "file" },
        h(
          "div",
          { class: "menu-trigger", "data-menu-trigger": "file", role: "menuitem", tabIndex: 0, "aria-haspopup": "true" },
          "File"
        ),
        h(
          "div",
          { class: "menu-panel", role: "menu", "aria-label": "File menu" },
          menuActionItem(
            { id: "itemNew", "data-action": "new", role: "menuitem" },
            "New",
            { iconName: "file-plus-2" }
          )
        )
      ),
      h(
        "div",
        { class: "menu-root", "data-menu": "tool" },
        h(
          "div",
          { class: "menu-trigger", "data-menu-trigger": "tool", role: "menuitem", tabIndex: 0, "aria-haspopup": "true" },
          "Tool"
        ),
        h(
          "div",
          { class: "menu-panel", id: "toolSeg", role: "menu", "aria-label": "Tool menu" },
          menuSelectableItem(
            { "data-tool": "select", role: "menuitemradio", "aria-checked": "false" },
            "Select",
            { iconName: "mouse-pointer-2", hotkey: "1" }
          ),
          menuSelectableItem(
            { "data-tool": "line", role: "menuitemradio", "aria-checked": "true", class: "selected" },
            "Line",
            { iconName: "slash", hotkey: "2" }
          ),
          menuSelectableItem(
            { "data-tool": "circle", role: "menuitemradio", "aria-checked": "false" },
            "Circle",
            { iconName: "circle", hotkey: "3" }
          ),
          menuSelectableItem(
            { "data-tool": "fill", role: "menuitemradio", "aria-checked": "false" },
            "Fill",
            { iconName: "paint-bucket", hotkey: "4" }
          ),
          menuSelectableItem(
            { "data-tool": "delete", role: "menuitemradio", "aria-checked": "false" },
            "Delete",
            { iconName: "eraser", hotkey: "D" }
          ),
          h("hr", { class: "menu-sep" }),
          menuSelectableItem(
            { id: "itemToolSnap", "data-toggle": "tool-snap", role: "menuitemcheckbox", "aria-checked": "true", class: "selected" },
            "Snap"
          )
        )
      ),
      h(
        "div",
        { class: "menu-root", "data-menu": "edit" },
        h(
          "div",
          { class: "menu-trigger", "data-menu-trigger": "edit", role: "menuitem", tabIndex: 0, "aria-haspopup": "true" },
          "Edit"
        ),
        h(
          "div",
          { class: "menu-panel", role: "menu", "aria-label": "Edit menu" },
          menuActionItem(
            { id: "itemUndo", "data-action": "undo", role: "menuitem" },
            "Undo",
            { iconName: "undo-2", hotkey: "Z" }
          ),
          menuActionItem(
            { id: "itemRedo", "data-action": "redo", role: "menuitem" },
            "Redo",
            { iconName: "redo-2", hotkey: "Y" }
          ),
          h("hr", { class: "menu-sep" }),
          menuActionItem(
            { id: "itemClear", "data-action": "clear", role: "menuitem", class: "danger" },
            "Clear",
            { iconName: "trash-2", hotkey: "X" }
          )
        )
      ),
      h(
        "div",
        { class: "menu-root", "data-menu": "grid" },
        h(
          "div",
          { class: "menu-trigger", "data-menu-trigger": "grid", role: "menuitem", tabIndex: 0, "aria-haspopup": "true" },
          "Grid"
        ),
        h(
          "div",
          { class: "menu-panel grid-panel", role: "menu", "aria-label": "Grid menu" },
          menuSelectableItem(
            { id: "itemGrid", "data-toggle": "grid", role: "menuitemcheckbox", "aria-checked": "false" },
            "Grid on"
          ),
          menuSelectableItem(
            { id: "itemSnap", "data-toggle": "snap", role: "menuitemcheckbox", "aria-checked": "false" },
            "Snap"
          ),
          h("hr", { class: "menu-sep" }),
          h("div", { class: "menu-section-label" }, "Size"),
          menuSelectableItem(
            { "data-grid-size": "48", role: "menuitemradio", "aria-checked": "false" },
            "XS"
          ),
          menuSelectableItem(
            { "data-grid-size": "24", role: "menuitemradio", "aria-checked": "false" },
            "S"
          ),
          menuSelectableItem(
            { "data-grid-size": "16", role: "menuitemradio", "aria-checked": "true", class: "selected" },
            "M"
          ),
          menuSelectableItem(
            { "data-grid-size": "12", role: "menuitemradio", "aria-checked": "false" },
            "L"
          ),
          menuSelectableItem(
            { "data-grid-size": "8", role: "menuitemradio", "aria-checked": "false" },
            "XL"
          )
        )
      ),
      h(
        "div",
        { class: "menu-root", "data-menu": "view" },
        h(
          "div",
          { class: "menu-trigger", "data-menu-trigger": "view", role: "menuitem", tabIndex: 0, "aria-haspopup": "true" },
          "View"
        ),
        h(
          "div",
          { class: "menu-panel", role: "menu", "aria-label": "View menu" },
          menuSelectableItem(
            { id: "itemViewTools", "data-toggle": "view-tools", role: "menuitemcheckbox", "aria-checked": "true", class: "selected" },
            "Tools"
          )
        )
      )
    ),
    h(
      "div",
      { id: "shapeDialogBackdrop", class: "shape-dialog-backdrop open", role: "presentation" },
      h(
        "div",
        { id: "shapeDialog", class: "shape-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "shapeDialogTitle" },
        h(
          "div",
          { class: "shape-dialog-head" },
          h("h2", { id: "shapeDialogTitle" }, "Tile Designer"),
          h("button", { id: "btnShapeClose", class: "shape-dialog-close", type: "button", "aria-label": "Close shape picker" }, icon("x"))
        ),
        h("p", { class: "shape-dialog-copy" }, "Pick your tile shape"),
        h(
          "div",
          { id: "shapeOptionList", class: "shape-option-list" },
          shapeOption(
            { "data-shape-option": "triangle", class: "selected", "aria-pressed": "true" },
            ["triangle"],
            "Triangle"
          ),
          shapeOption(
            { "data-shape-option": "square", "aria-pressed": "false" },
            ["square"],
            "Square"
          ),
          shapeOption(
            { "data-shape-option": "hexagon", "aria-pressed": "false" },
            ["hexagon"],
            "Hexagon"
          ),
          shapeOption(
            { "data-shape-option": "tiling-3464", "aria-pressed": "false" },
            ["hexagon", "triangle", "square"],
            "3.4.6.4"
          ),
          shapeOption(
            { "data-shape-option": "tiling-48-2", "aria-pressed": "false" },
            ["octagon", "square"],
            "4,8^2"
          ),
          shapeOption(
            { "data-shape-option": "tiling-33-434", "aria-pressed": "false" },
            ["square", "triangle"],
            "3^2,4,3,4"
          )
        )
      )
    ),
    h(
      "aside",
      { id: "toolPalette", class: "tool-palette", "aria-label": "Tool palette" },
      paletteButton({ "data-tool": "select" }, "mouse-pointer-2", "Select (1)"),
      paletteButton({ "data-tool": "line", class: "selected" }, "slash", "Line (2)"),
      paletteButton({ "data-tool": "circle" }, "circle", "Circle (3)"),
      paletteButton({ "data-tool": "fill" }, "paint-bucket", "Fill (4)"),
      paletteButton({ "data-tool": "delete" }, "eraser", "Delete (D)"),
      h("div", { class: "palette-sep" }),
      paletteButton({ id: "palUndo", "data-palette-action": "undo" }, "undo-2", "Undo (Z)"),
      paletteButton({ id: "palRedo", "data-palette-action": "redo" }, "redo-2", "Redo (Y)")
    )
  );
}

render(h(App), document.getElementById("app"));
