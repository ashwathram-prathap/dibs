export function catalogContent(
  answers: { display: string; aliases: string[]; obscurity: number }[],
) {
  return JSON.stringify(
    answers
      .map((a) => [a.display, [...a.aliases].sort(), a.obscurity])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en')),
  );
}
