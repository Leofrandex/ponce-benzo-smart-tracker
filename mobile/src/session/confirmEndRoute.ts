type AlertButton = { text: string; style: 'cancel' | 'destructive'; onPress?: () => void };

// Argumentos de Alert.alert para finalizar la ruta. Atras o tocar afuera solo cierran el aviso.
export function confirmEndRouteArgs(onConfirm: () => void): [string, string, AlertButton[], { cancelable: true; onDismiss?: () => void }] {
  return [
    '¿Seguro que quieres finalizar la ruta?',
    'Una vez finalizada no puedes volver a reportar visitas el día de hoy.',
    [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', style: 'destructive', onPress: onConfirm },
    ],
    { cancelable: true },
  ];
}
