import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

function AppContent() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>S15P11B104</Text>
        <Text style={styles.description}>
          React Native Android 실행 환경이 준비되었습니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#272727',
    fontSize: 28,
    fontWeight: '700',
  },
  description: {
    marginTop: 12,
    color: '#666666',
    fontSize: 16,
    textAlign: 'center',
  },
});
