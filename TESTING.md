# 🧪 SpeakFlow Testing Guide

## 📱 Quick Start Testing

### 1. Launch the App
```bash
npm start
# Scan QR code with Expo Go app
```

### 2. Basic Navigation Testing
- ✅ Welcome → Language Selection → Dashboard
- ✅ Browse lesson cards
- ✅ UI components and styling

### 3. Conversation Testing (Limited without API keys)
- ✅ Recording interface
- ✅ Fallback responses
- ✅ Progress tracking

## 🔑 Full AI Testing Setup

### Required API Keys

#### OpenAI (Speech Recognition)
1. Go to https://platform.openai.com/api-keys
2. Create account → Generate API key
3. Add to `.env`: `OPENAI_API_KEY=sk-...`

#### Anthropic (AI Conversations)  
1. Go to https://console.anthropic.com/
2. Create account → Get API key
3. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`

### .env File Example
```bash
# Required for full functionality
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Optional (for future features)
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 🎯 Testing Scenarios

### Scenario 1: Coffee Ordering Lesson
1. **Start**: Tap "Ordering Coffee" lesson
2. **Listen**: Sofia says "¡Buenos días! ¿Qué le gustaría tomar?"
3. **Respond**: Say or type "Me gustaría un café con leche"
4. **Expect**: Pronunciation feedback + Sofia's next response

### Scenario 2: Error Handling
1. **No microphone permission**: Should show text input fallback
2. **Network error**: Should show friendly error message
3. **Invalid response**: Sofia should guide you back on track

### Scenario 3: Progress Tracking
1. **Complete exchanges**: Watch progress bar increase
2. **Vocabulary learning**: New words get highlighted
3. **Lesson completion**: Celebration dialog appears

## 📊 What to Test

### ✅ Working Features
- App navigation flow
- Lesson selection interface
- Recording UI/UX
- Progress visualization
- Error handling
- Text input fallback

### 🔑 API-Dependent Features
- Speech-to-text transcription
- AI conversation responses
- Pronunciation scoring
- Real lesson completion

## 🐛 Known Limitations

### Current MVP Scope
- 5 lessons only (Spanish)
- Basic pronunciation feedback
- Simplified progress tracking
- Text-based fallbacks

### Future Enhancements (Week 3+)
- Advanced pronunciation analysis
- Progress persistence
- Achievement system
- Social features

## 📱 Testing on Different Platforms

### Mobile (Recommended)
- **Best experience**: Native mobile features
- **Speech recognition**: Works with device microphone
- **Full functionality**: All features available

### Web Browser
- **Limited**: No native audio recording
- **UI Testing**: Good for layout and navigation
- **Fallback**: Text input works well

## 🔧 Debugging Tips

### Common Issues
1. **Metro bundler errors**: Clear cache with `npx expo start -c`
2. **API key errors**: Check `.env` file format
3. **Audio permissions**: Enable microphone in device settings
4. **Network issues**: Ensure stable internet connection

### Developer Tools
- Press `d` in Expo → Open developer menu
- Use React Native debugger
- Check Expo logs for errors 