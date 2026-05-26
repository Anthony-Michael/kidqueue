import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from './supabase';

// Expo Go removed remote push support in SDK 53.
// We lazy-require expo-notifications only in real builds to avoid
// the module-load error that fires in Expo Go on Android.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const N = require('expo-notifications');
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch { /* not available */ }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const N = require('expo-notifications');

    const { status: existingStatus } = await N.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('kidqueue', {
        name: 'KidQueue Alerts',
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F86C6',
      });
    }

    const token = (await N.getExpoPushTokenAsync()).data;
    return token;
  } catch {
    return null;
  }
}

export async function savePushToken(token: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
  } catch { /* silent */ }
}

export async function scheduleLocalAlert(
  activityName: string,
  registrationOpensAt: Date,
  daysBefore: number,
): Promise<string | null> {
  if (isExpoGo) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const N = require('expo-notifications');

    const alertDate = new Date(registrationOpensAt);
    alertDate.setDate(alertDate.getDate() - daysBefore);
    alertDate.setHours(8, 0, 0, 0);
    if (alertDate <= new Date()) return null;

    const id = await N.scheduleNotificationAsync({
      content: {
        title: '⏰ Registration opens soon!',
        body: `${activityName} registration opens in ${daysBefore} day${daysBefore !== 1 ? 's' : ''}. Don't miss your spot!`,
        sound: true,
        data: { type: 'registration_alert', activityName },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: alertDate,
      },
    });

    const sameDayAlert = new Date(registrationOpensAt);
    sameDayAlert.setHours(7, 0, 0, 0);
    if (sameDayAlert > new Date()) {
      await N.scheduleNotificationAsync({
        content: {
          title: '🚨 Registration is OPEN today!',
          body: `${activityName} registration opens TODAY! Tap to sign up now.`,
          sound: true,
          data: { type: 'registration_open', activityName },
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: sameDayAlert,
        },
      });
    }
    return id;
  } catch {
    return null;
  }
}
