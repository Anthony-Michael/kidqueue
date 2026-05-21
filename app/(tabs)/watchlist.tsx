import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWatchlist, useRemoveFromWatchlist } from '../../hooks/useActivities';
import { Colors, CategoryColors } from '../../constants/Colors';
import { WatchlistItem } from '../../types';
import { format, differenceInDays, parseISO } from 'date-fns';

function WatchlistCard({ item, onRemove }: { item: WatchlistItem; onRemove: () => void }) {
  const activity = item.activity!;
  const catColor = CategoryColors[activity.category] ?? Colors.textMuted;
  const daysUntil = activity.registration_opens_at
    ? differenceInDays(parseISO(activity.registration_opens_at), new Date())
    : null;

  const urgencyColor =
    daysUntil === null ? Colors.textMuted
    : daysUntil < 0 ? Colors.textMuted
    : daysUntil <= 3 ? Colors.error
    : daysUntil <= 7 ? Colors.accent
    : Colors.success;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/activity/${activity.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.categoryBar, { backgroundColor: catColor }]} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.activityName}>{activity.name}</Text>
        <Text style={styles.provider}>{activity.provider}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.metaText}>{activity.location}</Text>
        </View>

        {activity.registration_opens_at && (
          <View style={styles.alertRow}>
            <Ionicons name="notifications-outline" size={14} color={urgencyColor} />
            <Text style={[styles.alertText, { color: urgencyColor }]}>
              {daysUntil === null
                ? 'No date set'
                : daysUntil < 0
                ? 'Registration has passed'
                : daysUntil === 0
                ? 'Reg. opens TODAY!'
                : `Reg. opens ${format(parseISO(activity.registration_opens_at), 'MMM d')} (${daysUntil}d)`}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
        <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function WatchlistScreen() {
  const { data: watchlist, isLoading, refetch, isRefetching } = useWatchlist();
  const { mutate: removeItem } = useRemoveFromWatchlist();

  const handleRemove = (id: string, name: string) => {
    Alert.alert(
      'Remove from Watchlist',
      `Remove "${name}" from your watchlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeItem(id) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Watchlist</Text>
        <Text style={styles.subtitle}>
          {watchlist?.length ?? 0} activit{watchlist?.length === 1 ? 'y' : 'ies'} saved
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} size="large" />
      ) : !watchlist?.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No saved activities</Text>
          <Text style={styles.emptyText}>
            Browse activities and tap "Save" to get alerts when registration opens.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/discover')}
          >
            <Text style={styles.emptyButtonText}>Browse Activities</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={watchlist}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <WatchlistCard
              item={item}
              onRemove={() => handleRemove(item.id, item.activity?.name ?? 'this activity')}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLeft: { width: 6 },
  categoryBar: { flex: 1 },
  cardContent: { flex: 1, padding: 14, gap: 4 },
  activityName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  provider: { fontSize: 13, color: Colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 12, color: Colors.textMuted },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  alertText: { fontSize: 13, fontWeight: '600' },
  removeBtn: { padding: 12, justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  emptyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyButtonText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
