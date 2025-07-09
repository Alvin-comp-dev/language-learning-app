# 🌍 SpeakFlow - AI Language Learning App

Master any language through real conversations with AI. SpeakFlow provides personalized, conversation-first language learning with instant feedback and pronunciation analysis.

## ✨ Features

- **🤖 AI-Powered Conversations**: Practice with intelligent AI tutors that adapt to your skill level
- **🗣️ Real-Time Pronunciation Feedback**: Get instant feedback on your pronunciation with detailed analysis
- **🎯 Personalized Learning**: Adaptive learning paths based on your progress and preferences
- **📱 Cross-Platform**: Built with React Native for iOS and Android
- **🔒 Secure Authentication**: User accounts with Supabase authentication
- **💎 Freemium Model**: Free tier with premium features available

## 🚀 Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL, Authentication, Storage)
- **AI Services**: OpenAI Whisper (Speech-to-Text), Anthropic Claude (Conversations)
- **State Management**: Zustand
- **Navigation**: React Navigation
- **UI Components**: Custom design system with TypeScript
- **Speech Services**: Expo AV for audio recording/playback

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   └── ui/             # Core UI components (Button, Card, Text)
├── screens/            # App screens
│   ├── onboarding/     # Welcome, Language Selection, Assessment
│   ├── main/           # Dashboard, Profile
│   └── lessons/        # Conversation, Progress
├── store/              # State management (Zustand)
├── theme/              # Design system (colors, typography, spacing)
├── config/             # Configuration (Supabase, API)
├── services/           # API services and utilities
├── types/              # TypeScript type definitions
└── utils/              # Helper functions
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (macOS) or Android Studio (Android development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd speakflow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your actual API keys:
   - Supabase project URL and anon key
   - OpenAI API key (for Whisper)
   - Anthropic API key (for Claude)
   - Other service API keys as needed

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Run on device/simulator**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   ```

## 🔧 Development

### Available Scripts

- `npm start` - Start Expo development server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run web` - Run on web browser
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Code Style

- TypeScript for type safety
- ESLint for code linting
- Consistent component structure
- Custom hooks for reusable logic
- Atomic design principles for components

### Design System

SpeakFlow uses a custom design system with:

- **Colors**: Primary blue, success green, warning yellow, error red
- **Typography**: Responsive text styles with consistent hierarchy
- **Spacing**: 4px base unit with consistent spacing scale
- **Components**: Reusable UI components with variants and states

## 🏗️ Architecture

### State Management

- **AuthStore**: User authentication and profile management
- **AppStore**: General app state (lessons, progress, UI state)
- **Zustand**: Lightweight state management with TypeScript

### Navigation

- **React Navigation**: Stack navigation with type-safe routing
- **Screens**: Organized by feature (onboarding, main, lessons)
- **Deep Linking**: Support for app deep links

### Data Flow

1. **Authentication**: Supabase handles user auth and profiles
2. **Lessons**: Stored in Supabase with rich content structure
3. **Progress**: User progress tracked in real-time
4. **AI Services**: External APIs for speech and conversation

## 🔐 Environment Variables

Required environment variables:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# AI Services
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# App Configuration
EXPO_PUBLIC_APP_ENV=development
```

## 📱 App Screens

### Onboarding Flow
1. **Welcome Screen** - App introduction and value proposition
2. **Language Selection** - Choose target language
3. **Assessment** - Quick skill level assessment
4. **Dashboard** - Main app hub

### Main App
1. **Dashboard** - Progress overview and lesson recommendations
2. **Lesson Browser** - Browse and select lessons
3. **Conversation** - AI conversation practice
4. **Profile** - User settings and progress

## 🎯 Development Roadmap

### Week 1 (Current)
- [x] Project setup and configuration
- [x] Design system and UI components
- [x] Authentication flow
- [x] Basic navigation
- [x] Welcome and language selection screens

### Week 2 (Next)
- [ ] AI conversation integration
- [ ] Speech recognition setup
- [ ] Lesson content structure
- [ ] Progress tracking

### Week 3-4
- [ ] Advanced features
- [ ] Performance optimization
- [ ] Testing and debugging
- [ ] MVP launch preparation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)

---

**Built with ❤️ for language learners worldwide** 