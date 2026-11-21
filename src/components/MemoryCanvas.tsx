import React, { useEffect, useRef } from 'react';
import type { DiaryEntry } from '../types/diary';
import type { SpectrumMetrics } from '../engine/audioAnalyzer';

interface MemoryCanvasProps {
  entry: DiaryEntry;
  isPlaying?: boolean;
  getSpectrum?: () => SpectrumMetrics;
  compact?: boolean;
  pinnedPhotoIndex?: number | null;
  canvasRefOut?: React.RefObject<HTMLCanvasElement | null>;
}

interface CursorTrailPoint {
  x: number;
  y: number;
  born: number;
  color: string;
  size: number;
}

type WeatherEffectType = 'rain' | 'storm' | 'snow' | 'leaves' | 'mist' | 'none';

function detectWeatherEffect(entry: DiaryEntry): WeatherEffectType {
  const combined = `${entry.weather ?? ''} ${entry.text}`.toLowerCase();
  if (/(гроз|молн|шторм)/.test(combined)) return 'storm';
  if (/(дожд|морос|ливень|капл|лужах|мокрое стекло)/.test(combined)) return 'rain';
  if (/(снег|снеж|мороз|вьюг|метел|зима)/.test(combined)) return 'snow';
  if (/(туман|дымк|море|прибреж)/.test(combined)) return 'mist';
  if (/(осен|жёлтых листьях|желтых листьях|листопад|парк)/.test(combined))
    return 'leaves';
  return 'none';
}

export const MemoryCanvas: React.FC<MemoryCanvasProps> = ({
  entry,
  isPlaying = false,
  getSpectrum,
  compact = false,
  pinnedPhotoIndex = null,
  canvasRefOut,
}) => {
  const internalRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = canvasRefOut ?? internalRef;
  const imagesRef = useRef<HTMLImageElement[]>([]);

  const pointerRef = useRef<{
    nx: number;
    ny: number;
    active: boolean;
    trail: CursorTrailPoint[];
  }>({
    nx: 0.5,
    ny: 0.5,
    active: false,
    trail: [],
  });

  useEffect(() => {
    let cancelled = false;
    const imgs: HTMLImageElement[] = [];

    const loadAll = async () => {
      for (const ph of entry.photos) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          img.src = ph.dataUrl;
        });
        if (!cancelled) imgs.push(img);
      }
      if (!cancelled) {
        imagesRef.current = imgs;
      }
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [entry.photos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = compact ? 480 : 720;
    const H = compact ? 600 : 900; // строго 4:5
    canvas.width = W;
    canvas.height = H;

    const weatherType = detectWeatherEffect(entry);
    let rafId = 0;
    const startTime = performance.now();

    const drawFrame = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const { analysis, music } = entry;
      const { palette, visualParams, movement } = analysis;
      const ptr = pointerRef.current;

      const spec =
        isPlaying && getSpectrum
          ? getSpectrum()
          : {
              bass: isPlaying ? 0.35 + Math.sin(elapsed * 3) * 0.2 : 0.08,
              mid: 0.14,
              treble: 0.1,
              energy: isPlaying ? 0.42 : 0.12,
              bars: [],
            };

      // 1. Постоянный фон страницы с мягким музейным градиентом
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, palette.bg);
      bgGrad.addColorStop(1, palette.surface);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Тонкая акцентная полоса спектра по верхнему краю постера
      const topSpec = ctx.createLinearGradient(0, 0, W, 0);
      topSpec.addColorStop(0, palette.accent);
      topSpec.addColorStop(0.5, palette.secondary);
      topSpec.addColorStop(1, palette.accent);
      ctx.fillStyle = topSpec;
      ctx.fillRect(0, 0, W, compact ? 3 : 5);

      // 2. Постоянная внешняя рамка и шапка дневника
      const pad = Math.round(W * 0.055);
      const headerH = Math.round(H * 0.08);
      const footerH = Math.round(H * 0.19);

      ctx.strokeStyle = palette.ink;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = compact ? 1 : 1.5;
      ctx.strokeRect(pad * 0.55, pad * 0.55, W - pad * 1.1, H - pad * 1.1);
      ctx.globalAlpha = 1;

      // Шапка (индекс дня, 4 цветовых пробника Pantone, дата, погода)
      const headY = pad * 0.55 + headerH * 0.5;
      ctx.fillStyle = palette.ink;
      ctx.font = `600 ${Math.round(W * 0.022)}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'middle';
      const dayCode = `DAY // ${String(entry.indexNumber).padStart(2, '0')}`;
      ctx.fillText(dayCode, pad, headY);

      const chipColors = entry.photos[0]?.dominantColors ?? [
        palette.accent,
        palette.secondary,
      ];
      const chipStart =
        pad + ctx.measureText(dayCode).width + Math.round(W * 0.025);
      const chipSize = compact ? 7 : 10;
      chipColors.slice(0, 4).forEach((hex, cIdx) => {
        ctx.fillStyle = hex;
        ctx.fillRect(
          chipStart + cIdx * (chipSize + 4),
          headY - chipSize / 2,
          chipSize,
          chipSize
        );
      });

      ctx.fillStyle = palette.ink;
      ctx.globalAlpha = 0.74;
      ctx.font = `500 ${Math.round(W * 0.02)}px "JetBrains Mono", monospace`;
      const rightMeta = [entry.dateLabel, entry.weather]
        .filter(Boolean)
        .join(' · ');
      const metaWidth = ctx.measureText(rightMeta).width;
      ctx.fillText(rightMeta, W - pad - metaWidth, headY);
      ctx.globalAlpha = 1;

      // 3. Зона встроенного фото (зависит от whitespace и movement)
      const extraAir = visualParams.whitespace * (W * 0.085);
      const frameX = pad + extraAir * 0.5;
      const frameY = pad * 0.55 + headerH + extraAir * 0.35;
      const frameW = W - pad * 2 - extraAir;
      const frameH = H - pad * 1.1 - headerH - footerH - extraAir * 0.7;

      // Подложка под фото
      ctx.fillStyle = palette.surface;
      ctx.fillRect(frameX - 4, frameY - 4, frameW + 8, frameH + 8);

      const imgs = imagesRef.current;

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, frameW, frameH);
      ctx.clip();

      // Параллакс-сдвиг от курсора
      const parallaxX = ptr.active ? (ptr.nx - 0.5) * 14 : 0;
      const parallaxY = ptr.active ? (ptr.ny - 0.5) * 14 : 0;

      if (imgs.length > 0) {
        const isPinned =
          pinnedPhotoIndex !== null &&
          pinnedPhotoIndex >= 0 &&
          pinnedPhotoIndex < imgs.length;
        const cycleDur = Math.max(2.6, 7.5 / visualParams.rhythmSpeed);
        const totalIdx = elapsed / cycleDur;
        const curIdx = isPinned
          ? pinnedPhotoIndex
          : Math.floor(totalIdx) % imgs.length;
        const nextIdx = (curIdx + 1) % imgs.length;
        const phase = totalIdx - Math.floor(totalIdx);

        const fadeStart = movement === 'constructivism' ? 0.92 : 0.72;
        const alphaNext =
          !isPinned && imgs.length > 1 && phase > fadeStart
            ? (phase - fadeStart) / (1 - fadeStart)
            : 0;

        const zoom =
          1.03 +
          Math.sin(elapsed * 0.7 * visualParams.rhythmSpeed) * 0.025 +
          spec.bass * 0.045;

        const drawCover = (
          img: HTMLImageElement,
          alpha: number,
          offsetAngle: number
        ) => {
          if (!img.width || !img.height || alpha <= 0.01) return;
          ctx.save();
          ctx.globalAlpha = alpha;
          const scale = Math.max(frameW / img.width, frameH / img.height) * zoom;
          const dw = img.width * scale;
          const dh = img.height * scale;
          const dx =
            frameX +
            (frameW - dw) * 0.5 +
            Math.sin(elapsed * 0.5 + offsetAngle) *
              (movement === 'film-35mm' ? 7 : 3) -
            parallaxX * 0.6;
          const dy = frameY + (frameH - dh) * 0.5 - parallaxY * 0.6;

          ctx.filter = `contrast(${visualParams.contrastBoost}) saturate(${
            movement === 'wabi-sabi' ? 0.78 : 1.1
          })`;
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
        };

        drawCover(imgs[curIdx], 1 - alphaNext, 0);
        if (alphaNext > 0) {
          drawCover(imgs[nextIdx], alphaNext, 1.5);
        }
      } else {
        const baseGrad = ctx.createLinearGradient(
          frameX,
          frameY,
          frameX + frameW,
          frameY + frameH
        );
        baseGrad.addColorStop(0, palette.accent);
        baseGrad.addColorStop(0.55, palette.secondary);
        baseGrad.addColorStop(1, palette.bg);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = baseGrad;
        ctx.fillRect(frameX, frameY, frameW, frameH);
        ctx.globalAlpha = 1;
      }

      // 4. Художественный слой (переменные элементы системы + реакция на курсор)
      const domColors = entry.photos[0]?.dominantColors ?? [
        palette.accent,
        palette.secondary,
      ];

      if (movement === 'impressionism') {
        const strokeCount = compact ? 16 : 32;
        for (let i = 0; i < strokeCount; i++) {
          const angle = elapsed * 0.22 + i * 1.618;
          const bx =
            frameX +
            (Math.sin(angle * 0.65 + i) * 0.5 + 0.5) * frameW +
            parallaxX * 0.4;
          const by =
            frameY +
            (Math.cos(angle * 0.48 + i * 1.9) * 0.5 + 0.5) * frameH +
            parallaxY * 0.4;
          const bw = (20 + (i % 5) * 12) * (1 + spec.energy * 0.5);
          const bh = bw * 0.36;

          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(Math.sin(i * 0.8 + elapsed * 0.18) * 0.7);
          ctx.fillStyle = domColors[i % domColors.length] ?? palette.accent;
          ctx.globalAlpha = 0.13 + spec.mid * 0.15;
          ctx.beginPath();
          ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        const dustCount = compact ? 8 : 18;
        for (let d = 0; d < dustCount; d++) {
          const dx =
            frameX + (Math.sin(d * 7.3 + elapsed * 0.18) * 0.5 + 0.5) * frameW;
          const dy = frameY + (((d * 0.17 + elapsed * 0.04) % 1) * frameH);
          const r = 3 + (d % 4) * 2.5 + spec.treble * 4;
          ctx.fillStyle = 'rgba(255, 232, 185, 0.36)';
          ctx.beginPath();
          ctx.arc(dx, dy, r, 0, Math.PI * 2);
          ctx.fill();
        }

        const glow = ctx.createRadialGradient(
          frameX + frameW * (ptr.active ? ptr.nx : 0.3),
          frameY + frameH * (ptr.active ? ptr.ny : 0.25),
          10,
          frameX + frameW * 0.5,
          frameY + frameH * 0.5,
          frameW * 0.82
        );
        glow.addColorStop(0, 'rgba(255, 224, 172, 0.28)');
        glow.addColorStop(1, 'rgba(255, 224, 172, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(frameX, frameY, frameW, frameH);
      } else if (movement === 'constructivism') {
        const splitX =
          frameX + frameW * (0.28 + spec.bass * 0.08) + parallaxX * 1.4;
        const splitY =
          frameY + frameH * (0.68 - spec.energy * 0.06) + parallaxY * 1.4;

        ctx.fillStyle = palette.secondary;
        ctx.globalAlpha = 0.16 + spec.mid * 0.12;
        ctx.fillRect(frameX, splitY, splitX - frameX, frameY + frameH - splitY);

        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = compact ? 2 : 3;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(splitX, frameY);
        ctx.lineTo(splitX, frameY + frameH);
        ctx.moveTo(frameX, splitY);
        ctx.lineTo(frameX + frameW, splitY);
        ctx.stroke();

        const cx = frameX + frameW * 0.77 - parallaxX * 1.1;
        const cy = frameY + frameH * 0.24 - parallaxY * 1.1;
        const baseR = (20 + spec.bass * 38) * (compact ? 0.68 : 1);

        ctx.fillStyle = palette.accent;
        ctx.globalAlpha = 0.3 + spec.bass * 0.35;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = compact ? 1.2 : 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          baseR * 1.45,
          elapsed * 0.8,
          elapsed * 0.8 + Math.PI * 1.3
        );
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(frameX + 20, frameY + frameH - 30);
        ctx.lineTo(
          frameX + frameW * 0.64 + parallaxX,
          frameY + 38 + parallaxY
        );
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (movement === 'wabi-sabi') {
        const mistGrad = ctx.createLinearGradient(
          frameX,
          frameY,
          frameX,
          frameY + frameH
        );
        mistGrad.addColorStop(0, 'rgba(244, 243, 238, 0.24)');
        mistGrad.addColorStop(0.5, 'rgba(244, 243, 238, 0.06)');
        mistGrad.addColorStop(1, 'rgba(244, 243, 238, 0.22)');
        ctx.fillStyle = mistGrad;
        ctx.fillRect(frameX, frameY, frameW, frameH);

        ctx.strokeStyle = palette.ink;
        ctx.globalAlpha = 0.38;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(
          frameX + frameW * 0.1,
          frameY + frameH * 0.86 + parallaxY * 0.4
        );
        ctx.lineTo(
          frameX + frameW * (0.44 + spec.mid * 0.14) + parallaxX,
          frameY + frameH * 0.86 + parallaxY * 0.4
        );
        ctx.stroke();

        const stampSize = compact ? 18 : 26;
        const sx = frameX + frameW - stampSize - 14;
        const sy = frameY + frameH - stampSize - 14;
        ctx.globalAlpha = 0.78;
        ctx.strokeStyle = '#a83c32';
        ctx.lineWidth = compact ? 1.5 : 2;
        ctx.strokeRect(sx, sy, stampSize, stampSize);
        ctx.fillStyle = '#a83c32';
        ctx.font = `600 ${Math.round(
          stampSize * 0.45
        )}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          String(entry.indexNumber).padStart(2, '0'),
          sx + stampSize / 2,
          sy + stampSize / 2 + 1
        );
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      } else if (movement === 'film-35mm') {
        ctx.fillStyle = 'rgba(18, 16, 14, 0.78)';
        const stripW = compact ? 16 : 24;
        ctx.fillRect(frameX, frameY, stripW, frameH);
        ctx.fillRect(frameX + frameW - stripW, frameY, stripW, frameH);

        ctx.fillStyle = palette.surface;
        const holeStep = compact ? 22 : 30;
        const holeOffset = (elapsed * 16 * visualParams.rhythmSpeed) % holeStep;
        for (
          let y = frameY - holeStep + holeOffset;
          y < frameY + frameH;
          y += holeStep
        ) {
          if (y + holeStep * 0.46 < frameY || y > frameY + frameH) continue;
          ctx.fillRect(frameX + 3, y, stripW - 6, holeStep * 0.46);
          ctx.fillRect(
            frameX + frameW - stripW + 3,
            y,
            stripW - 6,
            holeStep * 0.46
          );
        }

        const leakY = ptr.active ? frameY + frameH * ptr.ny : frameY + frameH * 0.25;
        const leak = ctx.createLinearGradient(
          frameX,
          frameY,
          frameX + frameW * 0.42,
          leakY
        );
        leak.addColorStop(
          0,
          `rgba(245, 130, 54, ${0.24 + spec.energy * 0.18})`
        );
        leak.addColorStop(1, 'rgba(245, 130, 54, 0)');
        ctx.fillStyle = leak;
        ctx.fillRect(frameX, frameY, frameW, frameH);
      }

      // 4B. Движок погодных частиц (дождь / гроза / снег / осенние листья / туман)
      if (weatherType === 'rain' || weatherType === 'storm') {
        const dropCount = compact ? 22 : 42;
        ctx.strokeStyle = 'rgba(230, 240, 255, 0.28)';
        ctx.lineWidth = compact ? 1 : 1.4;
        for (let r = 0; r < dropCount; r++) {
          const speed = 260 + (r % 5) * 45;
          const rx =
            frameX +
            (((r * 97 + elapsed * 35) % frameW + frameW) % frameW);
          const ry =
            frameY +
            (((r * 61 + elapsed * speed) % frameH + frameH) % frameH);
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 5, ry + (compact ? 14 : 22));
          ctx.stroke();
        }
        if (
          weatherType === 'storm' &&
          Math.sin(elapsed * 1.9) > 0.96
        ) {
          ctx.fillStyle = 'rgba(240, 245, 255, 0.14)';
          ctx.fillRect(frameX, frameY, frameW, frameH);
        }
      } else if (weatherType === 'snow') {
        const flakeCount = compact ? 18 : 34;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        for (let s = 0; s < flakeCount; s++) {
          const sx =
            frameX +
            ((s * 73 + Math.sin(elapsed * 0.9 + s) * 24) % frameW + frameW) %
              frameW;
          const sy =
            frameY +
            (((s * 59 + elapsed * (32 + (s % 4) * 10)) % frameH + frameH) %
              frameH);
          const sr = (compact ? 1.8 : 2.8) + (s % 3);
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (weatherType === 'leaves') {
        const leafCount = compact ? 10 : 18;
        const leafCols = ['#f59e0b', '#ea580c', '#eab308', '#dc2626'];
        for (let l = 0; l < leafCount; l++) {
          const lx =
            frameX +
            ((l * 89 + Math.sin(elapsed * 0.7 + l) * 32) % frameW + frameW) %
              frameW;
          const ly =
            frameY +
            (((l * 67 + elapsed * (24 + (l % 3) * 8)) % frameH + frameH) %
              frameH);
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(elapsed * 0.9 + l);
          ctx.fillStyle = leafCols[l % leafCols.length];
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.ellipse(0, 0, compact ? 5 : 8, compact ? 2.5 : 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (weatherType === 'mist') {
        for (let m = 0; m < 3; m++) {
          const mx =
            frameX +
            frameW * 0.5 +
            Math.sin(elapsed * 0.25 + m * 2) * (frameW * 0.22);
          const my = frameY + frameH * (0.35 + m * 0.22);
          const mGrad = ctx.createRadialGradient(
            mx,
            my,
            10,
            mx,
            my,
            frameW * 0.55
          );
          mGrad.addColorStop(0, 'rgba(240, 248, 246, 0.18)');
          mGrad.addColorStop(1, 'rgba(240, 248, 246, 0)');
          ctx.fillStyle = mGrad;
          ctx.fillRect(frameX, frameY, frameW, frameH);
        }
      }

      // 4C. Интерактивный след кисти/света за курсором
      if (ptr.trail.length > 0) {
        ptr.trail = ptr.trail.filter((pt) => now - pt.born < 900);
        for (const pt of ptr.trail) {
          const life = 1 - (now - pt.born) / 900;
          const px = frameX + pt.x * frameW;
          const py = frameY + pt.y * frameH;
          ctx.save();
          ctx.globalAlpha = life * 0.36;
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          if (movement === 'constructivism') {
            ctx.rect(
              px - pt.size * life,
              py - pt.size * life,
              pt.size * 2 * life,
              pt.size * 2 * life
            );
          } else {
            ctx.arc(px, py, pt.size * life, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.restore();
        }
      }

      // Лёгкое плёночное зерно
      if (visualParams.grain > 0.18 && !compact) {
        ctx.fillStyle = 'rgba(255,255,255,0.065)';
        const grainCount = Math.round(visualParams.grain * 95);
        for (let g = 0; g < grainCount; g++) {
          const gx =
            frameX +
            (Math.sin(g * 91.7 + elapsed * 17) * 0.5 + 0.5) * frameW;
          const gy =
            frameY +
            (Math.cos(g * 47.3 + elapsed * 13) * 0.5 + 0.5) * frameH;
          ctx.fillRect(gx, gy, 1.5, 1.5);
        }
      }

      ctx.restore();

      // 5. Постоянный нижний блок (название папки, трек, подпись, музейный индекс)
      const footerTop = H - pad * 0.55 - footerH;

      ctx.strokeStyle = palette.ink;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, footerTop + 2);
      ctx.lineTo(W - pad, footerTop + 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = palette.ink;
      ctx.font = `600 ${Math.round(
        W * 0.045
      )}px "Cormorant Garamond", Georgia, serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(analysis.folderName, pad, footerTop + 10, W - pad * 2);

      const musicY = footerTop + Math.round(W * 0.072);
      for (let b = 0; b < 4; b++) {
        const bh = Math.round(
          6 +
            ((b % 2 === 0 ? spec.bass : spec.energy) * 10 +
              Math.abs(Math.sin(elapsed * 4 + b)) * (isPlaying ? 6 : 2))
        );
        ctx.fillStyle = b % 2 === 0 ? palette.accent : palette.secondary;
        ctx.fillRect(pad + b * 4, musicY + 14 - bh, 2.5, bh);
      }

      ctx.fillStyle = palette.ink;
      ctx.globalAlpha = 0.82;
      ctx.font = `500 ${Math.round(W * 0.02)}px "JetBrains Mono", monospace`;
      const trackLabel = `${music.artist ? music.artist + ' — ' : ''}${
        music.title || 'Без трека'
      } · ${music.bpm} BPM`;
      ctx.fillText(trackLabel, pad + 22, musicY, W - pad * 2 - 22);
      ctx.globalAlpha = 1;

      if (entry.signature) {
        ctx.fillStyle = palette.ink;
        ctx.globalAlpha = 0.88;
        ctx.font = `500 ${Math.round(W * 0.036)}px "Caveat", cursive`;
        ctx.fillText(
          entry.signature,
          pad,
          musicY + Math.round(W * 0.038),
          W - pad * 2.4
        );
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = palette.ink;
      ctx.globalAlpha = 0.42;
      ctx.font = `500 ${Math.round(W * 0.016)}px "JetBrains Mono", monospace`;
      const stampText = movement.toUpperCase();
      const sw = ctx.measureText(stampText).width;
      ctx.fillText(stampText, W - pad - sw, musicY + Math.round(W * 0.052));
      ctx.globalAlpha = 1;

      if (!compact || isPlaying || ptr.active || ptr.trail.length > 0) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafId);
  }, [entry, isPlaying, getSpectrum, compact, pinnedPhotoIndex, canvasRef]);

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const domColors = entry.photos[0]?.dominantColors ?? [
      entry.analysis.palette.accent,
      entry.analysis.palette.secondary,
    ];
    const ptr = pointerRef.current;
    ptr.nx = nx;
    ptr.ny = ny;
    ptr.active = true;
    ptr.trail.push({
      x: nx,
      y: ny,
      born: performance.now(),
      color:
        domColors[ptr.trail.length % domColors.length] ??
        entry.analysis.palette.accent,
      size: compact ? 14 : 24,
    });
    if (ptr.trail.length > 28) {
      ptr.trail.shift();
    }
  };

  const handlePointerLeave = () => {
    pointerRef.current.active = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      style={{
        width: '100%',
        height: 'auto',
        aspectRatio: '4 / 5',
        display: 'block',
        borderRadius: '4px',
        boxShadow: '0 14px 36px rgba(20, 18, 15, 0.12)',
        cursor: compact ? 'pointer' : 'crosshair',
      }}
    />
  );
};
