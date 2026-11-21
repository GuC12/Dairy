import React, { useEffect, useRef } from 'react';
import { hexToRgb } from '../engine/photoAnalyzer';

export type WorldThemeId = 'indigo' | 'turrell';

interface BackdropCanvasProps {
  world: WorldThemeId;
  activeColors: string[];
}

const WORLD_BASE_PALETTES: Record<
  WorldThemeId,
  { bgTop: string; bgBottom: string; orbs: [string, string, string, string] }
> = {
  indigo: {
    bgTop: '#191636',
    bgBottom: '#112240',
    orbs: ['#8b5cf6', '#ec4899', '#0ea5e9', '#f59e0b'],
  },
  turrell: {
    bgTop: '#fff8f1',
    bgBottom: '#eff6ff',
    orbs: ['#fda4af', '#fcd34d', '#7dd3fc', '#c4b5fd'],
  },
};

export const BackdropCanvas: React.FC<BackdropCanvasProps> = ({
  world,
  activeColors,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.35 });
  const currentRgbRef = useRef<Array<{ r: number; g: number; b: number }>>([
    { r: 253, g: 164, b: 175 },
    { r: 252, g: 211, b: 77 },
    { r: 125, g: 211, b: 252 },
    { r: 196, g: 181, b: 253 },
  ]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / Math.max(1, window.innerWidth);
      mouseRef.current.y = e.clientY / Math.max(1, window.innerHeight);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // Частицы света и созвездия атмосферы
    const particles = Array.from({ length: 32 }, (_, i) => ({
      x: ((i * 137) % 100) / 100,
      y: ((i * 293) % 100) / 100,
      vx: (Math.sin(i * 2.1) * 0.00018),
      vy: (Math.cos(i * 1.7) * 0.00018),
      r: 2 + (i % 4) * 1.5,
    }));

    let rafId = 0;
    const start = performance.now();

    const render = (now: number) => {
      const t = (now - start) / 1000;
      const wp = WORLD_BASE_PALETTES[world];
      const isDark = world === 'indigo';

      // Плавная интерполяция цветов к цветам активного дня
      const targetHexes =
        activeColors.length >= 2
          ? [
              activeColors[0] ?? wp.orbs[0],
              activeColors[1] ?? wp.orbs[1],
              activeColors[2] ?? wp.orbs[2],
              activeColors[3] ?? wp.orbs[3],
            ]
          : wp.orbs;

      targetHexes.forEach((hex, idx) => {
        const target = hexToRgb(hex);
        const cur = currentRgbRef.current[idx];
        cur.r += (target.r - cur.r) * 0.035;
        cur.g += (target.g - cur.g) * 0.035;
        cur.b += (target.b - cur.b) * 0.035;
      });

      // 1. Базовый шёлковый градиент неба (никакого чёрного!)
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, wp.bgTop);
      bgGrad.addColorStop(1, wp.bgBottom);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // 2. Акварельно-световые волны (4 плавающих облака + отклик на мышь)
      const mx = mouseRef.current.x * W;
      const my = mouseRef.current.y * H;

      const orbCenters = [
        {
          x: W * (0.2 + Math.sin(t * 0.25) * 0.12) + (mx - W * 0.5) * 0.08,
          y: H * (0.22 + Math.cos(t * 0.2) * 0.1) + (my - H * 0.5) * 0.08,
          radius: Math.max(W, H) * 0.52,
        },
        {
          x: W * (0.82 + Math.cos(t * 0.22) * 0.1) - (mx - W * 0.5) * 0.06,
          y: H * (0.28 + Math.sin(t * 0.28) * 0.12),
          radius: Math.max(W, H) * 0.48,
        },
        {
          x: W * (0.35 + Math.cos(t * 0.18) * 0.15),
          y: H * (0.78 + Math.sin(t * 0.24) * 0.1),
          radius: Math.max(W, H) * 0.55,
        },
        {
          x: mx,
          y: my,
          radius: Math.max(W, H) * 0.36,
        },
      ];

      orbCenters.forEach((orb, idx) => {
        const c = currentRgbRef.current[idx];
        const alpha = isDark ? 0.34 : 0.36;
        const g = ctx.createRadialGradient(
          orb.x,
          orb.y,
          10,
          orb.x,
          orb.y,
          orb.radius
        );
        g.addColorStop(
          0,
          `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(
            c.b
          )}, ${alpha})`
        );
        g.addColorStop(
          0.55,
          `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(
            c.b
          )}, ${alpha * 0.4})`
        );
        g.addColorStop(
          1,
          `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, 0)`
        );
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      });

      // 3. Парящие частицы света и тонкие линии созвездий вокруг курсора
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x = (p.x + p.vx + 1) % 1;
        p.y = (p.y + p.vy + 1) % 1;
        const px = p.x * W;
        const py = p.y * H;

        const c = currentRgbRef.current[i % 4];
        ctx.fillStyle = isDark
          ? `rgba(255, 255, 255, 0.35)`
          : `rgba(${Math.round(c.r * 0.75)}, ${Math.round(
              c.g * 0.75
            )}, ${Math.round(c.b * 0.75)}, 0.38)`;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();

        // Тонкая нить к курсору, если частица рядом
        const distToMouse = Math.hypot(px - mx, py - my);
        if (distToMouse < 190) {
          const lineAlpha = (1 - distToMouse / 190) * (isDark ? 0.25 : 0.22);
          ctx.strokeStyle = isDark
            ? `rgba(255, 255, 255, ${lineAlpha})`
            : `rgba(${Math.round(c.r * 0.65)}, ${Math.round(
                c.g * 0.65
              )}, ${Math.round(c.b * 0.65)}, ${lineAlpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(mx, my);
          ctx.stroke();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, [world, activeColors]);

  return (
    <canvas
      ref={canvasRef}
      className="backdrop-live-canvas"
      aria-hidden="true"
    />
  );
};
