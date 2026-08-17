import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RouteScreen } from '../screens/RouteScreen';
import { AdhocReportScreen } from '../screens/AdhocReportScreen';
import { VisitHistoryScreen } from '../screens/VisitHistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../theme';

const Tab = createBottomTabNavigator();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { focused: IoniconName; unfocused: IoniconName }> = {
  Ruta:      { focused: 'map',             unfocused: 'map-outline' },
  Reporte:   { focused: 'add-circle',      unfocused: 'add-circle-outline' },
  Historial: { focused: 'clipboard',       unfocused: 'clipboard-outline' },
  Perfil:    { focused: 'person-circle',   unfocused: 'person-circle-outline' },
};

export function MainTabs() {
  const { user } = useAuth();
  // El reporte suelto es para quien no tiene ruta fija que cubrir: el supervisor
  // cuando reemplaza a un ausente, y la direccion cuando pasa por una sucursal.
  const puedeReportarSuelto = Boolean(user?.is_supervisor) || user?.role === 'admin';

  return (
    <Tab.Navigator
      initialRouteName={user?.role === 'admin' ? 'Reporte' : 'Ruta'}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          ...fonts.semibold,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons?.focused ?? 'help-outline' : icons?.unfocused ?? 'help-outline';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Ruta"      component={RouteScreen} />
      {puedeReportarSuelto && <Tab.Screen name="Reporte" component={AdhocReportScreen} />}
      <Tab.Screen name="Historial" component={VisitHistoryScreen} />
      <Tab.Screen name="Perfil"    component={ProfileScreen} />
    </Tab.Navigator>
  );
}
