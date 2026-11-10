import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Text, useColorScheme, View } from "react-native";
import '@/global.css';
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { SolearnProvider, useSolearn } from "@/context/solearn-context";

void SplashScreen.preventAutoHideAsync();

function AppNavigation() {
  const { user, loading } = useSolearn();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const segments = useSegments();
  const onAuthRoute = segments[0] === "auth";
  const needsRedirect = (!user && !onAuthRoute) || (!!user && onAuthRoute);

  useEffect(() => {
    if (loading || !rootNavigationState?.key || !needsRedirect) return;
    router.replace(user ? "/" : "/auth");
  }, [loading, needsRedirect, rootNavigationState?.key, router, user]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {(loading || needsRedirect) && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-[#F6F7F2]">
          <Text className="text-sm font-bold text-[#287A4B]">Loading SoloEarn…</Text>
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <SolearnProvider>
        <AnimatedSplashOverlay />
        <AppNavigation />
      </SolearnProvider>
    </ThemeProvider>
  );
}
