/** Connexion — héro dégradé + carte blanche ; gère l'étape 2FA (ticket + code). */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../lib/auth-context';
import { COLORS, GRADIENTS, RADIUS, SHADOW } from '../../lib/theme';
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
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Héro */}
        <LinearGradient
          colors={GRADIENTS.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.logoEmoji}>🤱</Text>
          <Text style={styles.logo}>Mamaya</Text>
          <Text style={styles.tagline}>Le réseau des mamans et futures mamans 💛</Text>
        </LinearGradient>

        {/* Carte */}
        <View style={[styles.card, SHADOW.card]}>
          <ErrorText message={error} />

          {twoFaTicket ? (
            <>
              <Text style={styles.paragraph}>
                Entre le code à 6 chiffres de ton application d'authentification.
              </Text>
              <TextField
                label="Code de vérification"
                icon="shield-checkmark"
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
                icon="mail"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="toi@exemple.fr"
              />
              <TextField
                label="Mot de passe"
                icon="lock-closed"
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bgSoft },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  hero: {
    paddingTop: 90,
    paddingBottom: 64,
    alignItems: 'center',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  logoEmoji: { fontSize: 44, marginBottom: 6 },
  logo: { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.92)', marginTop: 6 },
  card: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.xl,
    padding: 22,
    marginHorizontal: 20,
    marginTop: -34,
  },
  paragraph: { fontSize: 15, color: COLORS.ink, marginBottom: 16, lineHeight: 22 },
  link: { color: COLORS.rose, textAlign: 'center', marginTop: 18, fontWeight: '700' },
});
