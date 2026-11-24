'use client';
import { useEffect, useState } from 'react';

// הקבצים שיש לשאול. הראשון הוא ברירת המחדל, והבחירה לפי משרה או שורה נשמרת
// במכשיר (24.11.2026: "leave it for me to choose on every job").
export const CV_FILES = [
  'Shaul_Mano.pdf',
  'Shaul_Mano_QA_Manager.pdf',
  'Shaul_Mano_Project_Manager.pdf',
  'Shaul_Mano_Project_Release_Manager.pdf',
  'Shaul_Mano_Release_Manager.pdf',
];
const label = (f: string) => f.replace('.pdf', '').replace(/_/g, ' ');

export default function CvFilePick({ file, id }: { file: string; id: string }) {
  const [pick, setPick] = useState(file);
  const key = 'cvpick:' + id;
  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v && CV_FILES.includes(v)) setPick(v);
    } catch {}
  }, [key]);
  const options = CV_FILES.includes(pick) ? CV_FILES : [pick, ...CV_FILES];
  return (
    <select value={pick} aria-label="קובץ קורות חיים לצירוף"
      onChange={(e) => {
        setPick(e.target.value);
        try { localStorage.setItem(key, e.target.value); } catch {}
      }}
      style={{ font: 'inherit', fontSize: '.78rem', maxWidth: '100%' }}>
      {options.map((f) => <option key={f} value={f}>{label(f)}</option>)}
    </select>
  );
}
