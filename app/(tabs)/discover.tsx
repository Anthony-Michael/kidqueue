import { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useActivities } from '../../hooks/useActivities';
import { useProfile } from '../../hooks/useProfile';
import { Colors, CategoryColors } from '../../constants/Colors';
import { Activity, Category } from '../../types';
import { format, differenceInDays, parseISO } from 'date-fns';

const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '✨' },
  { key: 'camps', label: 'Camps', icon: '⛺' },
  { key: 'sports', label: 'Sports', icon: '⚽' },
  { key: 'swim', label: 'Swim', icon: '🏊' },
  { key: 'arts', label: 'Arts', icon: '🎨' },
  { key: 'music', label: 'Music', icon: '🎵' },
  { key: 'stem', label: 'STEM', icon: '🔬' },
  { key: 'dance', label: 'Dance', icon: '💃' },
];

function RegistrationBadge({ opensAt }: { opensAt: string | null }) {
  if (!opensAt) return null;
  const days = differenceInDays(parseISO(opensAt), new Date());

  if (days < 0) return (
    <View style={[styles.badge, { backgroundColor: Colors.border }]}>
      <Text style={[styles.badgeText, { color: Colors.textMuted }]}>Registration passed</Text>
    </View>
  );
  if (days === 0) return (
    <View style={[styles.badge, { backgroundColor: '#FFF3E0' }]}>
      <Text style={[styles.badgeText, { color: Colors.accent }]}>🚨 Opens TODAY</Text>
    </View>
  );
  if (days <= 7) return (
    <View style={[styles.badge, { backgroundColor: '#FFF3E0' }]}>
      <Text style={[styles.badgeText, { color: Colors.accent }]}>⏰ Opens in {days} {days === 1 ? 'day' : 'days'}</Text>
    </View>
  );
  return (
    <View style={[styles.badge, { backgroundColor: Colors.primaryLight }]}>
      <Text style={[styles.badgeText, { color: Colors.primary }]}>
        Opens {format(parseISO(opensAt), 'MMM d')}
      </Text>
    </View>
  );
}

function ActivityCard({ activity }: { activity: Activity }) {
  const catColor = CategoryColors[activity.category] ?? Colors.textMuted;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/activity/${activity.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
        <Text style={[styles.categoryLabel, { color: catColor }]}>
          {activity.category.toUpperCase()}
        </Text>
        {!activity.is_verified && (
          <Text style={styles.unverified}>  · Community submitted</Text>
        )}
      </View>

      <Text style={styles.activityName}>{activity.name}</Text>
      <Text style={styles.provider}>{activity.provider}</Text>

      <View style={styles.cardMeta}>
        <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
        <Text style={styles.metaText}>{activity.location}</Text>
        {activity.age_min != null && (
          <>
            <Text style={styles.metaDot}>·</Text>
            <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              Ages {activity.age_min}{activity.age_max ? `–${activity.age_max}` : '+'}
            </Text>
          </>
        )}
      </View>

      <RegistrationBadge opensAt={activity.registration_opens_at} />
    </TouchableOpacity>
  );
}

export default function DiscoverScreen() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { data: profile } = useProfile();
  const userCity = profile?.city ?? 'Port Coquitlam';
  const userProvince = profile?.province ?? 'BC';

  const { data: activities, isLoading, refetch, isRefetching } = useActivities(
    userCity,
    selectedCategory,
  );

  const filtered = (activities ?? []).filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.provider.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🎯 KidQueue</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={Colors.primary} />
          <Text style={styles.subtitle}>{userCity}, {userProvince}</Text>
          <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search activities..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category pills — fixed-height wrapper prevents Android layout jank */}
      <View style={styles.categoryWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryPill,
                selectedCategory === cat.key && styles.categoryPillActive,
              ]}
              onPress={() => setSelectedCategory(cat.key)}
            >
              <Text style={styles.categoryPillIcon}>{cat.icon}</Text>
              <Text style={[
                styles.categoryPillText,
                selectedCategory === cat.key && styles.categoryPillTextActive,
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Activity list — flex:1 ensures it fills space so gaps don't appear above */}
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} size="large" />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{search ? '🔍' : '🌱'}</Text>
          <Text style={styles.emptyTitle}>
            {search ? 'No results found' : `Building ${userCity}…`}
          </Text>
          <Text style={styles.emptyText}>
            {search
              ? `No activities match "${search}"`
              : `We're still collecting activities for ${userCity}. You can kick things off by importing from a URL or adding one manually!`}
          </Text>
          {!search && (
            <>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/add')}
              >
                <Text style={styles.emptyButtonText}>➕  Add an Activity</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ActivityCard activity={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          style={styles.flatList}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
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
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  subtitle: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary },
  categoryWrapper: { height: 50, flexShrink: 0 },
  categoryRow: { paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center', height: 50 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    gap: 4,
    height: 36,
  },
  categoryPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryPillIcon: { fontSize: 13, lineHeight: 18 },
  categoryPillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, lineHeight: 18 },
  categoryPillTextActive: { color: Colors.white },
  flatList: { flex: 1 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  categoryLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  unverified: { fontSize: 11, color: Colors.textMuted },
  activityName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  provider: { fontSize: 14, color: Colors.textSecondary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 13, color: Colors.textMuted },
  metaDot: { color: Colors.textMuted, fontSize: 13 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
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
