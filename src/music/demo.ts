export type Take = {
  id?: string;
  title: string; url: string; kind: 'audio' | 'video'; recorded: string;
  instrument: string; notes: string; visibility: 'public' | 'private';
};

export type Piece = {
  id: string;
  title: string;
  slug?: string;
  visibility?: 'published' | 'unlisted' | 'private' | 'draft';
  metadata?: Record<string, string>;
  takes?: Take[];
  artist: string;
  root: number;
  mode: 'major' | 'minor';
  score: string;
  video: string;
  listed: boolean;
  revision: number;
};

export const demo: Piece = {
  id: 'demo',
  title: 'شبِ آرام',
  artist: 'قطعهٔ نمونه برای تمرین',
  root: 9,
  mode: 'minor',
  score: [
    '# بند اول',
    '[Am]پنجره رو باز کن، [F]هوا بوی بارون داره',
    '[C]آسمون از دور [G]واسه ما چراغ می‌ذاره',
    '! ۲ ضرب مکث',
    '# هم‌خوانی',
    '[Am]با من بخون [F]تا شب آروم بگیره',
    '[C]تا نور صبح [G]از لای پرده بتابه',
    '~ تار یا سه‌تار | A4 C5 B4 A4 E4',
    '[F]هر جا که رفتیم، [G]این آواز [Am]یادمون باشه',
  ].join('\n'),
  video: '',
  listed: false,
  revision: 0,
};
