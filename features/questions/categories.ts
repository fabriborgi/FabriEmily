export type QuestionCategory = 'deep' | 'spicy' | 'about_us' | 'hypothetical' | 'fun';

/** Ordine di visualizzazione nei selettori. */
export const CATEGORIES: Array<{ value: QuestionCategory; label: string }> = [
  { value: 'deep', label: 'Deep' },
  { value: 'about_us', label: 'About us' },
  { value: 'hypothetical', label: 'Hypothetical' },
  { value: 'fun', label: 'Fun' },
  { value: 'spicy', label: 'Spicy' },
];

export const CATEGORY_LABELS: Record<QuestionCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<QuestionCategory, string>;
