import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { AuthProvider } from './src/context/AuthContext';
import { SyncProvider } from './src/context/SyncContext';
import { RouteProvider } from './src/context/RouteContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { getDb } from './src/store/localStore';
import './src/location/backgroundTask'; // registra el TaskManager.defineTask en el arranque

export default function App() {
  // Sólo Inter bloquea el arranque. Las fuentes de íconos se cargan aparte y NO
  // bloquean: sobre el túnel (ngrok) a veces una de ellas se cuelga al descargar
  // y, si estuviera en el mismo useFonts, dejaba la app en blanco para siempre.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    Font.loadAsync({ ...Ionicons.font, ...MaterialIcons.font }).catch((e: unknown) =>
      console.warn('[fonts] icon fonts load failed (no bloquea la app):', e),
    );
  }, []);

  // Inicializa el schema SQLite una vez al montar (getDb es un singleton).
  useEffect(() => { getDb(); }, []);

  if (!fontsLoaded) return null; // mantiene el splash hasta que cargue Inter

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncProvider>
          <RouteProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </RouteProvider>
        </SyncProvider>
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
