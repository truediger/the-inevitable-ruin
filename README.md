# the-inevitable-ruin

3D endless tower of monsters — Three.js world with billboard sprite characters.

## Running

WebGL textures are blocked when opening `index.html` from `file://`. Serve the folder over HTTP:

```
npx serve .
# or
python -m http.server 8000
```

Then open http://localhost:8000 (or the port `serve` prints).
