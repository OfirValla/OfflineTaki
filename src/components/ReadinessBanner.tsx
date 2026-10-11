import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../app/theme';
import type { ReadinessController } from '../hooks/useNearbyReadiness';

const COPY: Record<
  ReadinessController['readiness']['status'],
  { title: string; body: string; action?: string }
> = {
  checking: { title: 'Checking radios…', body: '' },
  ready: { title: 'Ready', body: '' },
  'permissions-needed': {
    title: 'Nearby devices permission needed',
    body: 'The game finds other phones over Bluetooth. No location data is collected.',
    action: 'Allow',
  },
  'permissions-blocked': {
    title: 'Permission was denied',
    body: 'Enable "Nearby devices" (and Location on older Android) for Offline TAKI in system settings.',
    action: 'Open settings',
  },
  'bluetooth-off': {
    title: 'Bluetooth is off',
    body: 'Turn Bluetooth on. It works in airplane mode too.',
    action: 'Turn on',
  },
  'location-off': {
    title: 'Location is off',
    body: 'On this Android version, discovering nearby phones requires the system Location toggle to be on.',
    action: 'Open settings',
  },
  'no-play-services': {
    title: 'Google Play Services missing',
    body: 'This phone cannot use Nearby Connections. It can still join a game once the Bluetooth transport ships.',
  },
  unsupported: {
    title: 'No Bluetooth on this device',
    body: 'Offline TAKI needs Bluetooth to find nearby phones.',
  },
};

export function ReadinessBanner({
  controller,
}: {
  controller: ReadinessController;
}) {
  const { readiness, fix, canFix } = controller;
  if (readiness.status === 'ready') return null;
  const copy = COPY[readiness.status];
  return (
    <View style={styles.banner}>
      <View style={styles.textColumn}>
        <Text style={styles.title}>{copy.title}</Text>
        {copy.body ? <Text style={styles.body}>{copy.body}</Text> : null}
      </View>
      {readiness.status === 'checking' ? (
        <ActivityIndicator color={colors.accent} />
      ) : canFix && copy.action ? (
        <Pressable
          onPress={() => void fix()}
          style={styles.action}
          accessibilityRole="button"
        >
          <Text style={styles.actionLabel}>{copy.action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textColumn: { flex: 1, gap: spacing.xs },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  action: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  actionLabel: { color: colors.accentText, fontWeight: '700' },
});
