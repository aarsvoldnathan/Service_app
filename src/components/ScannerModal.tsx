import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef } from 'react';
import { Linking, Modal, StyleSheet, Text, View } from 'react-native';
import { Palette, radius, spacing, useStyles } from '../theme';
import { Button } from './ui';

type Props = {
  visible: boolean;
  onScanned: (code: string) => void;
  onClose: () => void;
  title?: string;
};

/** Full-screen camera that reads barcodes and QR codes, then calls onScanned once. */
export function ScannerModal({ visible, onScanned, onClose, title = 'Scan machine barcode' }: Props) {
  const s = useStyles(makeStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const locked = useRef(false);

  useEffect(() => {
    if (visible) locked.current = false;
  }, [visible]);

  const handle = ({ data }: { data: string }) => {
    if (locked.current || !data) return;
    locked.current = true;
    onScanned(data.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={s.root}>
        {!permission ? (
          <View style={s.center} />
        ) : !permission.granted ? (
          <View style={s.center}>
            <Text style={s.title}>Camera access needed</Text>
            <Text style={s.body}>Service Ceo uses the camera only to read machine barcodes and QR codes.</Text>
            {permission.canAskAgain ? (
              <Button title="Allow camera" onPress={requestPermission} style={s.wide} />
            ) : (
              <Button title="Open Settings" onPress={() => Linking.openSettings()} style={s.wide} />
            )}
            <Button title="Cancel" variant="secondary" onPress={onClose} style={[s.wide, { marginTop: spacing.sm }]} />
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={handle}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e', 'datamatrix', 'pdf417', 'itf14', 'codabar'],
              }}
            />
            <View style={s.overlay} pointerEvents="box-none">
              <Text style={s.banner}>{title}</Text>
              <View style={s.frame} />
              <Text style={s.help}>Hold the code inside the box</Text>
              <Button title="Close" variant="secondary" onPress={onClose} style={s.wide} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: c.bg },
    title: { color: c.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.sm },
    body: { color: c.muted, fontSize: 16, textAlign: 'center', marginBottom: spacing.lg },
    wide: { alignSelf: 'stretch' },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 70,
      paddingBottom: 50,
      paddingHorizontal: spacing.lg,
    },
    banner: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '800',
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius,
      overflow: 'hidden',
    },
    frame: { width: 260, height: 180, borderWidth: 3, borderColor: c.accent, borderRadius: radius },
    help: { color: '#fff', fontSize: 15, backgroundColor: 'rgba(0,0,0,0.55)', padding: spacing.sm, borderRadius: 8, overflow: 'hidden' },
  });
