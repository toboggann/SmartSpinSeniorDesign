(function () {
  const configs = {
    primary:   { waveColor: 'rgba(100,200,230,0.45)', foamColor: 'rgba(255,255,255,0.22)' },
    secondary: { waveColor: 'rgba(160,215,245,0.5)',  foamColor: 'rgba(255,255,255,0.35)' },
    accent:    { waveColor: 'rgba(80,195,140,0.45)',  foamColor: 'rgba(255,255,255,0.22)' },
    image:     { waveColor: 'rgba(100,200,230,0.45)', foamColor: 'rgba(255,255,255,0.22)' }
  };

  function initButton(btn) {
    const type = btn.dataset.wave;
    const cfg = configs[type] || configs.primary;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:inherit;';
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';

    const inner = document.createElement('span');
    inner.className = 'btn-wave-label';
    inner.style.cssText = 'position:relative;z-index:2;pointer-events:none;';
    while (btn.firstChild) inner.appendChild(btn.firstChild);
    btn.appendChild(canvas);
    btn.appendChild(inner);

    const ctx = canvas.getContext('2d');
    let offset = 0;
    let fillTarget = 0.42;
    let fillCurrent = 0.42;

    function getW() { return canvas.width  / devicePixelRatio; }
    function getH() { return canvas.height / devicePixelRatio; }

    function resize() {
      const rect = btn.getBoundingClientRect();
      if (!rect.width) return;
      canvas.width  = Math.round(rect.width  * devicePixelRatio);
      canvas.height = Math.round(rect.height * devicePixelRatio);
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    function drawWave(yBase, amplitude, speed, phase, color) {
      const w = getW(), h = getH();
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x++) {
        const y = yBase
          + Math.sin((x / w) * Math.PI * 2.5 + offset * speed + phase) * amplitude
          + Math.sin((x / w) * Math.PI * 4.0 + offset * speed * 1.3 + phase) * (amplitude * 0.4);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    function draw() {
      const w = getW(), h = getH();
      ctx.clearRect(0, 0, w, h);
      fillCurrent += (fillTarget - fillCurrent) * 0.05;
      const yBase = h * (1 - fillCurrent);
      drawWave(yBase + 4, 3.5, 1.2, 0,             cfg.waveColor);
      drawWave(yBase,     2.5, 0.9, Math.PI * 0.6,  cfg.foamColor);
      offset += 0.04;
    }

    function loop() { draw(); requestAnimationFrame(loop); }

    btn.addEventListener('mouseenter', () => { fillTarget = 0.62; });
    btn.addEventListener('mouseleave', () => { fillTarget = 0.42; });

    btn.addEventListener('click', () => {
      btn.classList.remove('btn-spinning');
      void btn.offsetWidth;
      btn.classList.add('btn-spinning');
      btn.addEventListener('animationend', () => btn.classList.remove('btn-spinning'), { once: true });
    });

    setTimeout(() => { resize(); loop(); }, 50);
    window.addEventListener('resize', resize);
  }

  function init() {
    document.querySelectorAll('.btn-primary, .btn-secondary, .btn-accent, .btn-image').forEach(btn => {
      if (btn.dataset.waveInit) return;
      btn.dataset.waveInit = '1';

      if      (btn.classList.contains('btn-primary'))   btn.dataset.wave = 'primary';
      else if (btn.classList.contains('btn-secondary'))  btn.dataset.wave = 'secondary';
      else if (btn.classList.contains('btn-accent'))     btn.dataset.wave = 'accent';
      else if (btn.classList.contains('btn-image'))      btn.dataset.wave = 'image';

      initButton(btn);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();