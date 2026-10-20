/* Фон: редкие тёплые искорки, медленно поднимающиеся вверх. Лёгкий canvas, ~36 частиц. */
(function (root) {
  'use strict';

  function Particles(canvas, opts) {
    opts = opts || {};
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.count = opts.count || 36;
    this.list = [];
    this.running = false;
    this._tick = this._tick.bind(this);
    this._resize = this._resize.bind(this);
  }

  Particles.prototype._resize = function () {
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    this.w = this.cv.clientWidth;
    this.h = this.cv.clientHeight;
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Particles.prototype._spawn = function (anywhere) {
    return {
      x: Math.random() * this.w,
      y: anywhere ? Math.random() * this.h : this.h + 10,
      r: 0.6 + Math.random() * 1.7,
      vy: 6 + Math.random() * 14,          // px/сек
      sway: 8 + Math.random() * 18,
      ph: Math.random() * Math.PI * 2,
      tw: 0.5 + Math.random() * 1.2,
      a: 0.12 + Math.random() * 0.35
    };
  };

  Particles.prototype.start = function () {
    if (this.running) return;
    this._resize();
    root.addEventListener('resize', this._resize);
    this.list = [];
    for (var i = 0; i < this.count; i++) this.list.push(this._spawn(true));
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._tick);
  };

  Particles.prototype.stop = function () {
    this.running = false;
    cancelAnimationFrame(this.raf);
    root.removeEventListener('resize', this._resize);
  };

  Particles.prototype._tick = function (now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this._tick);
    var dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i];
      p.y -= p.vy * dt;
      p.ph += p.tw * dt;
      if (p.y < -10) { this.list[i] = this._spawn(false); continue; }
      var x = p.x + Math.sin(p.ph) * p.sway;
      var a = p.a * (0.55 + 0.45 * Math.sin(p.ph * 2.3));
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 110, 140, ' + a.toFixed(3) + ')';
      ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  root.Particles = Particles;
})(window);
