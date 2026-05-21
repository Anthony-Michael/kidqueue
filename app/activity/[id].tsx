import { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useActivity, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from '../../hooks/useActivities';
import { scheduleLocalAlert } from '../../lib/notifications';
import { Colors, CategoryColors } from '../../constants/Colors';
import { format, parseISO, differenceInDays } from 'date-fns';

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: activity, isLoading } = useActivity(id);
  const { data: watchlist } = useWatchlist();
  const { mutate: addToWatchlist, isPending: adding } = useAddToWatchlist();
  const { mutate: removeFromWatchlist, isPending: removing } = useRemoveFromWatchlist();
  const [savingAlert, setSavingAlert] = useState(false);

  if (isLoading || !activity) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} size="large" />
      </SafeAreaView>
    );
  }

  const watchlistItem = watchlist?.find((w) => w.activity_id === activity.id);
  const isSaved = !!watchlistItem;
  const catColor = CategoryColors[activity.category] ?? Colors.textMuted;

  const daysUntilReg = activity.registration_opens_at
    ? differenceInDays(parseISO(activity.registration_opens_at), new Date())
    : null;

  const handleSave = async () => {
    if (isSaved) {
      removeFromWatchlist(watchlistItem!.id);
      return;
    }

    setSavingAlert(true);
    addToWatchlist(
      { activityId: activity.id, notifyDaysBefore: 3 },
      {
        onSuccess: async () => {
          // Schedule local push notification
          if (activity.registration_opens_at) {
            await scheduleLocalAlert(
              activity.name,
              parseISO(activity.registration_opens_at),
              3,
            );
          }
          setSavingAlert(false);
          Alert.alert(
            'Saved! 🔔',
            activity.registration_opens_at
              ? `You'll get an alert 3 days before registration opens on ${format(parseISO(activity.registration_opens_at), 'MMM d, yyyy')}.`
              : 'Added to your watchlist.',
          );
        },
        onError: (err) => {
          setSavingAlert(false);
          Alert.alert('Error', err.message);
        },
      },
    );
  };

  const handleSignUp = () => {
    if (activity.signup_url) {
      Linking.openURL(activity.signup_url);
    } else {
      Alert.alert('No link available', 'No sign-up URL has been provided for this activity yet.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Category + verified badge */}
        <View style={styles.headerRow}>
          <View style={[styles.categoryBadge, { backgroundColor: catColor + '20' }]}>
            <Text style={[styles.categoryText, { color: catColor }]}>
              {activity.category.toUpperCase()}
            </Text>
          </View>
          {activity.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>

        <Text style={styles.name}>{activity.name}</Text>
        <Text style={styles.provider}>{activity.provider}</Text>

        {/* Registration countdown */}
        {activity.registration_opens_at && (
          <View style={[
            styles.regBanner,
            {
              backgroundColor:
                daysUntilReg === 0 ? '#FFF3E0'
                : daysUntilReg !== null && daysUntilReg < 0 ? Colors.border
                : Colors.primaryLight,
            },
          ]}>
            <Ionicons
              name={daysUntilReg === 0 ? 'alarm-outline' : 'calendar-outline'}
              size={18}
              color={daysUntilReg === 0 ? Colors.accent : daysUntilReg !== null && daysUntilReg < 0 ? Colors.textMuted : Colors.primary}
            />
            <View>
              <Text style={styles.regLabel}>Registration Opens</Text>
              <Text style={styles.regDate}>
                {format(parseISO(activity.registration_opens_at), 'MMMM d, yyyy')}
                {daysUntilReg !== null && daysUntilReg >= 0 && (
                  <Text style={styles.regCountdown}>
                    {daysUntilReg === 0 ? '  🚨 TODAY!' : `  (${daysUntilReg} days away)`}
                  </Text>
                )}
              </Text>
            </View>
          </View>
        )}

        {/* Details */}
        <View style={styles.detailsCard}>
          <DetailRow icon="location-outline" label="Location" value={activity.location} />
          {(activity.age_min !== null || activity.age_max !== null) && (
            <DetailRow
              icon="person-outline"
              label="Age Range"
              value={`${activity.age_min ?? '?'}–${activity.age_max ?? '?'} years old`}
            />
          )}
          {activity.activity_starts_at && (
            <DetailRow
              icon="calendar-outline"
              label="Activity Starts"
              value={format(parseISO(activity.activity_starts_at), 'MMMM d, yyyy')}
            />
          )}
          {activity.signup_url && (
            <DetailRow icon="link-outline" label="Sign-up Link" value={activity.signup_url} isLink />
          )}
        </View>

        {/* Description */}
        {activity.description ? (
          <View style={styles.descSection}>
            <Text style={styles.descTitle}>About this activity</Text>
            <Text style={styles.descText}>{activity.description}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.saveBtn, isSaved && styles.saveBtnSaved]}
          onPress={handleSave}
          disabled={adding || removing || savingAlert}
        >
          {adding || savingAlert ? (
            <ActivityIndicator color={isSaved ? Colors.primary : Colors.white} size="small" />
          ) : (
            <>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={isSaved ? Colors.primary : Colors.white}
              />
              <Text style={[styles.saveBtnText, isSaved && styles.saveBtnTextSaved]}>
                {isSaved ? 'Saved' : 'Save & Alert Me'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.signUpBtn} onPress={handleSignUp}>
          <Text style={styles.signUpBtnText}>Sign Up</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({
  icon, label, value, isLink,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  isLink?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={Colors.primary} style={styles.detailIcon} />
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text
          style={[styles.detailValue, isLink && styles.detailValueLink]}
          onPress={isLink ? () => Linking.openURL(value) : undefined}
          numberOfLines={isLink ? 1 : undefined}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backText: { fontSize: 16, color: Colors.textPrimary, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 120, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  categoryText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  name: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, lineHeight: 32 },
  provider: { fontSize: 16, color: Colors.textSecondary, marginTop: -8 },
  regBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 16,
  },
  regLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  regDate: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  regCountdown: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  detailsCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16,
    gap: 14, borderWidth: 1, borderColor: Colors.border,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailIcon: { marginTop: 1 },
  detailText: { flex: 1 },
  detailLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', marginBottom: 2 },
  detailValue: { fontSize: 14, color: Colors.textPrimary },
  detailValueLink: { color: Colors.primary, textDecorationLine: 'underline' },
  descSection: { gap: 8 },
  descTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  descText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.card,
    borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 16, paddingBottom: 32,
    flexDirection: 'row', gap: 12,
  },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14,
  },
  saveBtnSaved: { backgroundColor: Colors.primaryLight, borderWidth: 1.5, borderColor: Colors.primary },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  saveBtnTextSaved: { color: Colors.primary },
  signUpBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14,
  },
  signUpBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
