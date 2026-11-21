import React, { useEffect, useRef } from 'react';
import { Download, Sparkles, X } from 'lucide-react';
import type { DiaryEntry } from '../types/diary';

interface TapestryModalProps {
  entries: DiaryEntry[];
  onClose: () => void;
}

export const TapestryModal: React.FC<TapestryModalProps> = ({
  entries,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || entries.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1120;
    const H = 680;
    canvas.width = W;
    canvas.height = H;

    const ordered = [...entries].sort((a, b) => a.indexNumber - b.indexNumber);
    const count = ordered.length;

    // 1. Фон паспарту гобелена
    ctx.fillStyle = '#faf6ef';
    ctx.fillRect(0, 0, W, H);

    const pad = 48;
    const innerX = pad;
    const innerY = 82;
    const innerW = W - pad * 2;
    const innerH = H - 172;
    const colW = innerW / count;

    // 2. Шапка гобелена
    ctx.fillStyle = '#18181b';
    ctx.font = '600 15px "JetBrains Mono", monospace';
    ctx.fillText(
      `ATMOS_ // ГОБЕЛЕН ПЕРИОДА (${count} ДНЕЙ В ЕДИНОМ СПЕКТРЕ)`,
      pad,
      44
    );

    const avgBpm = Math.round(
      ordered.reduce((s, e) => s + e.music.bpm, 0) / count
    );
    const rightMeta = `СР. РИТМ ${avgBpm} BPM · GENESIS ARTTECH 2026`;
    const rw = ctx.measureText(rightMeta).width;
    ctx.globalAlpha = 0.65;
    ctx.fillText(rightMeta, W - pad - rw, 44);
    ctx.globalAlpha = 1;

    // 3. Рисуем перетекающие цветовые полосы каждого дня
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(innerX, innerY, innerW, innerH, 12);
    ctx.clip();

    ordered.forEach((entry, idx) => {
      const x = innerX + idx * colW;
      const colors = entry.photos[0]?.dominantColors ?? [
        entry.analysis.palette.accent,
        entry.analysis.palette.secondary,
        entry.analysis.palette.bg,
      ];

      const vGrad = ctx.createLinearGradient(x, innerY, x + colW, innerY + innerH);
      vGrad.addColorStop(0, colors[0] ?? entry.analysis.palette.accent);
      vGrad.addColorStop(0.5, colors[1] ?? entry.analysis.palette.secondary);
      vGrad.addColorStop(1, colors[2] ?? entry.analysis.palette.bg);
      ctx.fillStyle = vGrad;
      ctx.fillRect(x - 2, innerY, colW + 4, innerH);

      // Мягкие мазки внутри колонки дня
      for (let m = 0; m < 18; m++) {
        const mx = x + ((m * 47) % Math.max(10, colW));
        const my = innerY + ((m * 73) % innerH);
        const mr = 24 + (m % 4) * 16;
        ctx.fillStyle = colors[m % colors.length] ?? '#ffffff';
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Разделительная тонкая нить между днями
      if (idx > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, innerY);
        ctx.lineTo(x, innerY + innerH);
        ctx.stroke();
      }

      // Индекс и название папки внутри колонки
      ctx.fillStyle = 'rgba(15, 16, 22, 0.55)';
      ctx.fillRect(x + 12, innerY + 14, colW - 24, 58);

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillText(
        `DAY // ${String(entry.indexNumber).padStart(2, '0')} · ${entry.music.bpm} BPM`,
        x + 20,
        innerY + 34,
        colW - 40
      );

      ctx.font = '600 16px "Cormorant Garamond", Georgia, serif';
      ctx.fillText(
        entry.analysis.folderName,
        x + 20,
        innerY + 56,
        colW - 40
      );
    });

    // 4. Единая сквозная волна настроения и ритма через все дни
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ordered.forEach((entry, idx) => {
      const cx = innerX + idx * colW + colW * 0.5;
      const cy =
        innerY +
        innerH * 0.55 -
        entry.analysis.valence * (innerH * 0.22) -
        (entry.analysis.arousal - 0.5) * (innerH * 0.16);
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    // Узловые точки каждого дня на волне
    ordered.forEach((entry, idx) => {
      const cx = innerX + idx * colW + colW * 0.5;
      const cy =
        innerY +
        innerH * 0.55 -
        entry.analysis.valence * (innerH * 0.22) -
        (entry.analysis.arousal - 0.5) * (innerH * 0.16);
      ctx.fillStyle = entry.analysis.palette.accent;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
    ctx.restore();

    // 5. Подвал гобелена с цветовыми чипами всех дней
    const footY = innerY + innerH + 34;
    ctx.fillStyle = '#18181b';
    ctx.font = 'italic 600 24px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(
      '«Синтез невидимых ощущений в единую хроматическую память»',
      pad,
      footY
    );

    ctx.font = '500 12px "JetBrains Mono", monospace';
    ctx.globalAlpha = 0.65;
    ctx.fillText(
      ordered.map((e) => e.dateLabel).join('  →  '),
      pad,
      footY + 26
    );
    ctx.globalAlpha = 1;
  }, [entries]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `ATMOS_Tapestry_${entries.length}_Days.png`;
    a.click();
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div
        className="lightbox-box tapestry-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lightbox-head font-mono">
          <span className="tapestry-head-title">
            <Sparkles size={15} /> ГОБЕЛЕН ВСЕХ ДНЕЙ АРХИВА // СВОДНОЕ ПОЛОТНО
          </span>
          <div className="photo-head-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleDownload}
            >
              <Download size={14} />
              Скачать постер (PNG)
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '10px',
            display: 'block',
            boxShadow: '0 16px 42px rgba(0, 0, 0, 0.22)',
          }}
        />
      </div>
    </div>
  );
};
