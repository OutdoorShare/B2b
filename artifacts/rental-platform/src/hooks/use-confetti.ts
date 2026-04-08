import { useEffect } from "react";

export function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const COLORS = ["#3ab549","#22c55e","#16a34a","#4ade80","#facc15","#fb923c","#60a5fa","#f472b6","#a78bfa"];
  type P = { x:number;y:number;r:number;c:string;vx:number;vy:number;va:number;a:number;w:number;h:number };
  const particles: P[] = Array.from({length: 160}, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 200,
    r: Math.random() * Math.PI * 2,
    c: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 3,
    vy: 2 + Math.random() * 4,
    va: (Math.random() - 0.5) * 0.2,
    a: 1,
    w: 8 + Math.random() * 8,
    h: 4 + Math.random() * 4,
  }));
  let raf: number;
  let elapsed = 0;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    elapsed++;
    particles.forEach(p => {
      p.y += p.vy;
      p.x += p.vx;
      p.r += p.va;
      if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
      if (elapsed > 160) p.a = Math.max(0, p.a - 0.008);
      ctx.save();
      ctx.globalAlpha = p.a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    });
    if (elapsed < 300) raf = requestAnimationFrame(tick);
    else canvas.remove();
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); canvas.remove(); };
}

export function useConfetti(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return fireConfetti();
  }, [active]);
}
