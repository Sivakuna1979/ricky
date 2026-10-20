import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native'
import { colors, fonts, radius, space } from '../theme'

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
}) {
  const off = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.ghost,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.bg : colors.text} />
      ) : (
        <Text style={[styles.buttonText, variant === 'primary' && { color: colors.bg }, variant === 'danger' && { color: colors.danger }]}>{label}</Text>
      )}
    </Pressable>
  )
}

export function Heading({ children, size = 34 }: { children: ReactNode; size?: number }) {
  return <Text style={[styles.heading, { fontSize: size, lineHeight: size * 1.12 }]}>{children}</Text>
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[styles.body, muted && { color: colors.muted }, style]}>{children}</Text>
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && { color: colors.text }]}>{label}</Text>
    </Pressable>
  )
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.faint} selectionColor={colors.gold} {...props} style={[styles.field, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, props.style]} />
}

/** "Step 2 of 4 · Photos" with a thin progress bar. */
export function Steps({ step, label }: { step: 1 | 2 | 3 | 4; label: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.label}>
        Step {step} of 4 · {label}
      </Text>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${step * 25}%` }]} />
      </View>
    </View>
  )
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.trackFill, { width: `${Math.max(3, Math.min(100, value * 100))}%` }]} />
    </View>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <Text style={styles.error}>{children}</Text>
}

const styles = StyleSheet.create({
  button: { minHeight: 54, borderRadius: radius.pill, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.gold },
  ghost: { borderWidth: 1, borderColor: colors.line, backgroundColor: 'transparent' },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text, letterSpacing: 0.2 },
  heading: { fontFamily: fonts.display, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.text },
  label: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.gold },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  chipText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  field: {
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: colors.gold },
  error: { fontFamily: fonts.body, fontSize: 15, color: colors.danger, lineHeight: 22 },
})
