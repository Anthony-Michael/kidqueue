import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { registerForPushNotifications, savePushToken } from '../lib/notifications';
import { supabase } from '../lib/supabase';

const queryClient = new QueryClient();
const CITY_KEY = 'kidqueue_user_city';

function RootLayoutNav() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/(auth)/login');
      return;
    }

    // Register push notifications in background (non-blocking)
    registerForPushNotifications().then((token) => {
      if (token) savePushToken(token);
    }).catch(() => {});

    // Check AsyncStorage first (instant), fall back to DB
    AsyncStorage.getItem(CITY_KEY)
      .then(async (cachedCity) => {
        if (cachedCity) {
          router.replace('/(tabs)/discover');
          return;
        }
        // First open — check DB
        try {
          const { data } = await supabase
            .from('profiles')
            .select('city')
            .eq('id', session.user.id)
            .single();

          if (data?.city) {
            AsyncStorage.setItem(CITY_KEY, data.city).catch(() => {});
            router.replace('/(tabs)/discover');
          } else {
            router.replace('/(auth)/onboarding');
          }
        } catch {
          router.replace('/(tabs)/discover');
        }
      })
      .catch(() => {
        router.replace('/(tabs)/discover');
      });
  }, [session, loading]);

  // Always render the Stack — router.replace() needs it mounted first
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="activity/[id]"
        options={{ headerShown: true, title: '', presentation: 'card' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <RootLayoutNav />
    </QueryClientProvider>
  );
}
