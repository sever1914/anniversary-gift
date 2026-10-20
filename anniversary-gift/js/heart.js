/*
 * Сердце из фраз «Я люблю тебя» на разных языках.
 * Порт алгоритма из love.py (turtle/tkinter) на Canvas 2D.
 *
 * Идея алгоритма (как в love.py):
 *  1. Контур сердца — параметрическая кривая, 720 точек.
 *  2. Сердце режется на горизонтальные «строки». Для каждой строки находим
 *     отрезки внутри контура (scanline: пересечение рёбер полигона), берём
 *     пересечение отрезков верхней и нижней границы строки, чтобы текст
 *     гарантированно не вылезал за контур.
 *  3. В каждый отрезок укладываем фразы встык (случайный размер шрифта),
 *     затем растягиваем интервалы, чтобы строка заканчивалась ровно на краю.
 *  4. Порядок появления: сначала фразы по контуру (по часовой стрелке),
 *     затем внутренние — от краёв к центру.
 *
 * buildLayout() — чистая функция без DOM (можно тестировать в Node).
 * HeartAnimation — отрисовка и анимация на canvas.
 */
(function (root) {
  'use strict';

  var BG = [6 / 255, 2 / 255, 8 / 255];          // #060208
  var FLASH = [1.0, 0.78, 0.78];
  var FONT = '-apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
  var BASE_SIZES = [10, 11, 12, 13];
  var ANIM_MS = 700;                              // «прилёт» одной фразы
  var X_RADIUS = 16, Y_RADIUS = 14.5;             // нормировка для rad (как math_dist в love.py)

  var WINE = [0.70, 0.02, 0.12];      // чуть ярче, чем в love.py: на OLED iPhone тёмно-красное тонет
  var CRIMSON = [0.95, 0.08, 0.18];
  var BLOOD = [1.0, 0.16, 0.22];

  // ---------- утилиты ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return Math.max(lo === undefined ? 0 : lo, Math.min(hi === undefined ? 1 : hi, v)); }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function dim(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  function rgb(c) {
    return 'rgb(' + Math.round(clamp(c[0]) * 255) + ',' + Math.round(clamp(c[1]) * 255) + ',' + Math.round(clamp(c[2]) * 255) + ')';
  }

  // ---------- раскладка (чистая математика) ----------
  /**
   * opts: { width, sizes:[px], gap, phrases:[], seed }
   * measure(text, sizePx) -> ширина текста в px
   * Возвращает { items, cy, ymax, ymin, width, height }, где координаты
   * математические (ось Y вверх), центр по X = 0.
   */
  function buildLayout(opts, measure) {
    var rng = mulberry32(opts.seed || 11);
    var SC = opts.width / 32;
    var KY = opts.yScale || 1;        // растяжение по вертикали: на телефоне есть место по высоте
    var sizes = opts.sizes;
    var gap = opts.gap;
    var phrases = opts.phrases;

    function pt(a) {
      var x = 16 * Math.pow(Math.sin(a), 3);
      var y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
      return [x * SC, y * SC * KY];
    }

    var N = 720, poly = [], i;
    for (i = 0; i < N; i++) poly.push(pt(2 * Math.PI * i / N));
    var ymax = -Infinity, ymin = Infinity;
    for (i = 0; i < N; i++) { ymax = Math.max(ymax, poly[i][1]); ymin = Math.min(ymin, poly[i][1]); }
    var cy = (ymax + ymin) / 2;

    function spans(y) {
      var xs = [];
      for (var k = 0; k < N; k++) {
        var p1 = poly[k], p2 = poly[(k + 1) % N];
        var x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
        if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
          xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
        }
      }
      xs.sort(function (a, b) { return a - b; });
      var out = [];
      for (var j = 0; j + 1 < xs.length; j += 2) out.push([xs[j], xs[j + 1]]);
      return out;
    }

    function intersect(A, B) {
      var out = [];
      for (var a = 0; a < A.length; a++) {
        for (var b = 0; b < B.length; b++) {
          var lo = Math.max(A[a][0], B[b][0]), hi = Math.min(A[a][1], B[b][1]);
          if (hi - lo > 14) out.push([lo, hi]);
        }
      }
      return out;
    }

    // бесконечный цикл фраз, каждый «круг» — в новом случайном порядке
    var queue = [], qi = 0;
    function nextPhrase() {
      if (qi >= queue.length) {
        queue = phrases.slice();
        for (var k = queue.length - 1; k > 0; k--) {
          var j = Math.floor(rng() * (k + 1));
          var t = queue[k]; queue[k] = queue[j]; queue[j] = t;
        }
        qi = 0;
      }
      return queue[qi++];
    }

    var maxSize = Math.max.apply(null, sizes);
    var rowH = maxSize * 1.25 + 3;
    var half = rowH / 2;
    var placed = [];

    var y = ymax - half;
    while (y > ymin + half) {
      var row = intersect(spans(y + half), spans(y - half));

      for (var r = 0; r < row.length; r++) {
        var lo = row[r][0] + 4, hi = row[r][1] - 4;
        var cur = lo + rng() * 8;
        var line = [];

        for (;;) {
          var fit = null;
          for (var tries = 0; tries < 10; tries++) {
            var text = nextPhrase();
            var size = sizes[Math.floor(rng() * sizes.length)];
            var w = measure(text, size);
            if (cur + w <= hi) { fit = { text: text, size: size, w: w }; break; }
          }
          if (!fit) break;
          line.push({ x: cur + fit.w / 2, text: fit.text, size: fit.size, w: fit.w });
          cur += fit.w + gap;
        }
        if (!line.length) continue;

        if (line.length > 1) {
          var last = line[line.length - 1];
          var left = hi - (last.x + last.w / 2);
          for (var q = 0; q < line.length; q++) line[q].x += left * q / (line.length - 1);
        } else {
          line[0].x = (lo + hi) / 2;
        }

        for (var m = 0; m < line.length; m++) {
          placed.push({
            x: line[m].x, y: y, text: line[m].text, size: line[m].size,
            edge: m === 0 || m === line.length - 1
          });
        }
      }
      y -= rowH;
    }

    // цвета: от винного в центре к алому у края
    for (i = 0; i < placed.length; i++) {
      var p = placed[i];
      var rad = Math.min(1, Math.hypot(p.x / (X_RADIUS * SC), (p.y - cy) / (Y_RADIUS * SC * KY)));
      var base = mix(WINE, CRIMSON, 0.25 + 0.75 * rad);
      base = mix(base, BLOOD, rng() * 0.35 + (p.edge ? 0.3 : 0));
      p.color = [Math.min(1, base[0]), Math.min(1, base[1]), Math.min(1, base[2])];
      p.rad = rad;
    }

    // порядок появления: контур по часовой стрелке, затем внутренние — снаружи внутрь
    var edges = placed.filter(function (p) { return p.edge; });
    var inner = placed.filter(function (p) { return !p.edge; });
    var TWO_PI = 2 * Math.PI;
    edges.sort(function (a, b) {
      var A = ((Math.atan2(a.x, a.y - cy) % TWO_PI) + TWO_PI) % TWO_PI;
      var B = ((Math.atan2(b.x, b.y - cy) % TWO_PI) + TWO_PI) % TWO_PI;
      return A - B;
    });
    inner.forEach(function (p) { p._k = -p.rad + rng() * 0.08; });
    inner.sort(function (a, b) { return a._k - b._k; });

    return { items: edges.concat(inner), cy: cy, ymax: ymax, ymin: ymin, width: 32 * SC, height: ymax - ymin, rowH: rowH };
  }

  // ---------- анимация на canvas ----------
  function HeartAnimation(canvas, cfg, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = cfg;
    this.hooks = hooks || {};
    this.state = 'idle';           // idle | filling | live
    this.items = [];
    this.spawned = 0;
    this.flashing = [];
    this.ripples = [];
    this.lastFlash = 0;
    this.t0 = 0;
    this.running = false;
    this._tick = this._tick.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onTap = this._onTap.bind(this);
    this._resizeTimer = 0;
  }

  HeartAnimation.prototype._measureFn = function () {
    var ctx = this.ctx;
    return function (text, size) {
      ctx.font = '700 ' + size + 'px ' + FONT;
      return ctx.measureText(text).width;
    };
  };

  HeartAnimation.prototype._setup = function (keepProgress) {
    var cv = this.canvas;
    var w = cv.clientWidth, h = cv.clientHeight;
    var dpr = Math.min(root.devicePixelRatio || 1, 3);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    this.w = w; this.h = h; this.dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Область под сердце: сверху отступ, снизу место для подписи и кнопки
    var top = 70, availH = Math.max(200, h - top - 230);
    var W = Math.min(w * 0.94, 640), ky = 1;
    if (0.91 * W > availH) W = availH / 0.91;                 // ландшафт / низкий экран
    else ky = clamp(availH / (0.91 * W), 1, 1.3);            // портрет: вытягиваем по высоте
    var fs = clamp(W / 400, 0.95, 1.6);
    this.fs = fs;
    this.lift = 30 * fs;

    var layout = buildLayout({
      width: W,
      sizes: BASE_SIZES.map(function (s) { return s * fs; }),
      gap: 6 * fs,
      phrases: this.cfg.phrases,
      seed: this.cfg.seed,
      yScale: ky
    }, this._measureFn());

    var old = this.items, oldSpawned = this.spawned, now = performance.now();
    var items = layout.items;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      it.dx = (Math.random() * 2 - 1) * 10 * fs;
      it.born = null;
      it.fontMain = '700 ' + it.size + 'px ' + FONT;
      it.fontBig = '700 ' + (it.size + 1) + 'px ' + FONT;
    }
    if (keepProgress && old.length) {
      var count = Math.round(oldSpawned / old.length * items.length);
      for (var j = 0; j < count; j++) {
        items[j].born = (old.length === items.length && old[j].born !== null) ? old[j].born : now - ANIM_MS;
      }
      this.spawned = count;
    } else {
      this.spawned = 0;
    }
    this.items = items;
    this.layout = layout;
    this.ox = w / 2;
    this.oy = top + availH / 2 + layout.cy;
    this.flashing = [];
    this.layer = null;
    if (this.state === 'live') this._renderLayer();
  };

  HeartAnimation.prototype._drawItem = function (ctx, it, now) {
    var u = clamp((now - it.born) / ANIM_MS);
    var e = 1 - Math.pow(1 - u, 3);
    var c = it.color;
    var x = this.ox + it.x, y = this.oy - it.y;
    var px = x + it.dx * (1 - e);
    var py = y - (1 - e) * this.lift;
    var s = this.fs;

    ctx.font = it.fontMain;
    ctx.fillStyle = rgb(mix(BG, dim(c, 0.30), e));
    ctx.fillText(it.text, x + 1.5 * s, y + 2 * s);

    ctx.font = it.fontBig;
    ctx.fillStyle = rgb(mix(BG, dim(c, 0.20), e * e));
    ctx.fillText(it.text, px, py);

    var flash = 0.75 * Math.sin(Math.PI * clamp((u - 0.55) / 0.45));
    ctx.font = it.fontMain;
    ctx.fillStyle = rgb(mix(mix(BG, c, Math.pow(e, 1.5)), FLASH, flash));
    ctx.fillText(it.text, px, py);
  };

  // После заполнения «запекаем» сердце в offscreen-слой — кадры дешёвые, батарея целее
  HeartAnimation.prototype._renderLayer = function () {
    var layer = document.createElement('canvas');
    layer.width = this.canvas.width;
    layer.height = this.canvas.height;
    var lctx = layer.getContext('2d');
    lctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.shadowColor = 'rgba(255, 50, 80, 0.55)';      // мягкое свечение запекаем один раз
    lctx.shadowBlur = 5 * this.dpr;
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      this._drawItem(lctx, it, it.born === null ? 0 : it.born + ANIM_MS * 2);
    }
    this.layer = layer;
  };

  HeartAnimation.prototype._tick = function (now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this._tick);
    var ctx = this.ctx, items = this.items, n = items.length, i;

    ctx.clearRect(0, 0, this.w, this.h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.state === 'filling') {
      var target = Math.min(n, Math.floor(clamp((now - this.t0) / this.cfg.duration) * n));
      while (this.spawned < target) { items[this.spawned].born = now; this.spawned++; }

      for (i = 0; i < this.spawned; i++) this._drawItem(ctx, items[i], now);

      if (this.spawned >= n && now - items[n - 1].born >= ANIM_MS) {
        this.state = 'live';
        this._renderLayer();
        this.lastFlash = now;
        if (this.hooks.onComplete) this.hooks.onComplete();
      }
      return;
    }

    // live: статичный слой + мерцание отдельных фраз
    if (this.layer) ctx.drawImage(this.layer, 0, 0, this.w, this.h);

    if (now - this.lastFlash > 140) {
      this.lastFlash = now;
      var idx = Math.floor(Math.random() * n);
      this.flashing.push({ it: items[idx], t0: now });
      if (Math.random() < 0.18) {            // иногда — «рябь» по соседним фразам
        for (var d = 1; d <= 3; d++) {
          var nb = items[idx + d];
          if (nb) this.flashing.push({ it: nb, t0: now + d * 110 });
        }
      }
    }

    var keep = [];
    for (i = 0; i < this.flashing.length; i++) {
      var f = this.flashing[i];
      var k = (now - f.t0) / 1000;
      if (k < 0) { keep.push(f); continue; }
      if (k >= 1) continue;
      keep.push(f);
      var env = Math.sin(Math.PI * k);
      var it = f.it;
      ctx.font = '700 ' + (it.size * (1 + 0.10 * env)) + 'px ' + FONT;
      ctx.fillStyle = rgb(mix(it.color, FLASH, 0.8 * env));
      ctx.fillText(it.text, this.ox + it.x, this.oy - it.y);
    }
    this.flashing = keep;

    // «рябь» от касания: волна света расходится от пальца по фразам
    if (this.ripples.length) {
      var rs = [], span = this.layout.width * 0.8, band = 26 * this.fs;
      for (var q = 0; q < this.ripples.length; q++) {
        var r = this.ripples[q], kk = (now - r.t0) / 1000;
        if (kk >= 1.6) continue;
        rs.push(r);
        var radius = kk * span, fade = 1 - kk / 1.6;
        for (i = 0; i < n; i++) {
          var o = items[i], sx = this.ox + o.x, sy = this.oy - o.y;
          var dd = Math.abs(Math.hypot(sx - r.x, sy - r.y) - radius);
          if (dd >= band) continue;
          var e2 = (1 - dd / band) * fade;
          ctx.font = '700 ' + (o.size * (1 + 0.14 * e2)) + 'px ' + FONT;
          ctx.fillStyle = rgb(mix(o.color, FLASH, 0.9 * e2));
          ctx.fillText(o.text, sx, sy);
        }
      }
      this.ripples = rs;
    }
  };

  HeartAnimation.prototype._onTap = function (e) {
    if (this.state !== 'live') return;
    var rect = this.canvas.getBoundingClientRect();
    if (this.ripples.length >= 4) this.ripples.shift();
    this.ripples.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t0: performance.now() });
  };

  HeartAnimation.prototype._onResize = function () {
    var self = this;
    clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(function () {
      if (self.canvas.clientWidth && self.canvas.clientHeight) self._setup(true);
    }, 200);
  };

  HeartAnimation.prototype.start = function () {
    if (this.running) return;
    this.state = 'filling';
    this.items = [];
    this._setup(false);
    this.running = true;
    this.t0 = performance.now();
    root.addEventListener('resize', this._onResize);
    root.addEventListener('orientationchange', this._onResize);
    this.canvas.addEventListener('pointerdown', this._onTap);
    this.raf = requestAnimationFrame(this._tick);
  };

  HeartAnimation.prototype.stop = function () {
    this.running = false;
    cancelAnimationFrame(this.raf);
    root.removeEventListener('resize', this._onResize);
    root.removeEventListener('orientationchange', this._onResize);
    this.canvas.removeEventListener('pointerdown', this._onTap);
  };

  var api = { HeartAnimation: HeartAnimation, buildLayout: buildLayout, BASE_SIZES: BASE_SIZES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Heart = api;
})(typeof window !== 'undefined' ? window : globalThis);
