import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

const DIR = `${FileSystem.documentDirectory ?? ''}receipts/`;

/**
 * Take a photo of a receipt (or pick one from the photo library), store a copy
 * in the app's own folder and return its file address. Returns undefined if cancelled.
 */
export async function captureReceipt(source: 'camera' | 'library'): Promise<string | undefined> {
  const perm =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      source === 'camera' ? 'Camera access needed' : 'Photo access needed',
      'Allow access in your phone settings to attach receipt photos.',
    );
    return undefined;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, allowsEditing: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return undefined;

  const src = result.assets[0].uri;
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  const dest = `${DIR}receipt-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: src, to: dest });
  return dest;
}

export async function deleteReceipt(uri?: string) {
  if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

/** Receipt as a data: URL for embedding in the invoice PDF (undefined if the file is gone). */
export async function receiptDataUrl(uri: string): Promise<string | undefined> {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return undefined;
  }
}
