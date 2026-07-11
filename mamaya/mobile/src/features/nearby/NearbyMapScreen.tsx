/**
 * « Mamans autour de moi » 🗺️ — vue RADAR maison (pas de carte native :
 * react-native-maps ne fonctionne pas dans Expo Go, et le serveur ne renvoie
 * de toute façon jamais de coordonnées, seulement des distances arrondies).
 *
 * Garanties de confidentialité, par construction :
 *  - consentement RGPD 'geoloc' explicite, tracé côté serveur AVANT tout envoi ;
 *  - la position exacte ne quitte le téléphone que vers PUT /v1/me/location,
 *    où le serveur la FLOUTE (~1 km) avant stockage ;
 *  - le Mode Fantôme 👻 coupe la visibilité immédiatement, côté serveur ;
 *  - k-anonymat : en zone peu dense (< 5 mamans), le serveur ne montre personne.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../../lib/theme';
import { Avatar, ErrorText, PrimaryButton } from '../../ui/components';
import { chatApi } from '../chat/api';
import { nearbyApi, NearbyMom } from './api';

const RADIUS_OPTIONS_KM = [2, 5, 10, 25] as const;
const REFRESH_MS = 60_000;
const POSITION_TIMEOUT_MS = 10_000;

type ScreenState =
  | { step: 'consent' }
  | { step: 'denied' }
  | { step: 'loading' }
  | { step: 'error'; message: string }
  | { step: 'ready' };

export function NearbyMapScreen() {
  const navigation = useNavigation<any>();
  const [state, setState] = useState<ScreenState>({ step: 'consent' });
  const [ghostMode, setGhostMode] = useState(false);
  const [radiusKm, setRadiusKm] = useState<(typeof RADIUS_OPTIONS_KM)[number]>(10);
  const [moms, setMoms] = useState<NearbyMom[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Activation : consentement serveur → permission OS → position (avec délai
   * maxi + repli sur la dernière connue) → envoi. Chaque étape peut échouer :
   * on n'affiche JAMAIS un chargement infini, toujours un état explicite.
   */
  const handleConsent = useCallback(async () => {
    setState({ step: 'loading' });
    try {
      await nearbyApi.grantConsent();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState({ step: 'denied' });
        return;
      }

      let pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), POSITION_TIMEOUT_MS)),
      ]);
      pos = pos ?? (await Location.getLastKnownPositionAsync());
      if (!pos) {
        setState({
          step: 'error',
          message: 'Impossible de récupérer ta position. Vérifie que le GPS est activé, puis réessaie.',
        });
        return;
      }

      await nearbyApi.updateMyLocation(pos.coords.latitude, pos.coords.longitude);
      setState({ step: 'ready' });
    } catch {
      setState({
        step: 'error',
        message: 'Petit souci de connexion avec le serveur. Réessaie dans un instant 💛',
      });
    }
  }, []);

  const refreshNearby = useCallback(async () => {
    if (state.step !== 'ready' || ghostMode) return;
    setRefreshing(true);
    try {
      const { data } = await nearbyApi.getNearby({ radiusKm });
      setMoms(data);
    } catch {
      // silencieux : le prochain rafraîchissement retentera
    } finally {
      setRefreshing(false);
    }
  }, [state.step, ghostMode, radiusKm]);

  useEffect(() => {
    refreshNearby();
    const timer = setInterval(refreshNearby, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshNearby]);

  /** Mode Fantôme — effet serveur immédiat, UI optimiste avec rollback. */
  const toggleGhostMode = useCallback(async (enabled: boolean) => {
    setGhostMode(enabled);
    if (enabled) setMoms([]);
    try {
      await nearbyApi.setGhostMode(enabled);
    } catch {
      setGhostMode(!enabled);
    }
  }, []);

  /** Ouvre (ou retrouve) le DM avec une maman et navigue vers la conversation. */
  const sayHello = useCallback(
    async (mom: NearbyMom) => {
      try {
        const conv = await chatApi.openDm(mom.userId);
        navigation.navigate('Conversation', {
          conversationId: conv.id,
          title: mom.displayName,
        });
      } catch {
        // DM impossible (blocage…) : on n'affiche rien de bruyant
      }
    },
    [navigation],
  );

  // ---- États préalables ------------------------------------------------------

  if (state.step === 'consent' || state.step === 'denied' || state.step === 'error') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.centered}>
        <View style={[styles.introCard, SHADOW.card]}>
          <View style={styles.introIcon}>
            <Ionicons name="location" size={34} color={COLORS.rose} />
          </View>
          <Text style={styles.title}>Mamans autour de toi 💛</Text>
          {state.step === 'error' ? <ErrorText message={state.message} /> : null}
          {state.step === 'denied' ? (
            <Text style={styles.paragraph}>
              Pas de souci 💛 Tu peux autoriser la localisation plus tard dans les réglages de
              ton téléphone, puis revenir ici.
            </Text>
          ) : (
            <Text style={styles.paragraph}>
              Pour te montrer les mamans proches, ta position est utilisée de façon{' '}
              <Text style={styles.bold}>approximative</Text> : floutée à ~1 km avant d'être
              enregistrée. Personne ne voit jamais où tu es exactement, et le Mode Fantôme 👻 te
              rend invisible à tout moment.
            </Text>
          )}
          <PrimaryButton
            label={state.step === 'consent' ? 'Activer autour de moi' : 'Réessayer'}
            icon="navigate"
            onPress={handleConsent}
          />
          <Text style={styles.hint}>Tu peux retirer ton accord à tout moment. 🔒</Text>
        </View>
      </ScrollView>
    );
  }

  if (state.step === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.loadingEmoji}>📡</Text>
        <Text style={styles.paragraph}>On cherche les mamans autour de toi…</Text>
      </View>
    );
  }

  // ---- Radar -------------------------------------------------------------------

  return (
    <ScrollView
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshNearby} />}
    >
      {/* Mode Fantôme */}
      <View style={[styles.ghostBar, SHADOW.card]}>
        <Ionicons
          name={ghostMode ? 'eye-off' : 'eye'}
          size={20}
          color={ghostMode ? COLORS.lavande : COLORS.rose}
        />
        <Text style={styles.ghostLabel}>
          {ghostMode ? 'Mode Fantôme 👻 — invisible' : 'Visible par les mamans proches'}
        </Text>
        <Switch
          value={ghostMode}
          onValueChange={toggleGhostMode}
          trackColor={{ true: COLORS.lavande, false: COLORS.border }}
          accessibilityLabel="Mode Fantôme"
        />
      </View>

      {/* Rayon */}
      <View style={styles.radiusRow}>
        {RADIUS_OPTIONS_KM.map((km) => (
          <Pressable
            key={km}
            onPress={() => setRadiusKm(km)}
            style={[styles.radiusChip, radiusKm === km && styles.radiusChipActive]}
          >
            <Text style={radiusKm === km ? styles.radiusTextActive : styles.radiusText}>
              {km} km
            </Text>
          </Pressable>
        ))}
      </View>

      <Radar moms={ghostMode ? [] : moms} radiusKm={radiusKm} />

      {/* Liste */}
      {ghostMode ? (
        <Text style={styles.emptyText}>
          Tu es invisible — désactive le Mode Fantôme pour voir les mamans autour de toi 👻
        </Text>
      ) : moms.length === 0 ? (
        <Text style={styles.emptyText}>
          Pas encore assez de mamans par ici 💛{'\n'}
          (On n'affiche personne en dessous de 5 mamans dans la zone, pour protéger la vie privée
          de chacune.)
        </Text>
      ) : (
        moms.map((mom) => (
          <View key={mom.userId} style={[styles.momRow, SHADOW.card]}>
            <Avatar name={mom.displayName} seed={mom.userId} size={44} />
            <View style={styles.momInfo}>
              <Text style={styles.momName}>{mom.displayName}</Text>
              <Text style={styles.momDistance}>à environ {mom.distanceKm} km</Text>
            </View>
            <Pressable style={styles.helloBtn} onPress={() => sayHello(mom)}>
              <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
              <Text style={styles.helloText}>Coucou</Text>
            </Pressable>
          </View>
        ))
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

/**
 * Radar : anneaux concentriques + points placés à un angle stable par maman
 * (dérivé de son id) et à un rayon proportionnel à la distance. Honnête par
 * construction : « à ~N km dans la zone », jamais une position précise.
 */
function Radar({ moms, radiusKm }: { moms: NearbyMom[]; radiusKm: number }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 32, 340);
  const center = size / 2;

  const dots = useMemo(
    () =>
      moms.map((mom) => {
        const angle = (hashCode(mom.userId) % 360) * (Math.PI / 180);
        const r = Math.min(mom.distanceKm / radiusKm, 0.92) * (center - 30);
        return {
          mom,
          x: center + r * Math.cos(angle),
          y: center + r * Math.sin(angle),
        };
      }),
    [moms, radiusKm, center],
  );

  return (
    <View style={[styles.radar, { width: size, height: size, borderRadius: size / 2 }]}>
      {[0.33, 0.66, 1].map((f) => (
        <View
          key={f}
          style={[
            styles.ring,
            {
              width: size * f,
              height: size * f,
              borderRadius: (size * f) / 2,
              left: center - (size * f) / 2,
              top: center - (size * f) / 2,
            },
          ]}
        />
      ))}
      {/* Moi, au centre */}
      <View style={[styles.me, { left: center - 14, top: center - 14 }]}>
        <Ionicons name="heart" size={16} color="#fff" />
      </View>
      {dots.map(({ mom, x, y }) => (
        <View key={mom.userId} style={{ position: 'absolute', left: x - 14, top: y - 14 }}>
          <Avatar name={mom.displayName} seed={mom.userId} size={28} />
        </View>
      ))}
      <Text style={styles.radarLabel}>{radiusKm} km</Text>
    </View>
  );
}

/** Hash stable 32 bits (angle d'affichage par utilisatrice). */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgSoft },
  centered: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  introCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.xl,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: COLORS.gray,
    marginBottom: 14,
  },
  bold: { fontWeight: '700', color: COLORS.ink },
  hint: { marginTop: 12, fontSize: 12, color: COLORS.grayLight, textAlign: 'center' },
  loadingEmoji: { fontSize: 42, marginBottom: 10 },
  ghostBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 16,
    marginBottom: 8,
  },
  ghostLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.ink },
  radiusRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  radiusChip: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  radiusChipActive: { backgroundColor: COLORS.rose, borderColor: COLORS.rose },
  radiusText: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
  radiusTextActive: { fontSize: 13, color: '#fff', fontWeight: '800' },
  radar: {
    alignSelf: 'center',
    backgroundColor: COLORS.roseSoft,
    marginVertical: 8,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(233, 83, 143, 0.25)',
  },
  me: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.rose,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...SHADOW.fab,
  },
  radarLabel: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.rose,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.gray,
    fontSize: 14,
    lineHeight: 21,
    padding: 24,
  },
  momRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
  },
  momInfo: { marginLeft: 12, flex: 1 },
  momName: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  momDistance: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  helloBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.rose,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  helloText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
