/** Profil / réglages — minimal pour la V1 : infos, vie privée, déconnexion. */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { COLORS } from '../../lib/theme';
import { PrimaryButton } from '../../ui/components';

export function ProfileScreen() {
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

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
      <Text style={styles.title}>Ton espace 💛</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ta vie privée, notre priorité 🔒</Text>
        <Text style={styles.cardText}>
          • Tes messages privés sont chiffrés en base.{'\n'}
          • Ta position n'est jamais stockée précisément : elle est floutée à ~1 km avant
          enregistrement.{'\n'}
          • Le Mode Fantôme 👻 (onglet carte) te rend invisible instantanément.{'\n'}
          • Tu peux demander la suppression totale de ton compte et de tes données à tout moment.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sécurité du compte</Text>
        <Text style={styles.cardText}>
          Tu peux activer la double authentification (2FA) pour protéger ton compte — bientôt
          disponible directement ici.
        </Text>
      </View>

      <PrimaryButton label="Me déconnecter" onPress={handleLogout} loading={loggingOut} />

      <Text style={styles.version}>Mamaya · version de test 1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgSoft },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.ink, marginBottom: 18 },
  card: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  cardText: { fontSize: 14, color: COLORS.gray, lineHeight: 21 },
  version: { textAlign: 'center', color: COLORS.grayLight, fontSize: 12, marginTop: 24 },
});
