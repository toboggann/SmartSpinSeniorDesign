const canvas = document.getElementById("particles");

if (canvas) {
  const ctx = canvas.getContext("2d");
  let bubbles = [];
  let lightDots = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createScene();
  }

  window.addEventListener("resize", resizeCanvas);

  class Bubble {
    constructor(x, y, radius, speed, drift, alpha) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.speed = speed;
      this.drift = drift;
      this.alpha = alpha;
      this.offset = Math.random() * Math.PI * 2;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

      const gradient = ctx.createRadialGradient(
        this.x - this.radius * 0.3,
        this.y - this.radius * 0.3,
        this.radius * 0.15,
        this.x,
        this.y,
        this.radius
      );

      gradient.addColorStop(0, `rgba(255,255,255,${this.alpha})`);
      gradient.addColorStop(0.55, `rgba(210,240,255,${this.alpha * 0.55})`);
      gradient.addColorStop(1, `rgba(255,255,255,0.03)`);

      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(
        this.x - this.radius * 0.28,
        this.y - this.radius * 0.28,
        this.radius * 0.18,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = `rgba(255,255,255,${this.alpha * 0.55})`;
      ctx.fill();
    }

    update(frame) {
      this.y -= this.speed;
      this.x += Math.sin(frame * 0.01 + this.offset) * this.drift;

      if (this.y + this.radius < 0) {
        this.y = canvas.height + this.radius + Math.random() * 80;
        this.x = Math.random() * canvas.width;
      }

      this.draw();
    }
  }

  class LightDot {
    constructor(x, y, size, speed, alpha) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.speed = speed;
      this.alpha = alpha;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${this.alpha})`;
      ctx.fill();
    }

    update() {
      this.y += this.speed;

      if (this.y - this.size > canvas.height) {
        this.y = -10;
        this.x = Math.random() * canvas.width;
      }

      this.draw();
    }
  }

  function createScene() {
    bubbles = [];
    lightDots = [];

    const bubbleCount = Math.max(18, Math.floor((canvas.width * canvas.height) / 22000));
    const dotCount = Math.max(25, Math.floor((canvas.width * canvas.height) / 28000));

    for (let i = 0; i < bubbleCount; i++) {
      bubbles.push(
        new Bubble(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          Math.random() * 18 + 6,
          Math.random() * 0.9 + 0.35,
          Math.random() * 0.35 + 0.08,
          Math.random() * 0.22 + 0.1
        )
      );
    }

    for (let i = 0; i < dotCount; i++) {
      lightDots.push(
        new LightDot(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          Math.random() * 2.4 + 0.8,
          Math.random() * 0.25 + 0.06,
          Math.random() * 0.18 + 0.04
        )
      );
    }
  }

  function drawWaterGlow() {
    const glow = ctx.createLinearGradient(0, 0, 0, canvas.height);
    glow.addColorStop(0, "rgba(255,255,255,0.16)");
    glow.addColorStop(0.18, "rgba(255,255,255,0.06)");
    glow.addColorStop(0.6, "rgba(255,255,255,0.01)");
    glow.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  let frame = 0;

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawWaterGlow();

    for (const dot of lightDots) {
      dot.update();
    }

    for (const bubble of bubbles) {
      bubble.update(frame);
    }

    frame++;
    requestAnimationFrame(animate);
  }

  resizeCanvas();
  animate();
}