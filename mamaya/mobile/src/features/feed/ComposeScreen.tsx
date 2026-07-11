/**
 * Nouveau post : texte + photos (4 max, galerie).
 * Le bouton Publier vit dans une barre FIXE en haut — jamais caché par le
 * clavier. Un tap hors du champ ferme le clavier.
 */
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../../lib/theme';
import { ErrorText, PrimaryButton } from '../../ui/components';
import { feedApi } from './api';

const MAX_PHOTOS = 4;

interface PickedPhoto {
  uri: string;      // aperçu local
  base64: string;   // contenu à envoyer
  mime: string;
}

export function ComposeScreen({ onDone }: { onDone: () => void }) {
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [loading, setLoading] = useState(false);

  const canPost = (body.trim().length > 0 || photos.length > 0) && !loading;

  const pickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photos', "Autorise l'accès à tes photos dans les réglages pour en ajouter 💛");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.6, // compression : limite serveur 5 Mo/photo
      base64: true,
    });
    if (result.canceled) return;
    const picked = result.assets
      .filter((a) => a.base64)
      .map((a) => ({
        uri: a.uri,
        base64: a.base64 as string,
        mime: a.mimeType ?? 'image/jpeg',
      }));
    setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

  const handlePost = async () => {
    Keyboard.dismiss();
    setError(null);
    setLoading(true);
    try {
      const keys: string[] = [];
      for (const photo of photos) {
        keys.push(await feedApi.uploadPhoto(photo.mime, photo.base64));
      }
      await feedApi.createPost(body.trim(), keys);
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
      {/* Barre fixe : fermer / titre / PUBLIER — toujours visible, clavier ou pas */}
      <View style={styles.topBar}>
        <Pressable onPress={onDone} hitSlop={12}>
          <Ionicons name="close" size={26} color={COLORS.ink} />
        </Pressable>
        <Text style={styles.topTitle}>Nouveau post</Text>
        <Pressable
          onPress={handlePost}
          disabled={!canPost}
          style={[styles.publishBtn, !canPost && { opacity: 0.4 }]}
        >
          <Text style={styles.publishText}>{loading ? 'Envoi…' : 'Publier'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ErrorText message={error} />

        <TextInput
          style={styles.input}
          multiline
          value={body}
          onChangeText={setBody}
          placeholder="Une question, un doute, une victoire du jour… raconte ! 💛"
          placeholderTextColor={COLORS.grayLight}
          maxLength={5000}
        />

        {/* Aperçus des photos choisies */}
        {photos.length > 0 && (
          <View style={styles.photoRow}>
            {photos.map((photo) => (
              <View key={photo.uri} style={styles.photoWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <Pressable style={styles.photoRemove} onPress={() => removePhoto(photo.uri)}>
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Zone tapable : ferme le clavier */}
        <Pressable style={styles.dismissZone} onPress={Keyboard.dismiss} />
      </ScrollView>

      {/* Barre d'outils : ajouter des photos */}
      <View style={styles.toolbar}>
        <Pressable
          style={[styles.toolBtn, photos.length >= MAX_PHOTOS && { opacity: 0.4 }]}
          onPress={pickPhotos}
          disabled={photos.length >= MAX_PHOTOS}
        >
          <Ionicons name="image" size={20} color={COLORS.rose} />
          <Text style={styles.toolText}>
            Photo {photos.length > 0 ? `(${photos.length}/${MAX_PHOTOS})` : ''}
          </Text>
        </Pressable>
        <Text style={styles.counter}>{body.length}/5000</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  topTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  publishBtn: {
    backgroundColor: COLORS.rose,
    borderRadius: RADIUS.full,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  publishText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  content: { padding: 16, flexGrow: 1 },
  input: {
    minHeight: 130,
    fontSize: 16,
    lineHeight: 23,
    color: COLORS.ink,
    textAlignVertical: 'top',
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  photoWrap: { position: 'relative' },
  photo: { width: 82, height: 82, borderRadius: RADIUS.md, backgroundColor: COLORS.field },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissZone: { flex: 1, minHeight: 60 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.roseSoft,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toolText: { color: COLORS.rose, fontWeight: '700', fontSize: 14 },
  counter: { color: COLORS.grayLight, fontSize: 12 },
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
