import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { APP_VERSION } from '../../app/constants';
import type { ScreenProps } from '../../app/navigation';
import { useSessionApi } from '../../app/SessionContext';
import { colors, spacing } from '../../app/theme';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ReadinessBanner } from '../../components/ReadinessBanner';
import { Screen } from '../../components/Screen';
import { SeatStepper } from '../../components/SeatStepper';
import { SoundToggle } from '../../components/SoundToggle';
import { TextField } from '../../components/TextField';
import { useNearbyReadiness } from '../../hooks/useNearbyReadiness';
import { MAX_SEATS, MIN_SEATS } from '../../networking/protocol';
import { MAX_PLAYER_NAME_LENGTH } from '../../storage/profileStore';

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const {
    profile,
    settings,
    setPlayerName,
    setSeatCount,
    setSoundEnabled,
    hostGame,
  } = useSessionApi();
  const readiness = useNearbyReadiness();
  const [creating, setCreating] = useState(false);

  const ready = readiness.readiness.status === 'ready';
  const hasName = (profile?.playerName ?? '').trim().length > 0;
  const canAct = ready && hasName && profile !== null;

  const onCreate = async () => {
    setCreating(true);
    try {
      await hostGame();
      navigation.navigate('Session');
    } catch (error) {
      Alert.alert(
        'Could not create game',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen avoidKeyboard>
      <View style={styles.toolbar}>
        <SoundToggle
          enabled={settings.soundEnabled}
          onToggle={next => void setSoundEnabled(next)}
        />
      </View>
      <View style={styles.hero}>
        <View style={styles.logo}>
          {[
            ['T', colors.red, colors.redDark],
            ['A', colors.blue, colors.blueDark],
            ['K', colors.green, colors.greenDark],
            ['I', colors.yellow, colors.yellowDark],
          ].map(([letter, fill, shade]) => (
            <View key={letter} style={styles.logoLetterBox}>
              <Text
                style={[styles.logoLetter, styles.logoShade, { color: shade }]}
              >
                {letter}
              </Text>
              <Text style={[styles.logoLetter, { color: fill }]}>{letter}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.subtitle}>Offline · Nearby · No internet</Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Your name"
          value={profile?.playerName ?? ''}
          onChangeText={text => void setPlayerName(text)}
          placeholder="e.g. Ofir"
          maxLength={MAX_PLAYER_NAME_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          editable={profile !== null}
        />
        <SeatStepper
          label="Players per game"
          hint="When you host and start early, open seats are filled with bots."
          value={settings.seatCount}
          min={MIN_SEATS}
          max={MAX_SEATS}
          onChange={value => void setSeatCount(value)}
        />
        <ReadinessBanner controller={readiness} />
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          title="Create Game"
          onPress={() => void onCreate()}
          disabled={!canAct}
          loading={creating}
        />
        <PrimaryButton
          title="Join Nearby Game"
          variant="secondary"
          onPress={() => navigation.navigate('Join')}
          disabled={!canAct}
        />
        {!hasName && profile !== null ? (
          <Text style={styles.hint}>Enter your name to continue.</Text>
        ) : null}
      </View>

      <Text style={styles.footer}>v{APP_VERSION} · offline TAKI</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { alignItems: 'center', paddingTop: spacing.sm, gap: spacing.sm },
  logo: { flexDirection: 'row', gap: 2 },
  logoLetterBox: {
    width: 52,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { fontSize: 56, fontWeight: '900', includeFontPadding: false },
  logoShade: { position: 'absolute', left: 3, top: 4 },
  subtitle: { color: colors.textMuted, fontSize: 15, letterSpacing: 1 },
  form: { marginTop: spacing.lg, gap: spacing.md },
  actions: { marginTop: 'auto', gap: spacing.md },
  hint: { color: colors.textMuted, textAlign: 'center' },
  footer: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
