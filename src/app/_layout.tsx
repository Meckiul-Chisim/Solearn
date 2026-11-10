import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import '@/global.css';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

/**
 * Screens are split into two groups:
 * - signed in  -> the app (tabs, redeem, spin)
 * - signed out -> the login screen
 * Expo Router sends people to the right group whenever the auth state changes.
 */
function RootNavigator() {
  const { status } = useAuth();
  const signedIn = status === 'signedIn';

  return (
    <>
      <AnimatedSplashOverlay />
      {/* While we check for a saved session, render no screens so a signed-in
          user does not see the login screen flash by. */}
      {status !== 'loading' && (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="redeem" />
            <Stack.Screen name="spin" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      )}
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
