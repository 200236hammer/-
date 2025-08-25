(function () {
  'use strict';

  function initPlugin() {
    console.log('=== myPlugin.init() start ===');

    const configTemplate = document.getElementById('config-template');
    if (!configTemplate) {
      console.error('config-template が見つかりません');
      return;
    }

    // --- タブ切替 ---
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const tabId = 'tab-' + btn.dataset.tab;
        document.getElementById(tabId).classList.add('active');
      });
    });

    // --- 汎用: 追加＆削除ボタン ---
    function addRowFromTemplate(wrapper, templateId, removerSelector = '.remove-btn') {
      const t = document.getElementById(templateId).content.cloneNode(true);
      wrapper.appendChild(t);
      const row = wrapper.lastElementChild;
      const rm = row.querySelector(removerSelector);
      if (rm) rm.onclick = () => row.remove();
      return row;
    }

    // --- InfoItem セットアップ ---
    function setupInfoItem(rowEl) {
      rowEl.querySelector('.remove-info-item').onclick = () => rowEl.remove();
      rowEl.querySelector('.move-up').onclick = () => {
        const prev = rowEl.previousElementSibling;
        if (prev) rowEl.parentNode.insertBefore(rowEl, prev);
      };
      rowEl.querySelector('.move-down').onclick = () => {
        const next = rowEl.nextElementSibling;
        if (next) rowEl.parentNode.insertBefore(next, rowEl);
      };
      rowEl.querySelector('.add-display-name').onclick = () => {
        const wrap = rowEl.querySelector('.display-names-wrapper');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'display-name mini';
        input.placeholder = '表示名';
        wrap.insertBefore(input, rowEl.querySelector('.add-display-name'));
      };
    }

    // --- 区分セット追加 ---
    function addTypeSetRow(wrapper) {
      const row = addRowFromTemplate(wrapper, 'type-set-template', '.remove-type-set');
      setupTypeSet(row);
      return row;
    }

    // --- 区分セット色操作 ---
    function setupTypeSet(typeRow) {
      const colorList = typeRow.querySelector('.color-list');
      typeRow.querySelector('.add-color').onclick = () => {
        addRowFromTemplate(colorList, 'color-item-template');
      };
      typeRow.querySelector('.remove-color').onclick = () => {
        if (colorList.lastElementChild) colorList.lastElementChild.remove();
      };
      typeRow.querySelector('.rainbow-color').onclick = () => {
        const rainbow = ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#8b00ff'];
        colorList.querySelectorAll('.color-value').forEach((c, i) => {
          c.value = rainbow[i % rainbow.length];
        });
      };

      // 初期2行
      addRowFromTemplate(colorList, 'color-item-template');
      addRowFromTemplate(colorList, 'color-item-template');
    }

    // ここを最初に置く（savedConfig を使う前）
    const PLUGIN_ID = kintone.$PLUGIN_ID;
    const savedConfig = kintone.plugin.app.getConfig(PLUGIN_ID) || {};

    // --- 設定ブロック生成 ---
    function addConfig(containerSelector, isRecord = true) {
      const container = document.querySelector(containerSelector);
      if (!container) return;

      const t = document.getElementById('config-template').content.cloneNode(true);
      container.appendChild(t);
      const config = container.lastElementChild;

      const idLabel = config.querySelector('.id-label');
      idLabel.textContent = isRecord ? 'レコードID:' : 'ビューID:';

      // 設定削除
      config.querySelector('.remove-config').onclick = () => config.remove();

      // 区分セット
      const typesList = config.querySelector('.types-list');
      config.querySelector('.add-type-set').onclick = () => addTypeSetRow(typesList);

      // GPX
      const gpxList = config.querySelector('.gpx-list');
      config.querySelector('.add-gpx').onclick = () => addRowFromTemplate(gpxList, 'gpx-item-template');

      // 除去文字列
      const removeStrsList = config.querySelector('.removeStrs-list');
      config.querySelector('.add-removeStr').onclick = () => addRowFromTemplate(removeStrsList, 'row-text-template');

      // InfoItem: 地点クリック
      const pointKintoneList = config.querySelector('.pointKintone-list');
      config.querySelector('.add-pointKintone').onclick = () => {
        const row = addRowFromTemplate(pointKintoneList, 'info-item-template', '.remove-info-item');
        setupInfoItem(row);
      };

      // InfoItem: ルートクリック
      const routeKintoneList = config.querySelector('.routeKintone-list');
      config.querySelector('.add-routeKintone').onclick = () => {
        const row = addRowFromTemplate(routeKintoneList, 'info-item-template', '.remove-info-item');
        setupInfoItem(row);
      };

      // 乗車条件
      const boardingList = config.querySelector('.boarding-conds');
      config.querySelector('.add-boarding-cond').onclick = () => addRowFromTemplate(boardingList, 'cond-item-template');

      // 降車条件
      const alightingList = config.querySelector('.alighting-conds');
      config.querySelector('.add-alighting-cond').onclick = () => addRowFromTemplate(alightingList, 'cond-item-template');

      // GPX ↔ kintoneフィールド対応
      const mappingList = config.querySelector('.mapping-list');
      config.querySelector('.add-mapping').onclick = () => addRowFromTemplate(mappingList, 'mapping-item-template');
      config.querySelector('.remove-mapping').onclick = () => {
        if (mappingList.lastElementChild) mappingList.lastElementChild.remove();
      };

      return config;
    }

    // 初期タブ生成（保存データがないときだけ作成）
    if (!savedConfig || !savedConfig.recordConfigs) {
      addConfig('.record-configs', true);
    }
    if (!savedConfig || !savedConfig.listConfigs) {
      addConfig('.list-configs', false);
    }

    if (savedConfig) {
      // APIキー
      if (savedConfig.apiKeyCommon) document.getElementById('apiKeyCommon').value = savedConfig.apiKeyCommon;

      // recordConfigs
      if (savedConfig.recordConfigs) {
        const recConfigs = JSON.parse(savedConfig.recordConfigs);
        recConfigs.forEach(cfg => {
          const configEl = addConfig('.record-configs', true);
          configEl.querySelector('.recordOrViewId').value = cfg.recordOrViewId || "";

          // GPX
          cfg.gpxUrls?.forEach(url => {
            const row = addRowFromTemplate(configEl.querySelector('.gpx-list'), 'gpx-item-template');
            row.querySelector('.gpxUrl').value = url;
          });

          // 区分セット
          cfg.typeSets?.forEach(ts => {
            const typeRow = addTypeSetRow(configEl.querySelector('.types-list'));
            typeRow.querySelector('.type-name').value = ts.typeName;
            typeRow.querySelector('.line-type').value = ts.lineType;
            typeRow.querySelector('.legend').value = ts.legend;
            typeRow.querySelector('.icon-url').value = ts.iconUrl;
            ts.colors?.forEach((c, i) => {
              const colorInput = typeRow.querySelectorAll('.color-value')[i];
              if (colorInput) colorInput.value = c;
            });
          });

          // 除去文字列
          cfg.removeStrs?.forEach(str => {
            const row = addRowFromTemplate(configEl.querySelector('.removeStrs-list'), 'row-text-template');
            row.querySelector('.text-input').value = str;
          });

          // InfoItem: 地点クリック
          cfg.pointKintone?.forEach(pt => {
            const row = addRowFromTemplate(configEl.querySelector('.pointKintone-list'), 'info-item-template', '.remove-info-item');
            setupInfoItem(row);
            row.querySelector('.data-source').value = pt.source;
            row.querySelector('.field-name').value = pt.field;
            pt.displayNames?.forEach((dn, i) => {
              if (i === 0) row.querySelector('.display-name').value = dn;
              else {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'display-name mini';
                input.value = dn;
                row.querySelector('.display-names-wrapper').appendChild(input);
              }
            });
          });

          // InfoItem: ルートクリック
          cfg.routeKintone?.forEach(rt => {
            const row = addRowFromTemplate(configEl.querySelector('.routeKintone-list'), 'info-item-template', '.remove-info-item');
            setupInfoItem(row);
            row.querySelector('.data-source').value = rt.source;
            row.querySelector('.field-name').value = rt.field;
            rt.displayNames?.forEach((dn, i) => {
              if (i === 0) row.querySelector('.display-name').value = dn;
              else {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'display-name mini';
                input.value = dn;
                row.querySelector('.display-names-wrapper').appendChild(input);
              }
            });
          });

          // GPX ↔ kintoneフィールド対応
          cfg.mappings?.forEach(mp => {
            const row = addRowFromTemplate(configEl.querySelector('.mapping-list'), 'mapping-item-template');
            row.querySelector('.map-gpx').value = mp.gpxName;
            row.querySelector('.map-field').value = mp.kintoneField;
          });

          // 黒線設定
          if (cfg.blackIfShort) {
            configEl.querySelector('.blackIfShort').value = cfg.blackIfShort;
          }
        });
      }


      // listConfigs
      if (savedConfig.listConfigs) {
        const lstConfigs = JSON.parse(savedConfig.listConfigs);
        lstConfigs.forEach(cfg => {
          const configEl = addConfig('.list-configs', false);
          configEl.querySelector('.recordOrViewId').value = cfg.recordOrViewId || "";

          // GPX
          cfg.gpxUrls?.forEach(url => {
            const row = addRowFromTemplate(configEl.querySelector('.gpx-list'), 'gpx-item-template');
            row.querySelector('.gpxUrl').value = url;
          });

          // 区分セット
          cfg.typeSets?.forEach(ts => {
            const typeRow = addTypeSetRow(configEl.querySelector('.types-list'));
            typeRow.querySelector('.type-name').value = ts.typeName;
            typeRow.querySelector('.line-type').value = ts.lineType;
            typeRow.querySelector('.legend').value = ts.legend;
            typeRow.querySelector('.icon-url').value = ts.iconUrl;
            ts.colors?.forEach((c, i) => {
              const colorInput = typeRow.querySelectorAll('.color-value')[i];
              if (colorInput) colorInput.value = c;
            });
          });

          // 除去文字列
          cfg.removeStrs?.forEach(str => {
            const row = addRowFromTemplate(configEl.querySelector('.removeStrs-list'), 'row-text-template');
            row.querySelector('.text-input').value = str;
          });

          // InfoItem: 地点クリック
          cfg.pointKintone?.forEach(pt => {
            const row = addRowFromTemplate(configEl.querySelector('.pointKintone-list'), 'info-item-template', '.remove-info-item');
            setupInfoItem(row);
            row.querySelector('.data-source').value = pt.source;
            row.querySelector('.field-name').value = pt.field;
            pt.displayNames?.forEach((dn, i) => {
              if (i === 0) row.querySelector('.display-name').value = dn;
              else {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'display-name mini';
                input.value = dn;
                row.querySelector('.display-names-wrapper').appendChild(input);
              }
            });
          });

          // InfoItem: ルートクリック
          cfg.routeKintone?.forEach(rt => {
            const row = addRowFromTemplate(configEl.querySelector('.routeKintone-list'), 'info-item-template', '.remove-info-item');
            setupInfoItem(row);
            row.querySelector('.data-source').value = rt.source;
            row.querySelector('.field-name').value = rt.field;
            rt.displayNames?.forEach((dn, i) => {
              if (i === 0) row.querySelector('.display-name').value = dn;
              else {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'display-name mini';
                input.value = dn;
                row.querySelector('.display-names-wrapper').appendChild(input);
              }
            });
          });

          // GPX ↔ kintoneフィールド対応
          cfg.mappings?.forEach(mp => {
            const row = addRowFromTemplate(configEl.querySelector('.mapping-list'), 'mapping-item-template');
            row.querySelector('.map-gpx').value = mp.gpxName;
            row.querySelector('.map-field').value = mp.kintoneField;
          });
          if (cfg.blackIfShort) {
            configEl.querySelector('.blackIfShort').value = cfg.blackIfShort;
          }
        });
      }

    }

    // ボタンイベント
    document.getElementById('add-record-config').onclick = () => addConfig('.record-configs', true);
    document.getElementById('add-list-config').onclick = () => addConfig('.list-configs', false);

    // --- 保存ボタン修正版 ---
    document.getElementById('save').onclick = () => {
      console.log('保存ボタン押下');

      const apiKeyCommon = document.getElementById('apiKeyCommon').value;

      function collectConfig(config) {
        return {
          recordOrViewId: config.querySelector('.recordOrViewId')?.value || "",
          gpxUrls: [...config.querySelectorAll('.gpx-list .gpxUrl')].map(el => el.value),
          removeStrs: [...config.querySelectorAll('.removeStrs-list .text-input')].map(el => el.value),
          typeSets: [...config.querySelectorAll('.types-list .type-set-row')].map(row => ({
            typeName: row.querySelector('.type-name')?.value || "",
            colors: [...row.querySelectorAll('.color-value')].map(c => c.value),
            lineType: row.querySelector('.line-type')?.value || "",
            legend: row.querySelector('.legend')?.value || "",
            iconUrl: row.querySelector('.icon-url')?.value || ""
          })),
          pointKintone: [...config.querySelectorAll('.pointKintone-list .info-item')].map(item => ({
            source: item.querySelector('.data-source')?.value,
            field: item.querySelector('.field-name')?.value,
            displayNames: [...item.querySelectorAll('.display-name')].map(d => d.value)
          })),
          routeKintone: [...config.querySelectorAll('.routeKintone-list .info-item')].map(item => ({
            source: item.querySelector('.data-source')?.value,
            field: item.querySelector('.field-name')?.value,
            displayNames: [...item.querySelectorAll('.display-name')].map(d => d.value)
          })),
          mappings: [...config.querySelectorAll('.mapping-list .row')].map(row => ({
            gpxName: row.querySelector('.map-gpx')?.value,
            kintoneField: row.querySelector('.map-field')?.value
          })),
          blackIfShort: config.querySelector('.blackIfShort')?.value || "false"
        };
      }

      const recordConfigs = [...document.querySelectorAll('.record-configs .config-item')].map(collectConfig);
      const listConfigs = [...document.querySelectorAll('.list-configs .config-item')].map(collectConfig);

      const pluginConfig = {
        apiKeyCommon: apiKeyCommon,
        recordConfigs: JSON.stringify(recordConfigs),
        listConfigs: JSON.stringify(listConfigs)
      };

      kintone.plugin.app.setConfig(pluginConfig, () => {
        alert('プラグイン設定を保存しました');
        console.log('保存完了:', pluginConfig);
        // 設定保存後に画面をリロードして最新状態を反映
        location.reload();
      });

    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlugin);
  } else {
    initPlugin();
  }

})();
