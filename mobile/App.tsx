import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { AuthProvider } from './src/context/AuthContext';
import { SyncProvider } from './src/context/SyncContext';
import { RouteProvider } from './src/context/RouteContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initDatabase } from './src/services/db';

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) return null; // mantiene el splash hasta que cargue Inter

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SQLiteProvider databaseName="poncebenzo.db" onInit={initDatabase}>
          <SyncProvider>
            <RouteProvider>
              <NavigationContainer>
                <AppNavigator />
              </NavigationContainer>
            </RouteProvider>
          </SyncProvider>
        </SQLiteProvider>
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
