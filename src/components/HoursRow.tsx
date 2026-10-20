import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { daysSince } from '../maintenance';
import { Palette, radius, spacing, useStyles } from '../theme';
import { Asset } from '../types';
import { Button, Input } from './ui';

type Props = {
  asset: Asset;
  now: Date;
  onSave: (assetId: string, hours: number) => string | null;
  /** Show the machine name (dashboard) or hide it (service screen, where it is already shown). */
  showName?: boolean;
};

export function HoursRow({ asset, now, onSave, showName = true }: Props) {
  const s = useStyles(makeStyles);
  const [text, setText] = useState('');
  const age = daysSince(asset.hoursUpdatedAt, now);

  const save = () => {
    const hours = Number(text.replace(',', '.'));
    const error = onSave(asset.id, hours);
    if (error) Alert.alert('Cannot save hours', error);
    else setText('');
  };

  return (
    <View style={s.row}>
      {showName ? <Text style={s.name}>{asset.name}</Text> : null}
      <Text style={s.meta}>
        Current: <Text style={s.hours}>{asset.currentHours} h</Text> · updated{' '}
        {age <= 0 ? 'today' : `${age} day${age === 1 ? '' : 's'} ago`}
      </Text>
      <View style={s.inputRow}>
        <Input
          style={{ flex: 1, fontSize: 18 }}
          value={text}
          onChangeText={setText}
          placeholder="New hours reading"
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={save}
          accessibilityLabel={`New hours for ${asset.name}`}
        />
        <Button
          title="Update"
          onPress={save}
          disabled={text.trim() === ''}
          style={{ minWidth: 100 }}
          accessibilityLabel={`Save hours for ${asset.name}`}
        />
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    name: { color: c.text, fontSize: 17, fontWeight: '700' },
    meta: { color: c.muted, fontSize: 14, marginTop: 2, marginBottom: spacing.sm },
    hours: { color: c.text, fontWeight: '800' },
    inputRow: { flexDirection: 'row', gap: spacing.sm },
  });
