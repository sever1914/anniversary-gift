/*
 * Экран приветствия: пожелания по одному. Дальше — тап по экрану или свайп влево,
 * назад — свайп вправо. Читать можно сколько угодно: автоматического перехода нет.
 */
(function (root) {
  'use strict';

  var LOCK_MS = 750;        // защита от случайного двойного тапа
  var SWIPE_PX = 45;
  var TAP_PX = 14;

  function Intro(rootEl, cfg, hooks) {
    this.el = rootEl;
    this.wishEl = rootEl.querySelector('#wish');
    this.dotsEl = rootEl.querySelector('#dots');
    this.hintEl = rootEl.querySelector('#hint');
    this.wishes = cfg.wishes;
    this.name = cfg.herName || '';
    this.hooks = hooks || {};
    this.i = -1;
    this.lockedUntil = 0;
    this.finished = false;
    this._down = null;
    this._bind();
    this._buildDots();
  }

  Intro.prototype._buildDots = function () {
    this.dotsEl.textContent = '';
    for (var k = 0; k < this.wishes.length; k++) this.dotsEl.appendChild(document.createElement('i'));
  };

  Intro.prototype._bind = function () {
    var self = this;
    this.el.addEventListener('pointerdown', function (e) {
      self._down = { x: e.clientX, y: e.clientY };
    });
    this.el.addEventListener('pointerup', function (e) {
      if (!self._down) return;
      var dx = e.clientX - self._down.x, dy = e.clientY - self._down.y;
      self._down = null;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) self.next(); else self.prev();
      } else if (Math.abs(dy) > SWIPE_PX && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) self.next(); else self.prev();      // свайп вверх — дальше, как в сторис
      } else if (Math.abs(dx) < TAP_PX && Math.abs(dy) < TAP_PX) {
        self.next();
      }
    });
    this.el.addEventListener('pointercancel', function () { self._down = null; });
    this._onKey = function (e) {
      if (!self.el.classList.contains('is-active')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') self.next();
      else if (e.key === 'ArrowLeft') self.prev();
    };
    root.addEventListener('keydown', this._onKey);
  };

  Intro.prototype._render = function (idx) {
    var wish = this.wishes[idx];
    var text = wish.text.replace(/\{name\}/g, this.name);
    var el = this.wishEl;
    el.textContent = '';
    el.classList.remove('out');
    el.classList.toggle('big', !!wish.big);

    var n = 0;
    text.split('\n').forEach(function (line, li) {
      if (li > 0) el.appendChild(document.createElement('br'));
      line.split(' ').forEach(function (word, wi, arr) {
        if (!word) return;
        var span = document.createElement('span');
        span.className = 'w';
        span.style.setProperty('--i', n++);
        span.textContent = word;
        el.appendChild(span);
        if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
      });
    });

    var dots = this.dotsEl.children;
    for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('on', k === idx);
    // подсказка нужна только в самом начале
    if (idx > 0) this.hintEl.style.display = 'none';
  };

  Intro.prototype._go = function (idx) {
    var self = this;
    var now = performance.now();
    if (now < this.lockedUntil || this.finished) return;
    this.lockedUntil = now + LOCK_MS;

    var show = function () { self.i = idx; self._render(idx); };
    if (this.i < 0) { show(); return; }
    this.wishEl.classList.add('out');
    setTimeout(show, 340);
  };

  Intro.prototype.start = function () { this._go(0); };

  Intro.prototype.next = function () {
    if (this.i < 0) return;
    if (this.i >= this.wishes.length - 1) {
      var now = performance.now();
      if (now < this.lockedUntil || this.finished) return;
      this.finished = true;
      this.wishEl.classList.add('out');
      root.removeEventListener('keydown', this._onKey);
      var self = this;
      setTimeout(function () { if (self.hooks.onFinish) self.hooks.onFinish(); }, 420);
      return;
    }
    this._go(this.i + 1);
  };

  Intro.prototype.prev = function () {
    if (this.i > 0) this._go(this.i - 1);
  };

  root.Intro = Intro;
})(window);
