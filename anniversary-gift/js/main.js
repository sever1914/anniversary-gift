/*
 * Сценарий: пожелания -> сердце -> кнопка «Посмотреть сюрприз» -> видео.
 * Для отладки: добавь к ссылке ?skip — сразу откроется сердце.
 */
(function () {
  'use strict';

  var cfg = window.GIFT_CONFIG;
  var $ = function (id) { return document.getElementById(id); };

  var particles = new Particles($('bg'));
  particles.start();

  var introEl = $('intro');
  var stageEl = $('stage');
  var heartCanvas = $('heart');
  var captionEl = $('heart-caption');
  var btn = $('surprise-btn');

  btn.textContent = cfg.surpriseLabel;
  captionEl.textContent = (cfg.heart.caption || '').replace(/\{name\}/g, cfg.herName || '');

  var heart = new Heart.HeartAnimation(heartCanvas, cfg.heart, {
    onComplete: function () {
      heartCanvas.classList.add('live');           // сердце «дышит»
      setTimeout(function () { captionEl.classList.add('show'); }, 600);
      setTimeout(function () { btn.classList.add('show'); }, 2200);
    }
  });

  var player = new VideoPlayer($('video-modal'), cfg.video);
  btn.addEventListener('click', function () { player.open(); });

  function showHeart() {
    introEl.classList.remove('is-active');
    stageEl.classList.add('is-active');
    // дать экрану проявиться, затем начать заполнение
    setTimeout(function () { heart.start(); }, 700);
  }

  var intro = new Intro(introEl, cfg, { onFinish: showHeart });

  function begin() {
    if (/[?&]skip\b/.test(location.search)) { showHeart(); return; }
    intro.start();
  }

  // Подождать веб-шрифт, но не дольше 1.2 с (плохая сеть не должна задерживать подарок)
  var started = false;
  function go() { if (!started) { started = true; begin(); } }
  if (document.fonts && document.fonts.load) {
    // fonts.ready резолвится сразу, пока шрифт ещё ни разу не понадобился — просим явно
    Promise.race([
      Promise.all([
        document.fonts.load('italic 400 24px "Cormorant Garamond"', 'Привет'),
        document.fonts.load('italic 400 24px "Cormorant Garamond"', 'Hello')
      ]),
      new Promise(function (r) { setTimeout(r, 1200); })
    ]).then(go);
  } else {
    go();
  }
})();
