import React from 'react';
import { StatusBar } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { GameScreen } from '../screens/Game/GameScreen';
import { JoinGameScreen } from '../screens/Join/JoinGameScreen';
import { SessionScreen } from '../screens/Session/SessionScreen';
import type { RootStackParamList } from './navigation';
import { SessionProvider } from './SessionContext';
import { colors } from './theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    primary: colors.accent,
    border: colors.border,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar barStyle="light-content" />
        <NavigationContainer theme={navigationTheme}>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Join" component={JoinGameScreen} />
            <Stack.Screen
              name="Session"
              component={SessionScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="Game"
              component={GameScreen}
              options={{ gestureEnabled: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
