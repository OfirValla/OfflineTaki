import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GameClient } from '../networking/client/GameClient';
import { GameHost } from '../networking/host/GameHost';
import { clampSeatCount } from '../networking/protocol';
import type { GameSession } from '../networking/session/SessionState';
import type {
  DiscoveredGame,
  NearbyTransport,
} from '../networking/transport/types';
import { NearbyConnectionsTransport } from '../networking/transport/NearbyConnectionsTransport';
import {
  AndroidDevice,
  requestNotificationPermission,
} from '../platform/AndroidDevice';
import {
  loadProfile,
  normalizePlayerName,
  savePlayerName,
  type Profile,
} from '../storage/profileStore';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '../storage/settingsStore';
import { uuid } from '../utils/ids';
import { APP_VERSION } from './constants';
import { createTransport } from './transportFactory';

export type ActiveSession = GameHost | GameClient;

interface SessionApi {
  transport: NearbyTransport;
  profile: Profile | null;
  settings: Settings;
  session: ActiveSession | null;
  setPlayerName(name: string): Promise<void>;
  setSeatCount(seatCount: number): Promise<void>;
  hostGame(): Promise<GameHost>;
  joinGame(game: DiscoveredGame): Promise<GameClient>;
  leave(): Promise<void>;
}

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const transportRef = useRef<NearbyTransport | null>(null);
  if (transportRef.current === null) transportRef.current = createTransport();
  const transport = transportRef.current;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [session, setSession] = useState<ActiveSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadProfile(), loadSettings()]).then(
      ([loadedProfile, loadedSettings]) => {
        if (cancelled) return;
        setProfile(loadedProfile);
        setSettings(loadedSettings);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      profile?.playerName &&
      transport instanceof NearbyConnectionsTransport
    ) {
      transport.setLocalName(profile.playerName);
    }
  }, [profile?.playerName, transport]);

  const setPlayerName = useCallback(async (name: string) => {
    const normalized = normalizePlayerName(name);
    setProfile(current =>
      current ? { ...current, playerName: normalized } : current,
    );
    await savePlayerName(normalized);
  }, []);

  const setSeatCount = useCallback(async (seatCount: number) => {
    const next = { seatCount: clampSeatCount(seatCount) };
    setSettings(next);
    await saveSettings(next);
  }, []);

  const leave = useCallback(async () => {
    const current = session;
    setSession(null);
    AndroidDevice.setKeepScreenOn(false);
    if (current) {
      if (current.role === 'host') AndroidDevice.stopHostService();
      await current.leave();
    }
  }, [session]);

  const hostGame = useCallback(async () => {
    if (!profile) throw new Error('Profile not loaded');
    if (session) await leave();
    const gameName = `${profile.playerName}'s Game`;
    const next = new GameHost(transport, {
      self: { playerId: profile.playerId, name: profile.playerName },
      appVersion: APP_VERSION,
      gameId: uuid(),
      gameName,
      seatCount: settings.seatCount,
    });
    setSession(next);
    await requestNotificationPermission();
    await next.startHosting();
    AndroidDevice.startHostService(
      `Hosting ${gameName}`,
      'Nearby players can join. Keep the app open.',
    );
    AndroidDevice.setKeepScreenOn(true);
    return next;
  }, [leave, profile, session, settings.seatCount, transport]);

  const joinGame = useCallback(
    async (game: DiscoveredGame) => {
      if (!profile) throw new Error('Profile not loaded');
      // A phone that dropped mid-game keeps its session and reclaims the seat with its token.
      if (
        session instanceof GameClient &&
        session.getState().status === 'disconnected' &&
        session.getState().reconnectToken &&
        session.getState().gameId === game.gameId
      ) {
        await session.join(game);
        AndroidDevice.setKeepScreenOn(true);
        return session;
      }
      if (session) await leave();
      const next = new GameClient(transport, {
        self: { playerId: profile.playerId, name: profile.playerName },
        appVersion: APP_VERSION,
      });
      setSession(next);
      try {
        await next.join(game);
      } catch (error) {
        setSession(null);
        await next.leave();
        throw error;
      }
      AndroidDevice.setKeepScreenOn(true);
      return next;
    },
    [leave, profile, session, transport],
  );

  const value = useMemo<SessionApi>(
    () => ({
      transport,
      profile,
      settings,
      session,
      setPlayerName,
      setSeatCount,
      hostGame,
      joinGame,
      leave,
    }),
    [
      transport,
      profile,
      settings,
      session,
      setPlayerName,
      setSeatCount,
      hostGame,
      joinGame,
      leave,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSessionApi(): SessionApi {
  const api = useContext(SessionContext);
  if (!api)
    throw new Error('useSessionApi must be used inside SessionProvider');
  return api;
}

export function useGameSession(): GameSession | null {
  return useSessionApi().session;
}
