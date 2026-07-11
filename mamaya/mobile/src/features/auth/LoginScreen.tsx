/** Connexion — gère aussi l'étape 2FA (ticket + code TOTP) si activée. */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { COLORS } from '../../lib/theme';
import { ErrorText, PrimaryButton, TextField } from '../../ui/components';

export function LoginScreen({ onShowRegister }: { onShowRegister: () => void }) {
  const { login, verifyTwoFactor } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaTicket, setTwoFaTicket] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res.twoFactorRequired) setTwoFaTicket(res.ticket);
    } catch {
      // Message uniforme côté serveur (anti-énumération) — on reste vague aussi.
      setError('Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!twoFaTicket) return;
    setError(null);
    setLoading(true);
    try {
      await verifyTwoFactor(twoFaTicket, code.trim());
    } catch {
      setError('Code invalide ou expiré. Réessaie 💛');
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
        <Text style={styles.logo}>Mamaya 💛</Text>
        <Text style={styles.tagline}>Le réseau des mamans et futures mamans</Text>

        <ErrorText message={error} />

        {twoFaTicket ? (
          <>
            <Text style={styles.paragraph}>
              Entre le code à 6 chiffres de ton application d'authentification.
            </Text>
            <TextField
              label="Code de vérification"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={10}
              autoFocus
            />
            <PrimaryButton label="Vérifier" onPress={handleVerify} loading={loading} />
            <Pressable onPress={() => setTwoFaTicket(null)}>
              <Text style={styles.link}>← Revenir à la connexion</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="toi@exemple.fr"
            />
            <TextField
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••••••"
            />
            <PrimaryButton
              label="Me connecter"
              onPress={handleLogin}
              loading={loading}
              disabled={!email || !password}
            />
            <Pressable onPress={onShowRegister}>
              <Text style={styles.link}>Pas encore de compte ? Rejoins-nous 💛</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.roseBg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 34, fontWeight: '800', color: COLORS.rose, textAlign: 'center' },
  tagline: { fontSize: 15, color: COLORS.gray, textAlign: 'center', marginBottom: 28 },
  paragraph: { fontSize: 15, color: COLORS.ink, marginBottom: 16, lineHeight: 22 },
  link: { color: COLORS.rose, textAlign: 'center', marginTop: 18, fontWeight: '600' },
});
