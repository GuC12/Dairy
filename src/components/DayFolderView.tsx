import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Film,
  FolderOpen,
  Maximize2,
  Mic,
  Minimize2,
  Pause,
  Pencil,
  Play,
  Share2,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from 'lucide-react';
import type { DiaryEntry, PhotoItem } from '../types/diary';
import { DayAudioController } from '../engine/audioAnalyzer';
import { MemoryCanvas } from './MemoryCanvas';
import { AtmosphereCompass } from './AtmosphereCompass';

interface DayFolderViewProps {
  entry: DiaryEntry;
  hasPrev?: boolean;
  hasNext?: boolean;
  initialImmersive?: boolean;
  initialAutoReel?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onNextReel?: () => void;
  onBack: () => void;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (id: string) => void;
}

export const DayFolderView: React.FC<DayFolderViewProps> = ({
  entry,
  hasPrev = false,
  hasNext = false,
  initialImmersive = false,
  initialAutoReel = false,
  onPrev,
  onNext,
  onNextReel,
  onBack,
  onEdit,
  onDelete,
}) => {
  const [isPlaying, setIsPlaying] = useState(
    initialImmersive || initialAutoReel
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isImmersive, setIsImmersive] = useState(
    initialImmersive || initialAutoReel
  );
  const [isAutoReel, setIsAutoReel] = useState(initialAutoReel);
  const [frostMode, setFrostMode] = useState(
    initialImmersive && !initialAutoReel
  );
  const [reelProgress, setReelProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(16).fill(0.08));
  const [pinnedPhotoIndex, setPinnedPhotoIndex] = useState<number | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoItem | null>(null);

  const audioCtrlRef = useRef<DayAudioController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const ctrl = new DayAudioController();
    audioCtrlRef.current = ctrl;
    if (initialImmersive || initialAutoReel) {
      ctrl.start(entry.music);
    }
    return () => {
      ctrl.stop();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [entry.id, entry.music, initialImmersive, initialAutoReel]);

  // Авто-фильм дневника (перелистывание каждые 9 секунд в режиме погружения)
  useEffect(() => {
    if (!isImmersive || !isAutoReel) return;
    const duration = 9000;
    const start = Date.now();
    const id = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / duration) * 100);
      setReelProgress(pct);
      if (pct >= 100) {
        clearInterval(id);
        onNextReel?.();
      }
    }, 80);
    return () => clearInterval(id);
  }, [isImmersive, isAutoReel, entry.id, onNextReel]);

  // Горячие клавиши: стрелки влево/вправо для листания дневника и Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxPhoto) setLightboxPhoto(null);
        else if (isImmersive) setIsImmersive(false);
        return;
      }
      if (lightboxPhoto || isImmersive) return;
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && hasNext && onNext) {
        onNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext, lightboxPhoto, isImmersive]);

  // Обновляем мини-спектрометр при воспроизведении
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const m = audioCtrlRef.current?.getSpectrumMetrics();
      if (m) setBars(m.bars);
    }, 65);
    return () => clearInterval(id);
  }, [isPlaying]);

  const activeBars = isPlaying ? bars : Array<number>(16).fill(0.08);

  const togglePlay = () => {
    const ctrl = audioCtrlRef.current;
    if (!ctrl) return;
    if (isPlaying) {
      ctrl.stop();
      setIsPlaying(false);
    } else {
      ctrl.start(entry.music);
      setIsPlaying(true);
    }
  };

  const toggleVoice = () => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      audioCtrlRef.current?.setDucking(false);
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(entry.text);
    utterance.lang = 'ru-RU';
    utterance.rate = entry.analysis.voiceProfile.rate;
    utterance.pitch = entry.analysis.voiceProfile.pitch;

    const voices = window.speechSynthesis.getVoices();
    const ruVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ru'));
    if (ruVoice) utterance.voice = ruVoice;

    audioCtrlRef.current?.setDucking(true);

    utterance.onend = () => {
      setIsSpeaking(false);
      audioCtrlRef.current?.setDucking(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      audioCtrlRef.current?.setDucking(false);
    };

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.analysis.folderName.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  const handleRecordVideo = () => {
    const canvas = canvasRef.current;
    if (!canvas || isRecording || typeof MediaRecorder === 'undefined') return;

    let startedHere = false;
    if (!isPlaying && audioCtrlRef.current) {
      audioCtrlRef.current.start(entry.music);
      setIsPlaying(true);
      startedHere = true;
    }

    const canvasStream = canvas.captureStream(30);
    const audioStream = audioCtrlRef.current?.getAudioStream();
    const combinedTracks = [
      ...canvasStream.getVideoTracks(),
      ...(audioStream ? audioStream.getAudioTracks() : []),
    ];
    const combinedStream = new MediaStream(combinedTracks);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    const recorder = new MediaRecorder(combinedStream, { mimeType });
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entry.analysis.folderName.replace(/\s+/g, '_')}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setIsRecording(false);
      setRecordProgress(0);
      if (startedHere && audioCtrlRef.current) {
        audioCtrlRef.current.stop();
        setIsPlaying(false);
      }
    };

    setIsRecording(true);
    setRecordProgress(0);
    recorder.start(250);

    const durationMs = 7000;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const pct = Math.min(
        100,
        Math.round(((Date.now() - startedAt) / durationMs) * 100)
      );
      setRecordProgress(pct);
      if (pct >= 100) {
        clearInterval(timer);
        if (recorder.state !== 'inactive') recorder.stop();
      }
    }, 150);
  };

  const handleExportFolder = () => {
    const blob = new Blob([JSON.stringify(entry, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.analysis.folderName.replace(/\s+/g, '_')}.atmos.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="folder-view view-enter">
      <div
        className="folder-ambient-glow"
        style={{ backgroundColor: entry.analysis.palette.accent }}
      />
      <div className="folder-topbar">
        <div className="folder-nav-left">
          <button className="btn-ghost" onClick={onBack}>
            <ArrowLeft size={16} />
            Архив
          </button>

          <div className="day-pager">
            <button
              type="button"
              className="btn-ghost pager-btn"
              disabled={!hasPrev}
              onClick={onPrev}
              title="Предыдущий день (стрелка ←)"
            >
              <ChevronLeft size={16} />
              Пред.
            </button>
            <button
              type="button"
              className="btn-ghost pager-btn"
              disabled={!hasNext}
              onClick={onNext}
              title="Следующий день (стрелка →)"
            >
              След.
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="folder-path font-mono">
          <FolderOpen size={15} />
          <span>/архив/{entry.analysis.folderName}</span>
        </div>

        <div className="topbar-right-actions">
          <button
            className="btn-secondary"
            onClick={() => onEdit(entry)}
            title="Редактировать день"
          >
            <Pencil size={14} />
            Редактировать
          </button>

          <button
            className="btn-secondary"
            onClick={handleExportFolder}
            title="Скачать папку дня (.atmos.json), чтобы отправить другу"
          >
            <Share2 size={14} />
            Экспорт папки
          </button>

          <button
            className="btn-secondary"
            onClick={() => {
              if (!isPlaying) togglePlay();
              setIsImmersive(true);
            }}
          >
            <Maximize2 size={15} />
            Погружение
          </button>

          <button
            className="btn-ghost btn-danger-subtle"
            onClick={() => onDelete(entry.id)}
            title="Удалить папку дня"
          >
            <Trash2 size={15} />
            Удалить
          </button>
        </div>
      </div>

      <div className="folder-grid">
        {/* Левая колонка: живое воспоминание 4:5 + управление звуком и экспорт */}
        <div className={`folder-stage ${isPlaying ? 'is-playing-glow' : ''}`}>
          <MemoryCanvas
            entry={entry}
            isPlaying={isPlaying}
            pinnedPhotoIndex={pinnedPhotoIndex}
            frostMode={frostMode}
            onFrostClarityChange={(c) =>
              audioCtrlRef.current?.setMemoryClarity(c)
            }
            getSpectrum={() =>
              audioCtrlRef.current?.getSpectrumMetrics() ?? {
                bass: 0,
                mid: 0,
                treble: 0,
                energy: 0,
                bars: [],
              }
            }
            canvasRefOut={canvasRef}
          />

          {/* Живой аудио-спектрометр */}
          <div className="eq-strip" aria-hidden="true">
            {activeBars.map((v, idx) => (
              <span
                key={idx}
                className="eq-bar"
                style={{
                  height: `${Math.round(v * 26) + 3}px`,
                  backgroundColor: entry.analysis.palette.accent,
                }}
              />
            ))}
          </div>

          <div className="stage-controls">
            <button
              className={`btn-primary ${isPlaying ? 'is-active' : ''}`}
              onClick={togglePlay}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying
                ? 'Пауза'
                : entry.music.mode === 'file'
                  ? 'Включить трек'
                  : 'Слушать атмосферу'}
            </button>

            <button
              className={`btn-secondary ${isSpeaking ? 'is-active' : ''}`}
              onClick={toggleVoice}
              title={`Голос: ${entry.analysis.voiceProfile.label}`}
            >
              {isSpeaking ? <VolumeX size={16} /> : <Mic size={16} />}
              {isSpeaking ? 'Стоп голос' : 'Озвучить'}
            </button>
          </div>

          <div className="stage-export-row">
            <button
              className="btn-secondary"
              onClick={handleDownloadPng}
              title="Сохранить открытку в PNG"
            >
              <Download size={15} />
              Открытка PNG
            </button>

            <button
              className={`btn-secondary ${isRecording ? 'is-active' : ''}`}
              onClick={handleRecordVideo}
              disabled={isRecording}
              title="Записать короткое видео со звуком (7 сек)"
            >
              <Film size={15} />
              {isRecording ? `Запись ${recordProgress}%...` : 'Видео WebM (7с)'}
            </button>
          </div>

          <div className="voice-hint font-mono">
            <Volume2 size={13} />
            <span>
              Голос: {entry.analysis.voiceProfile.label} ({entry.analysis.voiceProfile.rate}×)
            </span>
          </div>
        </div>

        {/* Правая колонка: артефакты папки + компас + объяснимая логика */}
        <div className="folder-details">
          <div className="detail-card">
            <div className="detail-meta-row font-mono">
              <span>ДЕНЬ // {String(entry.indexNumber).padStart(2, '0')}</span>
              <span>{entry.dateLabel}</span>
              {entry.location && <span>{entry.location}</span>}
              {entry.weather && <span>{entry.weather}</span>}
            </div>

            <h1 className="folder-title font-serif">{entry.analysis.folderName}</h1>

            <div className="tag-row">
              <span className="pill">{entry.analysis.moodLabel}</span>
              <span className="pill pill-outline">
                {entry.analysis.movementTitle}
              </span>
            </div>

            <p className="entry-prose">{entry.text}</p>

            {entry.signature && (
              <div className="entry-signature font-hand">
                — {entry.signature}
              </div>
            )}
          </div>

          {/* Музыка и интерактивные исходные фото в папке */}
          <div className="detail-card">
            <div className="section-label-row">
              <h3 className="section-label font-mono">
                СОДЕРЖИМОЕ ПАПКИ ДНЯ ({entry.photos.length} ФОТО)
              </h3>
              {pinnedPhotoIndex !== null && (
                <button
                  type="button"
                  className="btn-ghost font-mono"
                  onClick={() => setPinnedPhotoIndex(null)}
                >
                  Вернуть авто-слайдшоу
                </button>
              )}
            </div>

            <div className="music-box">
              <div>
                <div className="music-title">
                  {entry.music.artist ? `${entry.music.artist} — ` : ''}
                  {entry.music.title}
                </div>
                <div className="music-meta font-mono">
                  {entry.music.genre} · {entry.music.bpm} BPM ·{' '}
                  {entry.music.tonality === 'minor' ? 'Минор' : 'Мажор'} ·
                  Энергия {Math.round(entry.music.energy * 100)}%
                </div>
              </div>
              {entry.music.url && (
                <a
                  href={entry.music.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost"
                >
                  Открыть трек <ExternalLink size={14} />
                </a>
              )}
            </div>

            <div className="photos-strip">
              {entry.photos.map((ph, idx) => {
                const isPinned = pinnedPhotoIndex === idx;
                return (
                  <div
                    key={ph.id}
                    className={`photo-thumb-card ${isPinned ? 'is-pinned' : ''}`}
                    onClick={() =>
                      setPinnedPhotoIndex((prev) => (prev === idx ? null : idx))
                    }
                    title="Нажмите, чтобы закрепить этот кадр на странице 4:5"
                  >
                    <div className="photo-thumb-img-wrap">
                      <img src={ph.dataUrl} alt={ph.name} />
                      <button
                        type="button"
                        className="photo-zoom-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxPhoto(ph);
                        }}
                        title="Открыть фото крупно с разбором палитры"
                      >
                        <ZoomIn size={13} />
                      </button>
                    </div>
                    <div className="swatch-row">
                      {ph.dominantColors.map((hex) => (
                        <span
                          key={hex}
                          className="swatch"
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2D Компас + Объяснимая логика */}
          <div className="detail-card logic-card">
            <h3 className="section-label font-mono">
              <Sparkles size={14} />
              ОБЪЯСНИМАЯ ЛОГИКА // ПОЧЕМУ ДЕНЬ ВЫГЛЯДИТ ТАК
            </h3>
            <div className="logic-split">
              <div className="logic-list">
                {entry.analysis.explanation.map((item, idx) => (
                  <div key={idx} className="logic-item">
                    <span className="logic-badge font-mono">{item.source}</span>
                    <div>
                      <div className="logic-signal">{item.signal}</div>
                      <div className="logic-effect">{item.effect}</div>
                    </div>
                  </div>
                ))}
              </div>

              <AtmosphereCompass entries={[entry]} activeId={entry.id} compact />
            </div>

            {/* Математика визуальной системы (6 алгоритмических шкал) */}
            <div className="visual-math-grid font-mono">
              <div className="math-meter">
                <div className="math-meter-head">
                  <span>Воздух (Паспарту)</span>
                  <strong>
                    {Math.round(entry.analysis.visualParams.whitespace * 100)}%
                  </strong>
                </div>
                <div className="math-bar-track">
                  <div
                    className="math-bar-fill"
                    style={{
                      width: `${Math.round(
                        entry.analysis.visualParams.whitespace * 100
                      )}%`,
                      backgroundColor: entry.analysis.palette.accent,
                    }}
                  />
                </div>
              </div>

              <div className="math-meter">
                <div className="math-meter-head">
                  <span>Жёсткость сетки</span>
                  <strong>
                    {Math.round(entry.analysis.visualParams.gridRigidity * 100)}%
                  </strong>
                </div>
                <div className="math-bar-track">
                  <div
                    className="math-bar-fill"
                    style={{
                      width: `${Math.round(
                        entry.analysis.visualParams.gridRigidity * 100
                      )}%`,
                      backgroundColor: entry.analysis.palette.secondary,
                    }}
                  />
                </div>
              </div>

              <div className="math-meter">
                <div className="math-meter-head">
                  <span>Мягкость мазков</span>
                  <strong>
                    {Math.round(entry.analysis.visualParams.blurSoftness * 100)}%
                  </strong>
                </div>
                <div className="math-bar-track">
                  <div
                    className="math-bar-fill"
                    style={{
                      width: `${Math.round(
                        entry.analysis.visualParams.blurSoftness * 100
                      )}%`,
                      backgroundColor: entry.analysis.palette.accent,
                    }}
                  />
                </div>
              </div>

              <div className="math-meter">
                <div className="math-meter-head">
                  <span>Плёночное зерно</span>
                  <strong>
                    {Math.round(entry.analysis.visualParams.grain * 100)}%
                  </strong>
                </div>
                <div className="math-bar-track">
                  <div
                    className="math-bar-fill"
                    style={{
                      width: `${Math.round(
                        entry.analysis.visualParams.grain * 100
                      )}%`,
                      backgroundColor: entry.analysis.palette.secondary,
                    }}
                  />
                </div>
              </div>

              <div className="math-meter">
                <div className="math-meter-head">
                  <span>Плотность слоя</span>
                  <strong>
                    {Math.round(
                      entry.analysis.visualParams.overlayDensity * 100
                    )}
                    %
                  </strong>
                </div>
                <div className="math-bar-track">
                  <div
                    className="math-bar-fill"
                    style={{
                      width: `${Math.round(
                        entry.analysis.visualParams.overlayDensity * 100
                      )}%`,
                      backgroundColor: entry.analysis.palette.accent,
                    }}
                  />
                </div>
              </div>

              <div className="math-meter">
                <div className="math-meter-head">
                  <span>Скорость ритма</span>
                  <strong>{entry.analysis.visualParams.rhythmSpeed}×</strong>
                </div>
                <div className="math-bar-track">
                  <div
                    className="math-bar-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (entry.analysis.visualParams.rhythmSpeed / 2) * 100
                        )
                      )}%`,
                      backgroundColor: entry.analysis.palette.secondary,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Лайтбокс отдельной фотографии с разбором спектра */}
      {lightboxPhoto && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="lightbox-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-head font-mono">
              <span>ФАЙЛ В ПАПКЕ // {lightboxPhoto.name}</span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setLightboxPhoto(null)}
              >
                <X size={16} />
              </button>
            </div>

            <img
              src={lightboxPhoto.dataUrl}
              alt={lightboxPhoto.name}
              className="lightbox-img"
            />

            <div className="lightbox-footer font-mono">
              <div className="lightbox-swatches">
                {lightboxPhoto.dominantColors.map((hex) => (
                  <span key={hex} className="lightbox-chip">
                    <i style={{ backgroundColor: hex }} />
                    {hex}
                  </span>
                ))}
              </div>
              <div className="lightbox-metrics">
                Яркость {Math.round(lightboxPhoto.brightness * 100)}% · Контраст{' '}
                {Math.round(lightboxPhoto.contrast * 100)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Полноэкранный режим погружения (Cinema Mode) */}
      {isImmersive && (
        <div
          className="immersive-overlay"
          style={{
            background: `radial-gradient(circle at 50% 35%, ${entry.analysis.palette.accent}44, #08090f 80%)`,
          }}
        >
          {isAutoReel && (
            <div className="reel-progress-bar">
              <div
                className="reel-progress-fill"
                style={{
                  width: `${reelProgress}%`,
                  backgroundColor: entry.analysis.palette.accent,
                }}
              />
            </div>
          )}

          <div className="immersive-topbar">
            <span className="font-mono immersive-badge">
              ДЕНЬ // {String(entry.indexNumber).padStart(2, '0')} ·{' '}
              {entry.analysis.folderName}
            </span>
            <div className="immersive-actions">
              <button
                className={`btn-secondary ${frostMode ? 'is-active' : ''}`}
                onClick={() => {
                  const next = !frostMode;
                  setFrostMode(next);
                  audioCtrlRef.current?.setMemoryClarity(next ? 0.08 : 1);
                }}
                title="Покрыть воспоминание туманом времени и стереть его курсором"
              >
                <Sparkles size={15} />
                {frostMode ? 'Туман: ВКЛ' : 'Туман памяти'}
              </button>
              <button
                className={`btn-secondary ${isAutoReel ? 'is-active' : ''}`}
                onClick={() => setIsAutoReel((prev) => !prev)}
                title="Автоматически листать все дни дневника как фильм"
              >
                <Film size={15} />
                {isAutoReel ? 'Авто-фильм: ВКЛ' : 'Авто-фильм'}
              </button>
              <button className="btn-secondary" onClick={togglePlay}>
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                {isPlaying ? 'Пауза' : 'Звук'}
              </button>
              <button className="btn-secondary" onClick={toggleVoice}>
                {isSpeaking ? <VolumeX size={15} /> : <Mic size={15} />}
                {isSpeaking ? 'Стоп голос' : 'Озвучить'}
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setIsAutoReel(false);
                  setIsImmersive(false);
                }}
              >
                <Minimize2 size={15} />
                Выйти
              </button>
            </div>
          </div>

          <div className="immersive-body">
            <div className="immersive-canvas-box">
              <MemoryCanvas
                entry={entry}
                isPlaying={isPlaying}
                frostMode={frostMode}
                onFrostClarityChange={(c) =>
                  audioCtrlRef.current?.setMemoryClarity(c)
                }
                getSpectrum={() =>
                  audioCtrlRef.current?.getSpectrumMetrics() ?? {
                    bass: 0,
                    mid: 0,
                    treble: 0,
                    energy: 0,
                    bars: [],
                  }
                }
              />
            </div>

            <div className="immersive-caption">
              <p className="font-serif immersive-prose">«{entry.text}»</p>
              <div className="font-mono immersive-sub">
                {entry.analysis.movementTitle} · {entry.music.artist}{' '}
                {entry.music.title} ({entry.music.bpm} BPM)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
