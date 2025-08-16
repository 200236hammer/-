document.addEventListener('DOMContentLoaded', function(){

  let currentTab = 'record';

  // --- タブ切替 ---
  document.querySelectorAll('.tab-button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
      currentTab = btn.dataset.tab;
    });
  });

  // --- InfoItem 設定 ---
  function setupInfoItem(item){
    item.querySelector('.remove-info-item').onclick = ()=>item.remove();
    item.querySelector('.move-up').onclick = ()=>{
      const prev = item.previousElementSibling;
      if(prev) item.parentNode.insertBefore(item, prev);
    };
    item.querySelector('.move-down').onclick = ()=>{
      const next = item.nextElementSibling;
      if(next) item.parentNode.insertBefore(next, item);
    };
    item.querySelector('.add-display-name').onclick = ()=>{
      const wrapper = item.querySelector('.display-names-wrapper');
      const input = document.createElement('input');
      input.type='text'; input.className='display-name'; input.placeholder='表示名';
      wrapper.appendChild(input);
    };
  }

  function setupMultiAdd(btn, listClass, templateId){
    btn.onclick = ()=>{
      const wrapper = btn.parentNode.querySelector(listClass);
      const t = document.getElementById(templateId).content.cloneNode(true);
      wrapper.appendChild(t);
      const last = wrapper.lastElementChild;
      const removeBtn = last.querySelector('.remove-btn');
      if(removeBtn) removeBtn.onclick = ()=>last.remove();
    }
  }

  function setupTypeSet(btn, listClass){
    btn.onclick = ()=>{
      const wrapper = btn.parentNode.querySelector(listClass);
      const t = document.getElementById('type-set-template').content.cloneNode(true);
      wrapper.appendChild(t);
      const last = wrapper.lastElementChild;
      last.querySelector('.remove-type-set').onclick = ()=>last.remove();
    }
  }

  // --- 設定追加 ---
  function addConfig(containerClass, copyFrom){
    const container = document.querySelector(containerClass);
    const t = document.getElementById('config-template').content.cloneNode(true);
    container.appendChild(t);
    const config = container.lastElementChild;

    // ラベル切替
    const label = config.querySelector('.id-label');
    label.textContent = currentTab==='record'?'レコードID:':'ビューID:';

    // コピー
    if(copyFrom){
      const copyId = copyFrom.querySelector('.recordOrViewId')?.value;
      config.querySelector('.recordOrViewId').value = copyId || '';
    }

    // 削除
    config.querySelector('.remove-config').onclick = ()=>config.remove();

    // GPX URL
    setupMultiAdd(config.querySelector('.add-gpx'), '.gpx-list','gpx-item-template');

    // 区分セット
    setupTypeSet(config.querySelector('.add-type-set'), '.types-list');

    // 除去文字列
    setupMultiAdd(config.querySelector('.add-removeStr'), '.removeStrs-list','gpx-item-template');

    // 地点クリック表示
    const pointBtn = config.querySelector('.add-pointKintone');
    pointBtn.onclick = ()=>{
      const wrapper = config.querySelector('.pointKintone-list');
      const t = document.getElementById('info-item-template').content.cloneNode(true);
      wrapper.appendChild(t);
      setupInfoItem(wrapper.lastElementChild);
    };

    // ルートクリック表示
    const routeBtn = config.querySelector('.add-routeKintone');
    routeBtn.onclick = ()=>{
      const wrapper = config.querySelector('.routeKintone-list');
      const t = document.getElementById('info-item-template').content.cloneNode(true);
      wrapper.appendChild(t);
      setupInfoItem(wrapper.lastElementChild);
    };
  }

  document.getElementById('add-record-config').onclick = ()=>addConfig('.record-configs');
  document.getElementById('add-list-config').onclick = ()=>addConfig('.list-configs');

});
