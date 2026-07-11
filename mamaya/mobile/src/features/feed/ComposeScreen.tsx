/**
 * Nouveau post (texte). Après envoi, le contenu part en modération —
 * on l'explique clairement plutôt que de laisser croire à une publication ratée.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS } from '../../lib/theme';
import { ErrorText, PrimaryButton } from '../../ui/components';
import { feedApi } from './api';

export function ComposeScreen({ onDone }: { onDone: () => void }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePost = async () => {
    setError(null);
    setLoading(true);
    try {
      await feedApi.createPost(body.trim());
      setPosted(true);
    } catch {
      setError('Impossible de publier pour le moment. Réessaie dans un instant.');
    } finally {
      setLoading(false);
    }
  };

  if (posted) {
    return (
      <View style={styles.confirm}>
        <Text style={styles.confirmEmoji}>🌸</Text>
        <Text style={styles.confirmTitle}>C'est envoyé !</Text>
        <Text style={styles.confirmText}>
          Ton post est en cours de vérification par notre modération bienveillante. Il apparaîtra
          dans le fil d'ici quelques instants 💛
        </Text>
        <PrimaryButton label="Retour au fil" onPress={onDone} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Partage avec les mamans 💛</Text>
        <ErrorText message={error} />
        <TextInput
          style={styles.input}
          multiline
          value={body}
          onChangeText={setBody}
          placeholder="Une question, un doute, une victoire du jour… raconte !"
          placeholderTextColor={COLORS.grayLight}
          maxLength={5000}
          autoFocus
        />
        <Text style={styles.counter}>{body.length}/5000</Text>
        <PrimaryButton
          label="Publier"
          onPress={handlePost}
          loading={loading}
          disabled={body.trim().length === 0}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.ink, marginBottom: 16 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    lineHeight: 23,
    color: COLORS.ink,
    textAlignVertical: 'top',
  },
  counter: { textAlign: 'right', color: COLORS.grayLight, fontSize: 12, marginVertical: 8 },
  confirm: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: COLORS.bg },
  confirmEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmText: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
});
