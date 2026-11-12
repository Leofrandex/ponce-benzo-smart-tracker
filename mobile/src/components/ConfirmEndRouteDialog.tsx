import React from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { END_ROUTE_CONFIRM as T } from '../session/confirmEndRoute';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Atrás o tocar afuera solo cierran el aviso; únicamente "Sí" finaliza la ruta.
export function ConfirmEndRouteDialog({ visible, onCancel, onConfirm }: Props) {
  return (
    <ConfirmDialog
      visible={visible} icon="flag-outline" title={T.title} body={T.body}
      cancelLabel={T.cancel} confirmLabel={T.confirm} onCancel={onCancel} onConfirm={onConfirm}
    />
  );
}
