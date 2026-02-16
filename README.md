# Tile Designer

Design geometric tile patterns with lines, circles, fills, and multi-shape tilings, then export seamless wallpapers, SVG tiles, and JSON project files.

![Tile Designer screenshot](./tiledesigner.png)

## Features

- Tile shapes and tilings: triangle, square, hexagon, 3.4.6.4, 4.8^2, and 3^2.4.3.4
- Drawing tools: select, line, circle, fill, delete
- Editing: undo, redo, clear
- Snap controls for grid and tool points
- Export wallpaper PNG
- Export tile SVG
- Save/load project JSON

## Run locally

This app uses Preact with import maps and no build step.

1. Start any static file server from this folder.
2. Open `index.html` in your browser via that server.

Example:

```bash
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000).

## License

MIT. See [LICENSE](./LICENSE).
