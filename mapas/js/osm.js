/* Captura de mapa do OpenStreetMap como mapa base (opcional, precisa de internet).
   O Leaflet só é carregado quando a janela é aberta: o resto do editor segue offline. */
(function () {
  'use strict';

  const App = window.App;
  const U = App.util;
  const M = App.model;

  const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  const MAX_SIDE = 5000;

  const SOURCES = {
    osm: { label: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, retina: false, attribution: '© colaboradores do OpenStreetMap' }
  };

  let leafletPromise = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = LEAFLET_JS;
      s.onload = () => resolve(window.L);
      s.onerror = () => { leafletPromise = null; reject(new Error('Sem conexão para carregar o mapa.')); };
      document.head.appendChild(s);
    });
    return leafletPromise;
  }

  function tileUrl(src, z, x, y) {
    return src.url.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{r}', src.retina ? '@2x' : '');
  }

  function loadTile(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function capture(map, src, frameEl, quality, onProgress) {
    const L = window.L;
    const box = map.getContainer().getBoundingClientRect();
    const fr = frameEl.getBoundingClientRect();
    const left = fr.left - box.left, top = fr.top - box.top, w = fr.width, h = fr.height;
    if (w < 40 || h < 20) throw new Error('A janela do mapa ainda não terminou de abrir. Tente de novo.');
    // Captura com margem em volta do cartão, para poder reenquadrar depois.
    const mx = w * 0.2, my = h * 0.2;
    const nw = map.containerPointToLatLng(L.point(left - mx, top - my));
    const se = map.containerPointToLatLng(L.point(left + w + mx, top + h + my));
    const fnw = map.containerPointToLatLng(L.point(left, top));
    const fse = map.containerPointToLatLng(L.point(left + w, top + h));

    let z = Math.min(src.maxZoom, Math.round(map.getZoom()) + (quality === 'high' ? 1 : 0));
    const ts = src.retina ? 2 : 1;
    let p1, p2;
    for (;;) {
      p1 = map.project(nw, z);
      p2 = map.project(se, z);
      if (Math.max(p2.x - p1.x, p2.y - p1.y) * ts <= MAX_SIDE || z <= 1) break;
      z--;
    }
    const W = Math.round((p2.x - p1.x) * ts), H = Math.round((p2.y - p1.y) * ts);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f2efe9';
    ctx.fillRect(0, 0, W, H);

    const tiles = [];
    const n = Math.pow(2, z);
    for (let tx = Math.floor(p1.x / 256); tx <= Math.floor(p2.x / 256); tx++) {
      for (let ty = Math.floor(p1.y / 256); ty <= Math.floor(p2.y / 256); ty++) {
        if (ty < 0 || ty >= n) continue;
        tiles.push({ tx, ty });
      }
    }
    let done = 0, failed = 0;
    const queue = tiles.slice();
    const worker = async () => {
      while (queue.length) {
        const t = queue.shift();
        const x = ((t.tx % n) + n) % n;
        const img = await loadTile(tileUrl(src, z, x, t.ty));
        if (img) ctx.drawImage(img, (t.tx * 256 - p1.x) * ts, (t.ty * 256 - p1.y) * ts, 256 * ts, 256 * ts);
        else failed++;
        done++;
        onProgress(done / tiles.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (failed > tiles.length * 0.3) throw new Error('Não foi possível baixar parte do mapa. Verifique a conexão.');

    const f1 = map.project(fnw, z), f2 = map.project(fse, z);
    const frame = { x: (f1.x - p1.x) * ts, y: (f1.y - p1.y) * ts, w: (f2.x - f1.x) * ts, h: (f2.y - f1.y) * ts };
    let dataUrl;
    try { dataUrl = canvas.toDataURL('image/jpeg', 0.9); }
    catch (e) { throw new Error('O servidor de mapas não permitiu a captura. Tente novamente.'); }
    return { dataUrl, width: W, height: H, frame, attribution: src.attribution };
  }

  async function open() {
    const prefs = App.storage.getPrefs();
    const body = document.createElement('div');
    body.innerHTML =
      '<form class="osm-search"><input class="input" name="q" placeholder="Buscar endereço, bairro ou cidade…" autocomplete="off" /><button class="btn primary" type="submit">' + App.ui.icon('search') + '<span class="hide-xs">Buscar</span></button>' +
      '<button class="btn" type="button" data-locate title="Usar minha localização">' + App.ui.icon('target') + '</button></form>' +
      '<div class="osm-results" hidden></div>' +
      '<div class="osm-map-wrap"><div class="osm-map"></div><div class="osm-frame"><span>Cartão</span></div></div>' +
      '<div class="osm-options"><label>Detalhe <select class="select" name="quality" style="width:auto;margin-left:6px"><option value="high">Alto (recomendado)</option><option value="normal">Normal</option></select></label>' +
      '<span style="color:var(--muted)">Posicione a região dentro do retângulo. Uma margem em volta também é capturada.</span></div>' +
      '<div class="osm-progress" hidden><div></div></div>';

    const m = App.ui.modal({ title: 'Buscar no mapa', body, className: 'osm-dialog' });
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = 'Cancelar';
    cancel.onclick = () => m.close();
    const use = document.createElement('button');
    use.className = 'btn primary';
    use.innerHTML = App.ui.icon('check') + 'Usar esta região';
    m.foot.append(cancel, use);

    const mapEl = body.querySelector('.osm-map');
    const frameEl = body.querySelector('.osm-frame');
    const results = body.querySelector('.osm-results');
    const progress = body.querySelector('.osm-progress');

    let L;
    try { L = await loadLeaflet(); }
    catch (e) {
      mapEl.innerHTML = '<div class="empty" style="padding-top:80px">' + App.ui.icon('globe') + '<strong>Sem conexão</strong><p>A busca no mapa precisa de internet. Você ainda pode usar um print ou imagem.</p></div>';
      use.disabled = true;
      return;
    }
    if (!document.body.contains(m.dlg)) return;

    const view = prefs.osmView || { lat: -15.78, lng: -47.93, z: 4 };
    const map = L.map(mapEl, { zoomControl: true, attributionControl: true }).setView([view.lat, view.lng], view.z);
    const src = SOURCES.osm;
    L.tileLayer(src.url, { maxZoom: src.maxZoom, attribution: src.attribution }).addTo(map);

    const sizeFrame = () => {
      const r = mapEl.getBoundingClientRect();
      const ratio = M.frameRatio(App.store.doc);
      let w = r.width * 0.78, h = w / ratio;
      if (h > r.height * 0.78) { h = r.height * 0.78; w = h * ratio; }
      frameEl.style.width = w + 'px';
      frameEl.style.height = h + 'px';
      map.invalidateSize();
    };
    sizeFrame();
    requestAnimationFrame(sizeFrame);
    const ro = new ResizeObserver(sizeFrame);
    ro.observe(mapEl);
    m.dlg.addEventListener('close', () => { ro.disconnect(); map.remove(); });

    const form = body.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = form.q.value.trim();
      if (!q) return;
      results.hidden = false;
      results.innerHTML = '<button disabled>Buscando…</button>';
      try {
        const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=pt-BR&q=' + encodeURIComponent(q));
        const list = await res.json();
        if (!list.length) { results.innerHTML = '<button disabled>Nenhum resultado. Tente incluir a cidade.</button>'; return; }
        results.innerHTML = list.map((r, i) => '<button type="button" data-i="' + i + '">' + U.escapeHtml(r.display_name) + '</button>').join('');
        results.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
          const r = list[+b.dataset.i];
          const bb = r.boundingbox.map(Number);
          map.fitBounds([[bb[0], bb[2]], [bb[1], bb[3]]], { maxZoom: 17 });
          results.hidden = true;
        }));
      } catch (err) {
        results.innerHTML = '<button disabled>Falha na busca. Verifique a conexão.</button>';
      }
    });

    body.querySelector('[data-locate]').addEventListener('click', () => {
      if (!navigator.geolocation) return App.ui.toast('Localização indisponível neste navegador.');
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 17),
        () => App.ui.toast('Não foi possível obter sua localização.'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    use.addEventListener('click', async () => {
      if (map.getZoom() < 12) { App.ui.toast('Aproxime mais o mapa: escolha a região das ruas do território.'); return; }
      use.disabled = true;
      progress.hidden = false;
      const bar = progress.firstElementChild;
      try {
        const out = await capture(map, src, frameEl, body.querySelector('[name=quality]').value, (p) => { bar.style.width = Math.round(p * 100) + '%'; });
        const c = map.getCenter();
        App.storage.setPrefs({ osmView: { lat: c.lat, lng: c.lng, z: map.getZoom() } });
        m.close();
        await App.actions.setBaseImage(out.dataUrl, { attribution: out.attribution, frame: out.frame, width: out.width, height: out.height });
      } catch (err) {
        App.ui.toast(err.message, { type: 'error' });
        use.disabled = false;
        progress.hidden = true;
      }
    });
  }

  App.osm = { open };
})();
