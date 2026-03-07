import type {
  CommunicationArticlePractice,
  CommunicationSectionItem,
  GrammarQuestionItem
} from '../types/communication';

export const buildGrammarTestPrompt = () => `
You are building a grammar test for English communication practice.

Return strict JSON only with this shape:
{
  "questions": [
    {
      "id": "q1",
      "prompt": "Question text"
    }
  ]
}

Rules:
- Generate 5 grammar questions.
- Focus on spoken and workplace English.
- Cover tense, sentence correction, articles, prepositions, and clarity.
- Keep each question short and answerable in plain text.
- Do not include explanations.
- Do not include markdown.
`.trim();

export const buildGrammarExercisePrompt = (
  questions: GrammarQuestionItem[]
) => `
You are reviewing a grammar practice submission for English communication improvement.

Student answers:
${questions
  .map(
    question =>
      `- ${question.prompt}\n  Answer: ${question.answer.trim() || 'No answer provided'}`
  )
  .join('\n')}

Return strict JSON only with this shape:
{
  "title": "Short title",
  "summary": "One short summary",
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "items": ["exercise 1", "exercise 2", "exercise 3"]
}

Rules:
- Focus on the user's likely weak grammar areas.
- Give 3 to 5 practical grammar exercises.
- Keep the output specific and actionable.
- Do not use markdown.
`.trim();

export const buildSectionPracticePrompt = (section: CommunicationSectionItem) => `
You are helping the user improve ${section.label}.

Section description:
${section.description}

Return strict JSON only with this shape:
{
  "title": "Short practice title",
  "summary": "One short summary",
  "items": ["practice item 1", "practice item 2", "practice item 3"]
}

Rules:
- Generate 3 practical practice items.
- Keep them short and easy to execute today.
- Focus only on ${section.label}.
- Do not use markdown.
`.trim();

export const buildArticleReflectionPrompt = (
  articlePractice: CommunicationArticlePractice
) => `
You are helping the user practice article presentation for communication improvement.

Source: ${articlePractice.source ?? 'not selected'}
Title: ${articlePractice.articleTitle || 'not provided'}
Notes:
${articlePractice.notes || 'No notes provided yet.'}

Return strict JSON only with this shape:
{
  "title": "Short reflection title",
  "summary": "One short summary",
  "items": ["reflection question 1", "reflection question 2", "reflection question 3"]
}

Rules:
- Generate 3 reflection questions to help the user present clearly on camera.
- Focus on clarity, structure, confidence, and tonality.
- Do not use markdown.
`.trim();
