/*
 * Плеер сюрприза: свой mp4 (с подписями по таймкодам) или YouTube.
 * На iPhone видео запускается из обработчика нажатия, поэтому со звуком и без блокировок.
 */
(function (root) {
  'use strict';

  function VideoPlayer(modalEl, cfg) {
    this.modal = modalEl;
    this.cfg = cfg || {};
    this.host = modalEl.querySelector('#video-host');
    this.capEl = modalEl.querySelector('#video-caption');
    this.closeBtn = modalEl.querySelector('#video-close');
    this.media = null;
    this.activeCap = -1;
    this.onClose = null;

    var self = this;
    this.closeBtn.addEventListener('click', function () { self.close(); });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !self.modal.hidden) self.close();
    });
  }

  VideoPlayer.prototype._buildYouTube = function () {
    var f = document.createElement('iframe');
    var id = encodeURIComponent(this.cfg.youtubeId);
    f.src = 'https://www.youtube-nocookie.com/embed/' + id +
            '?playsinline=1&rel=0&modestbranding=1&autoplay=1';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.setAttribute('allowfullscreen', '');
    return f;
  };

  VideoPlayer.prototype._buildFile = function () {
    var self = this;
    var v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.controls = true;
    v.preload = 'metadata';
    if (this.cfg.poster) v.poster = this.cfg.poster;
    v.src = this.cfg.src;

    v.addEventListener('error', function () {
      self.host.textContent = '';
      var m = document.createElement('div');
      m.className = 'video-missing';
      m.textContent = 'Видео не найдено: ' + self.cfg.src +
        '. Положи файл в эту папку (H.264 + AAC, .mp4) или укажи youtubeId в js/config.js.';
      self.host.appendChild(m);
    });

    var caps = this.cfg.captions || [];
    if (caps.length) {
      v.addEventListener('timeupdate', function () {
        var t = v.currentTime, found = -1;
        for (var i = 0; i < caps.length; i++) {
          if (t >= caps[i].from && t < caps[i].to) { found = i; break; }
        }
        if (found === self.activeCap) return;
        self.activeCap = found;
        if (found < 0) { self.capEl.classList.remove('show'); return; }
        self.capEl.classList.remove('show');
        setTimeout(function () {
          if (self.activeCap !== found) return;
          self.capEl.textContent = caps[found].text;
          self.capEl.classList.add('show');
        }, 220);
      });
    }
    return v;
  };

  VideoPlayer.prototype.open = function () {
    var self = this;
    this.host.textContent = '';
    this.capEl.textContent = '';
    this.capEl.classList.remove('show');
    this.activeCap = -1;

    this.media = this.cfg.youtubeId ? this._buildYouTube() : this._buildFile();
    this.host.appendChild(this.media);

    this.modal.hidden = false;
    requestAnimationFrame(function () { self.modal.classList.add('open'); });

    if (this.media.tagName === 'VIDEO') {
      var p = this.media.play();
      if (p && p.catch) p.catch(function () { /* пользователь запустит кнопкой плеера */ });
    }
  };

  VideoPlayer.prototype.close = function () {
    var self = this;
    if (this.media && this.media.tagName === 'VIDEO') this.media.pause();
    this.modal.classList.remove('open');
    setTimeout(function () {
      self.modal.hidden = true;
      self.host.textContent = '';        // останавливает и YouTube, и загрузку файла
      self.media = null;
      if (self.onClose) self.onClose();
    }, 450);
  };

  root.VideoPlayer = VideoPlayer;
})(window);
