import { initializeBusinessSpanishPack } from '../src/data/businessSpanishPack';

const initializeContentPacks = async () => {
  try {
    console.log('Initializing content packs...');
    
    // Initialize Business Spanish pack
    await initializeBusinessSpanishPack();
    console.log('✅ Business Spanish pack initialized');

    // Add more content pack initializations here
    // await initializeTravelSpanishPack();
    // await initializeMedicalSpanishPack();
    // etc.

    console.log('✅ All content packs initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing content packs:', error);
  }
};

// Run the initialization
initializeContentPacks(); 