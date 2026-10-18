import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { daysSince } from '../maintenance';
import { colors, radius, spacing, touch } from '../theme';
import { Asset } from '../types';

type Props = {
  asset: Asset;
  now: Date;
  onSave: (assetId: string, hours: number) => string | null;
};

export function HoursRow({ asset, now, onSave }: Props) {
  const [text, setText] = useState('');
  const age = daysSince(asset.hoursUpdatedAt, now);

  const save = () => {
    const hours = Number(text.replace(',', '.'));
    const error = onSave(asset.id, hours);
    if (error) {
      Alert.alert('Cannot save hours', error);
    } else {
      setText('');
    }
  };

  return (
    <View style={styles.row}>
      <Text style={styles.name}>{asset.name}</Text>
      <Text style={styles.meta}>
        Last reading: {asset.currentHours} h · updated {age} day{age === 1 ? '' : 's'} ago
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="New hours"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
          onPress={save}
          disabled={text.trim() === ''}
          accessibilityRole="button"
          accessibilityLabel={`Save hours for ${asset.name}`}
        >
          <Text style={styles.buttonText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 14, marginTop: 2, marginBottom: spacing.sm },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    height: touch,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 18,
  },
  button: {
    height: touch,
    minWidth: 88,
    backgroundColor: colors.accent,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#1A1200', fontSize: 17, fontWeight: '800' },
});
