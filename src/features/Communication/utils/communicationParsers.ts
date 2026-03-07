import type {
  CommunicationAiContent,
  GrammarQuestionItem,
  ParsedGrammarExercises
} from '../types/communication';

const parseJsonObject = (input: string) => {
  const trimmed = input.trim();

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
};

const toStringList = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    : [];

export const parseGrammarTest = (input: string): GrammarQuestionItem[] | null => {
  const parsed = parseJsonObject(input);
  if (!parsed) return null;

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const normalized = questions
    .map((question, index) => {
      if (!question || typeof question !== 'object') return null;

      const rawQuestion = question as Record<string, unknown>;
      const prompt =
        typeof rawQuestion.prompt === 'string' ? rawQuestion.prompt.trim() : '';

      if (!prompt) return null;

      return {
        id:
          typeof rawQuestion.id === 'string' && rawQuestion.id.trim()
            ? rawQuestion.id.trim()
            : `q${index + 1}`,
        prompt,
        answer: ''
      };
    })
    .filter((item): item is GrammarQuestionItem => Boolean(item));

  return normalized.length > 0 ? normalized : null;
};

export const parseAiPracticeContent = (
  input: string
): CommunicationAiContent | null => {
  const parsed = parseJsonObject(input);
  if (!parsed) return null;

  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  const items = toStringList(parsed.items);

  if (!title || items.length === 0) {
    return null;
  }

  return {
    title,
    summary,
    items,
    generatedAt: new Date().toISOString()
  };
};

export const parseGrammarExercises = (
  input: string
): ParsedGrammarExercises | null => {
  const parsed = parseJsonObject(input);
  if (!parsed) return null;

  const content = parseAiPracticeContent(input);
  if (!content) return null;

  return {
    content,
    weaknesses: toStringList(parsed.weaknesses),
    recommendations: toStringList(parsed.recommendations)
  };
};
