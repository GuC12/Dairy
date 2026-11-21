import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Film,
  FolderOpen,
  Maximize2,
  Mic,
  Minimize2,
  Pause,
  Play,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { DiaryEntry } from '../types/diary';
import { DayAudioController } from '../engine/audioAnalyzer';
import { MemoryCanvas } from './MemoryCanvas';
import { AtmosphereCompass } from './AtmosphereCompass';

interface DayFolderViewProps {
  entry: DiaryEntry;
  onBack: () => void;
  onDelete: (id: string) => void;
}

export const DayFolderView: React.FC<DayFolderViewProps> = ({
  entry,
  onBack,
  onDelete,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(16).fill(0.08));

  const audioCtrlRef = useRef<DayAudioController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const ctrl = new DayAudioController();
    audioCtrlRef.current = ctrl;
    return () => {
      ctrl.stop();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [entry.id]);

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

    // Если звук не включён — включим его, чтобы клип был со звуком
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

  return (
    <div className="folder-view view-enter">
      <div
        className="folder-ambient-glow"
        style={{ backgroundColor: entry.analysis.palette.accent }}
      />
      <div className="folder-topbar">
        <button className="btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          Назад в архив
        </button>

        <div className="folder-path font-mono">
          <FolderOpen size={15} />
          <span>/archive/{entry.analysis.folderName}</span>
        </div>

        <div className="topbar-right-actions">
          <button
            className="btn-secondary"
            onClick={() => {
              if (!isPlaying) togglePlay();
              setIsImmersive(true);
            }}
          >
            <Maximize2 size={15} />
            Режим погружения
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
              <span>DAY // {String(entry.indexNumber).padStart(2, '0')}</span>
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
              <span className="pill pill-mono">
                {entry.analysis.engineUsed === 'gemini-2.5-flash'
                  ? 'Gemini 2.5 Flash + Rules'
                  : 'Local Atmosphere Engine'}
              </span>
            </div>

            <p className="entry-prose">{entry.text}</p>

            {entry.signature && (
              <div className="entry-signature font-hand">
                — {entry.signature}
              </div>
            )}
          </div>

          {/* Музыка и исходные фото в папке */}
          <div className="detail-card">
            <h3 className="section-label font-mono">СОДЕРЖИМОЕ ПАПКИ ДНЯ</h3>

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
              {entry.photos.map((ph) => (
                <div key={ph.id} className="photo-thumb-card">
                  <img src={ph.dataUrl} alt={ph.name} />
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
              ))}
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
          </div>
        </div>
      </div>

      {/* Полноэкранный режим погружения (Cinema Mode) */}
      {isImmersive && (
        <div
          className="immersive-overlay"
          style={{
            background: `radial-gradient(circle at 50% 35%, ${entry.analysis.palette.accent}33, #0e0e0d 78%)`,
          }}
        >
          <div className="immersive-topbar">
            <span className="font-mono immersive-badge">
              DAY // {String(entry.indexNumber).padStart(2, '0')} ·{' '}
              {entry.analysis.folderName}
            </span>
            <div className="immersive-actions">
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
                onClick={() => setIsImmersive(false)}
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
