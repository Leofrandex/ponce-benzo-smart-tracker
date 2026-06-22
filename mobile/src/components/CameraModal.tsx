import React, { useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';

interface CameraModalProps {
  visible: boolean;
  onCapture: (uri: string) => void;
  onClose: () => void;
}

export function CameraModal({ visible, onCapture, onClose }: CameraModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  function handleClose() {
    setPreviewUri(null);
    onClose();
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.75, skipProcessing: false });
      setPreviewUri(photo.uri);
    } catch {
      // camera error — just close
      handleClose();
    } finally {
      setCapturing(false);
    }
  }

  function handleUsePhoto() {
    if (!previewUri) return;
    onCapture(previewUri);
    setPreviewUri(null);
  }

  function handleRetake() {
    setPreviewUri(null);
  }

  // --- STATES ---

  // 1. Permission denied/undecided
  if (permission === null) {
    return null; // still loading permission
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={styles.container}>

        {/* No permission */}
        {!permission.granted && (
          <View style={styles.permissionScreen}>
            <Ionicons name="camera-outline" size={60} color={colors.textMuted} />
            <Text style={styles.permTitle}>Permiso de cámara</Text>
            <Text style={styles.permDesc}>
              Esta app necesita acceso a la cámara para registrar evidencia fotográfica de las visitas.
            </Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Permitir acceso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.permCancelBtn} onPress={handleClose}>
              <Text style={styles.permCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Preview */}
        {permission.granted && previewUri && (
          <View style={styles.previewScreen}>
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake}>
                <Ionicons name="refresh" size={20} color={colors.white} />
                <Text style={styles.retakeBtnText}>Retomar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.useBtn} onPress={handleUsePhoto}>
                <Ionicons name="checkmark" size={20} color={colors.white} />
                <Text style={styles.useBtnText}>Usar foto</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Live camera */}
        {permission.granted && !previewUri && (
          <View style={styles.cameraScreen}>
            <CameraView style={styles.camera} facing="back" ref={cameraRef}>
              {/* Top bar */}
              <View style={styles.topBar}>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={28} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.topBarLabel}>Solo cámara en vivo</Text>
                <View style={{ width: 44 }} />
              </View>
            </CameraView>

            {/* Capture button outside CameraView to avoid z-index issues */}
            <View style={styles.captureBar}>
              <TouchableOpacity
                style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
                onPress={handleCapture}
                disabled={capturing}
                activeOpacity={0.8}
              >
                {capturing
                  ? <ActivityIndicator color={colors.accent} size="large" />
                  : <View style={styles.captureBtnInner} />
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Permission screen
  permissionScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgBase,
    padding: 32,
  },
  permTitle: {
    fontSize: 20,
    color: colors.textPrimary,
    ...fonts.bold,
    marginTop: 20,
    marginBottom: 10,
  },
  permDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  permBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: radii.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  permBtnText: {
    color: colors.white,
    fontSize: 15,
    ...fonts.semibold,
  },
  permCancelBtn: {
    paddingVertical: 10,
  },
  permCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    ...fonts.medium,
  },

  // Camera screen
  cameraScreen: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    ...fonts.medium,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  captureBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureBtnInner: {
    width: 54,
    height: 54,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: '#ccc',
  },

  // Preview screen
  previewScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
  },
  previewActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    gap: 8,
  },
  retakeBtnText: {
    color: colors.white,
    fontSize: 15,
    ...fonts.semibold,
  },
  useBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    gap: 8,
  },
  useBtnText: {
    color: colors.white,
    fontSize: 15,
    ...fonts.semibold,
  },
});
