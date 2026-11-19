(() => {
  const { CATS, STORES, ENTRANCES, POI, POI_META, CROWD, TIPS, CHECKLIST, PLANS, BUILDINGS, ROWS, TRANSPORT } = window.SG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const byId = Object.fromEntries(STORES.map((s) => [s.id, s]));
  const icons = () => window.lucide && window.lucide.createIcons();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const haptic = (t) => window.TGA.haptic(t);
  const rub = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;

  /* ---------- хранилище (на этом устройстве) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sg-' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sg-' + k, JSON.stringify(v)); } catch (e) {} },
  };
  let list = store.get('list', []).filter((id) => byId[id]);

  /* ---------- общие кусочки ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function inList(id) { return list.includes(id); }
  function toggleList(id) {
    list = inList(id) ? list.filter((x) => x !== id) : [...list, id];
    store.set('list', list);
    toast(inList(id) ? `${byId[id].name} — в вашем списке` : `${byId[id].name} убран из списка`);
    haptic(inList(id) ? 'success' : 'light');
    syncList();
  }
  function syncList() {
    $$('[data-count]').forEach((c) => {
      const was = c.textContent;
      c.textContent = list.length; c.hidden = !list.length;
      if (was !== String(list.length)) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
    });
    $$('.fav[data-id]').forEach((b) => {
      const on = inList(b.dataset.id);
      b.classList.toggle('on', on);
      b.setAttribute('aria-label', on ? 'Убрать из списка' : 'Добавить в список');
    });
    if (current === 'list') renderList();
    if (current === 'map') renderRoutePanel(mapRouteOn);
    TGA.sync();
  }
  const priceStr = (p) => '₽'.repeat(p);

  function card(s, i = 0) {
    const c = CATS[s.cat];
    const badge = s.promo ? (s.promo.tier === 'top' ? '<span class="badge">Топ</span>' : '<span class="badge ad">Реклама</span>') : '';
    const tags = [s.retail && '<span class="tag g">розница</span>', s.opt && '<span class="tag">опт</span>', s.card && '<span class="tag">карта</span>', s.big && '<span class="tag">большие р-ры</span>'].filter(Boolean).join('');
    return `<article class="store pop" style="--h:${c.hue};--d:${Math.min(i, 10) * 0.045}s" data-open="${s.id}" tabindex="0">
      <div class="cover"><i data-lucide="${c.icon}"></i>${badge}<span class="code">${s.code}</span>
        <button class="fav${inList(s.id) ? ' on' : ''}" data-id="${s.id}" aria-label="Добавить в список"><i data-lucide="heart"></i></button></div>
      <div class="store-b">
        <div class="store-t"><b>${esc(s.name)}</b><span class="rate"><i data-lucide="star"></i>${s.rating}</span></div>
        <p class="store-d">${esc(s.desc)}</p>
        <div class="tags"><span class="tag">${priceStr(s.price)}</span>${tags}</div>
      </div></article>`;
  }

  /* ---------- шторка магазина ---------- */
  const sheet = $('#sheet');
  function openStore(id) {
    const s = byId[id]; if (!s) return;
    const c = CATS[s.cat];
    $('[data-sheet]').innerHTML = `
      <div class="cover" style="--h:${c.hue}"><i data-lucide="${c.icon}"></i><span class="code">${s.code}</span>
        <button class="icon-btn sheet-close" data-close aria-label="Закрыть"><i data-lucide="x"></i></button></div>
      <div class="sheet-b">
        <p class="muted small" style="margin:0 0 4px">${c.name} · ${s.place}</p>
        <h2>${esc(s.name)}</h2>
        <p class="muted" style="margin:0">${esc(s.desc)}</p>
        ${s.promo ? `<div class="sheet-promo"><i data-lucide="megaphone"></i>${esc(s.promo.text)}</div>` : ''}
        <div class="facts">
          <div><b>${s.code}</b><span>павильон</span></div>
          <div><b>★ ${s.rating}</b><span>${s.reviews} отзывов</span></div>
          <div><b>${priceStr(s.price)}</b><span>${['', 'недорого', 'средне', 'дороже'][s.price]}</span></div>
          <div><b>${s.retail ? 'Да' : 'Нет'}</b><span>розница</span></div>
          <div><b>${s.opt ? 'Да' : 'Нет'}</b><span>опт</span></div>
          <div><b>${s.card ? 'Да' : 'Нал/перевод'}</b><span>карта</span></div>
        </div>
        <div class="tags">${s.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="sheet-a">
          <button class="btn btn-accent" data-showmap="${s.id}"><i data-lucide="map-pin"></i>Показать на карте</button>
          <button class="btn btn-soft" data-tolist="${s.id}">${inList(s.id) ? '✓ В списке' : '+ В маршрут'}</button>
          <a class="btn btn-ghost" href="#" data-demo><i data-lucide="send"></i>Написать</a>
          ${TGA.shareLink ? `<button class="btn btn-ghost" data-share="${s.id}"><i data-lucide="share-2"></i>Поделиться</button>` : ''}
        </div>
      </div>`;
    icons();
    sheet.classList.remove('closing');
    if (!sheet.open) sheet.showModal();
    MapView.select(id);
    haptic('light'); TGA.sync();
  }
  function openBuilding(id) {
    const b = BUILDINGS.find((x) => x.id === id); if (!b) return;
    const here = STORES.filter((s) => s.building === id);
    const rows = id === 'veshch' ? ROWS.map((r) => `<button data-hlrow="${r.n}">Ряд ${r.n}<small>${r.label}</small></button>`).join('') : '';
    $('[data-sheet]').innerHTML = `
      <div class="b-cover" style="--c:${b.color};position:relative"><h2>${b.name}</h2>
        <button class="icon-btn sheet-close" data-close aria-label="Закрыть"><i data-lucide="x"></i></button></div>
      <div class="sheet-b">
        <p class="muted" style="margin:0">${b.about}</p>
        ${b.floors ? `<div class="b-floors">${b.floors.map(([f, l]) => `<div><b>${f}</b><ul>${l.map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
        ${here.length ? `<h3 style="margin-top:16px">Магазины в Садгиде</h3><div class="b-stores">${here.map((s) => `<button data-open="${s.id}">${esc(s.name)}<small>${s.code}</small></button>`).join('')}</div>` : ''}
        ${rows ? `<h3 style="margin-top:16px">Ряды</h3><div class="b-stores">${rows}</div>` : ''}
      </div>`;
    icons();
    sheet.classList.remove('closing');
    if (!sheet.open) sheet.showModal();
    haptic('light'); TGA.sync();
  }
  function closeSheet() {
    if (!sheet.open) return;
    sheet.classList.add('closing');
    setTimeout(() => { sheet.close(); sheet.classList.remove('closing'); TGA.sync(); }, FX.reduced ? 0 : 260);
  }
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });

  // делегирование кликов по всей странице
  document.addEventListener('click', (e) => {
    const fav = e.target.closest('.fav[data-id]');
    if (fav) { e.stopPropagation(); toggleList(fav.dataset.id); return; }
    const t = e.target.closest('[data-tolist]');
    if (t) { toggleList(t.dataset.tolist); t.textContent = inList(t.dataset.tolist) ? '✓ В списке' : '+ В маршрут'; return; }
    const sm = e.target.closest('[data-showmap]');
    if (sm) { closeSheet(); pendingFly = sm.dataset.showmap; location.hash = '#map'; if (current === 'map') flyPending(); return; }
    if (e.target.closest('[data-close]')) { closeSheet(); return; }
    const sh = e.target.closest('[data-share]');
    if (sh) { TGA.openLink(TGA.shareLink(sh.dataset.share)); return; }
    if (e.target.closest('[data-demo]')) { e.preventDefault(); toast('Демо: здесь будет переход в Telegram/WhatsApp продавца'); return; }
    const hr = e.target.closest('[data-hlrow]');
    if (hr) {
      closeSheet();
      const r = ROWS.find((x) => x.n === +hr.dataset.hlrow);
      const s = STORES.find((x) => x.row === r.n);
      if (s) MapView.flyTo(s.id); else toast(`Ряд ${r.n}: ${r.label}`);
      return;
    }
    const o = e.target.closest('[data-open]');
    if (o) openStore(o.dataset.open);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-open]')) openStore(e.target.dataset.open);
  });

  /* ---------- главная ---------- */
  function renderHome() {
    const quick = ['outer', 'clothes', 'shoes', 'kids', 'bedding', 'fur'];
    $('[data-quick]').innerHTML = quick.map((k) => `<button data-qcat="${k}">${CATS[k].name}</button>`).join('');
    $('[data-quick]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-qcat]'); if (!b) return;
      Object.assign(filters, { cat: b.dataset.qcat, q: '' }); location.hash = '#search';
    });
    const words = Object.values(CATS).map((c) => `<span>${c.name}</span>`).join('');
    $('[data-marquee]').innerHTML = words + words;

    const top = STORES.filter((s) => s.promo && s.promo.tier === 'top');
    $('[data-top]').innerHTML = top.map(card).join('');

    const posts = STORES.filter((s) => s.promo).sort((a, b) => (a.promo.tier === 'feed' ? -1 : 1) - (b.promo.tier === 'feed' ? -1 : 1));
    $('[data-feed]').innerHTML = posts.map((s, i) => {
      const c = CATS[s.cat];
      return `<article class="post reveal" style="--h:${c.hue}">
        <div class="ava"><i data-lucide="${c.icon}"></i></div>
        <div>
          <div class="post-h"><b>${esc(s.name)}</b><span class="muted">${s.code} · ${['сегодня', 'вчера', '2 дня назад'][i % 3]}</span><span class="ad-l">Реклама</span></div>
          <p>${esc(s.promo.text)}</p>
          ${i % 2 === 0 ? '<div class="post-img"></div>' : ''}
          <div class="post-a">
            <button class="btn btn-accent sm" data-open="${s.id}">Подробнее</button>
            <button class="btn btn-soft sm" data-tolist="${s.id}">${inList(s.id) ? '✓ В списке' : '+ В маршрут'}</button>
          </div>
        </div></article>`;
    }).join('');

    const nums = [STORES.length, Object.keys(CATS).length, ROWS.length, ENTRANCES.filter((e) => !e.stop).length];
    const stats = $$('[data-counter]');
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return;
      stats.forEach((el, i) => FX.counter(el, nums[i]));
      o.disconnect();
    }, { threshold: 0.4 }).observe($('[data-stats]'));

    renderCrowdMini();
    $('#heroSearch').addEventListener('submit', (e) => {
      e.preventDefault();
      Object.assign(filters, { q: e.target.q.value.trim(), cat: null });
      location.hash = '#search';
    });
  }

  function crowdNow() {
    const h = new Date().getHours();
    const v = CROWD[h];
    if (v == null) return { h, v: 0, label: 'рынок закрыт', short: 'Закрыто' };
    return { h, v, label: v > 0.8 ? 'очень много людей' : v > 0.5 ? 'людно' : v > 0.25 ? 'свободно' : 'почти пусто', short: v > 0.8 ? 'Пик' : v > 0.5 ? 'Людно' : 'Свободно' };
  }
  function renderCrowdMini() {
    const c = crowdNow();
    $('[data-crowd-mini]').innerHTML = `<i data-lucide="activity"></i><b>Сейчас на рынке: ${c.label}</b><span>Оценка по часу. Лучшее время для спокойных покупок — после 13:00.</span>`;
  }

  /* ---------- поиск ---------- */
  const filters = { q: '', cat: null, retail: false, opt: false, card: false, big: false, price: 0, sort: 'rel' };
  function renderCatChips() {
    $('[data-cat-chips]').innerHTML = `<button class="chip${filters.cat ? '' : ' on'}" data-cat="">Все</button>` +
      Object.entries(CATS).map(([k, c]) => `<button class="chip${filters.cat === k ? ' on' : ''}" data-cat="${k}"><i data-lucide="${c.icon}"></i>${c.name}</button>`).join('');
    icons();
  }
  function match(s, q) {
    if (!q) return true;
    const hay = [s.name, s.desc, s.code, CATS[s.cat].name, ...s.tags].join(' ').toLowerCase().replace(/ё/g, 'е');
    return q.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean).every((w) => hay.includes(w.length > 4 ? w.slice(0, -1) : w));
  }
  function runSearch() {
    let res = STORES.filter((s) => match(s, filters.q) && (!filters.cat || s.cat === filters.cat) &&
      (!filters.retail || s.retail) && (!filters.opt || s.opt) && (!filters.card || s.card) && (!filters.big || s.big) &&
      (!filters.price || s.price === filters.price));
    const promoW = (s) => (s.promo ? (s.promo.tier === 'top' ? 2 : 1) : 0);
    if (filters.sort === 'rel') res.sort((a, b) => promoW(b) - promoW(a) || b.rating - a.rating);
    if (filters.sort === 'rating') res.sort((a, b) => b.rating - a.rating);
    if (filters.sort === 'price') res.sort((a, b) => a.price - b.price || b.rating - a.rating);
    if (filters.sort === 'near') { const d = MapView.distFromEntrance(); res.sort((a, b) => d[a.id] - d[b.id]); }
    $('[data-found]').textContent = res.length ? `Найдено магазинов: ${res.length}` : '';
    $('[data-results]').innerHTML = res.length ? res.map(card).join('') :
      `<div class="empty"><i data-lucide="search-x"></i><p><b>Ничего не нашли</b><br>Попробуйте убрать фильтры или написать иначе.</p></div>`;
    icons();
  }
  function bindSearch() {
    const q = $('#q');
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { filters.q = q.value.trim(); runSearch(); }, 120); });
    $('#sort').addEventListener('change', (e) => { filters.sort = e.target.value; runSearch(); });
    $('[data-cat-chips]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      filters.cat = b.dataset.cat || null;
      $$('[data-cat-chips] .chip').forEach((c) => c.classList.toggle('on', c === b));
      runSearch();
    });
    $$('[data-f]').forEach((i) => i.addEventListener('change', () => { filters[i.dataset.f] = i.checked; runSearch(); }));
    $$('[data-price]').forEach((b) => b.addEventListener('click', () => {
      filters.price = +b.dataset.price;
      $$('[data-price]').forEach((x) => x.classList.toggle('on', x === b));
      runSearch();
    }));
  }

  /* ---------- карта ---------- */
  let mapReady = false, pendingFly = null, mapRouteOn = false;
  function initMap() {
    MapView.init($('#map'), $('#stage'), { onPin: openStore, onBuilding: openBuilding });
    $$('[data-zoom]').forEach((b) => b.addEventListener('click', () => MapView.zoom(b.dataset.zoom)));

    const ent = $('[data-entrances]');
    ent.innerHTML = ENTRANCES.map((e) => `<option value="${e.id}"${e.id === MapView.entrance ? ' selected' : ''}>${e.name}</option>`).join('');
    ent.addEventListener('change', () => {
      MapView.setEntrance(ent.value); haptic('select');
      if (mapRouteOn) renderRoutePanel(true);
    });

    const counts = {};
    STORES.forEach((s) => { counts[s.cat] = (counts[s.cat] || 0) + 1; });
    $('[data-legend]').innerHTML = Object.entries(CATS).map(([k, c]) => `<button data-lcat="${k}" style="--h:${c.hue}"><i></i>${c.name}<small>${counts[k] || 0}</small></button>`).join('');
    $('[data-legend]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-lcat]'); if (!b) return;
      b.classList.toggle('off', !MapView.toggleCat(b.dataset.lcat));
    });
    const types = [...new Set(POI.map((p) => p.type))];
    $('[data-poi-legend]').innerHTML = types.map((t) => `<button data-poi="${t}" class="${MapView.isPoiOn(t) ? '' : 'off'}"><i class="poi-i">${POI_META[t].label}</i>${POI_META[t].name}<small>${POI.filter((p) => p.type === t).length}</small></button>`).join('');
    $('[data-poi-legend]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-poi]'); if (!b) return;
      b.classList.toggle('off', !MapView.togglePoi(b.dataset.poi));
    });

    // поиск по карте
    const inp = $('#mapQ'), sug = $('[data-sugg]');
    inp.addEventListener('input', () => {
      const v = inp.value.trim();
      const res = v ? STORES.filter((s) => match(s, v)).slice(0, 6) : [];
      sug.hidden = !res.length;
      sug.innerHTML = res.map((s) => `<button data-fly="${s.id}">${esc(s.name)}<small>${s.code}</small></button>`).join('');
    });
    sug.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fly]'); if (!b) return;
      sug.hidden = true; inp.value = byId[b.dataset.fly].name;
      MapView.flyTo(b.dataset.fly);
      setTimeout(() => openStore(b.dataset.fly), 650);
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const f = sug.querySelector('button'); f && f.click(); } });
    mapReady = true;
  }
  function flyPending() {
    if (!pendingFly) return;
    const id = pendingFly; pendingFly = null;
    setTimeout(() => MapView.flyTo(id), 80);
  }
  function renderRoutePanel(build) {
    const box = $('[data-route-panel]');
    if (!list.length) { box.hidden = true; MapView.clearRoute(); mapRouteOn = false; return; }
    box.hidden = false;
    if (!build) {
      MapView.clearRoute();
      box.innerHTML = `<h3><i data-lucide="route"></i>Мой маршрут</h3><p class="muted small" style="margin:0 0 12px">В списке ${list.length} маг. Построим путь от выбранного входа.</p>
        <button class="btn btn-accent" data-build style="width:100%">Построить маршрут</button>`;
    } else {
      const p = MapView.route(list);
      const ent = ENTRANCES.find((e) => e.id === MapView.entrance);
      box.innerHTML = `<h3><i data-lucide="route"></i>Мой маршрут</h3>
        <div class="route-sum"><div><b>${p.meters} м</b><span>пешком</span></div><div><b>~${p.minutes} мин</b><span>без остановок</span></div></div>
        <ol class="steps"><li class="start">${ent.name}</li>${p.legs.map((l) => `<li data-open="${l.store.id}" style="cursor:pointer"><span>${esc(l.store.name)}${l.store.floor > 1 ? ' · <b>' + l.store.floor + ' этаж</b>' : ''}<br><small style="margin:0">${l.m} м · ${l.store.code}</small></span></li>`).join('')}</ol>
        <button class="btn btn-ghost sm" data-unbuild>Скрыть маршрут</button>`;
    }
    mapRouteOn = !!build;
    icons();
  }
  $('[data-route-panel]').addEventListener('click', (e) => {
    if (e.target.closest('[data-build]')) renderRoutePanel(true);
    if (e.target.closest('[data-unbuild]')) { renderRoutePanel(false); MapView.fit(); }
  });

  /* ---------- мой список ---------- */
  function renderList() {
    const box = $('[data-list]');
    if (!list.length) {
      box.innerHTML = `<div class="card empty" style="padding:56px 20px"><i data-lucide="heart"></i><p><b>Пока пусто</b><br>Нажмите ♡ на карточке магазина — он появится здесь.</p><a class="btn btn-accent" href="#search">Найти магазины</a></div>`;
      return icons();
    }
    const items = list.map((id) => byId[id]);
    box.innerHTML = `<div class="list-box">${items.map((s, i) => {
      const c = CATS[s.cat];
      return `<div class="li pop" style="--h:${c.hue};--d:${i * 0.05}s"><span class="li-handle">${i + 1}</span><div class="ava"><i data-lucide="${c.icon}"></i></div>
        <div class="grow" data-open="${s.id}"><b>${esc(s.name)}</b><span>${s.code} · ${c.name}</span></div>
        <button class="icon-btn fav on" data-id="${s.id}" aria-label="Убрать из списка"><i data-lucide="x"></i></button></div>`;
    }).join('')}</div>
      <div class="list-cta"><p class="muted">Порядок обхода подберём сами — от ближайшего к дальнему.</p>
        <div style="display:flex;gap:8px"><button class="btn btn-ghost" data-clear>Очистить</button><button class="btn btn-accent magnetic" data-go><i data-lucide="route"></i>Показать маршрут на карте</button></div></div>`;
    icons(); FX.magnetic(box);
  }
  $('[data-list]').addEventListener('click', (e) => {
    if (e.target.closest('[data-go]')) goRoute();
    if (e.target.closest('[data-clear]')) { list = []; store.set('list', list); syncList(); toast('Список очищен'); }
  });

  function goRoute() { mapRouteOn = true; location.hash = '#map'; }

  /* ---------- гид ---------- */
  function renderGuide() {
    $('[data-transport]').innerHTML = TRANSPORT.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join('');
    const now = new Date().getHours();
    const bars = $('[data-bars]');
    bars.innerHTML = Object.entries(CROWD).map(([h, v], i) => `<div class="${+h === now ? 'now' : ''}" title="${h}:00"><i style="--d:${i * 0.04}s" data-v="${v}"></i><span>${h}</span></div>`).join('');
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return;
      $$('i', bars).forEach((i) => { i.style.height = `${i.dataset.v * 100}%`; });
      o.disconnect();
    }).observe(bars);
    $('[data-crowd-now]').textContent = crowdNow().label;

    const checked = store.get('check', []);
    $('[data-checklist]').innerHTML = CHECKLIST.map((c, i) => `<label><input type="checkbox" data-ci="${i}"${checked.includes(i) ? ' checked' : ''}><span>${c}</span></label>`).join('');
    $('[data-checklist]').addEventListener('change', () => store.set('check', $$('[data-ci]').filter((x) => x.checked).map((x) => +x.dataset.ci)));

    const parkOut = $('[data-park-saved]');
    const showPark = () => {
      const p = store.get('park', null);
      parkOut.hidden = !p;
      if (p) parkOut.innerHTML = `<span>🅿︎ ${esc(p.spot)} · ${p.time}</span><button data-unpark>Сбросить</button>`;
    };
    $('[data-park]').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = e.target.spot.value.trim(); if (!v) return;
      store.set('park', { spot: v, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) });
      e.target.reset(); showPark(); toast('Место парковки сохранено');
    });
    parkOut.addEventListener('click', (e) => { if (e.target.closest('[data-unpark]')) { store.set('park', null); showPark(); } });
    showPark();

    let wallet = store.get('wallet', []);
    const limit = $('[data-limit]');
    limit.value = store.get('limit', '') || '';
    const showWallet = () => {
      const sum = wallet.reduce((a, b) => a + b.sum, 0);
      $('[data-spent]').textContent = rub(sum);
      const lim = parseInt(String(limit.value).replace(/\D/g, ''), 10) || 0;
      const m = $('[data-meter]');
      m.style.width = lim ? `${Math.min(100, (sum / lim) * 100)}%` : (sum ? '100%' : '0');
      m.classList.toggle('over', lim > 0 && sum > lim);
      $('[data-wallet-list]').innerHTML = wallet.map((w, i) => `<li><span>${esc(w.what)}</span><span><b>${rub(w.sum)}</b><button data-wdel="${i}" aria-label="Удалить">✕</button></span></li>`).join('');
    };
    limit.addEventListener('input', () => { store.set('limit', limit.value); showWallet(); });
    $('[data-wallet]').addEventListener('submit', (e) => {
      e.preventDefault();
      const sum = parseInt(e.target.sum.value.replace(/\D/g, ''), 10);
      if (!sum) return;
      wallet = [{ what: e.target.what.value.trim() || 'Покупка', sum }, ...wallet];
      store.set('wallet', wallet); e.target.reset(); showWallet();
    });
    $('[data-wallet-list]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-wdel]'); if (!b) return;
      wallet.splice(+b.dataset.wdel, 1); store.set('wallet', wallet); showWallet();
    });
    showWallet();

    $('[data-tips]').innerHTML = TIPS.map(([t, d]) => `<div class="tip"><b>${t}</b><span>${d}</span></div>`).join('');
  }

  /* ---------- продавцам ---------- */
  function renderSellers() {
    $('[data-plans]').innerHTML = PLANS.map((p) => `<div class="plan reveal${p.hot ? ' hot' : ''}">
      <b style="font-size:18px">${p.name}</b><div class="p">${p.price} <small>/ ${p.per}</small></div>
      <ul>${p.features.map((f) => `<li><i data-lucide="check"></i>${f}</li>`).join('')}</ul>
      <button class="btn ${p.hot ? 'btn-accent' : 'btn-soft'}" data-pick="${p.id}">Выбрать</button></div>`).join('');
    const sel = $('[data-plan-select]');
    sel.innerHTML = PLANS.map((p) => `<option value="${p.id}">Тариф «${p.name}» — ${p.price}</option>`).join('');
    $('[data-plans]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]'); if (!b) return;
      sel.value = b.dataset.pick;
      $('[data-apply]').scrollIntoView({ behavior: FX.reduced ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => $('[data-apply] input').focus({ preventScroll: true }), 500);
    });
    $('[data-apply]').addEventListener('submit', (e) => {
      e.preventDefault();
      const apps = store.get('apps', []);
      apps.push(Object.fromEntries(new FormData(e.target)));
      store.set('apps', apps); e.target.reset();
      toast('Заявка сохранена (демо). Свяжемся в течение дня.');
    });
  }

  /* ---------- навигация между разделами ---------- */
  let current = null;
  const VIEWS = ['home', 'search', 'map', 'list', 'guide', 'sellers'];
  function movePill() {
    const nav = $('.nav'); if (!nav) return;
    let pill = $('.nav-pill', nav);
    if (!pill) { pill = document.createElement('span'); pill.className = 'nav-pill'; nav.prepend(pill); nav.style.position = 'relative'; }
    const a = $(`.nav a.on`);
    if (!a) { pill.style.opacity = 0; return; }
    pill.style.opacity = 1;
    pill.style.left = `${a.offsetLeft}px`; pill.style.width = `${a.offsetWidth}px`;
    pill.style.top = `${a.offsetTop}px`; pill.style.height = `${a.offsetHeight}px`;
  }
  function show(name) {
    if (!VIEWS.includes(name)) name = 'home';
    const swap = () => {
      $$('.view').forEach((v) => { v.hidden = v.dataset.view !== name; });
      $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === name));
      movePill();
      if (name !== 'map') scrollTo({ top: 0 });
      if (name === 'search') { $('#q').value = filters.q; renderCatChips(); runSearch(); }
      if (name === 'list') renderList();
      if (name === 'map') {
        const first = !mapReady;
        if (first) initMap();
        requestAnimationFrame(() => {
          renderRoutePanel(mapRouteOn && list.length);
          if (!mapRouteOn) { if (first || !pendingFly) MapView.fit(); flyPending(); }
        });
      }
      FX.reveal($(`[data-view="${name}"]`));
      icons();
      TGA.sync();
    };
    const prev = current; current = name;
    if (prev && prev !== name && document.startViewTransition && !FX.reduced) document.startViewTransition(swap).ready.catch(() => {});
    else swap();
  }
  addEventListener('hashchange', () => { if (sheet.open) { sheet.close(); sheet.classList.remove('closing'); } show(location.hash.slice(1)); });
  addEventListener('resize', movePill);

  /* ---------- старт ---------- */
  const hero = FX.halftone($('.hero-dots'), 'САДОВОД');
  const flow = FX.flow($('.sellers-flow'));
  FX.themeToggle($('#theme'), () => { hero.colors(); flow.colors(); });
  addEventListener('sg-theme', () => { hero.colors(); flow.colors(); });
  window.APP = { view: () => current, sheetOpen: () => sheet.open, closeSheet, listCount: () => list.length, goRoute };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { hero.colors(); flow.colors(); });
  requestAnimationFrame(() => { hero.colors(); });

  renderHome(); bindSearch(); renderGuide(); renderSellers();
  syncList();
  show(location.hash.slice(1) || 'home');
  // ссылка из Telegram: ?startapp=s12 — магазин, map / list / guide / search — раздел
  if (TGA.start) {
    if (byId[TGA.start]) setTimeout(() => openStore(TGA.start), 400);
    else if (VIEWS.includes(TGA.start)) location.hash = '#' + TGA.start;
  }
  icons(); FX.magnetic();
  document.fonts && document.fonts.ready.then(movePill);
})();
