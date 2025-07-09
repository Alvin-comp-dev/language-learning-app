const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Screenshot configurations
const SCREENSHOTS = [
  {
    name: 'welcome',
    screen: 'Welcome',
    description: 'Start your Spanish learning journey with SpeakFlow',
    actions: []
  },
  {
    name: 'conversation',
    screen: 'Conversation',
    description: 'Practice natural conversations with your AI tutor',
    actions: [
      'tap(by.id("startConversation"))',
      'wait(2000)',
      'tap(by.id("recordButton"))',
      'wait(3000)'
    ]
  },
  {
    name: 'pronunciation',
    screen: 'Conversation',
    description: 'Get instant feedback on your pronunciation',
    actions: [
      'tap(by.id("startConversation"))',
      'wait(2000)',
      'tap(by.id("recordButton"))',
      'wait(3000)',
      'tap(by.id("feedbackButton"))'
    ]
  },
  {
    name: 'progress',
    screen: 'Progress',
    description: 'Track your learning progress and achievements',
    actions: []
  },
  {
    name: 'content-packs',
    screen: 'ContentPacks',
    description: 'Access specialized content for your goals',
    actions: []
  },
  {
    name: 'certification',
    screen: 'Certification',
    description: 'Earn certificates as you improve',
    actions: []
  },
  {
    name: 'achievements',
    screen: 'Achievements',
    description: 'Stay motivated with achievements and streaks',
    actions: []
  },
  {
    name: 'premium',
    screen: 'ContentPacks',
    description: 'Unlock unlimited learning with Premium',
    actions: [
      'tap(by.id("upgradeButton"))',
      'wait(1000)'
    ]
  }
];

// Device configurations
const DEVICES = {
  ios: {
    name: 'iPhone 14 Pro Max',
    size: { width: 1242, height: 2688 },
    outputDir: 'store-assets/ios'
  },
  android: {
    name: 'Pixel 6',
    size: { width: 1920, height: 1080 },
    outputDir: 'store-assets/android'
  }
};

// Ensure output directories exist
Object.values(DEVICES).forEach(device => {
  if (!fs.existsSync(device.outputDir)) {
    fs.mkdirSync(device.outputDir, { recursive: true });
  }
});

// Generate test file
const generateTestFile = () => {
  const testContent = `
    describe('Generate App Store Screenshots', () => {
      beforeAll(async () => {
        await device.launchApp({
          newInstance: true,
          permissions: { camera: 'YES', microphone: 'YES' }
        });
      });

      ${SCREENSHOTS.map(screenshot => `
        it('should capture ${screenshot.name} screenshot', async () => {
          await element(by.id('nav${screenshot.screen}')).tap();
          ${screenshot.actions.join(';\n          ')};
          await device.takeScreenshot('${screenshot.name}');
        });
      `).join('\n')}
    });
  `;

  fs.writeFileSync(
    path.join(__dirname, '../e2e/screenshots.test.js'),
    testContent
  );
};

// Generate metadata file
const generateMetadataFile = (device) => {
  const metadata = SCREENSHOTS.map((screenshot, index) => ({
    name: screenshot.name,
    filename: `${screenshot.name}.png`,
    description: screenshot.description,
    device: device.name,
    size: device.size,
    index: index + 1
  }));

  fs.writeFileSync(
    path.join(device.outputDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
};

// Run screenshot generation
const generateScreenshots = async () => {
  console.log('🚀 Starting screenshot generation...');

  // Generate test file
  generateTestFile();
  console.log('✅ Generated test file');

  // Generate metadata for each device
  Object.values(DEVICES).forEach(device => {
    generateMetadataFile(device);
    console.log(`✅ Generated metadata for ${device.name}`);
  });

  try {
    // Run Detox tests for iOS
    console.log('📱 Generating iOS screenshots...');
    execSync('detox test --configuration ios.release --testNamePattern="Generate App Store Screenshots"', {
      stdio: 'inherit'
    });

    // Run Detox tests for Android
    console.log('🤖 Generating Android screenshots...');
    execSync('detox test --configuration android.release --testNamePattern="Generate App Store Screenshots"', {
      stdio: 'inherit'
    });

    console.log('✨ Screenshot generation complete!');
  } catch (error) {
    console.error('❌ Error generating screenshots:', error);
    process.exit(1);
  }
};

// Run the script
generateScreenshots().catch(console.error); 