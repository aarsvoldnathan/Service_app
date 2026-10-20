import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bucket } from '../finance';
import { Palette, spacing, useStyles, useTheme } from '../theme';

const HEIGHT = 160;

/** Side-by-side income and expense bars per period, with a legend. */
export function BarChart({ data }: { data: Bucket[] }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const max = Math.max(1, ...data.map((b) => Math.max(b.income, b.expenses)));
  const short = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`);

  return (
    <View accessible accessibilityLabel={data.map((b) => `${b.label}: income ${Math.round(b.income)} dollars, expenses ${Math.round(b.expenses)} dollars`).join('. ')}>
      <View style={s.legend}>
        <View style={[s.swatch, { backgroundColor: c.ok }]} />
        <Text style={s.legendText}>Income</Text>
        <View style={[s.swatch, { backgroundColor: c.danger, marginLeft: spacing.md }]} />
        <Text style={s.legendText}>Expenses</Text>
        <Text style={[s.legendText, { marginLeft: 'auto' }]}>Top: {short(max)}</Text>
      </View>
      <View style={s.chart}>
        {[0.5, 1].map((f) => (
          <View key={f} style={[s.grid, { bottom: 22 + HEIGHT * f }]} />
        ))}
        {data.map((b) => (
          <View key={b.label + b.start.toISOString()} style={s.group}>
            <View style={s.bars}>
              <View style={[s.bar, { height: Math.max(b.income ? 2 : 0, (b.income / max) * HEIGHT), backgroundColor: c.ok }]} />
              <View style={[s.bar, { height: Math.max(b.expenses ? 2 : 0, (b.expenses / max) * HEIGHT), backgroundColor: c.danger }]} />
            </View>
            <Text style={s.label} numberOfLines={1}>
              {b.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
    swatch: { width: 12, height: 12, borderRadius: 3 },
    legendText: { color: c.muted, fontSize: 12, fontWeight: '600' },
    chart: { flexDirection: 'row', alignItems: 'flex-end', height: HEIGHT + 22, gap: 4 },
    grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: c.border },
    group: { flex: 1, alignItems: 'center' },
    bars: { flexDirection: 'row', alignItems: 'flex-end', height: HEIGHT, gap: 2 },
    bar: { width: 9, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
    label: { color: c.muted, fontSize: 10, marginTop: 6, height: 16 },
  });
