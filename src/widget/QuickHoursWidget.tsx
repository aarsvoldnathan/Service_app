// Android home-screen widget (react-native-android-widget). Plain widget primitives only.
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetSnapshot } from './snapshot';
import { LEVEL_HEX } from './snapshot';

const BG = '#181B20';
const TEXT = '#F2F4F7';
const MUTED = '#8B93A1';
const ACCENT = '#FFB020';
const OPEN = 'serviceceo://quick?scan=1';

export function QuickHoursWidget({ data }: { data: WidgetSnapshot | null }) {
  const last = data?.last;
  const color = last ? LEVEL_HEX[last.level] : MUTED;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: OPEN }}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 20, padding: 12, flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text="SERVICE CEO" style={{ fontSize: 13, color: ACCENT, fontWeight: 'bold' }} />
        <TextWidget
          text={data ? (data.needService ? `${data.needService} need service` : 'All up to date') : ''}
          style={{ fontSize: 12, color: data?.needService ? LEVEL_HEX.red : LEVEL_HEX.green }}
        />
      </FlexWidget>

      {last ? (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget style={{ width: 6, height: 42, backgroundColor: color, borderRadius: 3, marginRight: 10 }} />
          <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
            <TextWidget text={last.name.toUpperCase()} maxLines={1} style={{ fontSize: 17, color: TEXT, fontWeight: 'bold' }} />
            <TextWidget text={`S/N ${last.serial || '—'} · ${last.hours} h`} maxLines={1} style={{ fontSize: 12, color: MUTED }} />
            <TextWidget text={last.label} maxLines={1} style={{ fontSize: 12, color, fontWeight: 'bold' }} />
          </FlexWidget>
        </FlexWidget>
      ) : (
        <TextWidget text="Scan a machine to update its hours" style={{ fontSize: 13, color: MUTED }} />
      )}

      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: OPEN }}
        style={{ width: 'match_parent', height: 40, backgroundColor: ACCENT, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
      >
        <TextWidget text="SCAN & UPDATE HOURS" style={{ fontSize: 14, color: '#1A1200', fontWeight: 'bold' }} />
      </FlexWidget>
    </FlexWidget>
  );
}
