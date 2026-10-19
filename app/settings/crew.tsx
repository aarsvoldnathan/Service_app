import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/auth';
import { CrewMember, ROLE_LABEL, useCloud } from '../../src/cloud';
import { Button, Card, ChipSelect, Field, Muted, SectionTitle } from '../../src/components/ui';
import { ANDROID_DOWNLOAD } from '../../src/config';
import { useStore } from '../../src/store';
import { Role } from '../../src/supabase';
import { Palette, radius, spacing, useStyles, useTheme } from '../../src/theme';

/** Invite people with a code, manage roles, join or leave crews. */
export default function CrewScreen() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const { userId } = useAuth();
  const { fleets, activeFleet, technicians, prefs, technicianName } = useStore();
  const cloud = useCloud();
  const [fleetId, setFleetId] = useState(activeFleet.id);
  const fleet = fleets.find((f) => f.id === fleetId) ?? activeFleet;
  const membership = cloud.memberships.get(fleet.id);
  const role = membership?.role;
  const isOwner = role === 'owner';
  const [members, setMembers] = useState<CrewMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setMembers(await cloud.crew(fleet.id));
    } catch (e) {
      setLoadError(String((e as Error).message ?? e));
    }
  }, [cloud, fleet.id]);

  useEffect(() => {
    setMembers(null);
    load();
  }, [load]);

  const invite = () => {
    const me = prefs.meTechnicianId ? technicianName(prefs.meTechnicianId) : 'I';
    Share.share({
      message: [
        `${me} invited you to the "${fleet.name}" crew on Service Ceo, the app we use to track equipment service.`,
        '',
        `1. Android: open ${ANDROID_DOWNLOAD} on your phone, tap the .apk file and install it. iPhone: reply with your Apple ID email for a TestFlight invite.`,
        '2. Open the app and tap Create account.',
        `3. Enter this invite code: ${membership?.inviteCode ?? ''}`,
      ].join('\n'),
    });
  };

  const newCode = () =>
    Alert.alert('Make a new invite code?', 'The old code stops working. People already in the crew stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New code', onPress: () => cloud.newInviteCode(fleet.id) },
    ]);

  const changeRole = async (m: CrewMember, r: Role) => {
    const error = await cloud.setMemberRole(fleet.id, m.user_id, r);
    if (error) Alert.alert('Could not change role', error);
    load();
  };

  const link = async (m: CrewMember, techId: string) => {
    const error = await cloud.linkMember(fleet.id, m.user_id, techId);
    if (error) Alert.alert('Could not link profile', error);
    else cloud.syncNow(true);
    load();
  };

  const remove = (m: CrewMember) =>
    Alert.alert(
      m.user_id === userId ? `Leave ${fleet.name}?` : `Remove ${m.name ?? m.email} from ${fleet.name}?`,
      m.user_id === userId ? 'The fleet is removed from your phone.' : 'They lose access to this fleet right away.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: m.user_id === userId ? 'Leave' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            const error = await cloud.removeMember(fleet.id, m.user_id);
            if (error) Alert.alert('Could not remove', error);
            load();
          },
        },
      ],
    );

  const join = async () => {
    setBusy(true);
    const error = await cloud.joinCrew(code, prefs.meTechnicianId ? technicianName(prefs.meTechnicianId) : '');
    setBusy(false);
    if (error) Alert.alert('Could not join', error);
    else {
      setCode('');
      Alert.alert('Joined', 'The crew’s fleet is now on your phone. Switch fleets with the name at the top of the home screen.');
    }
  };

  const fleetTechs = technicians.filter((t) => fleet.memberIds.includes(t.id));

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Crew & sharing' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {fleets.length > 1 && (
          <View style={{ marginBottom: spacing.md }}>
            <ChipSelect options={fleets.map((f) => ({ value: f.id, label: f.name }))} value={fleetId} onChange={setFleetId} />
          </View>
        )}
        <Text style={s.roleLine}>
          {fleet.name} · you are {role ? ROLE_LABEL[role] : 'not connected yet'}
        </Text>

        {role && role !== 'technician' ? (
          <View style={s.section}>
            <SectionTitle>Invite someone</SectionTitle>
            <Card>
              <Text style={s.body}>They create an account in the app and enter this code to join as a technician.</Text>
              <View style={s.codeBox}>
                <Text style={s.code} selectable>
                  {membership?.inviteCode ?? '······'}
                </Text>
              </View>
              <Button title="Send invite (text / email)" onPress={invite} />
              {isOwner ? <Button title="Make a new code" variant="secondary" onPress={newCode} style={{ marginTop: spacing.sm }} /> : null}
            </Card>
          </View>
        ) : null}

        <View style={s.section}>
          <SectionTitle>{`Crew${members ? ` (${members.length})` : ''}`}</SectionTitle>
          {loadError ? <Text style={s.error}>{loadError}</Text> : null}
          {!members && !loadError ? <ActivityIndicator color={c.accent} /> : null}
          {members?.map((m) => {
            const self = m.user_id === userId;
            return (
              <Card key={m.user_id} style={s.member}>
                <Text style={s.name}>
                  {m.name ?? m.email}
                  {self ? ' (you)' : ''}
                </Text>
                <Text style={s.meta}>
                  {ROLE_LABEL[m.role]} · {m.email}
                  {m.technician_id && technicianName(m.technician_id) !== 'Unassigned' ? ` · profile: ${technicianName(m.technician_id)}` : ''}
                </Text>
                {isOwner && !self && (
                  <>
                    <Text style={s.label}>Role</Text>
                    <ChipSelect
                      options={[
                        { value: 'technician', label: 'Technician' },
                        { value: 'manager', label: 'Manager' },
                      ]}
                      value={m.role}
                      onChange={(r) => changeRole(m, r as Role)}
                    />
                    <Text style={[s.label, { marginTop: spacing.md }]}>Technician profile</Text>
                    <Text style={s.help}>
                      Link them to an existing profile so the jobs and hours already logged under that name become theirs.
                    </Text>
                    <ChipSelect
                      options={fleetTechs.map((t) => ({ value: t.id, label: t.name }))}
                      value={m.technician_id ?? undefined}
                      onChange={(tid) => link(m, tid)}
                    />
                  </>
                )}
                {(isOwner && !self) || (self && !isOwner) ? (
                  <Button
                    title={self ? 'Leave this crew' : 'Remove from crew'}
                    variant="danger"
                    onPress={() => remove(m)}
                    style={{ marginTop: spacing.md }}
                  />
                ) : null}
              </Card>
            );
          })}
          <Text style={s.help}>
            Owner: sees everything, including everyone's hours, rates and invoices. Manager: runs machines, schedules, assignments and the
            shopping list, but not other people's pay. Technician: logs service and sees only their own hours and invoices.
          </Text>
        </View>

        <View style={s.section}>
          <SectionTitle>Join another crew</SectionTitle>
          <Card>
            <Field label="Invite code" autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={setCode} />
            <Button title={busy ? 'Joining…' : 'Join'} disabled={busy} onPress={join} />
          </Card>
        </View>

        <Muted>
          {cloud.syncError
            ? `Sync problem: ${cloud.syncError}`
            : cloud.lastSync
              ? `Synced ${cloud.lastSync.toLocaleTimeString()}`
              : 'Syncing…'}
        </Muted>
        <Button title={cloud.syncing ? 'Syncing…' : 'Sync now'} variant="secondary" disabled={cloud.syncing} onPress={() => cloud.syncNow(true)} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    roleLine: { color: c.muted, fontSize: 15, fontWeight: '700' },
    section: { marginTop: spacing.lg },
    body: { color: c.text, fontSize: 15, marginBottom: spacing.md, lineHeight: 21 },
    codeBox: {
      borderWidth: 2,
      borderColor: c.accent,
      borderRadius: radius,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    code: { color: c.accent, fontSize: 36, fontWeight: '900', letterSpacing: 8 },
    member: { marginBottom: spacing.sm },
    name: { color: c.text, fontSize: 17, fontWeight: '800' },
    meta: { color: c.muted, fontSize: 13, marginTop: 2, marginBottom: spacing.sm },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    help: { color: c.muted, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    error: { color: c.danger, fontSize: 14 },
  });
