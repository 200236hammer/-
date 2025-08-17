document.addEventListener('DOMContentLoaded', () => {
  let currentTab = 'record';

  // ---- タブ切替 ----
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      currentTab = btn.dataset.tab;
    });
  });

  // ---- 汎用: その場で追加＆削除ボタン付与 ----
  function addRowFromTemplate(wrapper, templateId, removerSelector = '.remove-btn') {
    const t = document.getElementById(templateId).content.cloneNode(true);
    wrapper.appendChild(t);
    const row = wrapper.lastElementChild;
    const rm = row.querySelector(removerSelector);
    if (rm) rm.onclick = () => row.remove();
    return row;
  }

  // ---- InfoItem セットアップ ----
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

  // ---- 区分セット 追加 ----
  function addTypeSetRow(wrapper) {
    const row = addRowFromTemplate(wrapper, 'type-set-template', '.remove-type-set');
    setupTypeSet(row);
    return row;
  }

  // ---- 区分セット 色操作セット ----
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

  // ---- 設定ブロック生成 ----
  function addConfig(containerSelector, isRecord = true) {
    const container = document.querySelector(containerSelector);
    const t = document.getElementById('config-template').content.cloneNode(true);
    container.appendChild(t);
    const config = container.lastElementChild;

    const idLabel = config.querySelector('.id-label');
    idLabel.textContent = isRecord ? 'レコードID:' : 'ビューID:';

    config.querySelector('.remove-config').onclick = () => config.remove();
    const typesList = config.querySelector('.types-list');
    config.querySelector('.add-type-set').onclick = () => addTypeSetRow(typesList);

    const gpxList = config.querySelector('.gpx-list');
    config.querySelector('.add-gpx').onclick = () => addRowFromTemplate(gpxList, 'gpx-item-template');

    const removeStrsList = config.querySelector('.removeStrs-list');
    config.querySelector('.add-removeStr').onclick = () => addRowFromTemplate(removeStrsList, 'row-text-template');

    const pointKintoneList = config.querySelector('.pointKintone-list');
    config.querySelector('.add-pointKintone').onclick = () => {
      const row = addRowFromTemplate(pointKintoneList, 'info-item-template', '.remove-info-item');
      setupInfoItem(row);
    };

    const routeKintoneList = config.querySelector('.routeKintone-list');
    config.querySelector('.add-routeKintone').onclick = () => {
      const row = addRowFromTemplate(routeKintoneList, 'info-item-template', '.remove-info-item');
      setupInfoItem(row);
    };

    const boardingList = config.querySelector('.boarding-conds');
    config.querySelector('.add-boarding-cond').onclick = () => addRowFromTemplate(boardingList, 'cond-item-template');

    const alightingList = config.querySelector('.alighting-conds');
    config.querySelector('.add-alighting-cond').onclick = () => addRowFromTemplate(alightingList, 'cond-item-template');

    const mappingList = config.querySelector('.mapping-list');
    config.querySelector('.add-mapping').onclick = () => addRowFromTemplate(mappingList, 'mapping-item-template');
    config.querySelector('.remove-mapping').onclick = () => {
      if (mappingList.lastElementChild) mappingList.lastElementChild.remove();
    };

    return config;
  }

  // 初期タブ生成
  addConfig('.record-configs', true);
  addConfig('.list-configs', false);

  document.getElementById('add-record-config').onclick = () => addConfig('.record-configs', true);
  document.getElementById('add-list-config').onclick = () => addConfig('.list-configs', false);

  // 保存
  document.getElementById('save').onclick = () => {
    console.log('保存ボタン押下（サンプル）');
    alert('保存内容はコンソールに出力されます');
  };
});
