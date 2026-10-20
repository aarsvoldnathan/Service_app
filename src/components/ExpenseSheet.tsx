import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { parseDate, parseMoney, todayText } from '../dates';
import { captureReceipt } from '../receipts';
import { useStore } from '../store';
import { Palette, radius, spacing, useStyles, useTheme } from '../theme';
import { Expense, Job } from '../types';
import { Button } from './ui';

const QUICK = ['Fuel', 'Parts', 'Oil & fluids', 'Filters', 'Hose / fittings', 'Supplies'];

/** Bottom sheet to add or edit one expense: amount, what for, optional receipt photo. */
export function ExpenseSheet({
  job,
  expense,
  visible,
  onClose,
  onBeforeSave,
}: {
  job: Job;
  expense?: Expense;
  visible: boolean;
  onClose: () => void;
  /** Returns the job to save into (e.g. creates the running invoice the first time). */
  onBeforeSave?: () => Job;
}) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const store = useStore();
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(todayText());
  const [receipt, setReceipt] = useState<string | undefined>();

  useEffect(() => {
    if (!visible) return;
    setAmount(expense ? String(expense.amount) : '');
    setDesc(expense?.description ?? '');
    setDate(expense ? expense.date.slice(0, 10) : todayText());
    setReceipt(expense?.receiptUri);
  }, [visible, expense]);

  const save = () => {
    const d = parseDate(date);
    if (!d) return Alert.alert('Check the date', 'Use YYYY-MM-DD, for example 2026-10-19.');
    const target = expense ? job : onBeforeSave?.() ?? job;
    const error = store.saveExpense({
      id: expense?.id,
      jobId: expense?.jobId ?? target.id,
      technicianId: target.technicianId,
      date: d,
      amount: parseMoney(amount || '0'),
      description: desc,
      receiptUri: receipt,
    });
    if (error) return Alert.alert('Add expense', error);
    onClose();
  };

  const photo = async (src: 'camera' | 'library') => {
    const uri = await captureReceipt(src);
    if (uri) setReceipt(uri);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.sheet}>
          <View style={s.grabber} />
          <Text style={s.title}>{expense ? 'Edit expense' : 'Add expense'}</Text>

          <View style={s.amountRow}>
            <Text style={s.dollar}>$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={c.muted}
              keyboardType="decimal-pad"
              style={s.amount}
              autoFocus={!expense}
              accessibilityLabel="Amount"
            />
          </View>

          <TextInput
            value={desc}
            onChangeText={setDesc}
            placeholder="What for?"
            placeholderTextColor={c.muted}
            style={s.input}
            accessibilityLabel="What for"
          />
          <View style={s.chips}>
            {QUICK.map((q) => (
              <Pressable key={q} onPress={() => setDesc(q)} style={[s.chip, desc === q && s.chipOn]} accessibilityRole="button">
                <Text style={[s.chipText, desc === q && s.chipTextOn]}>{q}</Text>
              </Pressable>
            ))}
          </View>

          <View style={s.row}>
            {receipt ? (
              <Pressable onPress={() => setReceipt(undefined)} style={s.receipt} accessibilityLabel="Remove receipt">
                <Image source={{ uri: receipt }} style={s.thumb} />
                <Text style={s.small}>Tap to remove</Text>
              </Pressable>
            ) : (
              <>
                <Pressable onPress={() => photo('camera')} style={s.photoBtn} accessibilityRole="button">
                  <Text style={s.photoText}>📷 Receipt</Text>
                </Pressable>
                <Pressable onPress={() => photo('library')} style={s.photoBtn} accessibilityRole="button">
                  <Text style={s.photoText}>Photos</Text>
                </Pressable>
              </>
            )}
            <TextInput value={date} onChangeText={setDate} style={[s.input, s.date]} keyboardType="numbers-and-punctuation" accessibilityLabel="Date" />
          </View>

          <Button title={expense ? 'Save' : 'Add expense'} onPress={save} style={{ marginTop: spacing.md }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: { backgroundColor: c.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.md, paddingBottom: spacing.lg * 1.5 },
    grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: spacing.sm },
    title: { color: c.text, fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: spacing.sm },
    amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
    dollar: { color: c.muted, fontSize: 36, fontWeight: '700', marginRight: 4 },
    amount: { color: c.text, fontSize: 44, fontWeight: '800', minWidth: 140, textAlign: 'center' },
    input: { color: c.text, fontSize: 16, borderWidth: 1, borderColor: c.border, borderRadius: radius, paddingHorizontal: spacing.md, minHeight: 48, backgroundColor: c.card },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: c.border },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.text, fontSize: 13, fontWeight: '600' },
    chipTextOn: { color: c.onAccent },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
    photoBtn: { paddingHorizontal: spacing.md, minHeight: 48, justifyContent: 'center', borderRadius: radius, borderWidth: 1, borderColor: c.border },
    photoText: { color: c.text, fontSize: 14, fontWeight: '700' },
    receipt: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    thumb: { width: 48, height: 48, borderRadius: 8 },
    small: { color: c.muted, fontSize: 12 },
    date: { flex: 1, textAlign: 'center' },
  });
