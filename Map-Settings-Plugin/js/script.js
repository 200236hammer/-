(function () {
  'use strict';

  // DOM が読み込まれたら
  document.addEventListener('DOMContentLoaded', function () {

    let currentTab = 'record';

    // タブ切り替え
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-' + this.dataset.tab).classList.add('active');
        currentTab = this.dataset.tab;
      });
    });

    // テンプレートから行を追加
    function addRowFromTemplate(wrapper, templateId, removerSelector = '.remove-btn') {
      const t = document.getElementById(templateId).content.cloneNode(true);
      wrapper.appendChild(t);
      const row = wrapper.lastElementChild;
      const rm = row.querySelector(removerSelector);
      if (rm) rm.onclick = () => row.remove();
      return row;
    }

    // 区分セット
    function addTypeSetRow(wrapper) {
      const row = addRowFromTemplate(wrapper, 'type-set-template', '.remove-type-set');
      setupTypeSet(row);
      return row;
    }

    function setupTypeSet(typeRow) {
      const colorList = typeRow.querySelector('.color-list');
      typeRow.querySelector('.add-color').onclick = () => addRowFromTemplate(colorList, 'color-item-template');
      typeRow.querySelector('.remove-color').onclick = () => {
        if (colorList.lastElementChild) colorList.lastElementChild.remove();
      };
      typeRow.querySelector('.rainbow-color').onclick = () => {
        const rainbow = ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#8b00ff'];
        colorList.querySelectorAll('.color-value').forEach((c, i) => c.value = rainbow[i % rainbow.length]);
      };
      addRowFromTemplate(colorList, 'color-item-template');
      addRowFromTemplate(colorList, 'color-item-template');
    }

    // 設定ブロック追加
    function addConfig(containerSelector) {
      const container = document.querySelector(containerSelector);
      const t = document.getElementById('config-template').content.cloneNode(true);
      container.appendChild(t);
      const config = container.lastElementChild;
      config.querySelector('.remove-config').onclick = () => config.remove();

      // 区分セット
      const typesList = config.querySelector('.types-list');
      config.querySelector('.add-type-set').onclick = () => addTypeSetRow(typesList);

      // GPX追加
      const gpxList = config.querySelector('.gpx-list');
      config.querySelector('.add-gpx').onclick = () => addRowFromTemplate(gpxList, 'gpx-item-template');

      // 除去文字列
      const removeStrsList = config.querySelector('.removeStrs-list');
      config.querySelector('.add-removeStr').onclick = () => addRowFromTemplate(removeStrsList, 'row-text-template');

      // 地点クリック
      const pointKintoneList = config.querySelector('.pointKintone-list');
      config.querySelector('.add-pointKintone').onclick = () => addRowFromTemplate(pointKintoneList, 'row-text-template');

      // ルートクリック
      const routeKintoneList = config.querySelector('.routeKintone-list');
      config.querySelector('.add-routeKintone').onclick = () => addRowFromTemplate(routeKintoneList, 'row-text-template');

      // 乗車条件
      const boardingList = config.querySelector('.boarding-conds');
      config.querySelector('.add-boarding-cond').onclick = () => addRowFromTemplate(boardingList, 'cond-item-template');

      // 降車条件
      const alightingList = config.querySelector('.alighting-conds');
      config.querySelector('.add-alighting-cond').onclick = () => addRowFromTemplate(alightingList, 'cond-item-template');

      // GPX<name>対応
      const mappingList = config.querySelector('.mapping-list');
      config.querySelector('.add-mapping').onclick = () => addRowFromTemplate(mappingList, 'info-item-template');
      config.querySelector('.remove-mapping').onclick = () => { if (mappingList.lastElementChild) mappingList.lastElementChild.remove(); };
    }

    // 初期化：追加ボタン
    document.getElementById('add-record-config').onclick = () => addConfig('.record-configs');
    document.getElementById('add-list-config').onclick = () => addConfig('.list-configs');

// 保存ボタン
document.getElementById('save').onclick = () => {
  // 出力オブジェクト
  const output = {
    apiKeyCommon: document.getElementById('apiKeyCommon').value,
    recordConfigs: [],
    listConfigs: []
  };

  // 共通関数: 設定ブロックの内容をまとめる
  function collectConfig(configEl) {
    const cfg = {};

    cfg.recordOrViewId = configEl.querySelector('.recordOrViewId').value;

    // GPX URL
    cfg.gpxUrls = Array.from(configEl.querySelectorAll('.gpxUrl')).map(el => el.value);

    // 区分セット
    cfg.typeSets = Array.from(configEl.querySelectorAll('.type-set-row')).map(row => ({
      name: row.querySelector('.type-name').value,
      colors: Array.from(row.querySelectorAll('.color-value')).map(c => c.value),
      lineType: row.querySelector('.line-type').value,
      legend: row.querySelector('.legend').value,
      iconUrl: row.querySelector('.icon-url').value
    }));

    // 除去文字列
    cfg.removeStrs = Array.from(configEl.querySelectorAll('.removeStrs-list .text-input')).map(el => el.value);

    // 地点クリック表示
    cfg.pointKintone = Array.from(configEl.querySelectorAll('.pointKintone-list .info-item')).map(row => ({
      source: row.querySelector('.data-source').value,
      field: row.querySelector('.field-name').value,
      displayNames: Array.from(row.querySelectorAll('.display-name')).map(el => el.value)
    }));

    // ルートクリック表示
    cfg.routeKintone = Array.from(configEl.querySelectorAll('.routeKintone-list .info-item')).map(row => ({
      source: row.querySelector('.data-source').value,
      field: row.querySelector('.field-name').value,
      displayNames: Array.from(row.querySelectorAll('.display-name')).map(el => el.value)
    }));

    // レコードリンク条件
    cfg.boardingConds = Array.from(configEl.querySelectorAll('.boarding-conds .row')).map(row => ({
      key: row.querySelector('.cond-key').value,
      field: row.querySelector('.cond-field').value
    }));
    cfg.alightingConds = Array.from(configEl.querySelectorAll('.alighting-conds .row')).map(row => ({
      key: row.querySelector('.cond-key').value,
      field: row.querySelector('.cond-field').value
    }));

    // GPX <name> と kintoneフィールドの対応
    cfg.mappings = Array.from(configEl.querySelectorAll('.mapping-list .info-item')).map(row => ({
      gpxName: row.querySelector('.gpx-name').value,
      kintoneField: row.querySelector('.kintone-field').value
    }));

    // 黒線設定
    cfg.blackIfShort = configEl.querySelector('.blackIfShort').value;

    return cfg;
  }

  // レコード画面設定
  document.querySelectorAll('.record-configs .config-item').forEach(cfgEl => {
    output.recordConfigs.push(collectConfig(cfgEl));
  });

  // 一覧画面設定
  document.querySelectorAll('.list-configs .config-item').forEach(cfgEl => {
    output.listConfigs.push(collectConfig(cfgEl));
  });

  // === ここで kintone.plugin.app.setConfig() に保存 ===
  kintone.plugin.app.setConfig({
    apiKeyCommon: output.apiKeyCommon,
    recordConfigs: JSON.stringify(output.recordConfigs),
    listConfigs: JSON.stringify(output.listConfigs)
  }, () => {
    alert('設定を保存しました');
  });
};




  });

})();
