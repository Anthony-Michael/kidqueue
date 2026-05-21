import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('kidqueue', {
      name: 'KidQueue Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F86C6',
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
}

export async function savePushToken(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', user.id);
}

export async function scheduleLocalAlert(
  activityName: string,
  registrationOpensAt: Date,
  daysBefore: number,
) {
  const alertDate = new Date(registrationOpensAt);
  alertDate.setDate(alertDate.getDate() - daysBefore);
  alertDate.setHours(8, 0, 0, 0); // 8am alert

  if (alertDate <= new Date()) return null; // already past

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ Registration opens soon!',
      body: `${activityName} registration opens in ${daysBefore} day${daysBefore !== 1 ? 's' : ''}. Don't miss your spot!`,
      sound: true,
      data: { type: 'registration_alert', activityName },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: alertDate,
    },
  });

  // Also schedule a same-day alert
  const sameDayAlert = new Date(registrationOpensAt);
  sameDayAlert.setHours(7, 0, 0, 0);

  if (sameDayAlert > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Registration is OPEN today!',
        body: `${activityName} registration opens TODAY! Tap to sign up now.`,
        sound: true,
        data: { type: 'registration_open', activityName },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: sameDayAlert,
      },
    });
  }

  return id;
}
