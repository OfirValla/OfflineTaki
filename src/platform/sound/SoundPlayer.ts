import Sound from 'react-native-sound';
import { createLogger } from '../../utils/logger';
import { ALL_SOUNDS, SoundName } from './soundEvents';

const log = createLogger('Sound');

/**
 * Preloads the bundled effects once and plays them on demand. Playback goes to the media
 * stream, so the phone's volume keys and silent mode apply as players expect.
 */
class SoundPlayer {
  private readonly sounds = new Map<SoundName, Sound>();
  private enabled = true;
  private preloaded = false;

  preload(): void {
    if (this.preloaded) return;
    this.preloaded = true;
    Sound.setCategory('Playback', true);
    for (const name of ALL_SOUNDS) {
      const sound = new Sound(`${name}.wav`, Sound.MAIN_BUNDLE, error => {
        if (error) log.warn('Could not load', name, error);
      });
      this.sounds.set(name, sound);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  play(name: SoundName): void {
    if (!this.enabled) return;
    const sound = this.sounds.get(name);
    if (!sound || !sound.isLoaded()) return;
    // Restart from the top so rapid repeats (a shuffle, a quick TAKI run) each register.
    sound.stop(() => {
      sound.play(ok => {
        if (!ok) log.debug('Playback failed', name);
      });
    });
  }

  release(): void {
    for (const sound of this.sounds.values()) sound.release();
    this.sounds.clear();
    this.preloaded = false;
  }
}

export const soundPlayer = new SoundPlayer();
