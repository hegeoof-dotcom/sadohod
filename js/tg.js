/*
  Telegram Mini App. Вне Telegram файл ничего не делает — сайт работает как обычно.
  Внутри Telegram:
  - тема берётся из Telegram (светлая/тёмная), цвета шапки совпадают с приложением;
  - системная кнопка «Назад» закрывает карточку или возвращает на главную;
  - большая кнопка снизу (MainButton) — «Показать маршрут» в разделе «Мой список»;
  - виброотклик на нажатия;
  - ссылка вида t.me/<бот>/<app>?startapp=s12 открывает сразу магазин s12, startapp=map — карту.
*/
window.TGA = (() => {
  // Заполнить, когда будет бот: ссылка на Mini App из BotFather, например 'https://t.me/sadohod_bot/app'
  const APP_LINK = '';

  const wa = window.Telegram && window.Telegram.WebApp;
  const inside = !!(wa && wa.initData);
  const noop = () => {};
  if (!inside) {
    return { inside: false, haptic: noop, sync: noop, shareLink: null, start: null, openLink: (u) => window.open(u, '_blank') };
  }

  const root = document.documentElement;
  root.classList.add('in-tg');
  const ver = (v) => wa.isVersionAtLeast && wa.isVersionAtLeast(v);

  function applyTheme() {
    let manual = null;
    try { manual = localStorage.getItem('sg-theme'); } catch (e) {}
    if (!manual) root.dataset.theme = wa.colorScheme === 'dark' ? 'dark' : 'light';
    requestAnimationFrame(() => {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      try { wa.setHeaderColor(bg); wa.setBackgroundColor(bg); if (ver('7.10')) wa.setBottomBarColor(bg); } catch (e) {}
      window.dispatchEvent(new Event('sg-theme'));
    });
  }

  wa.ready();
  wa.expand();
  if (ver('7.7')) wa.disableVerticalSwipes(); // чтобы перетаскивание карты не сворачивало приложение
  applyTheme();
  wa.onEvent('themeChanged', applyTheme);
  new MutationObserver(() => applyTheme()).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  function haptic(type) {
    const h = wa.HapticFeedback; if (!h || !ver('6.1')) return;
    if (type === 'success' || type === 'error' || type === 'warning') h.notificationOccurred(type);
    else if (type === 'select') h.selectionChanged();
    else h.impactOccurred(type || 'light');
  }

  let mainHandler = null;
  wa.MainButton.onClick(() => { haptic('medium'); mainHandler && mainHandler(); });
  wa.BackButton.onClick(() => {
    haptic('light');
    const A = window.APP; if (!A) return;
    if (A.sheetOpen()) A.closeSheet(); else location.hash = '#home';
  });

  // вызывается приложением после каждой смены раздела/шторки/списка
  function sync() {
    const A = window.APP; if (!A) return;
    const view = A.view();
    if (A.sheetOpen() || view !== 'home') wa.BackButton.show(); else wa.BackButton.hide();
    const accent = getComputedStyle(root).getPropertyValue('--accent').trim();
    const ink = getComputedStyle(root).getPropertyValue('--accent-ink').trim();
    if (view === 'list' && A.listCount() && !A.sheetOpen()) {
      mainHandler = A.goRoute;
      wa.MainButton.setParams({ text: `Маршрут по ${A.listCount()} маг.`, color: accent, text_color: ink, is_visible: true, is_active: true });
    } else {
      mainHandler = null;
      wa.MainButton.hide();
    }
  }

  const sp = (wa.initDataUnsafe && wa.initDataUnsafe.start_param) || new URLSearchParams(location.hash.slice(1)).get('tgWebAppStartParam');
  return {
    inside: true,
    haptic,
    sync,
    start: sp || null,
    shareLink: APP_LINK ? (id) => `https://t.me/share/url?url=${encodeURIComponent(`${APP_LINK}?startapp=${id}`)}` : null,
    openLink: (u) => (u.startsWith('https://t.me/') ? wa.openTelegramLink(u) : wa.openLink(u)),
    user: wa.initDataUnsafe && wa.initDataUnsafe.user,
  };
})();
