import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { registerForPushNotifications, savePushToken } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/Colors';

const queryClient = new QueryClient();
const CITY_KEY = 'kidqueue_user_city';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/(auth)/login');
      setReady(true);
      return;
    }

    // Register for push notifications in background
    registerForPushNotifications().then((token) => {
      if (token) savePushToken(token);
    });

    // Check AsyncStorage first (fast) then DB as fallback
    AsyncStorage.getItem(CITY_KEY)
      .then(async (cachedCity) => {
        if (cachedCity) {
          router.replace('/(tabs)/discover');
          return;
        }
        // Fallback: check DB for city
        try {
          const { data } = await supabase
            .from('profiles')
            .select('city')
            .eq('id', session.user.id)
            .single();

          if (data?.city) {
            await AsyncStorage.setItem(CITY_KEY, data.city).catch(() => {});
            router.replace('/(tabs)/discover');
          } else {
            router.replace('/(auth)/onboarding');
          }
        } catch {
          router.replace('/(tabs)/discover');
        }
      })
      .catch(() => {
        // AsyncStorage unavailable — fall through to discover
        router.replace('/(tabs)/discover');
      })
      .finally(() => {
        setReady(true);
      });
  }, [session, loading]);

  // Show spinner while we figure out where to route
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

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
