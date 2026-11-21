import type { DiaryEntry, MusicInput, PhotoItem } from '../types/diary';
import { analyzeDayAtmosphere } from './atmosphereEngine';
import { analyzeDataUrl } from './photoAnalyzer';

function renderDemoScene(
  theme:
    | 'autumn-park'
    | 'autumn-cocoa'
    | 'office-night'
    | 'office-code'
    | 'mist-sea'
    | 'rain-tram'
    | 'summer-storm'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 540;
  const ctx = canvas.getContext('2d')!;

  if (theme === 'autumn-park' || theme === 'autumn-cocoa') {
    const grad = ctx.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, theme === 'autumn-park' ? '#fbe2a8' : '#b85324');
    grad.addColorStop(0.45, '#e88b35');
    grad.addColorStop(0.75, '#a83c1e');
    grad.addColorStop(1, '#2d1a14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 540);

    // Солнечный ореол
    const sun = ctx.createRadialGradient(360, 175, 10, 360, 175, 240);
    sun.addColorStop(0, 'rgba(255, 248, 210, 0.92)');
    sun.addColorStop(0.4, 'rgba(251, 191, 36, 0.45)');
    sun.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, 720, 540);

    if (theme === 'autumn-park') {
      // Зеркальный пруд с бирюзово-золотыми отражениями
      const water = ctx.createLinearGradient(0, 340, 0, 540);
      water.addColorStop(0, '#2a4a54');
      water.addColorStop(0.5, '#8c4f2b');
      water.addColorStop(1, '#1e161a');
      ctx.fillStyle = water;
      ctx.fillRect(0, 340, 720, 200);

      // Сотни импрессионистических листьев и бликов на воде
      const leafPalette = ['#fde047', '#f97316', '#dc2626', '#fbbf24', '#38bdf8'];
      for (let i = 0; i < 110; i++) {
        const x = (i * 73) % 720;
        const y = (i * 41) % 345;
        const r = 10 + (i % 6) * 8;
        ctx.fillStyle = leafPalette[i % leafPalette.length];
        ctx.globalAlpha = 0.42;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.3, r * 0.75, (i % 5) * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Отражение в пруду
        const ry = 348 + ((i * 19) % 180);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x - r, ry, r * 2.2, 4);
      }
      ctx.globalAlpha = 1;

      // Стволы и ветви
      ctx.fillStyle = '#291711';
      ctx.fillRect(108, 70, 22, 275);
      ctx.fillRect(580, 50, 28, 295);
    } else {
      // Тёплое какао с паром и золотистым боке
      for (let i = 0; i < 55; i++) {
        const x = (i * 97) % 720;
        const y = (i * 53) % 380;
        const r = 16 + (i % 5) * 14;
        ctx.fillStyle =
          i % 2 === 0
            ? 'rgba(253, 224, 71, 0.32)'
            : 'rgba(249, 115, 22, 0.36)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#2d1810';
      ctx.fillRect(0, 360, 720, 180);
      ctx.fillStyle = '#fff5e4';
      ctx.beginPath();
      ctx.roundRect(285, 235, 150, 155, 22);
      ctx.fill();
      ctx.fillStyle = '#5c2d16';
      ctx.beginPath();
      ctx.ellipse(360, 243, 66, 17, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === 'office-night' || theme === 'office-code') {
    const grad = ctx.createLinearGradient(0, 0, 720, 540);
    grad.addColorStop(0, '#070d1f');
    grad.addColorStop(0.5, '#0f2347');
    grad.addColorStop(1, '#1e1136');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 540);

    // Силуэты ночных небоскрёбов и неоновых огней
    const neonColors = ['#38bdf8', '#ff4757', '#facc15', '#a855f7'];
    for (let b = 0; b < 14; b++) {
      const bx = b * 54;
      const bh = 180 + ((b * 79) % 240);
      ctx.fillStyle = 'rgba(10, 18, 38, 0.85)';
      ctx.fillRect(bx, 540 - bh, 46, bh);

      for (let wy = 540 - bh + 16; wy < 520; wy += 22) {
        if ((b + wy) % 3 === 0) {
          ctx.fillStyle = neonColors[(b + wy) % neonColors.length];
          ctx.globalAlpha = 0.75;
          ctx.fillRect(bx + 8, wy, 12, 8);
          ctx.fillRect(bx + 26, wy, 12, 8);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Светящийся экран с кодом и графиками
    ctx.fillStyle = 'rgba(15, 28, 58, 0.88)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.fillRect(140, 95, 440, 265);
    ctx.strokeRect(140, 95, 440, 265);

    for (let row = 0; row < 9; row++) {
      ctx.fillStyle =
        row % 3 === 0 ? '#ff4757' : row % 2 === 0 ? '#38bdf8' : '#a855f7';
      ctx.fillRect(170, 128 + row * 24, 120 + ((row * 67) % 230), 8);
    }
  } else if (theme === 'mist-sea') {
    const grad = ctx.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, '#e6f4f1');
    grad.addColorStop(0.45, '#99cfc7');
    grad.addColorStop(0.8, '#3f7d76');
    grad.addColorStop(1, '#183a37');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 540);

    // Бледно-коралловый утренний диск солнца сквозь туман
    ctx.fillStyle = 'rgba(244, 114, 94, 0.72)';
    ctx.beginPath();
    ctx.arc(510, 165, 54, 0, Math.PI * 2);
    ctx.fill();

    // Многослойные силуэты гор в тумане
    ctx.fillStyle = 'rgba(45, 98, 92, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, 320);
    ctx.quadraticCurveTo(180, 210, 390, 295);
    ctx.quadraticCurveTo(560, 220, 720, 310);
    ctx.lineTo(720, 540);
    ctx.lineTo(0, 540);
    ctx.fill();

    // Туманная дымка
    ctx.fillStyle = 'rgba(236, 250, 247, 0.48)';
    ctx.fillRect(0, 275, 720, 65);

    // Деревянный пирс
    ctx.fillStyle = '#122926';
    ctx.fillRect(0, 370, 250, 8);
    ctx.fillRect(70, 370, 7, 110);
    ctx.fillRect(145, 370, 7, 110);
    ctx.fillRect(220, 370, 7, 110);
  } else if (theme === 'summer-storm') {
    const grad = ctx.createLinearGradient(0, 0, 720, 540);
    grad.addColorStop(0, '#1e1333');
    grad.addColorStop(0.5, '#58285f');
    grad.addColorStop(0.82, '#c8523b');
    grad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 540);

    // Тёплый янтарный свет настольной лампы
    const lamp = ctx.createRadialGradient(210, 330, 10, 210, 330, 240);
    lamp.addColorStop(0, 'rgba(254, 240, 138, 0.88)');
    lamp.addColorStop(0.5, 'rgba(245, 158, 11, 0.35)');
    lamp.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, 720, 540);

    // Росчерк молнии в окне
    ctx.strokeStyle = 'rgba(240, 235, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(510, 95);
    ctx.lineTo(485, 175);
    ctx.lineTo(520, 185);
    ctx.lineTo(475, 285);
    ctx.stroke();

    // Силуэт окна и виниловой пластинки
    ctx.strokeStyle = 'rgba(255, 238, 210, 0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(390, 85, 245, 315);
    ctx.fillStyle = '#120e17';
    ctx.beginPath();
    ctx.arc(215, 365, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(215, 365, 26, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // rain-tram: кинематографичный изумрудно-янтарный вечер в городе
    const grad = ctx.createLinearGradient(0, 0, 720, 540);
    grad.addColorStop(0, '#0f2027');
    grad.addColorStop(0.5, '#203a43');
    grad.addColorStop(1, '#2c5364');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 540);

    // Светящийся тёплый вагон трамвая
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.roundRect(170, 170, 380, 185, 20);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    for (let w = 0; w < 4; w++) {
      ctx.fillRect(200 + w * 86, 200, 64, 78);
    }

    // Яркие боке огней витрин и светофоров на мокром стекле
    const lights = [
      [115, 190, 44, 'rgba(251, 191, 36, 0.65)'],
      [250, 390, 58, 'rgba(249, 115, 22, 0.55)'],
      [490, 145, 48, 'rgba(45, 212, 191, 0.55)'],
      [590, 260, 42, 'rgba(244, 63, 94, 0.58)'],
      [420, 420, 62, 'rgba(250, 204, 21, 0.48)'],
    ] as const;
    for (const [x, y, r, color] of lights) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 42; i++) {
      const rx = (i * 83) % 720;
      const ry = (i * 41) % 500;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 7, ry + 28);
      ctx.stroke();
    }
  }

  return canvas.toDataURL('image/jpeg', 0.9);
}

export async function createSeedDays(): Promise<DiaryEntry[]> {
  const specs: Array<{
    id: string;
    indexNumber: number;
    dateLabel: string;
    weather: string;
    location: string;
    text: string;
    signature: string;
    themes: Array<Parameters<typeof renderDemoScene>[0]>;
    music: MusicInput;
  }> = [
    {
      id: 'seed_day_1',
      indexNumber: 1,
      dateLabel: '14 октября 2026',
      weather: '+7°C, ясно',
      location: 'Центральный парк',
      text: 'Гуляли по парку, всё в жёлтых листьях, было прохладно, но мы пили горячее какао у пруда и долго разговаривали обо всём. Воздух пах дымком и мокрой корой, а в наушниках тихо играл Синатра.',
      signature: 'Тёплая осень, которую не хочется забывать',
      themes: ['autumn-park', 'autumn-cocoa'],
      music: {
        mode: 'link',
        title: 'Autumn in New York',
        artist: 'Frank Sinatra',
        genre: 'Vocal Jazz',
        bpm: 74,
        tonality: 'major',
        energy: 0.34,
        url: 'https://open.spotify.com/search/Frank%20Sinatra%20Autumn%20in%20New%20York',
      },
    },
    {
      id: 'seed_day_2',
      indexNumber: 2,
      dateLabel: '03 ноября 2026',
      weather: '-2°C, ветер',
      location: 'Офис, 9 этаж',
      text: 'Срочная сдача проекта, ночь в офисе, за окном пустой проспект и синие огни. В наушниках плотная электронная музыка, на экране десятки строк кода и таблиц — собрались и дотянули до финала.',
      signature: '02:40 — релиз ушёл в прод',
      themes: ['office-night', 'office-code'],
      music: {
        mode: 'link',
        title: 'Midnight Grid (Electronic)',
        artist: 'Rival Consoles',
        genre: 'Electronic / IDM',
        bpm: 132,
        tonality: 'minor',
        energy: 0.86,
        url: 'https://open.spotify.com/search/Rival%20Consoles',
      },
    },
    {
      id: 'seed_day_3',
      indexNumber: 3,
      dateLabel: '11 ноября 2026',
      weather: '+4°C, густой туман',
      location: 'Прибрежная станция',
      text: 'Ранний утренний поезд вдоль берега. Море почти исчезло в белом тумане, слышен только мерный стук колёс и тишина в полупустом вагоне. Очень спокойное, медленное утро.',
      signature: 'Вдоль воды и тишины',
      themes: ['mist-sea'],
      music: {
        mode: 'link',
        title: 'An Ending (Ascent)',
        artist: 'Brian Eno',
        genre: 'Ambient',
        bpm: 64,
        tonality: 'minor',
        energy: 0.22,
        url: 'https://open.spotify.com/search/Brian%20Eno%20An%20Ending',
      },
    },
    {
      id: 'seed_day_4',
      indexNumber: 4,
      dateLabel: '18 ноября 2026',
      weather: '+3°C, морось',
      location: 'Трамвай №6',
      text: 'Ехали вечером через весь город на старом трамвае. По стеклу стекали капли, а огни витрин расплывались в тёплые пятна. Взяли кофе на остановке и смеялись над случайной вывеской.',
      signature: 'Город сквозь мокрое стекло',
      themes: ['rain-tram'],
      music: {
        mode: 'link',
        title: 'La Javanaise (Indie Cover)',
        artist: 'Pomplamoose',
        genre: 'Indie / Chanson',
        bpm: 104,
        tonality: 'major',
        energy: 0.56,
        url: 'https://open.spotify.com/search/Pomplamoose',
      },
    },
    {
      id: 'seed_day_5',
      indexNumber: 5,
      dateLabel: '19 ноября 2026',
      weather: '+11°C, гроза',
      location: 'Дома на кухне',
      text: 'Вечерняя гроза за окном, тёплая настольная лампа и треск старой виниловой пластинки. Пили чай с мёдом, пока за стеклом сверкали редкие вспышки и пахло озоном.',
      signature: 'Уют внутри грозы',
      themes: ['summer-storm'],
      music: {
        mode: 'link',
        title: 'Dream a Little Dream of Me',
        artist: 'Ella Fitzgerald & Louis Armstrong',
        genre: 'Classic Jazz',
        bpm: 78,
        tonality: 'major',
        energy: 0.38,
        url: 'https://open.spotify.com/search/Ella%20Fitzgerald%20Dream%20a%20Little%20Dream',
      },
    },
  ];

  const entries: DiaryEntry[] = [];
  for (const spec of specs) {
    const photos: PhotoItem[] = [];
    for (let i = 0; i < spec.themes.length; i++) {
      const dataUrl = renderDemoScene(spec.themes[i]);
      const analyzed = await analyzeDataUrl(dataUrl, `${spec.id}_photo_${i + 1}.jpg`);
      photos.push(analyzed);
    }

    const analysis = await analyzeDayAtmosphere(spec.text, photos, spec.music);
    entries.push({
      id: spec.id,
      indexNumber: spec.indexNumber,
      createdAt: new Date(2026, 10, 10 + spec.indexNumber).toISOString(),
      dateLabel: spec.dateLabel,
      weather: spec.weather,
      location: spec.location,
      text: spec.text,
      signature: spec.signature,
      photos,
      music: spec.music,
      analysis,
    });
  }

  return entries;
}
