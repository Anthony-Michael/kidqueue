import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';
import { Kid, Profile } from '../../types';

function KidCard({ kid, onRemove }: { kid: Kid; onRemove: () => void }) {
  const age = new Date().getFullYear() - kid.birth_year;
  return (
    <View style={styles.kidCard}>
      <View style={styles.kidAvatar}>
        <Text style={styles.kidAvatarText}>{kid.name[0].toUpperCase()}</Text>
      </View>
      <View style={styles.kidInfo}>
        <Text style={styles.kidName}>{kid.name}</Text>
        <Text style={styles.kidAge}>{age} years old · Born {kid.birth_year}</Text>
      </View>
      <TouchableOpacity onPress={onRemove}>
        <Ionicons name="trash-outline" size={20} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kids, setKids] = useState<Kid[]>([]);
  const [kidName, setKidName] = useState('');
  const [kidYear, setKidYear] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('kids').select('*').eq('user_id', user.id).order('created_at'),
    ]).then(([profileRes, kidsRes]) => {
      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (kidsRes.data) setKids(kidsRes.data as Kid[]);
      setLoading(false);
    });
  }, [user]);

  const addKid = async () => {
    if (!kidName || !kidYear) {
      Alert.alert('Missing info', 'Enter your child\'s name and birth year.');
      return;
    }
    const year = parseInt(kidYear);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < currentYear - 18 || year > currentYear) {
      Alert.alert('Invalid year', 'Please enter a valid birth year.');
      return;
    }

    const { data, error } = await supabase
      .from('kids')
      .insert({ user_id: user!.id, name: kidName, birth_year: year })
      .select()
      .single();

    if (error) { Alert.alert('Error', error.message); return; }
    setKids((prev) => [...prev, data as Kid]);
    setKidName('');
    setKidYear('');
  };

  const removeKid = async (kid: Kid) => {
    Alert.alert('Remove Child', `Remove ${kid.name} from your profile?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await supabase.from('kids').delete().eq('id', kid.id);
          setKids((prev) => prev.filter((k) => k.id !== kid.id));
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* User info */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.full_name ?? user?.email ?? '?')[0].toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.userName}>{profile?.full_name ?? 'Parent'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.userLocation}>
              <Ionicons name="location-outline" size={12} /> {profile?.city}, {profile?.province}
            </Text>
          </View>
        </View>

        {/* Kids */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Children</Text>
          <Text style={styles.sectionSub}>
            Add your kids so we can surface age-appropriate activities
          </Text>

          {kids.map((kid) => (
            <KidCard key={kid.id} kid={kid} onRemove={() => removeKid(kid)} />
          ))}

          <View style={styles.addKidForm}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={kidName}
              onChangeText={setKidName}
              placeholder="Child's name"
              placeholderTextColor={Colors.textMuted}
            />
            <TextInput
              style={[styles.input, { width: 100 }]}
              value={kidYear}
              onChangeText={setKidYear}
              placeholder="Birth year"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
            />
            <TouchableOpacity style={styles.addKidBtn} onPress={addKid}>
              <Ionicons name="add" size={22} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.infoCard}>
            <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              You'll get a push alert 3 days before registration opens, and again on the day it opens — for every activity on your watchlist.
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Contributions</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{kids.length}</Text>
              <Text style={styles.statLabel}>Children</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>–</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>–</Text>
              <Text style={styles.statLabel}>Submitted</Text>
            </View>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48, gap: 24 },
  userCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  userName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  userEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  userLocation: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  sectionSub: { fontSize: 13, color: Colors.textSecondary, marginTop: -6 },
  kidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  kidAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  kidAvatarText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  kidInfo: { flex: 1 },
  kidName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  kidAge: { fontSize: 13, color: Colors.textSecondary },
  addKidForm: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  addKidBtn: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 12,
    padding: 14, alignItems: 'center', gap: 4,
  },
  statNum: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  signOutText: { color: Colors.error, fontSize: 15, fontWeight: '700' },
});
