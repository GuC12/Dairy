import React, { useEffect, useRef } from 'react';
import type { DiaryEntry } from '../types/diary';
import type { SpectrumMetrics } from '../engine/audioAnalyzer';

interface MemoryCanvasProps {
  entry: DiaryEntry;
  isPlaying?: boolean;
  getSpectrum?: () => SpectrumMetrics;
  compact?: boolean;
  canvasRefOut?: React.RefObject<HTMLCanvasElement | null>;
}

export const MemoryCanvas: React.FC<MemoryCanvasProps> = ({
  entry,
  isPlaying = false,
  getSpectrum,
  compact = false,
  canvasRefOut,
}) => {
  const internalRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = canvasRefOut ?? internalRef;
  const imagesRef = useRef<HTMLImageElement[]>([]);

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

    let rafId = 0;
    const startTime = performance.now();

    const drawFrame = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const { analysis, music } = entry;
      const { palette, visualParams, movement } = analysis;

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

      // 1. Постоянный фон страницы
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, W, H);

      // 2. Постоянная внешняя рамка и шапка дневника
      const pad = Math.round(W * 0.055);
      const headerH = Math.round(H * 0.08);
      const footerH = Math.round(H * 0.19);

      ctx.strokeStyle =
        movement === 'constructivism'
          ? 'rgba(238, 242, 246, 0.24)'
          : 'rgba(26, 25, 23, 0.15)';
      ctx.lineWidth = compact ? 1 : 1.5;
      ctx.strokeRect(pad * 0.55, pad * 0.55, W - pad * 1.1, H - pad * 1.1);

      // Шапка (индекс дня, дата, погода)
      ctx.fillStyle = palette.ink;
      ctx.font = `500 ${Math.round(W * 0.022)}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'middle';
      const dayCode = `DAY // ${String(entry.indexNumber).padStart(2, '0')}`;
      ctx.fillText(dayCode, pad, pad * 0.55 + headerH * 0.5);

      ctx.globalAlpha = 0.72;
      const rightMeta = [entry.dateLabel, entry.weather]
        .filter(Boolean)
        .join(' · ');
      const metaWidth = ctx.measureText(rightMeta).width;
      ctx.fillText(
        rightMeta,
        W - pad - metaWidth,
        pad * 0.55 + headerH * 0.5
      );
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

      if (imgs.length > 0) {
        const cycleDur = Math.max(2.6, 7.5 / visualParams.rhythmSpeed);
        const totalIdx = elapsed / cycleDur;
        const curIdx = Math.floor(totalIdx) % imgs.length;
        const nextIdx = (curIdx + 1) % imgs.length;
        const phase = totalIdx - Math.floor(totalIdx);

        const fadeStart = movement === 'constructivism' ? 0.92 : 0.72;
        const alphaNext =
          imgs.length > 1 && phase > fadeStart
            ? (phase - fadeStart) / (1 - fadeStart)
            : 0;

        const zoom =
          1.02 +
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
              (movement === 'film-35mm' ? 7 : 3);
          const dy = frameY + (frameH - dh) * 0.5;

          ctx.filter = `contrast(${visualParams.contrastBoost}) saturate(${
            movement === 'wabi-sabi' ? 0.76 : 1.08
          })`;
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
        };

        drawCover(imgs[curIdx], 1 - alphaNext, 0);
        if (alphaNext > 0) {
          drawCover(imgs[nextIdx], alphaNext, 1.5);
        }
      } else {
        // Живая градиентная основа в палитре дня (например, в Live Studio до загрузки фото)
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

      // 4. Художественный слой (переменные элементы системы)
      const domColors = entry.photos[0]?.dominantColors ?? [
        palette.accent,
        palette.secondary,
      ];

      if (movement === 'impressionism') {
        // Многослойные мазки кисти Моне + плавающие огни/пылинки света
        const strokeCount = compact ? 16 : 32;
        for (let i = 0; i < strokeCount; i++) {
          const angle = elapsed * 0.22 + i * 1.618;
          const bx =
            frameX + (Math.sin(angle * 0.65 + i) * 0.5 + 0.5) * frameW;
          const by =
            frameY + (Math.cos(angle * 0.48 + i * 1.9) * 0.5 + 0.5) * frameH;
          const bw = (20 + (i % 5) * 12) * (1 + spec.energy * 0.5);
          const bh = bw * 0.36;

          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(Math.sin(i * 0.8 + elapsed * 0.18) * 0.7);
          ctx.fillStyle = domColors[i % domColors.length] ?? palette.accent;
          ctx.globalAlpha = 0.12 + spec.mid * 0.15;
          ctx.beginPath();
          ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Тёплые световые пылинки (боке)
        const dustCount = compact ? 8 : 18;
        for (let d = 0; d < dustCount; d++) {
          const dx =
            frameX + ((Math.sin(d * 7.3 + elapsed * 0.18) * 0.5 + 0.5) * frameW);
          const dy =
            frameY +
            (((d * 0.17 + elapsed * 0.04) % 1) * frameH);
          const r = 3 + (d % 4) * 2.5 + spec.treble * 4;
          ctx.fillStyle = 'rgba(255, 232, 185, 0.35)';
          ctx.beginPath();
          ctx.arc(dx, dy, r, 0, Math.PI * 2);
          ctx.fill();
        }

        const glow = ctx.createRadialGradient(
          frameX + frameW * 0.3,
          frameY + frameH * 0.25,
          10,
          frameX + frameW * 0.5,
          frameY + frameH * 0.5,
          frameW * 0.82
        );
        glow.addColorStop(0, 'rgba(255, 224, 172, 0.26)');
        glow.addColorStop(1, 'rgba(255, 224, 172, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(frameX, frameY, frameW, frameH);
      } else if (movement === 'constructivism') {
        // Супрематическая/конструктивистская композиция Кандинского
        const splitX = frameX + frameW * (0.28 + spec.bass * 0.08);
        const splitY = frameY + frameH * (0.68 - spec.energy * 0.06);

        // Полупрозрачная геометрическая плоскость
        ctx.fillStyle = palette.secondary;
        ctx.globalAlpha = 0.16 + spec.mid * 0.12;
        ctx.fillRect(frameX, splitY, splitX - frameX, frameY + frameH - splitY);

        // Оси
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = compact ? 2 : 3;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(splitX, frameY);
        ctx.lineTo(splitX, frameY + frameH);
        ctx.moveTo(frameX, splitY);
        ctx.lineTo(frameX + frameW, splitY);
        ctx.stroke();

        // Концентрические импульсные круги в правом верхнем квадранте
        const cx = frameX + frameW * 0.77;
        const cy = frameY + frameH * 0.24;
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
        ctx.arc(cx, cy, baseR * 1.45, elapsed * 0.8, elapsed * 0.8 + Math.PI * 1.3);
        ctx.stroke();

        // Диагональный вектор
        ctx.beginPath();
        ctx.moveTo(frameX + 20, frameY + frameH - 30);
        ctx.lineTo(frameX + frameW * 0.64, frameY + 38);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (movement === 'wabi-sabi') {
        // Туманная дымка и японская эстетика тишины
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

        // Тонкая асимметричная линия туши
        ctx.strokeStyle = palette.ink;
        ctx.globalAlpha = 0.38;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(frameX + frameW * 0.1, frameY + frameH * 0.86);
        ctx.lineTo(
          frameX + frameW * (0.44 + spec.mid * 0.14),
          frameY + frameH * 0.86
        );
        ctx.stroke();

        // Миниатюрный красный штамп-печать (ханко) в углу кадра
        const stampSize = compact ? 18 : 26;
        const sx = frameX + frameW - stampSize - 14;
        const sy = frameY + frameH - stampSize - 14;
        ctx.globalAlpha = 0.78;
        ctx.strokeStyle = '#a83c32';
        ctx.lineWidth = compact ? 1.5 : 2;
        ctx.strokeRect(sx, sy, stampSize, stampSize);
        ctx.fillStyle = '#a83c32';
        ctx.font = `600 ${Math.round(stampSize * 0.45)}px "JetBrains Mono", monospace`;
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
        // Перфорация Kodak/Ilford с номерами кадров
        ctx.fillStyle = 'rgba(18, 16, 14, 0.78)';
        const stripW = compact ? 16 : 24;
        ctx.fillRect(frameX, frameY, stripW, frameH);
        ctx.fillRect(frameX + frameW - stripW, frameY, stripW, frameH);

        ctx.fillStyle = palette.surface;
        const holeStep = compact ? 22 : 30;
        const holeOffset = (elapsed * 16 * visualParams.rhythmSpeed) % holeStep;
        for (let y = frameY - holeStep + holeOffset; y < frameY + frameH; y += holeStep) {
          if (y + holeStep * 0.46 < frameY || y > frameY + frameH) continue;
          ctx.fillRect(frameX + 3, y, stripW - 6, holeStep * 0.46);
          ctx.fillRect(
            frameX + frameW - stripW + 3,
            y,
            stripW - 6,
            holeStep * 0.46
          );
        }

        // Тёплая плёночная засветка (light leak)
        const leak = ctx.createLinearGradient(
          frameX,
          frameY,
          frameX + frameW * 0.36,
          frameY + frameH * 0.25
        );
        leak.addColorStop(
          0,
          `rgba(238, 122, 54, ${0.22 + spec.energy * 0.16})`
        );
        leak.addColorStop(1, 'rgba(238, 122, 54, 0)');
        ctx.fillStyle = leak;
        ctx.fillRect(frameX, frameY, frameW, frameH);
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

      // 5. Постоянный нижний блок (название папки, трек, подпись)
      const footerTop = H - pad * 0.55 - footerH;
      ctx.fillStyle = palette.ink;
      ctx.font = `600 ${Math.round(
        W * 0.044
      )}px "Cormorant Garamond", Georgia, serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(analysis.folderName, pad, footerTop + 8, W - pad * 2);

      const musicY = footerTop + Math.round(W * 0.068);
      ctx.fillStyle = palette.accent;
      const barH = Math.round(10 + spec.energy * 8);
      ctx.fillRect(pad, musicY + (14 - barH) / 2, 6, barH);

      ctx.fillStyle = palette.ink;
      ctx.globalAlpha = 0.82;
      ctx.font = `400 ${Math.round(W * 0.021)}px "JetBrains Mono", monospace`;
      const trackLabel = `♪ ${music.artist ? music.artist + ' — ' : ''}${
        music.title || 'Без трека'
      } · ${music.bpm} BPM`;
      ctx.fillText(trackLabel, pad + 14, musicY, W - pad * 2 - 14);
      ctx.globalAlpha = 1;

      if (entry.signature) {
        ctx.fillStyle = palette.ink;
        ctx.globalAlpha = 0.85;
        ctx.font = `500 ${Math.round(W * 0.036)}px "Caveat", cursive`;
        ctx.fillText(
          entry.signature,
          pad,
          musicY + Math.round(W * 0.038),
          W - pad * 2
        );
        ctx.globalAlpha = 1;
      }

      if (!compact || isPlaying) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafId);
  }, [entry, isPlaying, getSpectrum, compact, canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: 'auto',
        aspectRatio: '4 / 5',
        display: 'block',
        borderRadius: '4px',
        boxShadow: '0 14px 36px rgba(20, 18, 15, 0.12)',
      }}
    />
  );
};
