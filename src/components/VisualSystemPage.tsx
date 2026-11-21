import React from 'react';
import { BookOpen, Cpu, Layers, Music, Palette, Sparkles } from 'lucide-react';

export const VisualSystemPage: React.FC = () => {
  return (
    <div className="system-page view-enter">
      <div className="system-header">
        <div className="font-mono section-kicker">ARCHITECTURE & VISUAL GRAMMAR</div>
        <h1 className="font-serif create-title">
          Единая визуальная система дневника
        </h1>
        <p className="hero-subtitle">
          Дневник — это серия, а не набор случайных картинок. Каждая генерация
          подчиняется строгим правилам перевода невидимого ощущения дня в видимую форму.
        </p>
      </div>

      <div className="system-grid-2">
        <div className="system-card">
          <div className="system-card-title font-mono">
            <Layers size={16} /> ПОСТОЯННЫЕ ЭЛЕМЕНТЫ (ЦЕЛЬНОСТЬ ЛЕНТЫ)
          </div>
          <ul className="system-list">
            <li>
              <strong>Единый формат 4:5:</strong> каждая запись оформляется как
              коллекционная страница дневника с фиксированной внешней рамкой-паспарту.
            </li>
            <li>
              <strong>Типографическая иерархия:</strong> моноширинный индекс{' '}
              <code>DAY // 01</code>, дата и погода сверху; поэтичный заголовок
              папки (3–7 слов) на антикве <em>Cormorant Garamond</em> и личная
              рукописная подпись снизу.
            </li>
            <li>
              <strong>Окно встраивания фото:</strong> снимки всегда живут внутри
              центрального кадра и не выпадают из общей сетки.
            </li>
          </ul>
        </div>

        <div className="system-card">
          <div className="system-card-title font-mono">
            <Palette size={16} /> ПЕРЕМЕННЫЕ ЭЛЕМЕНТЫ (УНИКАЛЬНОСТЬ ДНЯ)
          </div>
          <ul className="system-list">
            <li>
              <strong>Адаптивная палитра:</strong> вычисляется из доминирующих
              цветов загруженных фото (Canvas-квантование) и сдвигается по
              температуре настроения и тональности музыки.
            </li>
            <li>
              <strong>Плотность «воздуха» и сетка:</strong> тихие минорные дни
              увеличивают поля паспарту, напряжённые — сжимают их жёсткой сеткой.
            </li>
            <li>
              <strong>Ритм и живой отклик:</strong> скорость смены кадров, зерно,
              мазки и геометрия пульсируют в такт реальному спектру музыки (Web
              Audio API).
            </li>
          </ul>
        </div>
      </div>

      <div className="system-card">
        <div className="system-card-title font-mono">
          <BookOpen size={16} /> 4 ХУДОЖЕСТВЕННЫХ ПРИЁМА И РЕФЕРЕНСА
        </div>
        <div className="movements-grid">
          <div className="movement-box">
            <div className="movement-tag font-mono">01 // ИМПРЕССИОНИЗМ</div>
            <h3>Клод Моне — свет и мазки</h3>
            <p>
              <strong>Когда включается:</strong> тёплые, спокойные, ностальгические
              дни, мажорная музыка, мягкий свет на фото.
            </p>
            <p>
              <strong>Как передаёт ощущение:</strong> полупрозрачные мазки из
              палитры снимков, диффузный свет и плавный кроссфейд кадров создают
              эффект тёплого воспоминания.
            </p>
          </div>

          <div className="movement-box">
            <div className="movement-tag font-mono">02 // КОНСТРУКТИВИЗМ</div>
            <h3>Василий Кандинский — геометрия</h3>
            <p>
              <strong>Когда включается:</strong> высокий темп (&gt;115 BPM),
              высокая энергия, дедлайны, ночная работа, электроника.
            </p>
            <p>
              <strong>Как передаёт ощущение:</strong> тёмная собранная палитра,
              пересекающиеся оси, резкая смена кадров и импульсные фигуры в такт
              басу.
            </p>
          </div>

          <div className="movement-box">
            <div className="movement-tag font-mono">03 // ЯПОНСКИЙ МИНИМАЛИЗМ</div>
            <h3>Ваби-саби — воздух и тишина</h3>
            <p>
              <strong>Когда включается:</strong> медленный темп (&le;82 BPM),
              минорная тональность, туман, дождь, созерцание.
            </p>
            <p>
              <strong>Как передаёт ощущение:</strong> увеличенное негативное
              пространство вокруг фото, приглушённая насыщенность и тонкая
              горизонтальная линия туши.
            </p>
          </div>

          <div className="movement-box">
            <div className="movement-tag font-mono">04 // АНАЛОГОВАЯ ПЛЁНКА</div>
            <h3>Плёнка 35mm / Коллаж</h3>
            <p>
              <strong>Когда включается:</strong> живые городские прогулки,
              смешанное настроение, средний темп, инди/поп.
            </p>
            <p>
              <strong>Как передаёт ощущение:</strong> перфорация кадра, лёгкая
              боковая засветка, зернистость и движение хроники.
            </p>
          </div>
        </div>
      </div>

      <div className="system-grid-2">
        <div className="system-card">
          <div className="system-card-title font-mono">
            <Music size={16} /> КАК ВВОД ВЛИЯЕТ НА РЕЗУЛЬТАТ
          </div>
          <ul className="system-list">
            <li>
              <strong>Текст:</strong> определяет время суток, сезон, валентность
              настроения, генерирует название папки (3–7 слов) и профиль голоса
              для озвучки.
            </li>
            <li>
              <strong>Фото:</strong> Canvas извлекает 4 доминирующих цвета,
              яркость и контраст — они становятся цветовой основой страницы и
              мазков.
            </li>
            <li>
              <strong>Музыка:</strong> Web Audio API оценивает BPM и энергию
              аудиофайла (или использует параметры трека по ссылке + процедурный
              саундскейп), управляя скоростью анимации и пульсацией в 60 FPS.
            </li>
          </ul>
        </div>

        <div className="system-card">
          <div className="system-card-title font-mono">
            <Cpu size={16} /> ИСПОЛЬЗОВАННЫЕ ИНСТРУМЕНТЫ И СТЕК
          </div>
          <ul className="system-list">
            <li>
              <strong>Frontend:</strong> React 19, TypeScript, Vite.
            </li>
            <li>
              <strong>Графика и анализ фото:</strong> HTML5 Canvas 2D (реальное
              квантование цветов, художественные фильтры, экспорт PNG).
            </li>
            <li>
              <strong>Аудио и озвучка:</strong> Web Audio API (
              <code>AnalyserNode</code>, оценка BPM/RMS, процедурный
              эмбиент-синтезатор для ссылок) + Web Speech API для озвучки текста.
            </li>
            <li>
              <strong>Хранилище и AI:</strong> IndexedDB для локальных папок дней
              + опциональное подключение <code>gemini-2.5-flash</code> для
              расширенного анализа текста.
            </li>
          </ul>
        </div>
      </div>

      <div className="system-footer-note font-mono">
        <Sparkles size={14} />
        <span>
          Все демо-дни в архиве сгенерированы без использования чужих личных
          дневников или защищённых авторским правом аудиофайлов.
        </span>
      </div>
    </div>
  );
};
