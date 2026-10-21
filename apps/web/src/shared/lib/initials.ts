/** "Ana Souza" → "AS", "teste.dono@example.com" → "T". Works for CJK names too ("王小明" → "王"). */
export function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split('@')[0] || '';
  const words = source.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = [...words[0]!][0] ?? '';
  const last = words.length > 1 ? ([...words[words.length - 1]!][0] ?? '') : '';
  return (first + last).toUpperCase();
}
