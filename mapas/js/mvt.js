/* Leitor mínimo de Mapbox Vector Tiles (protobuf), sem dependências.
   Devolve { camada: [{ type, props, geom }] } com coordenadas locais do tile (0..extent). */
(function () {
  'use strict';

  const App = window.App || (window.App = {});

  function decode(buffer) {
    const buf = new Uint8Array(buffer);
    let pos = 0;

    const varint = () => {
      let result = 0, shift = 0, b;
      do {
        b = buf[pos++];
        if (shift < 28) result |= (b & 0x7f) << shift;
        else result += (b & 0x7f) * Math.pow(2, shift);
        shift += 7;
      } while (b & 0x80);
      return result;
    };
    const zigzag = (n) => (n % 2 ? -(n + 1) / 2 : n / 2);
    const skip = (wire) => {
      if (wire === 0) varint();
      else if (wire === 1) pos += 8;
      else if (wire === 2) { const len = varint(); pos += len; }
      else if (wire === 5) pos += 4;
    };
    const text = new TextDecoder();
    const str = (end) => text.decode(buf.subarray(pos, (pos = end)));

    function readValue(end) {
      let v = null;
      while (pos < end) {
        const key = varint(), field = key >> 3, wire = key & 7;
        if (field === 1) { const len = varint(); v = str(pos + len); }
        else if (field === 2) { v = new DataView(buf.buffer, buf.byteOffset + pos, 4).getFloat32(0, true); pos += 4; }
        else if (field === 3) { v = new DataView(buf.buffer, buf.byteOffset + pos, 8).getFloat64(0, true); pos += 8; }
        else if (field === 4 || field === 5) v = varint();
        else if (field === 6) v = zigzag(varint());
        else if (field === 7) v = !!varint();
        else skip(wire);
      }
      return v;
    }

    function packed(end) {
      const out = [];
      while (pos < end) out.push(varint());
      return out;
    }

    function geometry(cmds, type) {
      const rings = [];
      let ring = null, x = 0, y = 0, i = 0;
      while (i < cmds.length) {
        const c = cmds[i++], id = c & 7, count = c >> 3;
        if (id === 1 || id === 2) {
          for (let k = 0; k < count; k++) {
            x += zigzag(cmds[i++]);
            y += zigzag(cmds[i++]);
            if (id === 1) { ring = []; rings.push(ring); }
            ring.push([x, y]);
          }
        } else if (id === 7 && ring && ring.length) {
          ring.push([ring[0][0], ring[0][1]]);
        }
      }
      return type === 1 ? rings.flat() : rings;
    }

    function readLayer(end) {
      const keys = [], values = [], raw = [];
      let name = '', extent = 4096;
      while (pos < end) {
        const key = varint(), field = key >> 3, wire = key & 7;
        if (field === 1) { const len = varint(); name = str(pos + len); }
        else if (field === 2) { const len = varint(); raw.push([pos, pos + len]); pos += len; }
        else if (field === 3) { const len = varint(); keys.push(str(pos + len)); }
        else if (field === 4) { const len = varint(); values.push(readValue(pos + len)); }
        else if (field === 5) extent = varint();
        else skip(wire);
      }
      const after = pos;
      const features = raw.map(([s, e]) => {
        pos = s;
        let tags = [], type = 0, cmds = [];
        while (pos < e) {
          const key = varint(), field = key >> 3, wire = key & 7;
          if (field === 2) { const len = varint(); tags = packed(pos + len); }
          else if (field === 3) type = varint();
          else if (field === 4) { const len = varint(); cmds = packed(pos + len); }
          else skip(wire);
        }
        const props = {};
        for (let t = 0; t < tags.length; t += 2) props[keys[tags[t]]] = values[tags[t + 1]];
        return { type, props, geom: geometry(cmds, type) };
      });
      pos = after;
      return { name, extent, features };
    }

    const layers = {};
    while (pos < buf.length) {
      const key = varint(), field = key >> 3, wire = key & 7;
      if (field === 3) {
        const len = varint();
        const layer = readLayer(pos + len);
        layers[layer.name] = layer;
      } else skip(wire);
    }
    return layers;
  }

  App.mvt = { decode };
})();
