import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store';
import { Palette, spacing, useStyles } from '../theme';
import { Assignment } from '../types';
import { Button, Card, CheckRow } from './ui';

type Props = {
  assignment: Assignment;
  /** Show the machine name (when listed outside the machine's own page). */
  showMachine?: boolean;
  compact?: boolean;
  onOpen?: () => void;
};

export function AssignmentCard({ assignment: a, showMachine, compact, onOpen }: Props) {
  const s = useStyles(makeStyles);
  const { assets, technicianName, toggleChecklistItem, setAssignmentStatus, deleteAssignment } = useStore();
  const machine = assets.find((x) => x.id === a.assetId);
  const done = a.items.filter((i) => i.done).length;
  const who = a.technicianId ? technicianName(a.technicianId) : 'Note to self';

  const remove = () =>
    Alert.alert('Delete this assignment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAssignment(a.id) },
    ]);

  return (
    <Card style={[s.card, a.status === 'done' && s.doneCard]}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          {showMachine && machine ? <Text style={s.machine}>{machine.name}</Text> : null}
          <Text style={s.who}>
            {a.status === 'done' ? 'Done · ' : ''}
            {who}
          </Text>
          <Text style={s.meta}>
            Assigned {new Date(a.createdAt).toLocaleDateString()}
            {a.items.length ? ` · ${done}/${a.items.length} done` : ''}
          </Text>
        </View>
      </View>
      {a.notes ? <Text style={s.notes}>{a.notes}</Text> : null}
      {!compact &&
        a.items.map((i) => (
          <CheckRow key={i.id} checked={i.done} onToggle={() => toggleChecklistItem(a.id, i.id)} title={i.text} />
        ))}
      <View style={s.actions}>
        {onOpen ? <Button title="Open" variant="secondary" style={{ flex: 1 }} onPress={onOpen} /> : null}
        {!compact &&
          (a.status === 'open' ? (
            <Button title="Mark work done" style={{ flex: 1 }} onPress={() => setAssignmentStatus(a.id, 'done')} />
          ) : (
            <Button title="Reopen" variant="secondary" style={{ flex: 1 }} onPress={() => setAssignmentStatus(a.id, 'open')} />
          ))}
        {!compact ? <Button title="Delete" variant="danger" onPress={remove} /> : null}
      </View>
    </Card>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: { marginBottom: spacing.sm, borderLeftWidth: 5, borderLeftColor: c.accent },
    doneCard: { borderLeftColor: c.ok, opacity: 0.8 },
    head: { flexDirection: 'row' },
    machine: { color: c.text, fontSize: 17, fontWeight: '800' },
    who: { color: c.text, fontSize: 16, fontWeight: '700' },
    meta: { color: c.muted, fontSize: 13, marginTop: 2 },
    notes: { color: c.text, fontSize: 15, marginTop: spacing.sm, marginBottom: spacing.xs },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  });
