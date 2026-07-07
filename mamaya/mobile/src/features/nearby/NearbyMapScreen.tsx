import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { nearbyApi, NearbyMom } from './api';

/**
 * « Mamans autour de moi » 🗺️
 *
 * Garanties de confidentialité, par construction :
 *  - la position exacte ne quitte le téléphone que vers PUT /v1/me/location,
 *    où le serveur la FLOUTE (~1 km) avant tout stockage ;
 *  - l'API ne renvoie JAMAIS les coordonnées des autres mamans : la carte
 *    n'affiche que des zones (cercles) positionnées approximativement autour
 *    de MOI à partir de la distance arrondie — pas de pins précis ;
 *  - le Mode Fantôme 👻 coupe la visibilité immédiatement, côté serveur.
 */

const RADIUS_OPTIONS_KM = [2, 5, 10, 25] as const;
const REFRESH_MS = 60_000;

type ScreenState =
  | { step: 'consent' }          // opt-in explicite avant toute demande de permission
  | { step: 'denied' }           // permission OS refusée
  | { step: 'loading' }
  | { step: 'ready'; center: { latitude: number; longitude: number } };

export function NearbyMapScreen() {
  const [state, setState] = useState<ScreenState>({ step: 'consent' });
  const [ghostMode, setGhostMode] = useState(false);
  const [radiusKm, setRadiusKm] = useState<(typeof RADIUS_OPTIONS_KM)[number]>(10);
  const [moms, setMoms] = useState<NearbyMom[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  /** L'utilisatrice accepte explicitement le partage de position (opt-in RGPD). */
  const handleConsent = useCallback(async () => {
    setState({ step: 'loading' });
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setState({ step: 'denied' });
      return;
    }
    // Précision "Balanced" suffit : le serveur floute de toute façon à ~1 km.
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await nearbyApi.updateMyLocation(pos.coords.latitude, pos.coords.longitude);
    setState({
      step: 'ready',
      center: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
    });
  }, []);

  const refreshNearby = useCallback(async () => {
    if (state.step !== 'ready' || ghostMode) return;
    setRefreshing(true);
    try {
      const { data } = await nearbyApi.getNearby({ radiusKm });
      setMoms(data);
    } finally {
      setRefreshing(false);
    }
  }, [state.step, ghostMode, radiusKm]);

  useEffect(() => {
    refreshNearby();
    const timer = setInterval(refreshNearby, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshNearby]);

  /** Bascule du Mode Fantôme — effet serveur immédiat, UI optimiste avec rollback. */
  const toggleGhostMode = useCallback(async (enabled: boolean) => {
    setGhostMode(enabled);
    if (enabled) setMoms([]); // je ne vois plus / on ne me voit plus : symétrique
    try {
      await nearbyApi.setGhostMode(enabled);
    } catch {
      setGhostMode(!enabled); // rollback si l'appel échoue
    }
  }, []);

  /**
   * Zones d'affichage : le serveur ne donnant qu'une distance arrondie,
   * on répartit les cercles sur un anneau autour de moi, à un angle stable
   * par personne (dérivé de son id) → la carte reste honnête : « à ~N km »,
   * jamais « ici précisément ».
   */
  const zones = useMemo(() => {
    if (state.step !== 'ready') return [];
    return moms.map((mom) => {
      const angle = (hashCode(mom.userId) % 360) * (Math.PI / 180);
      const dLat = (mom.distanceKm / 111) * Math.cos(angle);
      const dLng =
        (mom.distanceKm / (111 * Math.cos((state.center.latitude * Math.PI) / 180))) *
        Math.sin(angle);
      return {
        mom,
        center: {
          latitude: state.center.latitude + dLat,
          longitude: state.center.longitude + dLng,
        },
      };
    });
  }, [moms, state]);

  // ---- Écrans d'état -------------------------------------------------------

  if (state.step === 'consent') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Mamans autour de moi 💛</Text>
        <Text style={styles.paragraph}>
          Pour te montrer les mamans proches, on utilise ta position de façon{' '}
          <Text style={styles.bold}>approximative</Text> : elle est floutée à ~1 km
          avant d'être enregistrée, personne ne voit jamais où tu es exactement,
          et tu peux devenir invisible à tout moment avec le Mode Fantôme 👻.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={handleConsent}>
          <Text style={styles.primaryBtnText}>Activer la carte</Text>
        </Pressable>
        <Text style={styles.hint}>Tu peux retirer ton accord à tout moment dans Réglages.</Text>
      </View>
    );
  }

  if (state.step === 'denied') {
    return (
      <View style={styles.centered}>
        <Text style={styles.paragraph}>
          Pas de souci 💛 Tu peux autoriser la localisation plus tard dans les
          réglages de ton téléphone si tu changes d'avis.
        </Text>
      </View>
    );
  }

  if (state.step === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ---- Carte ---------------------------------------------------------------

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          ...state.center,
          latitudeDelta: radiusKm / 40,
          longitudeDelta: radiusKm / 40,
        }}
        showsUserLocation={!ghostMode}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {!ghostMode &&
          zones.map(({ mom, center }) => (
            <Circle
              key={mom.userId}
              center={center}
              radius={1200} // zone ~1 km : cohérent avec le floutage serveur
              strokeColor="rgba(217, 70, 160, 0.55)"
              fillColor="rgba(217, 70, 160, 0.18)"
            />
          ))}
      </MapView>

      {/* Bandeau Mode Fantôme */}
      <View style={styles.ghostBar}>
        <Text style={styles.ghostLabel}>
          {ghostMode ? 'Mode Fantôme activé 👻 — tu es invisible' : 'Visible par les mamans proches'}
        </Text>
        <Switch
          value={ghostMode}
          onValueChange={toggleGhostMode}
          accessibilityLabel="Mode Fantôme"
        />
      </View>

      {/* Filtres de rayon */}
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

      {/* Liste des mamans (distance approximative uniquement) */}
      {ghostMode ? null : moms.length === 0 && !refreshing ? (
        <View style={styles.emptyCard}>
          <Text style={styles.paragraph}>Pas encore assez de mamans par ici 💛</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={moms}
          keyExtractor={(m) => m.userId}
          renderItem={({ item }) => (
            <View style={styles.momRow}>
              <Image
                source={item.avatarUrl ? { uri: item.avatarUrl } : require('./avatar-default.png')}
                style={styles.avatar}
              />
              <View style={styles.momInfo}>
                <Text style={styles.momName}>{item.displayName}</Text>
                <Text style={styles.momDistance}>à environ {item.distanceKm} km</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

/** Hash stable 32 bits (angle d'affichage par utilisatrice). */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const ROSE = '#D946A0';

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  paragraph: { fontSize: 15, lineHeight: 22, textAlign: 'center', color: '#374151' },
  bold: { fontWeight: '700' },
  hint: { marginTop: 12, fontSize: 12, color: '#6B7280' },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: ROSE,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 100,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ghostBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ghostLabel: { fontSize: 13, fontWeight: '600', color: '#111827', flexShrink: 1 },
  radiusRow: {
    position: 'absolute',
    top: 64,
    left: 12,
    flexDirection: 'row',
    gap: 8,
  },
  radiusChip: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  radiusChipActive: { backgroundColor: ROSE },
  radiusText: { fontSize: 13, color: '#374151' },
  radiusTextActive: { fontSize: 13, color: '#fff', fontWeight: '700' },
  list: { maxHeight: 220, backgroundColor: '#fff' },
  momRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F3F4F6' },
  momInfo: { marginLeft: 12 },
  momName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  momDistance: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  emptyCard: { backgroundColor: '#fff', padding: 20 },
});
