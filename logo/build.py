"""Знак Садохода — 4 точки (3 квадрата + круг). Генерирует SVG-варианты и иконки.
Запуск: python3 logo/build.py"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ORANGE = ('#FFB45E', '#FF4A0A')
LIGHT = ('#FFE1A8', '#FF8A2A')

S, G, O = 50, 8, 6          # размер клетки, зазор, отступ (поле 120×120)
P = [(O, O), (O + S + G, O), (O, O + S + G), (O + S + G, O + S + G)]  # TL, TR, BL, BR
R = 16


def defs(uid):
    return f'''<defs>
  <linearGradient id="g{uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{ORANGE[0]}"/><stop offset="1" stop-color="{ORANGE[1]}"/></linearGradient>
  <linearGradient id="l{uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{LIGHT[0]}"/><stop offset="1" stop-color="{LIGHT[1]}"/></linearGradient>
  <radialGradient id="h{uid}" cx=".3" cy=".22" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="d{uid}" cx=".78" cy=".9" r=".6"><stop offset="0" stop-color="#5a1400" stop-opacity=".35"/><stop offset="1" stop-color="#5a1400" stop-opacity="0"/></radialGradient>
</defs>'''


def sq(x, y, fill, uid, clay=True, extra=''):
    s = f'<g{extra}><rect x="{x}" y="{y}" width="{S}" height="{S}" rx="{R}" fill="url(#{fill}{uid})"/>'
    if clay:
        s += f'<rect x="{x}" y="{y}" width="{S}" height="{S}" rx="{R}" fill="url(#d{uid})"/><rect x="{x}" y="{y}" width="{S}" height="{S}" rx="{R}" fill="url(#h{uid})"/>'
    return s + '</g>'


def circ(x, y, fill, uid, clay=True, extra=''):
    cx, cy, r = x + S / 2, y + S / 2, S / 2
    s = f'<g{extra}><circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{fill}{uid})"/>'
    if clay:
        s += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#d{uid})"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#h{uid})"/>'
    return s + '</g>'


def mark_a(uid='a'):
    """Клей: три глянцевых плитки и светлый круг — «точка, куда идём»."""
    (a, b, c, d) = P
    return defs(uid) + sq(*a, 'g', uid) + circ(*b, 'l', uid) + sq(*c, 'g', uid) + sq(*d, 'g', uid)


def mark_b(uid='b'):
    """Маршрут: пунктир идёт по проходам между корпусами к метке «вы здесь»."""
    (a, b, c, d) = P
    cx, cy = b[0] + S / 2, b[1] + S / 2
    mid = O + S + G / 2
    path = f'<path d="M{c[0] + S / 2} {c[1] + S / 2 + 2} V{mid} H{cx} V{cy + 6}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0.1 9"/>'
    pin = f'<circle cx="{cx}" cy="{cy}" r="{S / 2}" fill="url(#l{uid})"/><circle cx="{cx}" cy="{cy}" r="{S / 2}" fill="url(#h{uid})"/><circle cx="{cx}" cy="{cy}" r="10" fill="#fff"/><circle cx="{cx}" cy="{cy}" r="5" fill="{ORANGE[1]}"/>'
    start = f'<circle cx="{c[0] + S / 2}" cy="{c[1] + S / 2}" r="7" fill="#fff"/>'
    return defs(uid) + sq(*a, 'g', uid) + sq(*c, 'g', uid) + sq(*d, 'g', uid) + pin + path + start


def mark_c(uid='c'):
    """Шаг: нижняя плитка «шагнула» в сторону — знак в движении, это и есть «ход»."""
    (a, b, c, d) = P
    lines = ''.join(f'<rect x="{d[0] - 10 - i * 7}" y="{d[1] + 14 + i * 9}" width="{12 - i * 3}" height="4" rx="2" fill="{ORANGE[1]}" opacity="{.55 - i * .15}"/>' for i in range(3))
    moved = sq(d[0] + 6, d[1] + 4, 'g', uid, extra=f' transform="rotate(14 {d[0] + 6 + S / 2} {d[1] + 4 + S / 2})"')
    return defs(uid) + sq(*a, 'g', uid) + circ(*b, 'l', uid) + sq(*c, 'g', uid) + lines + moved


def svg(inner, vb='0 0 120 120', size=None):
    wh = f' width="{size}" height="{size}"' if size else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{wh}>{inner}</svg>'


def icon(mark_fn, uid, bg='orange'):
    """Иконка 512×512: знак на фоне. bg: 'orange' (белые плитки), 'dark', 'cream'."""
    inner = mark_fn(uid)
    if bg == 'orange':
        # на оранжевом фоне знак кремовый — перекрашиваем градиенты
        inner = inner.replace(ORANGE[0], '#FFFFFF').replace(ORANGE[1], '#FFE0CC').replace(LIGHT[0], '#F2FF9E').replace(LIGHT[1], '#D4FF3A')
        back = f'<defs><linearGradient id="bg{uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9A3C"/><stop offset="1" stop-color="#FF4A0A"/></linearGradient><radialGradient id="bh{uid}" cx=".25" cy=".15" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="512" height="512" fill="url(#bg{uid})"/><rect width="512" height="512" fill="url(#bh{uid})"/>'
    elif bg == 'dark':
        back = '<rect width="512" height="512" fill="#141010"/>'
    else:
        back = '<rect width="512" height="512" fill="#F5F1EA"/>'
    return svg(back + f'<g transform="translate(106 106) scale(2.5)">{inner}</g>', '0 0 512 512')


VARIANTS = {'a': mark_a, 'b': mark_b, 'c': mark_c}
for k, fn in VARIANTS.items():
    open(os.path.join(HERE, f'mark-{k}.svg'), 'w').write(svg(fn(k + 'm')))
    for bg in ('orange', 'dark', 'cream'):
        open(os.path.join(HERE, f'icon-{k}-{bg}.svg'), 'w').write(icon(fn, f'{k}{bg[0]}', bg))
print('ok')
