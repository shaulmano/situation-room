import { companyKey } from '@/lib/contacts';

// The same posting arrives from three boards at once, and closing the two extra
// copies by hand was eleven taps on a seventeen-job day. Two rows are the same
// posting when the company and the title match word for word once case and
// punctuation are taken out.
//
// Location is deliberately not part of the key. The boards write it differently
// for the same job, and a company hiring the same title in two cities is rarer
// than a board writing the city its own way.
export function titleKey(title?: string | null): string {
  return (title ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function postingKey(company?: string | null, title?: string | null): string {
  return `${companyKey(company)}|${titleKey(title)}`;
}
