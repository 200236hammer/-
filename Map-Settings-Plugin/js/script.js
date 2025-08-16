(function () {
  'use strict';

  var API_KEY = 'AIzaSyANAWkn3QQfslDYGqzTYRhLBWPWeK1FyDE';
  var GPX_URL = 'https://raw.githubusercontent.com/200236hammer/-/refs/heads/main/bus_trip1_nakao_to_kurashiki_trace.gpx';
  var TARGET_RECORD_ID = '3';
  var TARGET_VIEW_ID = 8251828;

  var WALK_KEYWORD = '徒歩';
  var SHIP_KEYWORD = '航路';

  var MARKER_ICONS = {
    bus:  "https://maps.google.com/mapfiles/ms/icons/bus.png",
    walk: "https://raw.githubusercontent.com/200236hammer/-/refs/heads/main/walk.png",
    ship: "https://raw.githubusercontent.com/200236hammer/-/refs/heads/main/ship.png"
  };

  // 虹色（順番適用）
  var RAINBOW_COLORS = ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#4B0082", "#8B00FF"];

  // --- レコードリンク取得（同一アプリ） ---
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
      console.error("レコード取得エラー:", err);
    }
    return '';
  }

  function loadGoogleMaps(callback) {
    if (window.google && window.google.maps) callback();
    else {
      var script = document.createElement('script');
      script.src = 'https://maps.googleapis.com/maps/api/js?key=' + API_KEY + '&libraries=geometry';
      script.onload = callback;
      document.body.appendChild(script);
    }
  }

  // 近傍一致（ルート点⇔wpt照合用）
  function isNear(a, b, tol) {
    return Math.abs(a.lat - b.lat) < tol && Math.abs(a.lng - (b.lng || b.lon)) < tol;
  }

  async function loadGpxAndDraw(map, url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("HTTPエラー " + response.status);
      const gpxText = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(gpxText, "application/xml");

      // --- wpt 読み込み（表示名は［徒歩］［航路］除去、タイプ判定は raw 名で） ---
      const wpts = [];
      const wptNodes = xml.getElementsByTagName("wpt");
      for (let i = 0; i < wptNodes.length; i++) {
        const nameNode = wptNodes[i].getElementsByTagName("name")[0];
        const descNode = wptNodes[i].getElementsByTagName("desc")[0];

        const nameRaw = nameNode ? nameNode.textContent : "";
        const name = nameRaw.replace(/［.*?］/g, '').replace(/\[.*?\]/g, '').trim(); // 全角/半角対応で除去
        const desc = descNode ? descNode.textContent : "";

        const type =
          nameRaw.includes(WALK_KEYWORD) ? "walk" :
          nameRaw.includes(SHIP_KEYWORD) ? "ship" : "bus";

        const lat = parseFloat(wptNodes[i].getAttribute("lat"));
        const lon = parseFloat(wptNodes[i].getAttribute("lon"));
        wpts.push({ lat, lon, name, nameRaw, desc, type });
      }

      // --- トラックポイント（道路沿い） ---
      let pts = xml.getElementsByTagName("trkpt");
      if (pts.length === 0) pts = xml.getElementsByTagName("rtept");
      const routePoints = [];
      for (let i = 0; i < pts.length; i++) {
        const lat = parseFloat(pts[i].getAttribute("lat"));
        const lon = parseFloat(pts[i].getAttribute("lon"));
        routePoints.push({ lat, lng: lon });
      }
      if (routePoints.length === 0) return;

      const bounds = new google.maps.LatLngBounds();

      // --- マーカー（wpt） ---
      wpts.forEach(wpt => {
        const marker = new google.maps.Marker({
          position: { lat: wpt.lat, lng: wpt.lon },
          map: map,
          title: wpt.name,
          icon: { url: MARKER_ICONS[wpt.type], scaledSize: new google.maps.Size(32, 32) }
        });

        marker.addListener('click', async () => {
          // 単一バス停クリック時は同名で検索（必要に応じて拡張可）
          const recordLink = await fetchRecordLink(wpt.name, wpt.name);
          const infoContent = `<div>
            <strong>${wpt.name}</strong><br>${wpt.type}<br>${wpt.desc}<br>${recordLink}
          </div>`;
          const info = new google.maps.InfoWindow({ content: infoContent });
          info.open(map, marker);
        });

        bounds.extend(new google.maps.LatLng(wpt.lat, wpt.lon));
      });

      // --- 区間描画：wpt を (0,1), (2,3), ... のペアで処理 ---
      const tol = 1e-4;
      let colorIndex = 0;
      let cursor = 0; // trkpt 走査位置（前方のみ）

      for (let i = 0; i < wpts.length - 1; i += 2) {
        const start = wpts[i];
        const end   = wpts[i + 1];

        // ルート上で start / end のインデックスを順に探す（前方一致）
        let startIdx = -1;
        for (let j = cursor; j < routePoints.length; j++) {
          if (isNear(routePoints[j], { lat: start.lat, lon: start.lon }, tol)) {
            startIdx = j;
            break;
          }
        }
        if (startIdx === -1) continue;

        let endIdx = -1;
        for (let j = startIdx; j < routePoints.length; j++) {
          if (isNear(routePoints[j], { lat: end.lat, lon: end.lon }, tol)) {
            endIdx = j;
            break;
          }
        }
        if (endIdx === -1 || endIdx - startIdx < 1) {
          cursor = startIdx + 1; // 進めて次へ
          continue;
        }

        // 区間のポイント（道路沿い）
        const segmentPoints = routePoints.slice(startIdx, endIdx + 1);

        // 距離
        const startLatLng = new google.maps.LatLng(segmentPoints[0].lat, segmentPoints[0].lng);
        const endLatLng   = new google.maps.LatLng(segmentPoints[segmentPoints.length - 1].lat,
                                                   segmentPoints[segmentPoints.length - 1].lng);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(startLatLng, endLatLng);

        // 線色（虹色を順番に）・線種
        let lineColor = RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length];
        colorIndex++;

        // デフォルト（バス=実線）
        let strokeOpacity = 1;
        let icons = [];

        if (start.type === "walk") {
          // 破線表示：ベース線を隠し、アイコンで色付きダッシュを描画
          strokeOpacity = 0;
          icons = [{
            icon: {
              path: "M 0,-1 0,1",
              strokeOpacity: 1,
              strokeWeight: 4,
              strokeColor: lineColor
            },
            offset: "0",
            repeat: "12px"
          }];
        } else if (start.type === "ship") {
          // 波線：ベース線を隠し、波形パターンで描画
          strokeOpacity = 0;
          icons = [{
            icon: {
              path: "M 0,0 Q 2,2 4,0 T 8,0",
              strokeOpacity: 1,
              strokeWeight: 3,
              strokeColor: lineColor,
              scale: 1
            },
            offset: "0",
            repeat: "12px"
          }];
        }

        // 100m 未満は黒の実線に置換
        if (distance < 100) {
          lineColor = "#000000";
          strokeOpacity = 1;
          icons = [];
        }

        const polyline = new google.maps.Polyline({
          path: segmentPoints,
          map: map,
          strokeColor: lineColor,
          strokeOpacity: strokeOpacity,
          strokeWeight: 4,
          icons: icons
        });

        // クリック地点に InfoWindow
polyline.addListener('click', async (e) => {
  try {
    const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: kintone.app.getId(),
      query: `boarding_bus_stop = "${start.name}" and alighting_bus_stop = "${end.name}" limit 1`
    });
    let infoContent = '';
    if (resp.records.length > 0) {
      const r = resp.records[0];
      const date = r.execution_date?.value || '';
      const allCount = r.bus_count_all_days?.value || '';
      const startTime = r.boarding_time?.value || '';
      const endTime = r.alighting_time?.value || '';
      const sectionCount = r.bus_count_each_day?.value || '';
      const fare = r.fare?.value || '';
      const duration = r.boarding_duration?.value || '';
      const link = `<a href="/k/${kintone.app.getId()}/show#record=${r.$id.value}" target="_blank">詳細レコード</a>`;

      const distanceKm = (distance / 1000).toFixed(1); // kmに変換

      if (start.type === 'bus') {
        infoContent = `<div>
          <strong>区間情報</strong><br>
          区分：バス<br>
          実施日: ${date}<br>
          全体乗車本数: ${allCount}本目<br>
          区間乗車本数: ${sectionCount}本目<br>
          乗車バス停：［${startTime}］${start.name} <br>
          降車バス停：［${endTime}］${end.name}<br>
          距離: ${distanceKm}km<br>
          乗車時間: ${duration}<br>
          運賃: ${fare}円<br>
          ${link}
        </div>`;
      } else if (start.type === 'walk') {
        infoContent = `<div>
          <strong>区間情報</strong><br>
          区分：徒歩<br>
          実施日: ${date}<br>
          出発地点：［${startTime}］${start.name}<br>
          到着地点：［${endTime}］${end.name}<br>
          距離: ${distanceKm}km<br>
          所要時間: ${duration}<br>
          ${link}
        </div>`;
      } else if (start.type === 'ship') {
        infoContent = `<div>
          <strong>区間情報</strong><br>
          区分：航路<br>
          実施日: ${date}<br>
          乗船港：［${startTime}］${start.name}<br>
          下船港：［${endTime}］${end.name}<br>
          航行距離: ${distanceKm}km<br>
          乗船時間: ${duration}<br>
          運賃: ${fare}円<br>
          ${link}
        </div>`;
      }
    } else {
      infoContent = '<div>該当データなし</div>';
    }
    new google.maps.InfoWindow({ content: infoContent, position: e.latLng }).open(map);
  } catch (err) {
    console.error(err);
    new google.maps.InfoWindow({ content: '<div>該当データなし</div>', position: e.latLng }).open(map);
  }
});



        // 範囲更新とカーソル前進
        segmentPoints.forEach(p => bounds.extend(p));
        cursor = endIdx; // 次区間はここから探す
      }

      map.fitBounds(bounds);

      // --- 凡例 ---
      const legend = document.createElement("div");
      legend.style.background = "#fff";
      legend.style.padding = "10px";
      legend.style.margin = "10px";
      legend.style.border = "1px solid #ccc";
      legend.style.fontSize = "14px";
      legend.innerHTML = `
        <div><img src="${MARKER_ICONS.bus}"  style="width:20px;vertical-align:middle;"> バス（実線・虹色）</div>
        <div><img src="${MARKER_ICONS.walk}" style="width:20px;vertical-align:middle;"> 徒歩（破線・虹色）</div>
        <div><img src="${MARKER_ICONS.ship}" style="width:20px;vertical-align:middle;"> 航路（波線・虹色）</div>
        <div style="margin-top:6px;">※ 区間距離が 100m 未満は黒の実線</div>
      `;
      map.controls[google.maps.ControlPosition.RIGHT_TOP].push(legend);

    } catch (err) {
      console.error("GPX の読み込みに失敗:", err);
    }
  }

  function createMap(container) {
    var map = new google.maps.Map(container, { center: { lat: 33.829, lng: 130.743 }, zoom: 12 });
    loadGpxAndDraw(map, GPX_URL);
  }

  // --- レコード詳細 ---
  if (TARGET_RECORD_ID) {
    kintone.events.on('app.record.detail.show', function (event) {
      var recordId = event.record.$id.value;
      if (recordId !== TARGET_RECORD_ID) return;
      loadGoogleMaps(function () {
        var spaceEl = kintone.app.record.getSpaceElement('map_space');
        if (!spaceEl) return;
        spaceEl.style.height = '500px';
        createMap(spaceEl);
      });
    });
  }

  // --- 一覧 ---
  if (TARGET_VIEW_ID) {
    kintone.events.on('app.record.index.show', function (event) {
      if (event.viewId !== TARGET_VIEW_ID) return;
      loadGoogleMaps(function () {
        var mapContainer = document.getElementById('list-map');
        if (!mapContainer) {
          mapContainer = document.createElement('div');
          mapContainer.id = 'list-map';
          mapContainer.style.height = '500px';
          mapContainer.style.marginBottom = '20px';
          kintone.app.getHeaderSpaceElement().appendChild(mapContainer);
        }
        createMap(mapContainer);
      });
    });
  }

})();
