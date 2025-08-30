(function () {
  'use strict';

  const PLUGIN_ID = kintone.$PLUGIN_ID;
  const savedConfig = kintone.plugin.app.getConfig(PLUGIN_ID) || {};

  const API_KEY = savedConfig.apiKeyCommon || '';
  const WALK_KEYWORD = '徒歩';
  const SHIP_KEYWORD = '航路';
  const MARKER_ICONS = {
    bus:  "https://maps.google.com/mapfiles/ms/icons/bus.png",
    walk: "https://raw.githubusercontent.com/200236hammer/-/refs/heads/main/walk.png",
    ship: "https://raw.githubusercontent.com/200236hammer/-/refs/heads/main/ship.png"
  };
  const RAINBOW_COLORS = ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#4B0082", "#8B00FF"];

  function loadGoogleMaps(callback) {
    if (window.google && window.google.maps) callback();
    else {
      const script = document.createElement('script');
      script.src = 'https://maps.googleapis.com/maps/api/js?key=' + API_KEY + '&libraries=geometry';
      script.onload = callback;
      document.body.appendChild(script);
    }
  }

  function isNear(a, b, tol) {
    return Math.abs(a.lat - b.lat) < tol && Math.abs(a.lng - (b.lng || b.lon)) < tol;
  }

  async function fetchRecordLink(startStop, endStop) {
    try {
      const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
        app: kintone.app.getId(),
        query: `boarding_bus_stop = "${startStop}" and alighting_bus_stop = "${endStop}" limit 1`
      });
      if (resp.records.length > 0) {
        const id = resp.records[0].$id.value;
        return `<a href="/k/${kintone.app.getId()}/show#record=${id}" target="_blank">詳細レコード</a>`;
      }
    } catch (err) {
      console.error(err);
    }
    return '';
  }

  async function loadGpxAndDraw(map, gpxUrl) {
    try {
      const resp = await fetch(gpxUrl);
      if (!resp.ok) throw new Error("HTTPエラー " + resp.status);
      const gpxText = await resp.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(gpxText, "application/xml");

      // --- wpt 読み込み ---
      const wpts = [];
      const wptNodes = xml.getElementsByTagName("wpt");
      for (let i = 0; i < wptNodes.length; i++) {
        const nameNode = wptNodes[i].getElementsByTagName("name")[0];
        const descNode = wptNodes[i].getElementsByTagName("desc")[0];
        const nameRaw = nameNode ? nameNode.textContent : "";
        const name = nameRaw.replace(/［.*?］/g, '').replace(/\[.*?\]/g, '').trim();
        const desc = descNode ? descNode.textContent : "";

        const type = nameRaw.includes(WALK_KEYWORD) ? "walk" :
                     nameRaw.includes(SHIP_KEYWORD) ? "ship" : "bus";

        const lat = parseFloat(wptNodes[i].getAttribute("lat"));
        const lon = parseFloat(wptNodes[i].getAttribute("lon"));
        wpts.push({ lat, lon, name, nameRaw, desc, type });
      }

      // --- trkpt / rtept ---
      let pts = xml.getElementsByTagName("trkpt");
      if (pts.length === 0) pts = xml.getElementsByTagName("rtept");
      const routePoints = Array.from(pts).map(p => ({
        lat: parseFloat(p.getAttribute("lat")),
        lng: parseFloat(p.getAttribute("lon"))
      }));
      if (routePoints.length === 0) return;

      const bounds = new google.maps.LatLngBounds();

      // --- マーカー ---
      wpts.forEach(wpt => {
        const marker = new google.maps.Marker({
          position: { lat: wpt.lat, lng: wpt.lon },
          map: map,
          title: wpt.name,
          icon: { url: MARKER_ICONS[wpt.type], scaledSize: new google.maps.Size(32, 32) }
        });

        marker.addListener('click', async () => {
          const recordLink = await fetchRecordLink(wpt.name, wpt.name);
          const infoContent = `<div>
            <strong>${wpt.name}</strong><br>${wpt.type}<br>${wpt.desc}<br>${recordLink}
          </div>`;
          new google.maps.InfoWindow({ content: infoContent }).open(map, marker);
        });

        bounds.extend(new google.maps.LatLng(wpt.lat, wpt.lon));
      });

      // --- 区間描画 ---
      const tol = 1e-4;
      let colorIndex = 0;
      let cursor = 0;
      for (let i = 0; i < wpts.length - 1; i += 2) {
        const start = wpts[i], end = wpts[i + 1];
        let startIdx = routePoints.findIndex((p, j) => j >= cursor && isNear(p, start, tol));
        if (startIdx === -1) continue;
        let endIdx = routePoints.findIndex((p, j) => j >= startIdx && isNear(p, end, tol));
        if (endIdx === -1 || endIdx - startIdx < 1) { cursor = startIdx + 1; continue; }

        const segmentPoints = routePoints.slice(startIdx, endIdx + 1);
        const startLatLng = new google.maps.LatLng(segmentPoints[0].lat, segmentPoints[0].lng);
        const endLatLng = new google.maps.LatLng(segmentPoints[segmentPoints.length - 1].lat, segmentPoints[segmentPoints.length - 1].lng);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(startLatLng, endLatLng);

        let lineColor = RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length];
        colorIndex++;
        let strokeOpacity = 1, icons = [];

        if (start.type === "walk") { strokeOpacity = 0; icons = [{ icon: { path: "M 0,-1 0,1", strokeOpacity:1, strokeWeight:4, strokeColor:lineColor }, offset:"0", repeat:"12px" }]; }
        if (start.type === "ship") { strokeOpacity = 0; icons = [{ icon: { path: "M 0,0 Q 2,2 4,0 T 8,0", strokeOpacity:1, strokeWeight:3, strokeColor:lineColor, scale:1 }, offset:"0", repeat:"12px" }]; }
        if (distance < 100) { lineColor = "#000"; strokeOpacity = 1; icons = []; }

        const polyline = new google.maps.Polyline({
          path: segmentPoints, map: map, strokeColor: lineColor, strokeOpacity, strokeWeight: 4, icons
        });

        polyline.addListener('click', async (e) => {
          const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
            app: kintone.app.getId(),
            query: `boarding_bus_stop = "${start.name}" and alighting_bus_stop = "${end.name}" limit 1`
          });
          let infoContent = '<div>該当データなし</div>';
          if (resp.records.length > 0) {
            const r = resp.records[0];
            const distanceKm = (distance / 1000).toFixed(1);
            infoContent = `<div>
              <strong>区間情報</strong><br>区分: ${start.type}<br>
              距離: ${distanceKm}km<br>
              <a href="/k/${kintone.app.getId()}/show#record=${r.$id.value}" target="_blank">詳細レコード</a>
            </div>`;
          }
          new google.maps.InfoWindow({ content: infoContent, position: e.latLng }).open(map);
        });

        segmentPoints.forEach(p => bounds.extend(p));
        cursor = endIdx;
      }

      map.fitBounds(bounds);

    } catch (err) {
      console.error("GPX読み込み失敗:", err);
    }
  }

  function createMap(container, gpxUrl) {
    const map = new google.maps.Map(container, { center: { lat: 33.829, lng: 130.743 }, zoom: 12 });
    loadGpxAndDraw(map, gpxUrl);
  }

  // --- レコード詳細 ---
  const recordConfigs = savedConfig.recordConfigs ? JSON.parse(savedConfig.recordConfigs) : [];
  recordConfigs.forEach(cfg => {
    const recId = cfg.recordOrViewId;
    const gpxUrls = cfg.gpxUrls || [];
    if (!recId) return;
    kintone.events.on('app.record.detail.show', function (event) {
      if (event.record.$id.value !== recId) return;
      loadGoogleMaps(() => {
        const spaceEl = kintone.app.record.getSpaceElement('map_space');
        if (!spaceEl) return;
        spaceEl.style.height = '500px';
        gpxUrls.forEach(url => createMap(spaceEl, url));
      });
    });
  });

  // --- 一覧 ---
  const listConfigs = savedConfig.listConfigs ? JSON.parse(savedConfig.listConfigs) : [];
  listConfigs.forEach(cfg => {
    const viewId = Number(cfg.recordOrViewId);
    const gpxUrls = cfg.gpxUrls || [];
    if (!viewId) return;
    kintone.events.on('app.record.index.show', function (event) {
      if (event.viewId !== viewId) return;
      loadGoogleMaps(() => {
        let mapContainer = document.getElementById('list-map');
        if (!mapContainer) {
          mapContainer = document.createElement('div');
          mapContainer.id = 'list-map';
          mapContainer.style.height = '500px';
          mapContainer.style.marginBottom = '20px';
          kintone.app.getHeaderSpaceElement().appendChild(mapContainer);
        }
        gpxUrls.forEach(url => createMap(mapContainer, url));
      });
    });
  });

})();
