(function () {
    'use strict';

    // Google Maps APIキー
    var API_KEY = 'AIzaSyANAWkn3QQfslDYGqzTYRhLBWPWeK1FyDE';

    // 公開した GPX ファイルの URL
    var GPX_URL = 'https://raw.githubusercontent.com/200236hammer/-/refs/heads/main/bus_trip1_nakao_to_kurashiki_trace.gpx';

    // 表示条件
    var TARGET_RECORD_ID = '3';      // ← レコードID。空文字 '' にすると無効
    var TARGET_VIEW_ID = 8251828;     // ← 一覧ビューID。null にすると無効

    // Google Maps 読み込み
    function loadGoogleMaps(callback) {
        if (window.google && window.google.maps) {
            callback();
        } else {
            var script = document.createElement('script');
            script.src = 'https://maps.googleapis.com/maps/api/js?key=' + API_KEY + '&libraries=geometry';

            script.onload = callback;
            document.body.appendChild(script);
        }
    }

    // GPX 読み込み & 描画
    async function loadGpxAndDraw(map, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("HTTPエラー " + response.status);

            const gpxText = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(gpxText, "application/xml");

            // バス停（wpt）
            const wpts = [];
            const wptNodes = xml.getElementsByTagName("wpt");
            for (let i = 0; i < wptNodes.length; i++) {
                const lat = parseFloat(wptNodes[i].getAttribute("lat"));
                const lon = parseFloat(wptNodes[i].getAttribute("lon"));
                const name = wptNodes[i].getElementsByTagName("name")[0]?.textContent || "";
                const desc = wptNodes[i].getElementsByTagName("desc")[0]?.textContent || "";

                const isWalk = /［徒歩］/.test(name);  // 全角角括弧を含めて判定


                wpts.push({ lat, lon, name, desc, isWalk });

                // マーカーアイコンを切り替え
                const iconUrl = isWalk
                    ? "https://maps.google.com/mapfiles/ms/icons/man.png"  // 徒歩アイコン
                    : "https://maps.google.com/mapfiles/ms/icons/bus.png"; // バスアイコン

                const marker = new google.maps.Marker({
                    position: { lat, lng: lon },
                    map: map,
                    title: name,
                    icon: {
                        url: iconUrl,
                        scaledSize: new google.maps.Size(32, 32)
                    }
                });

                const info = new google.maps.InfoWindow({
                    content: `<strong>${name}</strong><br>${desc}`
                });

                marker.addListener("click", () => {
                    info.open(map, marker);
                });
            }

            // ルート（trkpt or rtept）
            let pts = xml.getElementsByTagName("trkpt");
            if (pts.length === 0) pts = xml.getElementsByTagName("rtept");

            const routePoints = [];
            for (let i = 0; i < pts.length; i++) {
                const lat = parseFloat(pts[i].getAttribute("lat"));
                const lon = parseFloat(pts[i].getAttribute("lon"));
                routePoints.push({ lat, lng: lon });
            }

            if (routePoints.length === 0) return;


            // 区間ごとに色を変えて描画（徒歩・バス・航路対応）
            const colors = ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#4B0082", "#8B00FF"]; // 虹色
            let segment = [];
            let colorIndex = 0;
            const bounds = new google.maps.LatLngBounds();

            // ルート描画時に距離判定と線種判定を追加
            routePoints.forEach((p, idx) => {
                segment.push(p);
                bounds.extend(p);

                // wpt に一致する座標があれば区間を確定
                const match = wpts.find(w =>
                    Math.abs(w.lat - p.lat) < 0.0001 && Math.abs(w.lon - p.lng) < 0.0001
                );

                if (match || idx === routePoints.length - 1) {
                    if (segment.length > 1) {
                        // 区間タイプ判定
                        let type = "bus";
                        if (/［徒歩］/.test(match?.name)) type = "walk";
                        if (/［航路］/.test(match?.name)) type = "ship";


                        // デフォルト線スタイル
                        let lineColor = colors[colorIndex % colors.length];
                        let lineIcons = {
                            bus: [],
                            walk: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 }, offset: "0", repeat: "10px" }],
                            ship: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 6 }, offset: "0", repeat: "15px" }]
                        }[type];

                        // マーカー同士の距離判定（100m以内なら黒線）
                        const start = new google.maps.LatLng(segment[0].lat, segment[0].lng);
                        const end = new google.maps.LatLng(segment[segment.length - 1].lat, segment[segment.length - 1].lng);
                        const distance = google.maps.geometry.spherical.computeDistanceBetween(start, end);

                        if (distance <= 100) {
                            lineColor = "#000000";
                            lineIcons = []; // 実線
                        }

                        new google.maps.Polyline({
                            path: segment,
                            map: map,
                            strokeColor: lineColor,
                            strokeOpacity: 0.8,
                            strokeWeight: 4,
                            icons: lineIcons
                        });

                        colorIndex++;
                    }
                    segment = [p];
                }
            });


            // マーカー部分も type に応じて変更
            wpts.forEach(wpt => {
                let type = "bus";
                if (wpt.name.includes("徒歩")) type = "walk";
                if (wpt.name.includes("航路")) type = "ship";

                const icons = {
                    bus: "https://maps.google.com/mapfiles/ms/icons/bus.png",
                    walk: "https://maps.google.com/mapfiles/ms/icons/walking.png",
                    ship: "https://maps.google.com/mapfiles/ms/icons/boat.png"
                };

                const marker = new google.maps.Marker({
                    position: { lat: wpt.lat, lng: wpt.lon },
                    map: map,
                    title: wpt.name,
                    icon: {
                        url: icons[type],
                        scaledSize: new google.maps.Size(32, 32)
                    }
                });

                const info = new google.maps.InfoWindow({
                    content: `<strong>${wpt.name}</strong><br>${wpt.desc}`
                });

                marker.addListener("click", () => info.open(map, marker));
            });




            map.fitBounds(bounds);

        } catch (err) {
            console.error("GPX の読み込みに失敗:", err);
        }
    }

    // 地図作成
    function createMap(container) {
        var map = new google.maps.Map(container, {
            center: { lat: 33.82900999250258, lng: 130.74252683414016 }, // 東京駅を仮の中心
            zoom: 12
        });

        loadGpxAndDraw(map, GPX_URL);
    }

    // レコード詳細画面
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

    // 一覧画面
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
                    var headerSpace = kintone.app.getHeaderSpaceElement();
                    headerSpace.appendChild(mapContainer);
                }
                createMap(mapContainer);
            });
        });
    }

})();
