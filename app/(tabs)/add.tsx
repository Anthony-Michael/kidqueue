import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSubmitActivity } from '../../hooks/useActivities';
import { supabase } from '../../lib/supabase';
import { Colors, CategoryColors } from '../../constants/Colors';
import { Category } from '../../types';

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'camps', label: 'Camps', icon: '⛺' },
  { key: 'sports', label: 'Sports', icon: '⚽' },
  { key: 'swim', label: 'Swim', icon: '🏊' },
  { key: 'arts', label: 'Arts', icon: '🎨' },
  { key: 'music', label: 'Music', icon: '🎵' },
  { key: 'stem', label: 'STEM', icon: '🔬' },
  { key: 'dance', label: 'Dance', icon: '💃' },
  { key: 'tutoring', label: 'Tutoring', icon: '📚' },
  { key: 'other', label: 'Other', icon: '✨' },
];

export default function AddActivityScreen() {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState<Category>('camps');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('Port Coquitlam');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [regDate, setRegDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [signupUrl, setSignupUrl] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const { mutate: submitActivity, isPending } = useSubmitActivity();

  const handleImportFromUrl = async () => {
    if (!importUrl.startsWith('http')) {
      Alert.alert('Invalid URL', 'Please enter a full URL starting with https://');
      return;
    }
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-url', {
        body: { url: importUrl },
      });
      if (error) throw error;
      const a = data?.activity;
      if (!a) throw new Error('Could not extract activity data from that page.');

      // Pre-fill the form
      if (a.name) setName(a.name);
      if (a.provider) setProvider(a.provider);
      if (a.category) setCategory(a.category as Category);
      if (a.description) setDescription(a.description);
      if (a.location) setLocation(a.location);
      if (a.city) setCity(a.city);
      if (a.age_min != null) setAgeMin(String(a.age_min));
      if (a.age_max != null) setAgeMax(String(a.age_max));
      if (a.registration_opens_at) setRegDate(a.registration_opens_at);
      if (a.activity_starts_at) setStartDate(a.activity_starts_at);
      if (a.signup_url) setSignupUrl(a.signup_url);
      setImportUrl('');
      Alert.alert('Imported! 🎉', 'Review the details below and make any corrections before submitting.');
    } catch (e: any) {
      Alert.alert('Import failed', e.message ?? 'Could not import from that URL. Try filling in manually.');
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = () => {
    if (!name || !provider || !location) {
      Alert.alert('Missing info', 'Please fill in Name, Provider, and Location at minimum.');
      return;
    }

    submitActivity(
      {
        name,
        provider,
        category,
        description,
        location,
        city,
        province: 'BC',
        age_min: ageMin ? parseInt(ageMin) : null,
        age_max: ageMax ? parseInt(ageMax) : null,
        registration_opens_at: regDate || null,
        activity_starts_at: startDate || null,
        activity_ends_at: null,
        signup_url: signupUrl || null,
      },
      {
        onSuccess: () => {
          Alert.alert(
            'Activity Submitted! 🎉',
            'Thanks for contributing! Your activity will appear once reviewed.',
            [{ text: 'OK', onPress: () => router.push('/(tabs)/discover') }],
          );
        },
        onError: (err) => {
          Alert.alert('Error', err.message);
        },
      },
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Add an Activity</Text>
            <Text style={styles.subtitle}>
              Help other Port Coquitlam parents by sharing local programs
            </Text>
          </View>

          {/* Import from URL */}
          <View style={styles.importBox}>
            <View style={styles.importHeader}>
              <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
              <Text style={styles.importTitle}>Import from URL</Text>
            </View>
            <Text style={styles.importSubtitle}>
              Paste any activity page link — we'll fill in the details automatically
            </Text>
            <View style={styles.importRow}>
              <TextInput
                style={styles.importInput}
                value={importUrl}
                onChangeText={setImportUrl}
                placeholder="https://www.portcoquitlam.ca/..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TouchableOpacity
                style={[styles.importBtn, importing && { opacity: 0.6 }]}
                onPress={handleImportFromUrl}
                disabled={importing}
              >
                {importing
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                }
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or fill in manually</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Activity Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Summer Swim Lessons"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Provider */}
          <View style={styles.field}>
            <Text style={styles.label}>Provider / Organization *</Text>
            <TextInput
              style={styles.input}
              value={provider}
              onChangeText={setProvider}
              placeholder="e.g. PoCo Rec Centre"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryChip,
                    category === cat.key && {
                      backgroundColor: CategoryColors[cat.key],
                      borderColor: CategoryColors[cat.key],
                    },
                  ]}
                  onPress={() => setCategory(cat.key)}
                >
                  <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                  <Text style={[
                    styles.categoryChipText,
                    category === cat.key && { color: Colors.white },
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.label}>Location / Address *</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. 2150 Wilson Ave, Port Coquitlam"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Age range */}
          <View style={styles.field}>
            <Text style={styles.label}>Age Range</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={ageMin}
                onChangeText={setAgeMin}
                placeholder="Min age"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
              />
              <Text style={styles.rangeSep}>to</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={ageMax}
                onChangeText={setAgeMax}
                placeholder="Max age"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Registration opens */}
          <View style={styles.field}>
            <Text style={styles.label}>Registration Opens</Text>
            <TextInput
              style={styles.input}
              value={regDate}
              onChangeText={setRegDate}
              placeholder="YYYY-MM-DD (e.g. 2025-06-01)"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.hint}>This is what triggers alerts for parents on the watchlist</Text>
          </View>

          {/* Activity start date */}
          <View style={styles.field}>
            <Text style={styles.label}>Activity Start Date</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Sign up URL */}
          <View style={styles.field}>
            <Text style={styles.label}>Sign-up URL</Text>
            <TextInput
              style={styles.input}
              value={signupUrl}
              onChangeText={setSignupUrl}
              placeholder="https://..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Any extra details parents should know..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, isPending && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isPending}
          >
            {isPending
              ? <ActivityIndicator color={Colors.white} />
              : (
                <View style={styles.submitBtnInner}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                  <Text style={styles.submitBtnText}>Submit Activity</Text>
                </View>
              )
            }
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Submissions are reviewed before going live. Thanks for helping the community!
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 13 },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rangeSep: { color: Colors.textSecondary, fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.card,
  },
  categoryChipIcon: { fontSize: 13 },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  disclaimer: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 16 },
  importBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    marginBottom: 4,
  },
  importHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  importTitle: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  importSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  importRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  importInput: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  importBtn: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
});
