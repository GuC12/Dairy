import type { DiaryEntry, MusicInput, PhotoItem } from '../types/diary';
import { analyzeDayAtmosphere } from './atmosphereEngine';
import { analyzeDataUrl } from './photoAnalyzer';

async function loadPublicPhotoAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxSide = 1100;
      const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(url);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

export async function createUserPhotoDays(): Promise<DiaryEntry[]> {
  const specs: Array<{
    id: string;
    indexNumber: number;
    dateLabel: string;
    weather: string;
    location: string;
    text: string;
    signature: string;
    photoUrl: string;
    music: MusicInput;
  }> = [
    {
      id: 'user_photo_day_1',
      indexNumber: 1,
      dateLabel: '15 ноября 2026',
      weather: '+5°C, штормовой ветер',
      location: 'Двор у дома',
      text: 'После внезапного шквального ветра вышли на улицу — сломанные зелёные ветки прямо на асфальте, тяжёлый мусорный бак лежит на боку колёсами вперёд, а в витринах первого этажа уже спокойно горит тёплый свет. Странное ощущение городского хаоса, свежего пыльного воздуха и резкого ритма после бури.',
      signature: 'Улица после внезапного шторма',
      photoUrl: './photos/day1.jpg',
      music: {
        mode: 'link',
        title: 'A New Error',
        artist: 'Moderat',
        genre: 'Electronic / IDM',
        bpm: 128,
        tonality: 'minor',
        energy: 0.84,
        url: 'https://open.spotify.com/search/Moderat%20A%20New%20Error',
      },
    },
    {
      id: 'user_photo_day_2',
      indexNumber: 2,
      dateLabel: '17 ноября 2026',
      weather: '+14°C, лёгкий ветер',
      location: 'На краю города',
      text: 'Уехали туда, где заканчиваются кварталы и начинается высокое бесконечное небо. Тихий ветер гудит в проводах над зелёной травой, вдалеке стоит одинокий белый ангар, а лёгкие перистые облака растянулись через весь горизонт. Стоишь в полной тишине, дышишь простором и никуда не спешишь.',
      signature: 'Простор, трава и облака',
      photoUrl: './photos/day2.jpg',
      music: {
        mode: 'link',
        title: 'An Ending (Ascent)',
        artist: 'Brian Eno',
        genre: 'Ambient',
        bpm: 66,
        tonality: 'minor',
        energy: 0.24,
        url: 'https://open.spotify.com/search/Brian%20Eno%20An%20Ending',
      },
    },
    {
      id: 'user_photo_day_3',
      indexNumber: 3,
      dateLabel: '18 ноября 2026',
      weather: '+12°C, ясно',
      location: 'Верхний этаж',
      text: 'Смотрел на город с высоты верхнего этажа: прямо под окнами тихие зелёные дворы и крыши старых пятиэтажек, а далеко на горизонте под грядой кучевых облаков светятся новые башни. Необычное чувство, будто видишь сразу прошлое и будущее одного города в один ясный день.',
      signature: 'Весь город как на ладони',
      photoUrl: './photos/day3.jpg',
      music: {
        mode: 'link',
        title: 'Midnight City (Instrumental)',
        artist: 'M83',
        genre: 'Indie / Synthpop',
        bpm: 105,
        tonality: 'major',
        energy: 0.58,
        url: 'https://open.spotify.com/search/M83%20Midnight%20City',
      },
    },
    {
      id: 'user_photo_day_4',
      indexNumber: 4,
      dateLabel: '19 ноября 2026',
      weather: '+11°C, золотой час',
      location: 'Тихий перекрёсток',
      text: 'Тот самый тёплый золотой час перед закатом, когда низкое солнце красит фасады домов в мягкий янтарный свет, а тени вытягиваются через всю дорогу. На углу у ограды пристёгнуты два велосипеда, улица почти пустая — шли медленно, щурились от солнца и долго разговаривали обо всём.',
      signature: 'Золотой свет на вечерних фасадах',
      photoUrl: './photos/day4.jpg',
      music: {
        mode: 'link',
        title: 'Just the Two of Us',
        artist: 'Grover Washington Jr.',
        genre: 'Soul Jazz',
        bpm: 78,
        tonality: 'major',
        energy: 0.38,
        url: 'https://open.spotify.com/search/Just%20the%20Two%20of%20Us',
      },
    },
    {
      id: 'user_photo_day_5',
      indexNumber: 5,
      dateLabel: '21 ноября 2026',
      weather: '+10°C, солнечно',
      location: 'У крыльца',
      text: 'Встретили на нагретой солнцем брусчатке двух уличных котов — пушистого чёрного с белыми лапками и маленького пятнистого. Поделились с ними угощением и стояли улыбались, глядя на их длинные графичные тени. Самый тёплый, живой и уютный момент за всю неделю.',
      signature: 'Два кота и длинные тени',
      photoUrl: './photos/day5.jpg',
      music: {
        mode: 'link',
        title: 'Sunrise',
        artist: 'Norah Jones',
        genre: 'Acoustic Jazz',
        bpm: 80,
        tonality: 'major',
        energy: 0.36,
        url: 'https://open.spotify.com/search/Norah%20Jones%20Sunrise',
      },
    },
  ];

  const entries: DiaryEntry[] = [];
  for (const spec of specs) {
    const dataUrl = await loadPublicPhotoAsDataUrl(spec.photoUrl);
    const analyzedPhoto: PhotoItem = await analyzeDataUrl(
      dataUrl,
      `${spec.id}.jpg`
    );
    const photos = [analyzedPhoto];

    const analysis = await analyzeDayAtmosphere(spec.text, photos, spec.music);
    entries.push({
      id: spec.id,
      indexNumber: spec.indexNumber,
      createdAt: new Date(2026, 10, 14 + spec.indexNumber).toISOString(),
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
