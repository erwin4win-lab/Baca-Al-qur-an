export interface JuzInfo {
  juz: number;
  name: string;
  arabicName: string;
  startPage: number;
}

export const JUZ_LIST: JuzInfo[] = [
  { juz: 1, name: 'Al-Fatihah', arabicName: 'الم', startPage: 1 },
  { juz: 2, name: 'Sayaqulu', arabicName: 'سَيَقُولُ', startPage: 22 },
  { juz: 3, name: 'Tilkar Rusul', arabicName: 'تِلْكَ الرُّسُلُ', startPage: 42 },
  { juz: 4, name: 'Lan Tanalu', arabicName: 'لَنْ تَنَالُوا', startPage: 62 },
  { juz: 5, name: 'Wal Muhsanat', arabicName: 'وَالْمُحْصَنَاتُ', startPage: 82 },
  { juz: 6, name: 'La Yuhibbullah', arabicName: 'لَا يُحِبُّ اللَّهُ', startPage: 102 },
  { juz: 7, name: 'Wa Iza Sami\'u', arabicName: 'وَإِذَا سَمِعُوا', startPage: 121 },
  { juz: 8, name: 'Wa Lau Annana', arabicName: 'وَلَوْ أَنَّنَا', startPage: 142 },
  { juz: 9, name: 'Qalal Mala\'u', arabicName: 'قَالَ الْمَلَأُ', startPage: 162 },
  { juz: 10, name: 'Wa\'lamu', arabicName: 'وَاعْلَمُوا', startPage: 182 },
  { juz: 11, name: 'Ya\'tazirun', arabicName: 'يَعْتَذِرُونَ', startPage: 201 },
  { juz: 12, name: 'Wa Ma Min Dabbah', arabicName: 'وَمَا مِنْ دَابَّةٍ', startPage: 222 },
  { juz: 13, name: 'Wa Ma Ubarri\'u', arabicName: 'وَمَا أُبَرِّئُ', startPage: 242 },
  { juz: 14, name: 'Rubama', arabicName: 'رُبَمَا', startPage: 262 },
  { juz: 15, name: 'Subhanallazi', arabicName: 'سُبْحَانَ الَّذِي', startPage: 282 },
  { juz: 16, name: 'Qala Alam', arabicName: 'قَالَ أَلَمْ', startPage: 302 },
  { juz: 17, name: 'Iqtaraba', arabicName: 'اقْتَرَبَ', startPage: 322 },
  { juz: 18, name: 'Qad Aflaha', arabicName: 'قَدْ أَفْلَحَ', startPage: 342 },
  { juz: 19, name: 'Wa Qalal Lazina', arabicName: 'وَقَالَ الَّذِينَ', startPage: 362 },
  { juz: 20, name: 'Amman Khalaqa', arabicName: 'أَمَّنْ خَلَقَ', startPage: 382 },
  { juz: 21, name: 'Utlu Ma Uhiya', arabicName: 'اتْلُ مَا أُوحِيَ', startPage: 402 },
  { juz: 22, name: 'Wa Man Yaqnut', arabicName: 'وَمَنْ يَقْنُتْ', startPage: 422 },
  { juz: 23, name: 'Wa Maliya', arabicName: 'وَمَا لِيَ', startPage: 442 },
  { juz: 24, name: 'Faman Azlamu', arabicName: 'فَمَنْ أَظْلَمُ', startPage: 462 },
  { juz: 25, name: 'Ilayhi Yuraddu', arabicName: 'إِلَيْهِ يُرَدُّ', startPage: 482 },
  { juz: 26, name: 'Ha-Mim', arabicName: 'حم', startPage: 502 },
  { juz: 27, name: 'Qala Fama Khatbukum', arabicName: 'قَالَ فَمَا خَطْبُكُمْ', startPage: 522 },
  { juz: 28, name: 'Qad Sami\'allah', arabicName: 'قَدْ سَمِعَ اللَّهُ', startPage: 542 },
  { juz: 29, name: 'Tabarakallazi', arabicName: 'تَبَارَكَ الَّذِي', startPage: 562 },
  { juz: 30, name: '\'Amma Yatasa\'alun', arabicName: 'عَمَّ يَتَسَاءَلُونَ', startPage: 582 }
];

export function getJuzForPage(page: number): JuzInfo {
  const safePage = Math.min(604, Math.max(1, page));
  for (let i = JUZ_LIST.length - 1; i >= 0; i--) {
    if (safePage >= JUZ_LIST[i].startPage) {
      return JUZ_LIST[i];
    }
  }
  return JUZ_LIST[0];
}

export function getMadinahPageImageUrl(page: number): string {
  const safePage = Math.min(604, Math.max(1, page));
  const padded = String(safePage).padStart(3, '0');
  return `https://files.quran.app/hafs/madani/width_1260/page${padded}.png`;
}
