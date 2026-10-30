/* Aarthi Travels — hero slider, scroll reveal, subtle card tilt.
   Motion is reduced (cross-fade only) when the visitor prefers reduced motion.
   Everything here is progressive enhancement: if this file fails, content stays visible
   (the page <head> removes the `js` class after 4s unless window.__aarthiAnim is set). */
(function () {
  'use strict';
  window.__aarthiAnim = true;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Hero slider ----------
     Horizontal slide + cross-fade + Ken Burns. The incoming slide is prepared off to the side
     (.is-entering), decoded, then slid in (.is-active) while the outgoing slide (.is-leaving)
     stays opaque underneath, so there is never a blank or flickering frame. */
  var SLIDE_MS = 5500;      // autoplay interval
  var TRANSITION_MS = 1000; // must match the transition duration in style.css
  var SHIFT = 14;           // % the incoming slide travels

  function initSlider() {
    var root = document.querySelector('[data-hero-slider]');
    if (!root) return;
    var slides = Array.prototype.slice.call(root.querySelectorAll('.hero-bg-slide'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.hero-dot'));
    var barFill = root.querySelector('.hero-progress span');
    var caption = root.querySelector('.slide-caption');
    var pauseBtn = root.querySelector('.hero-pause');
    var n = slides.length;
    if (!n) return;

    var idx = 0, timer = null, busy = false, queued = null;
    var userPaused = false, touchHold = false, focusHold = false;
    root.style.setProperty('--slide-ms', SLIDE_MS + 'ms');

    slides.forEach(function (s, i) { s.setAttribute('aria-hidden', i === 0 ? 'false' : 'true'); });

    function setCaption() {
      if (!caption) return;
      var s = slides[idx];
      caption.textContent = '';
      var t = document.createElement('strong'); t.className = 'cap-title'; t.textContent = s.getAttribute('data-title') || '';
      var x = document.createElement('span'); x.className = 'cap-text'; x.textContent = s.getAttribute('data-text') || '';
      caption.appendChild(t); caption.appendChild(document.createTextNode(' \u2013 ')); caption.appendChild(x);
    }
    function setDots() {
      dots.forEach(function (d, i) { if (i === idx) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    }
    function isPaused() { return userPaused || touchHold || focusHold || document.hidden; }
    function restartBar() {
      if (!barFill) return;
      barFill.classList.remove('run'); void barFill.offsetWidth;
      if (!isPaused() && n > 1) barFill.classList.add('run');
    }
    function stopTimer() { if (timer) { clearTimeout(timer); timer = null; } }
    function schedule() {
      stopTimer();
      root.classList.toggle('is-paused', isPaused());
      if (n < 2 || isPaused()) return;
      timer = setTimeout(function () { go(idx + 1, 1); }, SLIDE_MS);
    }
    function pause() { stopTimer(); root.classList.add('is-paused'); }
    function resume() { restartBar(); schedule(); }

    /* Start loading an upcoming image so the transition never waits on the network */
    function preload(i) {
      var img = slides[(i + n) % n].querySelector('img');
      if (img && img.loading === 'lazy') img.loading = 'eager';
    }
    /* Call cb once the slide image is loaded and decoded (or after a 3s safety timeout) */
    function ready(slide, cb) {
      var img = slide.querySelector('img'), done = false;
      function fin() {
        if (done) return; done = true;
        if (img && img.decode) { img.decode().then(cb, cb); } else { cb(); }
      }
      if (!img || (img.complete && img.naturalWidth)) { fin(); return; }
      img.loading = 'eager';
      img.addEventListener('load', fin, { once: true });
      img.addEventListener('error', fin, { once: true });
      setTimeout(fin, 3000);
    }

    /* Where the slider is heading: the queued slide if a request is waiting, otherwise the current one */
    function pendingIdx() { return queued ? queued.t : idx; }

    function go(target, dir) {
      target = (target + n) % n;
      if (target === idx && !busy) return;
      if (busy) { queued = { t: target, d: dir }; return; } // one animation at a time; keep the latest request
      busy = true; stopTimer();
      var from = idx, incoming = slides[target], outgoing = slides[from];
      ready(incoming, function () {
        root.style.setProperty('--shift', (reduce ? 0 : (dir < 0 ? -SHIFT : SHIFT)) + '%');
        incoming.classList.remove('is-leaving');
        incoming.classList.add('is-entering');
        void incoming.offsetWidth; // commit the start position before animating
        outgoing.classList.remove('is-active'); outgoing.classList.add('is-leaving');
        incoming.classList.remove('is-entering'); incoming.classList.add('is-active');
        outgoing.setAttribute('aria-hidden', 'true'); incoming.setAttribute('aria-hidden', 'false');
        idx = target; setDots(); setCaption(); restartBar(); schedule(); preload(idx + 1);
        setTimeout(function () {
          outgoing.classList.remove('is-leaving');
          busy = false;
          if (queued) { var q = queued; queued = null; go(q.t, q.d); }
        }, TRANSITION_MS + 60);
      });
    }

    root.querySelectorAll('.hero-arrow').forEach(function (b) {
      b.addEventListener('click', function () { var d = b.classList.contains('prev') ? -1 : 1; go(pendingIdx() + d, d); });
    });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i, i > idx ? 1 : -1); }); });

    if (pauseBtn) {
      pauseBtn.addEventListener('click', function () {
        userPaused = !userPaused;
        pauseBtn.textContent = userPaused ? 'Play' : 'Pause';
        pauseBtn.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
        if (userPaused) pause(); else resume();
      });
    }

    /* Keyboard focus pauses autoplay; a mouse click that leaves focus on a button does not */
    root.addEventListener('focusin', function (e) {
      var kb = true; try { kb = e.target.matches(':focus-visible'); } catch (err) { /* old browsers */ }
      if (kb) { focusHold = true; pause(); }
    });
    root.addEventListener('focusout', function () { if (focusHold) { focusHold = false; resume(); } });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') go(pendingIdx() - 1, -1); else if (e.key === 'ArrowRight') go(pendingIdx() + 1, 1);
    });

    /* Swipe: horizontal gestures change slides, vertical gestures still scroll the page */
    var x0 = 0, y0 = 0, tracking = false;
    root.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      tracking = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
      touchHold = true; pause();
    }, { passive: true });
    function endTouch(e) {
      if (!tracking) return; tracking = false; touchHold = false;
      var t = e.changedTouches && e.changedTouches[0];
      var dx = t ? t.clientX - x0 : 0, dy = t ? t.clientY - y0 : 0;
      if (e.type === 'touchend' && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        go(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      } else { resume(); }
    }
    root.addEventListener('touchend', endTouch, { passive: true });
    root.addEventListener('touchcancel', endTouch, { passive: true });

    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else resume(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) resume(); });

    setCaption(); setDots(); restartBar(); schedule();
    if (n > 1) {
      if (document.readyState === 'complete') preload(1);
      else window.addEventListener('load', function () { preload(1); });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initSlider();

    /* Stagger grid items by column so cards arrive one after another */
    document.querySelectorAll('.grid, .steps, .filter-bar').forEach(function (g) {
      var cols = 1;
      if (window.getComputedStyle) {
        var tpl = window.getComputedStyle(g).gridTemplateColumns;
        if (tpl && tpl !== 'none') cols = tpl.split(' ').length;
      }
      if (cols < 2) cols = 4;
      Array.prototype.forEach.call(g.children, function (c, i) {
        c.classList.add('reveal-item'); c.style.setProperty('--d', ((i % cols) * 0.1).toFixed(2) + 's');
      });
    });

    /* Scroll reveal */
    var els = document.querySelectorAll('.reveal, .reveal-item, .reveal-left, .reveal-right, .reveal-zoom, .content-section h2');
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
      els.forEach(function (el) { io.observe(el); });
      setTimeout(function () { els.forEach(function (el) { el.classList.add('is-visible'); }); }, 5000); // safety net
    }
    if (reduce || !finePointer) return;

    /* Subtle card tilt (max 3 degrees, mouse only) */
    var MAX = 3;
    document.querySelectorAll('.tilt').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        card.classList.add('is-tracking');
        card.style.setProperty('--ry', (px * MAX * 2).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-py * MAX * 2).toFixed(2) + 'deg');
      });
      card.addEventListener('pointerleave', function () {
        card.classList.remove('is-tracking');
        card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
      });
    });
  });
})();
