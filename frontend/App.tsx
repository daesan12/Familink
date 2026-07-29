import {useState} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {SignupFlowScreen} from './src/features/auth/screens/SignupFlowScreen';
import {WelcomeScreen} from './src/features/auth/screens/WelcomeScreen';

type AppRoute = 'welcome' | 'signup';

export default function App() {
  const [route, setRoute] = useState<AppRoute>('welcome');

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {route === 'welcome' ? (
        <WelcomeScreen onStartSignup={() => setRoute('signup')} />
      ) : (
        <SignupFlowScreen
          onCancel={() => setRoute('welcome')}
          onComplete={() => setRoute('welcome')}
        />
      )}
    </SafeAreaProvider>
  );
}
