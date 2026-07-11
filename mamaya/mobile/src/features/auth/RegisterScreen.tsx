/**
 * Inscription — le statut « enceinte » est une donnée de santé (art. 9 RGPD) :
 * la case de consentement dédiée est requise en plus des CGU.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../../lib/api-client';
import { useAuth, UserStatus } from '../../lib/auth-context';
import { COLORS } from '../../lib/theme';
import { ErrorText, PrimaryButton, TextField } from '../../ui/components';

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: 'maman', label: 'Maman 🤱' },
  { value: 'enceinte', label: 'Enceinte 🤰' },
  { value: 'essai_bebe', label: 'En essai bébé ✨' },
];

export function RegisterScreen({ onShowLogin }: { onShowLogin: () => void }) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<UserStatus>('maman');
  const [dueDate, setDueDate] = useState('');
  const [cityLabel, setCityLabel] = useState('');
  const [cguAccepted, setCguAccepted] = useState(false);
  const [healthConsent, setHealthConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPregnant = status === 'enceinte';
  const canSubmit =
    email.length > 0 &&
    password.length >= 12 &&
    displayName.length >= 2 &&
    cguAccepted &&
    (!isPregnant || (dueDate.length === 10 && healthConsent));

  const handleRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        status,
        ...(isPregnant ? { dueDate } : {}),
        ...(cityLabel.trim() ? { cityLabel: cityLabel.trim() } : {}),
      });
      // Succès → l'AuthProvider bascule l'app sur les onglets, rien à faire ici.
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Un compte existe déjà avec cet email.'
          : e instanceof ApiError
            ? e.message
            : 'Impossible de créer le compte. Vérifie ta connexion.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Bienvenue chez Mamaya 💛</Text>
        <Text style={styles.subtitle}>Crée ton compte en 1 minute</Text>

        <ErrorText message={error} />

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="toi@exemple.fr"
        />
        <TextField
          label="Mot de passe (12 caractères minimum)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="une phrase facile à retenir"
        />
        <TextField
          label="Ton pseudo"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={30}
          placeholder="ex. Sarah, maman de Léo"
        />

        <Text style={styles.label}>Tu es…</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setStatus(opt.value)}
              style={[styles.chip, status === opt.value && styles.chipActive]}
            >
              <Text style={status === opt.value ? styles.chipTextActive : styles.chipText}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {isPregnant && (
          <TextField
            label="Date prévue d'accouchement (AAAA-MM-JJ)"
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="2026-11-15"
            maxLength={10}
            autoCapitalize="none"
          />
        )}

        <TextField
          label="Ta ville (optionnel)"
          value={cityLabel}
          onChangeText={setCityLabel}
          placeholder="ex. Lyon"
        />

        <View style={styles.consentRow}>
          <Switch value={cguAccepted} onValueChange={setCguAccepted} />
          <Text style={styles.consentText}>J'accepte les Conditions Générales d'Utilisation.</Text>
        </View>

        {isPregnant && (
          <View style={styles.consentRow}>
            <Switch value={healthConsent} onValueChange={setHealthConsent} />
            <Text style={styles.consentText}>
              J'accepte que Mamaya traite ma grossesse (donnée de santé) pour personnaliser mon
              expérience. Révocable à tout moment.
            </Text>
          </View>
        )}

        <PrimaryButton
          label="Créer mon compte"
          onPress={handleRegister}
          loading={loading}
          disabled={!canSubmit}
        />
        <Pressable onPress={onShowLogin}>
          <Text style={styles.link}>J'ai déjà un compte → me connecter</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.roseBg },
  container: { flexGrow: 1, padding: 24, paddingTop: 64, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.rose },
  subtitle: { fontSize: 15, color: COLORS.gray, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.ink, marginBottom: 8 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: COLORS.rose, borderColor: COLORS.rose },
  chipText: { color: COLORS.ink, fontSize: 14 },
  chipTextActive: { color: '#fff', fontSize: 14, fontWeight: '700' },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  consentText: { flex: 1, fontSize: 13, color: COLORS.gray, lineHeight: 18 },
  link: { color: COLORS.rose, textAlign: 'center', marginTop: 18, fontWeight: '600' },
});
