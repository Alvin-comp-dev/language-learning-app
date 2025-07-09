import { Lesson, LessonDifficulty, LessonScenario, LessonContent } from '../types/lessons';

export type LessonLevel = 'beginner' | 'elementary' | 'intermediate' | 'advanced';
export type LessonCategory = 'travel' | 'social' | 'business' | 'emergency' | 'daily';

export interface VocabularyItem {
  spanish: string;
  english: string;
  pronunciation: string;
  example: string;
}

export interface DialogueStep {
  id: string;
  speaker: 'user' | 'ai';
  text: string;
  translation?: string;
  expectedResponse?: string;
  alternatives?: string[];
  grammar_note?: string;
  cultural_note?: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  level: LessonLevel;
  category: LessonCategory;
  duration: number; // in minutes
  learning_goals: string[];
  vocabulary: VocabularyItem[];
  dialogue: DialogueStep[];
  scenario_context: string;
  completion_criteria: {
    min_exchanges: number;
    target_pronunciation_score: number;
    required_vocabulary: string[];
  };
  tips: string[];
}

export const CORE_LESSONS: Lesson[] = [
  {
    id: 'ordering-coffee',
    title: 'Ordering Coffee',
    description: 'Learn to order coffee and pastries at a Spanish café',
    level: 'beginner',
    category: 'daily',
    duration: 8,
    learning_goals: [
      'Order coffee and food items',
      'Use polite expressions',
      'Handle basic café interactions',
      'Ask for the bill'
    ],
    vocabulary: [
      {
        spanish: 'café',
        english: 'coffee',
        pronunciation: 'kah-FEH',
        example: 'Me gustaría un café, por favor'
      },
      {
        spanish: 'leche',
        english: 'milk',
        pronunciation: 'LEH-cheh',
        example: 'Un café con leche'
      },
      {
        spanish: 'azúcar',
        english: 'sugar',
        pronunciation: 'ah-SUH-kar',
        example: 'Con azúcar, por favor'
      },
      {
        spanish: 'croissant',
        english: 'croissant',
        pronunciation: 'kroh-SAHN',
        example: 'Un croissant de chocolate'
      },
      {
        spanish: 'cuenta',
        english: 'bill',
        pronunciation: 'KWEN-tah',
        example: 'La cuenta, por favor'
      }
    ],
    dialogue: [
      {
        id: 'coffee-1',
        speaker: 'ai',
        text: '¡Buenos días! ¿Qué le gustaría tomar?',
        translation: 'Good morning! What would you like to have?',
        expectedResponse: 'Buenos días. Me gustaría un café con leche, por favor.',
        alternatives: ['Un café con leche', 'Quiero un café con leche'],
        grammar_note: 'Use "Me gustaría" for polite requests'
      },
      {
        id: 'coffee-2',
        speaker: 'user',
        text: 'Buenos días. Me gustaría un café con leche, por favor.',
        translation: 'Good morning. I would like a coffee with milk, please.'
      },
      {
        id: 'coffee-3',
        speaker: 'ai',
        text: 'Perfecto. ¿Con azúcar?',
        translation: 'Perfect. With sugar?',
        expectedResponse: 'Sí, con azúcar, por favor.',
        alternatives: ['No, sin azúcar', 'Sí, por favor']
      },
      {
        id: 'coffee-4',
        speaker: 'user',
        text: 'Sí, con azúcar, por favor.',
        translation: 'Yes, with sugar, please.'
      },
      {
        id: 'coffee-5',
        speaker: 'ai',
        text: '¿Algo más? ¿Un croissant quizás?',
        translation: 'Anything else? A croissant perhaps?',
        expectedResponse: 'Sí, un croissant de chocolate.',
        alternatives: ['No, gracias', 'Sí, por favor']
      },
      {
        id: 'coffee-6',
        speaker: 'user',
        text: 'Sí, un croissant de chocolate.',
        translation: 'Yes, a chocolate croissant.'
      },
      {
        id: 'coffee-7',
        speaker: 'ai',
        text: 'Muy bien. Son 4 euros 50.',
        translation: 'Very good. That\'s 4 euros 50.',
        expectedResponse: 'Aquí tiene.',
        alternatives: ['¿Puedo pagar con tarjeta?', 'Perfecto']
      }
    ],
    scenario_context: 'You are in a cozy café in Madrid. The barista is friendly and patient. Take your time to order what you want.',
    completion_criteria: {
      min_exchanges: 4,
      target_pronunciation_score: 70,
      required_vocabulary: ['café', 'leche', 'por favor']
    },
    tips: [
      'Remember to say "por favor" (please) to be polite',
      'The "ch" sound in "leche" is like in "church"',
      'Practice the rolling "r" in "por favor"'
    ]
  },
  {
    id: 'asking-directions',
    title: 'Asking for Directions',
    description: 'Learn to ask for and understand directions in Spanish',
    level: 'beginner',
    category: 'travel',
    duration: 10,
    learning_goals: [
      'Ask for directions politely',
      'Understand basic directional words',
      'Express gratitude',
      'Ask for clarification'
    ],
    vocabulary: [
      {
        spanish: 'disculpe',
        english: 'excuse me',
        pronunciation: 'dees-KOOL-peh',
        example: 'Disculpe, ¿dónde está el museo?'
      },
      {
        spanish: 'dónde',
        english: 'where',
        pronunciation: 'DOHN-deh',
        example: '¿Dónde está la estación?'
      },
      {
        spanish: 'derecha',
        english: 'right',
        pronunciation: 'deh-REH-chah',
        example: 'Gire a la derecha'
      },
      {
        spanish: 'izquierda',
        english: 'left',
        pronunciation: 'ees-kee-EHR-dah',
        example: 'Está a la izquierda'
      },
      {
        spanish: 'recto',
        english: 'straight',
        pronunciation: 'REH-ktoh',
        example: 'Siga recto'
      }
    ],
    dialogue: [
      {
        id: 'directions-1',
        speaker: 'user',
        text: 'Disculpe, ¿dónde está el Museo del Prado?',
        translation: 'Excuse me, where is the Prado Museum?',
        grammar_note: 'Use "disculpe" to politely get someone\'s attention'
      },
      {
        id: 'directions-2',
        speaker: 'ai',
        text: 'Ah, el Prado. Está un poco lejos. ¿Va caminando?',
        translation: 'Ah, the Prado. It\'s a bit far. Are you walking?',
        expectedResponse: 'Sí, voy caminando.',
        alternatives: ['No, voy en metro', 'Sí, a pie']
      },
      {
        id: 'directions-3',
        speaker: 'user',
        text: 'Sí, voy caminando.',
        translation: 'Yes, I\'m walking.'
      },
      {
        id: 'directions-4',
        speaker: 'ai',
        text: 'Bien. Siga recto por esta calle, luego gire a la derecha.',
        translation: 'Good. Go straight down this street, then turn right.',
        expectedResponse: 'Recto y luego a la derecha, ¿verdad?',
        alternatives: ['¿Puedo repetir?', 'Entiendo']
      },
      {
        id: 'directions-5',
        speaker: 'user',
        text: 'Recto y luego a la derecha, ¿verdad?',
        translation: 'Straight and then right, correct?'
      },
      {
        id: 'directions-6',
        speaker: 'ai',
        text: 'Exacto. Camine unos 10 minutos y lo verá.',
        translation: 'Exactly. Walk about 10 minutes and you\'ll see it.',
        expectedResponse: 'Muchas gracias.',
        alternatives: ['Perfecto, gracias', 'Muy amable']
      }
    ],
    scenario_context: 'You are a tourist in Madrid and need to find the famous Prado Museum. A friendly local is helping you.',
    completion_criteria: {
      min_exchanges: 5,
      target_pronunciation_score: 70,
      required_vocabulary: ['disculpe', 'dónde', 'derecha']
    },
    tips: [
      'Start with "disculpe" to be polite',
      'Repeat directions back to confirm understanding',
      'Thank the person with "muchas gracias"'
    ]
  },
  {
    id: 'restaurant-ordering',
    title: 'Restaurant Ordering',
    description: 'Order food and drinks at a Spanish restaurant',
    level: 'elementary',
    category: 'daily',
    duration: 12,
    learning_goals: [
      'Read and understand a menu',
      'Order food and drinks',
      'Ask about ingredients',
      'Request the bill'
    ],
    vocabulary: [
      {
        spanish: 'menú',
        english: 'menu',
        pronunciation: 'meh-NU',
        example: '¿Puedo ver el menú?'
      },
      {
        spanish: 'plato',
        english: 'dish',
        pronunciation: 'PLAH-toh',
        example: 'Este plato está delicioso'
      },
      {
        spanish: 'camarero',
        english: 'waiter',
        pronunciation: 'kah-mah-REH-roh',
        example: 'Camarero, por favor'
      },
      {
        spanish: 'recomendación',
        english: 'recommendation',
        pronunciation: 'reh-koh-men-dah-see-OHN',
        example: '¿Cuál es su recomendación?'
      },
      {
        spanish: 'vegetariano',
        english: 'vegetarian',
        pronunciation: 'veh-heh-tah-ree-AH-noh',
        example: 'Soy vegetariano'
      }
    ],
    dialogue: [
      {
        id: 'restaurant-1',
        speaker: 'ai',
        text: '¡Buenas tardes! ¿Mesa para cuántas personas?',
        translation: 'Good afternoon! Table for how many people?',
        expectedResponse: 'Mesa para una persona, por favor.',
        alternatives: ['Para dos personas', 'Solo para mí']
      },
      {
        id: 'restaurant-2',
        speaker: 'user',
        text: 'Mesa para una persona, por favor.',
        translation: 'Table for one person, please.'
      },
      {
        id: 'restaurant-3',
        speaker: 'ai',
        text: 'Perfecto. Aquí tiene el menú. ¿Qué le gustaría beber?',
        translation: 'Perfect. Here\'s the menu. What would you like to drink?',
        expectedResponse: 'Una agua mineral, por favor.',
        alternatives: ['Un vino tinto', 'Una cerveza']
      },
      {
        id: 'restaurant-4',
        speaker: 'user',
        text: 'Una agua mineral, por favor.',
        translation: 'A mineral water, please.'
      },
      {
        id: 'restaurant-5',
        speaker: 'ai',
        text: '¿Ya sabe qué va a comer? ¿Necesita una recomendación?',
        translation: 'Do you know what you\'re going to eat? Do you need a recommendation?',
        expectedResponse: 'Sí, ¿cuál es su recomendación?',
        alternatives: ['Quiero la paella', 'Soy vegetariano']
      },
      {
        id: 'restaurant-6',
        speaker: 'user',
        text: 'Sí, ¿cuál es su recomendación?',
        translation: 'Yes, what is your recommendation?'
      },
      {
        id: 'restaurant-7',
        speaker: 'ai',
        text: 'Le recomiendo la paella valenciana. Es nuestra especialidad.',
        translation: 'I recommend the Valencian paella. It\'s our specialty.',
        expectedResponse: 'Perfecto, la paella valenciana.',
        alternatives: ['¿Tiene mariscos?', 'Suena delicioso']
      }
    ],
    scenario_context: 'You are dining alone at a traditional Spanish restaurant. The waiter is knowledgeable about the menu.',
    completion_criteria: {
      min_exchanges: 6,
      target_pronunciation_score: 75,
      required_vocabulary: ['menú', 'recomendación', 'por favor']
    },
    tips: [
      'Use "¿Cuál es su recomendación?" to ask for suggestions',
      'Spanish restaurants often have daily specials',
      'Remember to pronounce double "l" as "y" in "paella"'
    ]
  },
  {
    id: 'hotel-checkin',
    title: 'Hotel Check-in',
    description: 'Check into a hotel and handle room requests',
    level: 'elementary',
    category: 'travel',
    duration: 10,
    learning_goals: [
      'Check into a hotel',
      'Provide personal information',
      'Ask about hotel services',
      'Request room changes'
    ],
    vocabulary: [
      {
        spanish: 'reserva',
        english: 'reservation',
        pronunciation: 'reh-SEHR-vah',
        example: 'Tengo una reserva'
      },
      {
        spanish: 'habitación',
        english: 'room',
        pronunciation: 'ah-bee-tah-see-OHN',
        example: 'Mi habitación está en el segundo piso'
      },
      {
        spanish: 'desayuno',
        english: 'breakfast',
        pronunciation: 'deh-sah-YU-noh',
        example: '¿Está incluido el desayuno?'
      },
      {
        spanish: 'wifi',
        english: 'wifi',
        pronunciation: 'WEE-fee',
        example: '¿Hay wifi gratuito?'
      },
      {
        spanish: 'equipaje',
        english: 'luggage',
        pronunciation: 'eh-kee-PAH-heh',
        example: '¿Pueden subir mi equipaje?'
      }
    ],
    dialogue: [
      {
        id: 'hotel-1',
        speaker: 'user',
        text: 'Buenas tardes. Tengo una reserva a nombre de García.',
        translation: 'Good afternoon. I have a reservation under the name García.'
      },
      {
        id: 'hotel-2',
        speaker: 'ai',
        text: 'Bienvenido, señor García. ¿Me puede dar su pasaporte?',
        translation: 'Welcome, Mr. García. Can you give me your passport?',
        expectedResponse: 'Sí, aquí tiene.',
        alternatives: ['Por supuesto', 'Claro']
      },
      {
        id: 'hotel-3',
        speaker: 'user',
        text: 'Sí, aquí tiene.',
        translation: 'Yes, here you are.'
      },
      {
        id: 'hotel-4',
        speaker: 'ai',
        text: 'Perfecto. Su habitación es la 205. ¿Necesita ayuda con el equipaje?',
        translation: 'Perfect. Your room is 205. Do you need help with luggage?',
        expectedResponse: 'No, gracias. ¿Está incluido el desayuno?',
        alternatives: ['Sí, por favor', 'No, puedo yo']
      },
      {
        id: 'hotel-5',
        speaker: 'user',
        text: 'No, gracias. ¿Está incluido el desayuno?',
        translation: 'No, thank you. Is breakfast included?'
      },
      {
        id: 'hotel-6',
        speaker: 'ai',
        text: 'Sí, el desayuno está incluido. Es de 7 a 10 de la mañana.',
        translation: 'Yes, breakfast is included. It\'s from 7 to 10 in the morning.',
        expectedResponse: 'Perfecto. ¿Hay wifi gratuito?',
        alternatives: ['Muy bien', 'Excelente']
      }
    ],
    scenario_context: 'You are checking into a hotel in Barcelona. The receptionist is professional and helpful.',
    completion_criteria: {
      min_exchanges: 5,
      target_pronunciation_score: 75,
      required_vocabulary: ['reserva', 'habitación', 'desayuno']
    },
    tips: [
      'Have your passport ready when checking in',
      'Ask about included services like wifi and breakfast',
      'Use "a nombre de" to say "under the name of"'
    ]
  },
  {
    id: 'shopping-market',
    title: 'Shopping at the Market',
    description: 'Buy fruits and vegetables at a Spanish market',
    level: 'elementary',
    category: 'daily',
    duration: 9,
    learning_goals: [
      'Ask for prices',
      'Buy fruits and vegetables',
      'Use quantity expressions',
      'Negotiate prices'
    ],
    vocabulary: [
      {
        spanish: 'mercado',
        english: 'market',
        pronunciation: 'mer-KAH-doh',
        example: 'Voy al mercado'
      },
      {
        spanish: 'precio',
        english: 'price',
        pronunciation: 'PREH-see-oh',
        example: '¿Cuál es el precio?'
      },
      {
        spanish: 'kilo',
        english: 'kilo',
        pronunciation: 'KEE-loh',
        example: 'Un kilo de tomates'
      },
      {
        spanish: 'fresco',
        english: 'fresh',
        pronunciation: 'FRES-koh',
        example: 'Están muy frescos'
      },
      {
        spanish: 'cambio',
        english: 'change',
        pronunciation: 'KAM-bee-oh',
        example: 'Aquí tiene el cambio'
      }
    ],
    dialogue: [
      {
        id: 'market-1',
        speaker: 'ai',
        text: '¡Buenos días! ¿Qué necesita hoy?',
        translation: 'Good morning! What do you need today?',
        expectedResponse: 'Buenos días. Quiero comprar tomates.',
        alternatives: ['Necesito frutas', 'Quiero verduras']
      },
      {
        id: 'market-2',
        speaker: 'user',
        text: 'Buenos días. Quiero comprar tomates.',
        translation: 'Good morning. I want to buy tomatoes.'
      },
      {
        id: 'market-3',
        speaker: 'ai',
        text: 'Muy bien. Están muy frescos hoy. ¿Cuántos kilos quiere?',
        translation: 'Very good. They are very fresh today. How many kilos do you want?',
        expectedResponse: 'Un kilo, por favor.',
        alternatives: ['Medio kilo', 'Dos kilos']
      },
      {
        id: 'market-4',
        speaker: 'user',
        text: 'Un kilo, por favor.',
        translation: 'One kilo, please.'
      },
      {
        id: 'market-5',
        speaker: 'ai',
        text: 'Perfecto. Son 3 euros el kilo. ¿Algo más?',
        translation: 'Perfect. It\'s 3 euros per kilo. Anything else?',
        expectedResponse: 'Sí, también quiero plátanos.',
        alternatives: ['No, gracias', 'Eso es todo']
      },
      {
        id: 'market-6',
        speaker: 'user',
        text: 'Sí, también quiero plátanos.',
        translation: 'Yes, I also want bananas.'
      },
      {
        id: 'market-7',
        speaker: 'ai',
        text: 'Los plátanos están a 2 euros el kilo. ¿Cuántos?',
        translation: 'Bananas are 2 euros per kilo. How many?',
        expectedResponse: 'Medio kilo está bien.',
        alternatives: ['Un kilo también', 'Solo unos pocos']
      }
    ],
    scenario_context: 'You are at a bustling Spanish market buying fresh produce. The vendor is friendly and helpful.',
    completion_criteria: {
      min_exchanges: 6,
      target_pronunciation_score: 75,
      required_vocabulary: ['precio', 'kilo', 'quiero']
    },
    tips: [
      'Markets often have better prices than supermarkets',
      'Use "un kilo" or "medio kilo" for quantities',
      'Don\'t forget to say "gracias" after receiving your change'
    ]
  }
];

// Helper function to get lesson by ID
export function getLessonById(id: string): Lesson | undefined {
  return CORE_LESSONS.find(lesson => lesson.id === id);
}

// Helper function to get lessons by level
export function getLessonsByLevel(level: LessonLevel): Lesson[] {
  return CORE_LESSONS.filter(lesson => lesson.level === level);
}

// Helper function to get lessons by category
export function getLessonsByCategory(category: LessonCategory): Lesson[] {
  return CORE_LESSONS.filter(lesson => lesson.category === category);
}

export const LESSON_SCENARIOS: Record<LessonScenario, string> = {
  COFFEE_SHOP: 'Ordering Coffee',
  DIRECTIONS: 'Asking for Directions',
  RESTAURANT: 'Restaurant Ordering',
  HOTEL: 'Hotel Check-in',
  SHOPPING: 'Shopping',
  INTRODUCTION: 'Self Introduction',
  EMERGENCY: 'Emergency Situations',
  TRANSPORTATION: 'Public Transportation',
  BUSINESS_MEETING: 'Business Meeting',
  SOCIAL_EVENT: 'Social Events'
};

export const DIFFICULTY_LEVELS: Record<LessonDifficulty, {
  name: string;
  requiredXP: number;
  description: string;
}> = {
  BEGINNER: {
    name: 'Beginner',
    requiredXP: 0,
    description: 'Basic phrases and simple conversations'
  },
  ELEMENTARY: {
    name: 'Elementary',
    requiredXP: 1000,
    description: 'Simple daily conversations'
  },
  INTERMEDIATE: {
    name: 'Intermediate',
    requiredXP: 3000,
    description: 'Complex conversations and opinions'
  },
  ADVANCED: {
    name: 'Advanced',
    requiredXP: 6000,
    description: 'Fluent conversations on various topics'
  }
};

const createLessonContent = (
  phrases: string[],
  vocabulary: string[],
  grammarPoints: string[]
): LessonContent => ({
  phrases,
  vocabulary,
  grammarPoints,
  expectedResponses: phrases.map(phrase => ({
    phrase,
    variations: [] // Will be populated by AI during runtime
  }))
});

export const LESSONS: Lesson[] = [
  {
    id: 'coffee-shop-beginner',
    title: 'Ordering Your First Coffee',
    scenario: 'COFFEE_SHOP',
    difficulty: 'BEGINNER',
    xpReward: 100,
    estimatedDuration: 10,
    prerequisites: [],
    content: createLessonContent(
      [
        '¡Hola! ¿Qué desea ordenar?',
        'Me gustaría un café, por favor.',
        '¿Lo quiere grande o pequeño?',
        'Grande, por favor.',
        '¿Con leche o sin leche?',
        'Con leche, gracias.',
        'Son tres dólares.',
        'Aquí tiene.',
        'Gracias, que tenga un buen día.',
        '¡Igualmente!'
      ],
      [
        'café - coffee',
        'leche - milk',
        'grande - large',
        'pequeño - small',
        'por favor - please',
        'gracias - thank you',
        'ordenar - to order',
        'querer - to want',
        'tener - to have',
        'día - day'
      ],
      [
        'Using "me gustaría" for polite requests',
        'Question words: ¿Qué?, ¿Lo?',
        'Basic verb conjugations: quiere, tiene',
        'Politeness phrases'
      ]
    )
  },
  {
    id: 'directions-beginner',
    title: 'Finding Your Way',
    scenario: 'DIRECTIONS',
    difficulty: 'BEGINNER',
    xpReward: 120,
    estimatedDuration: 12,
    prerequisites: ['coffee-shop-beginner'],
    content: createLessonContent(
      [
        'Disculpe, ¿dónde está la estación de metro?',
        'La estación está a dos cuadras.',
        '¿Debo ir derecho?',
        'Sí, vaya derecho y gire a la derecha.',
        '¿En la primera calle?',
        'No, en la segunda calle.',
        '¿Y después?',
        'La estación está ahí mismo.',
        'Muchas gracias.',
        'De nada.'
      ],
      [
        'estación - station',
        'metro - subway',
        'cuadra - block',
        'derecho - straight',
        'girar - to turn',
        'derecha - right',
        'izquierda - left',
        'calle - street',
        'ahí - there',
        'mismo - same/right there'
      ],
      [
        'Giving and following directions',
        'Numbers and distance',
        'Location prepositions',
        'Command forms for directions'
      ]
    )
  },
  {
    id: 'restaurant-elementary',
    title: 'Restaurant Experience',
    scenario: 'RESTAURANT',
    difficulty: 'ELEMENTARY',
    xpReward: 150,
    estimatedDuration: 15,
    prerequisites: ['directions-beginner'],
    content: createLessonContent(
      [
        'Buenas noches, ¿tiene una reservación?',
        'Sí, a nombre de García.',
        '¿Mesa para cuántas personas?',
        'Para dos personas.',
        '¿Qué les gustaría beber?',
        'Una botella de vino tinto, por favor.',
        '¿Están listos para ordenar?',
        'Sí, yo quiero la sopa del día.',
        '¿Y de segundo plato?',
        'El pescado con verduras.'
      ],
      [
        'reservación - reservation',
        'mesa - table',
        'personas - people',
        'beber - to drink',
        'vino tinto - red wine',
        'sopa - soup',
        'pescado - fish',
        'verduras - vegetables',
        'plato - dish',
        'ordenar - to order'
      ],
      [
        'Restaurant vocabulary',
        'Formal vs informal speech',
        'Food and drink ordering',
        'Numbers and quantities'
      ]
    )
  }
];

export const getNextLessons = (completedLessonIds: string[]): Lesson[] => {
  return LESSONS.filter(lesson => {
    // If lesson has no prerequisites, it's available
    if (lesson.prerequisites.length === 0) {
      return !completedLessonIds.includes(lesson.id);
    }
    
    // Check if all prerequisites are completed
    const prerequisitesMet = lesson.prerequisites.every(
      prereqId => completedLessonIds.includes(prereqId)
    );
    
    return prerequisitesMet && !completedLessonIds.includes(lesson.id);
  });
};

export const calculateUserLevel = (totalXP: number): LessonDifficulty => {
  if (totalXP >= DIFFICULTY_LEVELS.ADVANCED.requiredXP) {
    return 'ADVANCED';
  } else if (totalXP >= DIFFICULTY_LEVELS.INTERMEDIATE.requiredXP) {
    return 'INTERMEDIATE';
  } else if (totalXP >= DIFFICULTY_LEVELS.ELEMENTARY.requiredXP) {
    return 'ELEMENTARY';
  }
  return 'BEGINNER';
}; 