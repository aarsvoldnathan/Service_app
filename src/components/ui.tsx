import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import type { Level } from '../maintenance';
import { font, Palette, radius, spacing, touch, useStyles, useTheme } from '../theme';

export function levelColor(c: Palette, level: Level): string {
  return level === 'red' ? c.danger : level === 'orange' ? c.orange : level === 'yellow' ? c.warn : c.ok;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles(makeStyles);
  return <View style={[s.card, style]}>{children}</View>;
}

type FieldProps = TextInputProps & { label: string; hint?: string };

export function Field({ label, hint, style, multiline, ...rest }: FieldProps) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        style={[s.input, multiline && s.multiline, style]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...rest}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Plain themed text input without a label (for compact rows). */
export function Input(props: TextInputProps) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  return <TextInput placeholderTextColor={c.muted} {...props} style={[s.input, s.compact, props.style]} />;
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({ title, onPress, variant = 'primary', disabled, style, accessibilityLabel }: ButtonProps) {
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        s.button,
        variant === 'primary' && s.primary,
        variant === 'secondary' && s.secondary,
        variant === 'danger' && s.dangerButton,
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}
    >
      <Text
        style={[
          s.buttonText,
          variant === 'primary' ? s.primaryText : s.secondaryText,
          variant === 'danger' && s.dangerText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/** Small text button for navigation headers. */
export function HeaderButton({ title, onPress, label }: { title: string; onPress: () => void; label: string }) {
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [s.headerButton, pressed && { opacity: 0.6 }]}
    >
      <Text style={s.headerButtonText}>{title}</Text>
    </Pressable>
  );
}

/** A large tappable check row. */
export function CheckRow({
  checked,
  onToggle,
  title,
  detail,
  detailColor,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  detail?: string;
  detailColor?: string;
}) {
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => [s.checkRow, pressed && { opacity: 0.7 }]}
    >
      <View style={[s.box, checked && s.boxChecked]}>{checked && <Text style={s.tick}>✓</Text>}</View>
      <View style={{ flex: 1 }}>
        <Text style={[s.checkTitle, checked && s.checkDone]}>{title}</Text>
        {detail ? (
          <Text style={[s.checkDetail, detailColor ? { color: detailColor } : null]}>{detail}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Row of pill buttons where one (or several) can be selected. */
export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
  multi,
}: {
  options: { value: T; label: string }[];
  value: T | T[] | undefined;
  onChange: (v: T) => void;
  multi?: boolean;
}) {
  const s = useStyles(makeStyles);
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = selected(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={multi ? { checked: on } : { selected: on }}
            style={({ pressed }) => [s.chip, on && s.chipOn, pressed && { opacity: 0.7 }]}
          >
            <Text style={[s.chipText, on && s.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tappable list row with title, subtitle and an optional colored dot. */
export function ListRow({
  title,
  subtitle,
  onPress,
  dot,
  right,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  dot?: string;
  right?: string;
}) {
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [s.listRow, pressed && { opacity: 0.7 }]}
    >
      {dot ? <View style={[s.dot, { backgroundColor: dot }]} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle}>{title}</Text>
        {subtitle ? <Text style={s.listSub}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={s.listRight}>{right}</Text> : null}
      {onPress ? <Text style={s.chevron}>›</Text> : null}
    </Pressable>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  const s = useStyles(makeStyles);
  return <Text style={s.muted}>{children}</Text>;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      color: c.muted,
      fontSize: 15,
      fontFamily: font.heading,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    card: {
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius,
      padding: spacing.md,
    },
    field: { marginBottom: spacing.md },
    label: { color: c.muted, fontSize: 14, fontFamily: font.regular, marginBottom: spacing.xs },
    hint: { color: c.muted, fontSize: 12, fontFamily: font.light, marginTop: spacing.xs },
    input: {
      minHeight: touch,
      backgroundColor: c.bg,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: c.text,
      fontSize: 17,
      fontFamily: font.regular,
    },
    compact: { paddingHorizontal: spacing.sm, fontSize: 16 },
    multiline: { minHeight: 96 },
    button: {
      minHeight: touch,
      borderRadius: radius,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: { backgroundColor: c.accent },
    secondary: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
    dangerButton: { borderWidth: 1, borderColor: c.danger },
    buttonText: { fontSize: 18, fontFamily: font.heading, letterSpacing: 1, textTransform: 'uppercase' },
    primaryText: { color: c.onAccent },
    secondaryText: { color: c.text },
    dangerText: { color: c.danger },
    headerButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    headerButtonText: { color: c.accent, fontSize: 17, fontFamily: font.heading, letterSpacing: 0.5 },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: touch,
      paddingVertical: spacing.sm,
    },
    box: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: c.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxChecked: { backgroundColor: c.accent, borderColor: c.accent },
    tick: { color: c.onAccent, fontSize: 18, fontWeight: '900' },
    checkTitle: { color: c.text, fontSize: 16, fontFamily: font.medium },
    checkDone: { textDecorationLine: 'line-through', color: c.muted },
    checkDetail: { color: c.muted, fontSize: 14, fontFamily: font.light, marginTop: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      minHeight: 44,
      paddingHorizontal: spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      justifyContent: 'center',
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.text, fontSize: 15, fontFamily: font.medium },
    chipTextOn: { color: c.onAccent },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 64,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius,
      marginBottom: spacing.sm,
    },
    dot: { width: 16, height: 16, borderRadius: 8 },
    listTitle: { color: c.text, fontSize: 19, fontFamily: font.heading, letterSpacing: 0.3 },
    listSub: { color: c.muted, fontSize: 14, fontFamily: font.light, marginTop: 2 },
    listRight: { color: c.muted, fontSize: 14, fontFamily: font.regular },
    chevron: { color: c.muted, fontSize: 26, marginTop: -2 },
    muted: { color: c.muted, fontSize: 15, fontFamily: font.light, paddingVertical: spacing.sm },
  });
