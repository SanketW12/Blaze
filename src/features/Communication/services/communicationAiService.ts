import { sendMessageToAssistant } from '@/features/Chat/chatservice';
import type {
  CommunicationArticlePractice,
  CommunicationSectionItem,
  GrammarQuestionItem
} from '../types/communication';
import {
  parseAiPracticeContent,
  parseGrammarExercises,
  parseGrammarTest
} from '../utils/communicationParsers';
import {
  buildArticleReflectionPrompt,
  buildGrammarExercisePrompt,
  buildGrammarTestPrompt,
  buildSectionPracticePrompt
} from '../utils/communicationPrompts';

const requestCommunicationContent = async ({
  content,
  instructions
}: {
  content: string;
  instructions: string;
}) => {
  const { assistantText } = await sendMessageToAssistant({
    content,
    mealContext: instructions,
    mode: 'responses'
  });

  return assistantText;
};

export const communicationAiService = {
  async generateGrammarTest() {
    const assistantText = await requestCommunicationContent({
      content: 'Create a grammar test for today.',
      instructions: buildGrammarTestPrompt()
    });
    const parsed = parseGrammarTest(assistantText);

    if (!parsed) {
      throw new Error('AI returned an invalid grammar test format.');
    }

    return parsed;
  },

  async generateGrammarExercises(questions: GrammarQuestionItem[]) {
    const assistantText = await requestCommunicationContent({
      content: 'Review the grammar test answers and create targeted exercises.',
      instructions: buildGrammarExercisePrompt(questions)
    });
    const parsed = parseGrammarExercises(assistantText);

    if (!parsed) {
      throw new Error('AI returned an invalid grammar exercise format.');
    }

    return parsed;
  },

  async generateSectionPractice(section: CommunicationSectionItem) {
    const assistantText = await requestCommunicationContent({
      content: `Generate ${section.label} practice for today.`,
      instructions: buildSectionPracticePrompt(section)
    });
    const parsed = parseAiPracticeContent(assistantText);

    if (!parsed) {
      throw new Error('AI returned an invalid practice response.');
    }

    return parsed;
  },

  async generateArticleReflection(articlePractice: CommunicationArticlePractice) {
    const assistantText = await requestCommunicationContent({
      content: 'Generate article presentation reflection questions.',
      instructions: buildArticleReflectionPrompt(articlePractice)
    });
    const parsed = parseAiPracticeContent(assistantText);

    if (!parsed) {
      throw new Error('AI returned an invalid article reflection response.');
    }

    return parsed;
  }
};
