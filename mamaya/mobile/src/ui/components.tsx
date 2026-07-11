/** Kit UI partagé : boutons dégradés, champs, avatars, erreurs. */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { avatarGradient, COLORS, GRADIENTS, RADIUS, SHADOW } from '../lib/theme';

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.btnWrap,
        style,
        inactive && { opacity: 0.45 },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <LinearGradient
        colors={GRADIENTS.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btn}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.btnRow}>
            {icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
            <Text style={styles.btnText}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function TextField({
  label,
  icon,
  ...props
}: TextInputProps & { label: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? COLORS.rose : COLORS.grayLight}
            style={styles.inputIcon}
          />
        ) : null}
        <TextInput
          style={styles.input}
          placeholderTextColor={COLORS.grayLight}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/** Avatar rond : photo si dispo, sinon initiale sur dégradé pastel stable. */
export function Avatar({
  name,
  size = 42,
  seed,
}: {
  name: string;
  size?: number;
  seed?: string;
}) {
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  return (
    <LinearGradient
      colors={avatarGradient(seed ?? name)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>
        {initial}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  btnWrap: { borderRadius: RADIUS.full, marginTop: 8, ...SHADOW.fab },
  btn: {
    borderRadius: RADIUS.full,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.field,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputWrapFocused: { borderColor: COLORS.rose, backgroundColor: COLORS.bg },
  inputIcon: { marginLeft: 12 },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.ink,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { flex: 1, color: COLORS.danger, fontSize: 14, lineHeight: 19 },
});
