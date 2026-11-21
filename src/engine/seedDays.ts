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
    grad.addColorStop(0, theme === 'autumn-park' ? '#e5b97a' : '#8c4c27');
    grad.addColorStop(0.55, '#c9783b');
    grad.addColorStop(1, '#4a2b18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 540);

    // Солнечные пятна сквозь листву
    for (let i = 0; i < 45; i++) {
      const x = (i * 97) % 720;
      const y = (i * 53) % 420;
      const r = 18 + (i % 5) * 14;
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(255, 224, 150, 0.28)'
          : i % 3 === 1
            ? 'rgba(214, 110, 42, 0.34)'
            : 'rgba(130, 62, 24, 0.25)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (theme === 'autumn-park') {
      // Силуэт пруда и деревьев
      ctx.fillStyle = 'rgba(48, 30, 20, 0.55)';
      ctx.fillRect(140, 90, 26, 300);
      ctx.fillRect(540, 60, 32, 330);
      ctx.fillStyle = 'rgba(235, 185, 110, 0.35)';
      ctx.fillRect(0, 380, 720, 160);
    } else {
      // Кружка какао на скамейке
      ctx.fillStyle = '#3b2416';
      ctx.fillRect(0, 360, 720, 180);
      ctx.fillStyle = '#efe3d0';
      ctx.beginPath();
      ctx.roundRect(290, 250, 140, 145, 18);
      ctx.fill();
      ctx.fillStyle = '#6f3e22';
      ctx.beginPath();
      ctx.ellipse(360, 258, 62, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === 'office-night' || theme === 'office-code') {
    const grad = ctx.createLinearGradient(0, 0, 720, 540);
    grad.addColorStop(0, '#0d1522');
    grad.addColorStop(0.6, '#17263c');
    grad.addColorStop(1, '#0b1018');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 540);

    // Холодный свет мониторов и линий сетки
    ctx.strokeStyle = 'rgba(104, 165, 224, 0.22)';
    ctx.lineWidth = 2;
    for (let x = 40; x < 720; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }
    ctx.fillStyle = theme === 'office-night' ? 'rgba(65, 130, 205, 0.35)' : 'rgba(224, 83, 60, 0.25)';
    ctx.fillRect(150, 120, 420, 250);
    ctx.fillStyle = '#9cc4e4';
    for (let row = 0; row < 8; row++) {
      ctx.fillRect(180, 155 + row * 24, 140 + ((row * 53) % 180), 8);
    }
  } else if (theme === 'mist-sea') {
    const grad = ctx.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, '#d8ddd8');
    grad.addColorStop(0.55, '#b6c1be');
    grad.addColorStop(1, '#7a8887');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 540);

    // Горизонт и туманная дымка
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.ellipse(360, 270, 380, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f4a49';
    ctx.fillRect(0, 340, 210, 6);
    ctx.fillRect(80, 340, 6, 95);
    ctx.fillRect(150, 340, 6, 95);
  } else if (theme === 'summer-storm') {
    const grad = ctx.createLinearGradient(0, 0, 720, 540);
    grad.addColorStop(0, '#2c2538');
    grad.addColorStop(0.55, '#594256');
    grad.addColorStop(1, '#c77c4e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 540);

    // Тёплый свет лампы на фоне предгрозового неба
    const lamp = ctx.createRadialGradient(220, 320, 12, 220, 320, 210);
    lamp.addColorStop(0, 'rgba(255, 212, 130, 0.72)');
    lamp.addColorStop(1, 'rgba(255, 212, 130, 0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, 720, 540);

    // Силуэт окна и проигрывателя
    ctx.strokeStyle = 'rgba(255, 238, 210, 0.25)';
    ctx.lineWidth = 4;
    ctx.strokeRect(390, 90, 240, 310);
    ctx.fillStyle = '#18141a';
    ctx.beginPath();
    ctx.arc(220, 360, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d4824a';
    ctx.beginPath();
    ctx.arc(220, 360, 22, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // rain-tram
    const grad = ctx.createLinearGradient(0, 0, 720, 540);
    grad.addColorStop(0, '#1f292e');
    grad.addColorStop(0.5, '#3b4a4e');
    grad.addColorStop(1, '#26211c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 540);

    // Боке огней витрин на мокром стекле
    const lights = [
      [140, 180, 38, 'rgba(244, 184, 96, 0.55)'],
      [250, 210, 52, 'rgba(230, 118, 72, 0.45)'],
      [480, 160, 44, 'rgba(248, 215, 132, 0.5)'],
      [560, 240, 34, 'rgba(130, 196, 185, 0.42)'],
    ] as const;
    for (const [x, y, r, color] of lights) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 36; i++) {
      const rx = (i * 83) % 720;
      const ry = (i * 41) % 500;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 6, ry + 26);
      ctx.stroke();
    }
  }

  return canvas.toDataURL('image/jpeg', 0.88);
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
