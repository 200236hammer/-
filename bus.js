(function () {
    'use strict';

    var API_KEY = 'AIzaSyANAWkn3QQfslDYGqzTYRhLBWPWeK1FyDE';
    var GPX_URL = 'https://raw.githubusercontent.com/200236hammer/-/refs/heads/main/bus_trip1_nakao_to_kurashiki_trace.gpx';
    var TARGET_RECORD_ID = '3';
    var TARGET_VIEW_ID = 8251828;

    var WALK_KEYWORD = '徒歩';
    var SHIP_KEYWORD = '航路';

    var COLORS = { bus: "#0000FF", walk: "#FF00FF", ship: "#00CC00" };
    var MARKER_ICONS = {
        bus: "https://maps.google.com/mapfiles/ms/icons/bus.png",
        walk: "https://maps.google.com/mapfiles/ms/icons/walking.png",
        ship: "https://maps.google.com/mapfiles/ms/icons/boat.png"
    };

    // レコードリンク取得
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

    async function loadGpxAndDraw(map, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("HTTPエラー " + response.status);
            const gpxText = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(gpxText, "application/xml");

            // バス停
            const wpts = [];
            const wptNodes = xml.getElementsByTagName("wpt");
            for (let i = 0; i < wptNodes.length; i++) {
                const lat = parseFloat(wptNodes[i].getAttribute("lat"));
                const lon = parseFloat(wptNodes[i].getAttribute("lon"));
                const name = wptNodes[i].getElementsByTagName("name")[0]?.textContent || "";
                const desc = wptNodes[i].getElementsByTagName("desc")[0]?.textContent || "";
                const type = name.includes(WALK_KEYWORD) ? "walk" : name.includes(SHIP_KEYWORD) ? "ship" : "bus";
                wpts.push({ lat, lon, name, desc, type });
            }

            // ルート
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
            let segment = [];
            routePoints.forEach((p, idx) => {
                segment.push(p);
                bounds.extend(p);

                const match = wpts.find(w => Math.abs(w.lat - p.lat) < 0.0001 && Math.abs(w.lon - p.lng) < 0.0001);
                if (match || idx === routePoints.length - 1) {
                    if (segment.length > 1) {
                        const type = match?.type || "bus";
                        let icons = [];
                        if (type === "walk") icons = [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 }, offset: "0", repeat: "10px" }];
                        else if (type === "ship") icons = [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 6 }, offset: "0", repeat: "15px" }];

                        const start = new google.maps.LatLng(segment[0].lat, segment[0].lng);
                        const end = new google.maps.LatLng(segment[segment.length - 1].lat, segment[segment.length - 1].lng);
                        const distance = google.maps.geometry.spherical.computeDistanceBetween(start, end);
                        let lineColor = COLORS[type];
                        if (distance <= 100) { lineColor = "#000000"; icons = []; }

                        const polyline = new google.maps.Polyline({
                            path: segment,
                            map: map,
                            strokeColor: lineColor,
                            strokeOpacity: 0.8,
                            strokeWeight: 4,
                            icons: icons
                        });

                        polyline.addListener('click', async () => {
                            const recordLink = await fetchRecordLink(match?.name || '', match?.name || '');
                            const infoContent = `<div>
                                <strong>区間情報</strong><br>
                                開始: ${segment[0].lat.toFixed(5)}, ${segment[0].lng.toFixed(5)}<br>
                                終了: ${segment[segment.length - 1].lat.toFixed(5)}, ${segment[segment.length - 1].lng.toFixed(5)}<br>
                                タイプ: ${type}<br>
                                距離: ${distance.toFixed(1)}m<br>
                                ${recordLink}
                            </div>`;
                            const info = new google.maps.InfoWindow({ content: infoContent, position: segment[0] });
                            info.open(map);
                        });
                    }
                    segment = [p];
                }
            });

            // マーカー表示
            wpts.forEach(async wpt => {
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
                    const info = new google.maps.InfoWindow({ content: infoContent });
                    info.open(map, marker);
                });
            });

            map.fitBounds(bounds);

            // 凡例
            const legend = document.createElement("div");
            legend.style.background = "#fff";
            legend.style.padding = "10px";
            legend.style.margin = "10px";
            legend.style.border = "1px solid #ccc";
            legend.style.fontSize = "14px";
            legend.innerHTML = `
                <div><img src="${MARKER_ICONS.bus}" style="width:20px;vertical-align:middle;"> バス区間</div>
                <div><img src="${MARKER_ICONS.walk}" style="width:20px;vertical-align:middle;"> 徒歩区間</div>
                <div><img src="${MARKER_ICONS.ship}" style="width:20px;vertical-align:middle;"> 航路区間</div>
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
