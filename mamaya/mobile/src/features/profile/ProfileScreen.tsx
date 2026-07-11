/** Profil — vraies infos (/v1/me), rappels vie privée, déconnexion. */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth-context';
import { COLORS, GRADIENTS, RADIUS, SHADOW } from '../../lib/theme';
import { Avatar, PrimaryButton } from '../../ui/components';
import { Me, meApi, STATUS_LABELS } from './api';

export function ProfileScreen() {
  const { logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    meApi.getMe().then(setMe).catch(() => {});
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* En-tête identité */}
      <LinearGradient
        colors={GRADIENTS.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.identity, SHADOW.card]}
      >
        <Avatar name={me?.displayName ?? '…'} seed={me?.id ?? 'moi'} size={72} />
        <Text style={styles.name}>{me?.displayName ?? 'Chargement…'}</Text>
        {me ? (
          <View style={styles.statusChip}>
            <Text style={styles.statusText}>{STATUS_LABELS[me.status]}</Text>
          </View>
        ) : null}
        {me?.cityLabel ? (
          <Text style={styles.city}>
            <Ionicons name="location" size={12} color="rgba(255,255,255,0.9)" /> {me.cityLabel}
          </Text>
        ) : null}
      </LinearGradient>

      <View style={[styles.card, SHADOW.card]}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="lock-closed" size={18} color={COLORS.rose} />
          <Text style={styles.cardTitle}>Ta vie privée, notre priorité</Text>
        </View>
        <Text style={styles.cardText}>
          • Tes messages privés sont chiffrés en base.{'\n'}
          • Ta position n'est jamais stockée précisément : floutée à ~1 km avant
          enregistrement.{'\n'}
          • Le Mode Fantôme 👻 (onglet Autour de moi) te rend invisible instantanément.{'\n'}
          • Tu peux demander la suppression totale de ton compte et de tes données à tout moment.
        </Text>
      </View>

      <View style={[styles.card, SHADOW.card]}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="shield-checkmark" size={18} color={COLORS.rose} />
          <Text style={styles.cardTitle}>Sécurité du compte</Text>
        </View>
        <Text style={styles.cardText}>
          Tu peux activer la double authentification (2FA) pour protéger ton compte — bientôt
          disponible directement ici.
        </Text>
      </View>

      <PrimaryButton
        label="Me déconnecter"
        icon="log-out"
        onPress={handleLogout}
        loading={loggingOut}
      />

      <Text style={styles.version}>Mamaya · version de test 1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgSoft },
  content: { padding: 20, paddingTop: 24, paddingBottom: 48 },
  identity: {
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    padding: 24,
    marginBottom: 16,
  },
  name: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 12 },
  statusChip: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 8,
  },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  city: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 8 },
  card: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 14,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
  cardText: { fontSize: 14, color: COLORS.gray, lineHeight: 21 },
  version: { textAlign: 'center', color: COLORS.grayLight, fontSize: 12, marginTop: 24 },
});
