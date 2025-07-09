import { supabase } from '../config/supabase';
import { Lesson } from '../types/lessons';

export const BUSINESS_SPANISH_PACK = {
  id: 'business-spanish-pack',
  name: 'Business Spanish',
  description: 'Master professional Spanish with 20 real-world business scenarios. Perfect for meetings, presentations, and workplace communication.',
  type: 'business',
  language: 'es',
  price: 14.99,
  lessons: [
    {
      id: 'business-introductions',
      title: 'Professional Introductions',
      difficulty_level: 'elementary',
      scenario_type: 'business',
      estimated_duration: 15,
      content: {
        description: 'Learn how to introduce yourself professionally and network in Spanish.',
        learning_goals: [
          'Introduce yourself professionally',
          'Exchange business cards',
          'Discuss your role and company',
          'Use formal greetings and farewells'
        ],
        vocabulary: [
          { word: 'encantado/a', translation: 'pleased to meet you', pronunciation: 'en-kan-TAH-doh/dah' },
          { word: 'tarjeta de visita', translation: 'business card', pronunciation: 'tar-HEH-ta deh bee-SEE-ta' },
          { word: 'empresa', translation: 'company', pronunciation: 'em-PREH-sah' },
          { word: 'cargo', translation: 'position/role', pronunciation: 'KAR-go' }
        ],
        conversation_flow: [
          { speaker: 'ai', text: 'Buenos días, soy María García de Tech Solutions.' },
          { speaker: 'user', text: 'Mucho gusto, me llamo [nombre] de [empresa].' },
          { speaker: 'ai', text: '¿Cuál es su cargo en la empresa?' },
          { speaker: 'user', text: 'Soy gerente de marketing.' }
        ]
      }
    },
    {
      id: 'business-meeting',
      title: 'Running a Meeting',
      difficulty_level: 'intermediate',
      scenario_type: 'business',
      estimated_duration: 20,
      content: {
        description: 'Learn to lead and participate in business meetings in Spanish.',
        learning_goals: [
          'Open and close meetings',
          'Present agenda items',
          'Ask for and give opinions',
          'Schedule follow-ups'
        ],
        vocabulary: [
          { word: 'orden del día', translation: 'agenda', pronunciation: 'OR-den del DEE-ah' },
          { word: 'acta', translation: 'minutes', pronunciation: 'AK-ta' },
          { word: 'siguiente punto', translation: 'next item', pronunciation: 'see-gee-EN-teh POON-to' },
          { word: 'propuesta', translation: 'proposal', pronunciation: 'pro-PWES-ta' }
        ],
        conversation_flow: [
          { speaker: 'ai', text: 'Buenos días a todos. Vamos a comenzar la reunión.' },
          { speaker: 'user', text: 'El primer punto en la agenda es el informe trimestral.' },
          { speaker: 'ai', text: '¿Podría presentarnos un resumen de los resultados?' },
          { speaker: 'user', text: 'Por supuesto. Los resultados muestran un crecimiento del 15%.' }
        ]
      }
    },
    {
      id: 'sales-presentation',
      title: 'Sales Presentation',
      difficulty_level: 'intermediate',
      scenario_type: 'business',
      estimated_duration: 25,
      content: {
        description: 'Practice giving sales presentations and handling client questions.',
        learning_goals: [
          'Present product features and benefits',
          'Handle pricing discussions',
          'Address client concerns',
          'Close deals professionally'
        ],
        vocabulary: [
          { word: 'características', translation: 'features', pronunciation: 'ka-rak-te-REES-tee-kas' },
          { word: 'presupuesto', translation: 'budget', pronunciation: 'pre-soo-PWES-to' },
          { word: 'descuento', translation: 'discount', pronunciation: 'des-KWEN-to' },
          { word: 'contrato', translation: 'contract', pronunciation: 'kon-TRA-to' }
        ],
        conversation_flow: [
          { speaker: 'ai', text: '¿Podría explicarnos las ventajas de su producto?' },
          { speaker: 'user', text: 'Nuestro producto ofrece tres beneficios principales...' },
          { speaker: 'ai', text: '¿Cuál es el costo total de implementación?' },
          { speaker: 'user', text: 'El precio base es €500 por usuario al año.' }
        ]
      }
    }
  ]
} as const;

// Add more scenarios:
// 4. Email Communication
// 5. Phone Calls
// 6. Negotiating Contracts
// 7. HR Discussions
// 8. Project Planning
// 9. Performance Reviews
// 10. Client Support
// 11. Business Travel
// 12. Office Small Talk
// 13. Team Building
// 14. Problem Resolution
// 15. Budget Discussions
// 16. Strategy Planning
// 17. Market Analysis
// 18. Quality Control
// 19. Supply Chain
// 20. Risk Management

export const initializeBusinessSpanishPack = async () => {
  try {
    const { data: existingPack } = await supabase
      .from('content_packs')
      .select('id')
      .eq('id', BUSINESS_SPANISH_PACK.id)
      .single();

    if (!existingPack) {
      // Create content pack
      await supabase
        .from('content_packs')
        .insert({
          id: BUSINESS_SPANISH_PACK.id,
          name: BUSINESS_SPANISH_PACK.name,
          description: BUSINESS_SPANISH_PACK.description,
          type: BUSINESS_SPANISH_PACK.type,
          language: BUSINESS_SPANISH_PACK.language,
          price: BUSINESS_SPANISH_PACK.price,
          lessons: BUSINESS_SPANISH_PACK.lessons.map(lesson => lesson.id)
        });

      // Create lessons
      await supabase
        .from('lessons')
        .insert(BUSINESS_SPANISH_PACK.lessons);
    }
  } catch (error) {
    console.error('Error initializing business Spanish pack:', error);
  }
};

export const BUSINESS_SPANISH_LESSONS: Lesson[] = [
  {
    id: 'business-meeting-intermediate',
    title: 'Leading a Business Meeting',
    scenario: 'BUSINESS_MEETING',
    difficulty: 'INTERMEDIATE',
    xpReward: 200,
    estimatedDuration: 20,
    prerequisites: ['restaurant-elementary'],
    content: {
      phrases: [
        'Buenos días a todos. Bienvenidos a la reunión.',
        'Hoy vamos a discutir los resultados del trimestre.',
        '¿Podemos ver la presentación, por favor?',
        'Los ingresos han aumentado un veinte por ciento.',
        '¿Alguien tiene alguna pregunta?',
        'Excelente punto. Vamos a analizarlo.',
        'Necesitamos mejorar nuestras ventas en este sector.',
        '¿Cuál es su opinión sobre esto?',
        'Programemos otra reunión para la próxima semana.',
        'Gracias por su atención y participación.'
      ],
      vocabulary: [
        'reunión - meeting',
        'resultados - results',
        'trimestre - quarter',
        'ingresos - revenue',
        'presentación - presentation',
        'ventas - sales',
        'sector - sector',
        'opinión - opinion',
        'programar - to schedule',
        'participación - participation'
      ],
      grammarPoints: [
        'Formal commands and requests',
        'Numbers and percentages',
        'Future tense for planning',
        'Professional vocabulary',
        'Question formation in formal settings'
      ],
      expectedResponses: []
    }
  },
  {
    id: 'networking-intermediate',
    title: 'Professional Networking',
    scenario: 'BUSINESS_MEETING',
    difficulty: 'INTERMEDIATE',
    xpReward: 180,
    estimatedDuration: 15,
    prerequisites: ['business-meeting-intermediate'],
    content: {
      phrases: [
        'Permítame presentarme. Soy [nombre] de [empresa].',
        'Encantado/a de conocerle. ¿A qué se dedica?',
        'Trabajo en el sector de tecnología.',
        'Qué interesante. ¿Me puede contar más sobre su trabajo?',
        'Claro. Desarrollo soluciones de software empresarial.',
        '¿Tiene una tarjeta de visita?',
        'Aquí tiene. ¿Podemos intercambiar contactos?',
        'Me gustaría mantener el contacto profesional.',
        '¿Está en LinkedIn?',
        'Excelente. Le enviaré una invitación.'
      ],
      vocabulary: [
        'presentarse - to introduce oneself',
        'empresa - company',
        'sector - industry',
        'tecnología - technology',
        'soluciones - solutions',
        'tarjeta de visita - business card',
        'contactos - contacts',
        'profesional - professional',
        'invitación - invitation',
        'mantener - to maintain'
      ],
      grammarPoints: [
        'Professional introductions',
        'Question formation in business context',
        'Present tense of common business verbs',
        'Formal vs informal address',
        'Future tense for follow-up actions'
      ],
      expectedResponses: []
    }
  },
  {
    id: 'email-writing-intermediate',
    title: 'Writing Professional Emails',
    scenario: 'BUSINESS_MEETING',
    difficulty: 'INTERMEDIATE',
    xpReward: 150,
    estimatedDuration: 15,
    prerequisites: ['networking-intermediate'],
    content: {
      phrases: [
        'Estimado/a Sr./Sra. [apellido]:',
        'Le escribo en referencia a nuestra reunión.',
        'Adjunto encontrará el informe solicitado.',
        'Quisiera confirmar la fecha de entrega.',
        'Por favor, revise los documentos adjuntos.',
        'Necesitamos su aprobación antes del viernes.',
        'Quedo a la espera de su respuesta.',
        'No dude en contactarme si tiene preguntas.',
        'Atentamente,',
        '[nombre y cargo]'
      ],
      vocabulary: [
        'adjunto - attachment',
        'informe - report',
        'entrega - delivery',
        'documentos - documents',
        'aprobación - approval',
        'respuesta - response',
        'cargo - position/role',
        'revisar - to review',
        'confirmar - to confirm',
        'contactar - to contact'
      ],
      grammarPoints: [
        'Formal email structure',
        'Professional closings and greetings',
        'Polite requests and follow-ups',
        'Future and conditional tenses',
        'Formal pronouns and titles'
      ],
      expectedResponses: []
    }
  }
]; 