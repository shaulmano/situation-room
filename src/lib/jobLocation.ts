/**
 * מיקום משרה מול גוש דן. 21.11.2026, שאול: רק גוש דן בשלב הראשון, וזה חל גם
 * על המשרה ולא רק על החברה. חברה בגוש דן יכולה לפרסם משרה בחיפה.
 *
 * הגדרה שלו: מראשון לציון ורחובות עד כפר סבא ונתניה.
 * שלוש תשובות בלבד:
 *   in      : עיר מוכרת בגוש דן.
 *   out     : עיר או מחוז ברור מחוץ לגוש דן. המשרה לא מוצגת בחברות זהב.
 *   unknown : "Israel", "Center", ריק, או עיר שלא הוגדרה. מוצגת עם המיקום
 *             כפי שנכתב, כי "לא ידוע" אינו ראיה שהיא רחוקה.
 */
const IN = [
  'tel aviv', 'תל אביב', 'ramat gan', 'רמת גן', 'givatayim', 'גבעתיים', 'bnei brak', 'בני ברק', 'petah tikva', 'petach tikva',
  'פתח תקווה', 'herzliya', 'הרצליה', 'raanana', "ra'anana", 'רעננה', 'kfar saba', 'כפר סבא', 'hod hasharon', 'הוד השרון',
  'netanya', 'נתניה', 'rishon', 'ראשון לציון', 'rehovot', 'רחובות', 'holon', 'חולון', 'bat yam', 'בת ים', 'rosh haayin',
  'rosh ha\'ayin', 'ראש העין', 'or yehuda', 'אור יהודה', 'yehud', 'יהוד', 'lod', 'לוד', 'ramla', 'רמלה', 'kiryat ono', 'kiryat oono',
  'קריית אונו', 'beer yaakov', "be'er ya'akov", 'באר יעקב', 'ness ziona', 'nes ziona', 'נס ציונה', 'yaqum', 'yakum', 'יקום',
  'airport city', 'shoham', 'שוהם', 'kadima', 'קדימה', 'tel aviv district', 'savyon', 'סביון', 'azor', 'אזור', 'ganei tikva', 'גני תקווה',
  'kfar yona', 'כפר יונה', 'even yehuda', 'אבן יהודה', 'yavne', 'יבנה', 'gedera', 'גדרה',
];
const OUT = [
  'haifa', 'חיפה', 'jerusalem', 'ירושלים', 'beer sheva', "be'er sheva", 'beersheba', 'באר שבע', 'ashdod', 'אשדוד', 'ashkelon', 'אשקלון',
  'yokneam', 'yoqneam', 'יקנעם', 'nazareth', 'נצרת', 'karmiel', 'כרמיאל', 'eilat', 'אילת', 'tiberias', 'טבריה', 'afula', 'עפולה',
  'kiryat shmona', 'קריית שמונה', 'north district', 'south district', 'haifa district', 'jerusalem district', 'מחוז הצפון', 'מחוז הדרום',
  'caesarea', 'קיסריה', 'hadera', 'חדרה', 'migdal haemek', 'מגדל העמק', 'rosh pina', 'safed', 'zefat', 'צפת', 'akko', 'acre', 'עכו',
  'nahariya', 'נהריה', 'kiryat gat', 'קריית גת', 'dimona', 'דימונה', 'omer', 'עומר', 'arad', 'ערד', 'mevaseret', 'מבשרת',
];

export type JobPlace = 'in' | 'out' | 'unknown';

export function jobPlace(location: string | null | undefined): JobPlace {
  const s = (location ?? '').toLowerCase();
  if (!s.trim()) return 'unknown';
  if (IN.some((w) => s.includes(w))) return 'in';
  if (OUT.some((w) => s.includes(w))) return 'out';
  return 'unknown';
}

// עברית ואנגלית לאותה עיר, כדי שאיחוד כפילויות לא יפספס "תל אביב" מול "Tel Aviv".
const HE_EN: Record<string, string> = {
  'תל אביב': 'tel aviv', 'רמת גן': 'ramat gan', 'גבעתיים': 'givatayim', 'בני ברק': 'bnei brak', 'פתח תקווה': 'petah tikva',
  'petach tikva': 'petah tikva', 'הרצליה': 'herzliya', 'רעננה': 'raanana', "ra'anana": 'raanana', 'כפר סבא': 'kfar saba',
  'הוד השרון': 'hod hasharon', 'נתניה': 'netanya', 'ראשון לציון': 'rishon', 'rishon lezion': 'rishon', 'רחובות': 'rehovot',
  'חולון': 'holon', 'בת ים': 'bat yam', 'ראש העין': 'rosh haayin', "rosh ha'ayin": 'rosh haayin', 'לוד': 'lod',
};

/**
 * שם העיר המנורמל (באנגלית) כשהיא מוכרת בגוש דן, ריק אם המיקום כללי או לא מוכר.
 * משמש לאיחוד כפילויות: אותה חברה, אותה כותרת, אותה עיר.
 */
export function cityOf(location: string | null | undefined): string {
  const s = (location ?? '').toLowerCase();
  if (!s.trim()) return '';
  const hit = IN.find((w) => s.includes(w));
  if (!hit) return '';
  return HE_EN[hit] ?? hit;
}
