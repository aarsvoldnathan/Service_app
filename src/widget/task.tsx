// Runs in the background when Android adds, refreshes or resizes the widget.
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { QuickHoursWidget } from './QuickHoursWidget';
import { readSnapshot } from './snapshot';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await readSnapshot();
      props.renderWidget(<QuickHoursWidget data={data} />);
      break;
    }
    default:
      break;
  }
}
