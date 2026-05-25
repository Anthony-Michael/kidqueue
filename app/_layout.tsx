import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { registerForPushNotifications, savePushToken } from '../lib/notifications';
import { supabase } from '../lib/supabase';

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/(auth)/login');
      return;
    }

    // Check if user has completed onboarding (has a city set)
    supabase
      .from('profiles')
      .select('city')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data?.city) {
          router.replace('/(tabs)/discover');
        } else {
          router.replace('/(auth)/onboarding');
        }
      })
      .catch(() => {
        // Fallback to discover on any profile error
        router.replace('/(tabs)/discover');
      });

    // Register for push notifications in background
    registerForPushNotifications().then((token) => {
      if (token) savePushToken(token);
    });
  }, [session, loading]);

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
