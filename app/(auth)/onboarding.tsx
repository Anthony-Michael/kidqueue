import { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

const PROVINCES = ['BC', 'AB', 'ON', 'QC', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'NT', 'YT', 'NU'];

// Normalize full province names (Android) to abbreviations
const PROVINCE_ABBR: Record<string, string> = {
  'British Columbia': 'BC', 'Alberta': 'AB', 'Ontario': 'ON', 'Quebec': 'QC',
  'Manitoba': 'MB', 'Saskatchewan': 'SK', 'Nova Scotia': 'NS',
  'New Brunswick': 'NB', 'Newfoundland and Labrador': 'NL',
  'Prince Edward Island': 'PE', 'Northwest Territories': 'NT',
  'Yukon': 'YT', 'Nunavut': 'NU',
};

function normalizeProvince(region: string): string {
  return PROVINCE_ABBR[region] ?? region.substring(0, 2).toUpperCase();
}

export default function OnboardingScreen() {
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('BC');
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);

  const detectLocation = async () => {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access, or enter your city manually below.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync(pos.coords);
      if (geo?.city) setCity(geo.city);
      if (geo?.region) setProvince(normalizeProvince(geo.region));
    } catch {
      Alert.alert('Could not detect location', 'Please enter your city manually.');
    } finally {
      setDetecting(false);
    }
  };

  const handleContinue = async (skipCity = false) => {
    if (!skipCity && !city.trim()) {
      Alert.alert('City required', 'Enter your city so we can show local activities.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const finalCity = skipCity ? 'Port Coquitlam' : city.trim();
      const finalProvince = skipCity ? 'BC' : province;

      // Save to profile
      await supabase
        .from('profiles')
        .update({ city: finalCity, province: finalProvince })
        .eq('id', user.id);

      if (!skipCity) {
        // Trigger auto-discovery in background (don't block navigation)
        supabase.functions.invoke('discover-sources', {
          body: { city: finalCity, province: finalProvince },
        }).catch(() => {/* silent — daily cron will catch it */});
      }

      router.replace('/(tabs)/discover');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🗺️</Text>
          <Text style={styles.heroTitle}>Where are you?</Text>
          <Text style={styles.heroSub}>
            KidQueue finds kids programs near you — camps, swim lessons, arts, sports and more.
            Tell us your city and we'll do the rest.
          </Text>
        </View>

        {/* GPS button */}
        <TouchableOpacity
          style={[styles.gpsBtn, detecting && { opacity: 0.7 }]}
          onPress={detectLocation}
          disabled={detecting}
        >
          {detecting ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Ionicons name="locate" size={20} color={Colors.white} />
          )}
          <Text style={styles.gpsBtnText}>
            {detecting ? 'Detecting…' : 'Detect my location'}
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or enter manually</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Province picker */}
        <View style={styles.field}>
          <Text style={styles.label}>Province</Text>
          <View style={styles.provinceGrid}>
            {PROVINCES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.provinceChip, province === p && styles.provinceChipActive]}
                onPress={() => setProvince(p)}
              >
                <Text style={[styles.provinceChipText, province === p && styles.provinceChipTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* City input */}
        <View style={styles.field}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Port Coquitlam"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="words"
          />
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, saving && { opacity: 0.7 }]}
          onPress={() => handleContinue(false)}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="search" size={20} color={Colors.white} />
              <Text style={styles.ctaBtnText}>Find Activities Near Me</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity style={styles.skipBtn} onPress={() => handleContinue(true)}>
          <Text style={styles.skipText}>Skip for now (use Port Coquitlam)</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24, paddingBottom: 48 },
  hero: { alignItems: 'center', marginBottom: 32, marginTop: 16 },
  heroEmoji: { fontSize: 56, marginBottom: 12 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  heroSub: {
    fontSize: 15, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginTop: 8, maxWidth: 320,
  },
  gpsBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  gpsBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 10 },
  provinceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  provinceChip: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.card,
  },
  provinceChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  provinceChipText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  provinceChipTextActive: { color: Colors.white },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: Colors.textPrimary,
  },
  ctaBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10, marginTop: 8,
  },
  ctaBtnText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  skipBtn: { alignItems: 'center', marginTop: 20 },
  skipText: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' },
});
