import type {
  CommunicationArticleSource,
  CommunicationSectionTemplate
} from '../types/communication';

export const DEFAULT_COMMUNICATION_USER_ID = 'sanket';

export const COMMUNICATION_COLLECTION = 'communication_daily_logs';

export const COMMUNICATION_ARTICLE_SOURCES: Array<{
  value: CommunicationArticleSource;
  label: string;
}> = [
  { value: 'economic_times', label: 'Economic Times' },
  { value: 'indian_express', label: 'Indian Express' }
];

export const COMMUNICATION_SECTION_TEMPLATES: CommunicationSectionTemplate[] = [
  {
    key: 'englishFluency',
    label: 'English Fluency',
    description:
      'Build confidence in speaking natural English without overthinking every sentence.',
    weight: 13,
    tasks: [
      {
        id: 'speakOnlyInEnglish',
        label: 'Speak only in English for one focused practice round',
        type: 'checkbox'
      },
      {
        id: 'describeYourDay',
        label: 'Describe your day or routine in English',
        type: 'checkbox'
      }
    ]
  },
  {
    key: 'tongueTwisters',
    label: 'Tongue Twisters',
    description:
      'Improve pronunciation and speech clarity through controlled repetition.',
    weight: 10,
    tasks: [
      {
        id: 'generateTongueTwisters',
        label: 'Generate a tongue twister set with AI',
        type: 'ai_action'
      },
      {
        id: 'practiceTongueTwisters',
        label: 'Practice the tongue twisters slowly and clearly',
        type: 'checkbox'
      }
    ]
  },
  {
    key: 'smoothCalmSpeaking',
    label: 'Smooth and Calm Speaking',
    description:
      'Train breath control, pacing, and calm delivery for relaxed speaking.',
    weight: 10,
    tasks: [
      {
        id: 'breathingExercise',
        label: 'Do one breathing exercise before speaking',
        type: 'checkbox'
      },
      {
        id: 'slowSpeakingRound',
        label: 'Speak one topic slowly with deliberate pauses',
        type: 'checkbox'
      }
    ]
  },
  {
    key: 'speechClarityDrill',
    label: 'Speech Clarity Drill',
    description:
      'Place a pen or pencil horizontally between your teeth and practice speaking clearly with articles and tongue twisters.',
    weight: 10,
    tasks: [
      {
        id: 'pencilBetweenTeethDrill',
        label: 'Place a pen or pencil between your teeth and speak clearly',
        type: 'checkbox'
      },
      {
        id: 'readArticleWithPencilDrill',
        label: 'Read an article aloud while doing the pencil drill',
        type: 'checkbox'
      },
      {
        id: 'tongueTwisterWithPencilDrill',
        label: 'Say tongue twisters while doing the pencil drill',
        type: 'checkbox'
      }
    ]
  },
  {
    key: 'thoughtStructuring',
    label: 'Thought Structuring',
    description:
      'Organize your response into main point, support, and conclusion before speaking.',
    weight: 13,
    tasks: [
      {
        id: 'generateThoughtPrompt',
        label: 'Generate a thought-structuring speaking prompt with AI',
        type: 'ai_action'
      },
      {
        id: 'structureOneResponse',
        label: 'Present one response using main point, 2-3 supports, and conclusion',
        type: 'checkbox'
      }
    ]
  },
  {
    key: 'tonality',
    label: 'Tonality',
    description:
      'Improve pitch, pace, emphasis, and vocal energy for clearer delivery.',
    weight: 10,
    tasks: [
      {
        id: 'stressImportantWords',
        label: 'Practice emphasizing important words naturally',
        type: 'checkbox'
      },
      {
        id: 'reviewTone',
        label: 'Review whether your tone felt calm, clear, and confident',
        type: 'checkbox'
      }
    ]
  },
  {
    key: 'articlePresentation',
    label: 'Article Presentation',
    description:
      'Read an article, note key points, and present it in front of the camera.',
    weight: 13,
    tasks: [
      {
        id: 'readArticle',
        label: 'Read one article from Economic Times or Indian Express',
        type: 'checkbox'
      },
      {
        id: 'noteKeyPoints',
        label: 'Write short key points or summary notes',
        type: 'checkbox'
      },
      {
        id: 'presentOnCamera',
        label: 'Present the article in front of the camera',
        type: 'checkbox'
      },
      {
        id: 'selfReviewPresentation',
        label: 'Reflect on clarity, structure, and tone after presenting',
        type: 'checkbox'
      }
    ]
  },
  {
    key: 'grammar',
    label: 'Grammar',
    description:
      'Take a grammar test, identify weak areas, and practice exercises designed by AI.',
    weight: 13,
    tasks: [
      {
        id: 'generateGrammarTest',
        label: 'Generate a grammar test with AI',
        type: 'ai_action'
      },
      {
        id: 'completeGrammarTest',
        label: 'Answer the grammar test questions',
        type: 'checkbox'
      },
      {
        id: 'reviewGrammarExercises',
        label: 'Review and practice the generated grammar exercises',
        type: 'checkbox'
      }
    ]
  },
  {
    key: 'mindfulSpeaking',
    label: 'Mindful Speaking',
    description:
      'Use articulation and mindful speech exercises so words come out clearly and intentionally.',
    weight: 8,
    tasks: [
      {
        id: 'articulationDrill',
        label: 'Do one articulation drill for crisp pronunciation',
        type: 'checkbox'
      },
      {
        id: 'mindfulPause',
        label: 'Pause briefly before speaking and state your thought clearly',
        type: 'checkbox'
      }
    ]
  }
];
