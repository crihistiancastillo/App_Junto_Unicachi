import { Feather } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow } from "../theme";

export type IconName = ComponentProps<typeof Feather>["name"];
export const Icon = ({ name, size = 20, color = colors.ink }: { name: IconName; size?: number; color?: string }) => (
  <Feather name={name} size={size} color={color} />
);

/** Contenedor de pantalla con scroll y "jalar para actualizar". */
export function Screen({ children, onRefresh, refreshing = false, padded = true }: {
  children: ReactNode; onRefresh?: () => void; refreshing?: boolean; padded?: boolean;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[padded && { padding: 20 }, { paddingBottom: 40 }]}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PageTitle({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
      <View style={{ flex: 1 }}>
        {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
        <Text style={s.h1}>{title}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function SectionHeading({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 28, marginBottom: 14 }}>
      <View>
        {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
        <Text style={s.h2}>{title}</Text>
      </View>
      {action && (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={s.textButton}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const content = <View style={[s.card, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>{content}</Pressable> : content;
}

type Tone = "green" | "amber" | "danger" | "neutral";
const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: colors.brandSoft, fg: colors.brand },
  amber: { bg: colors.amberSoft, fg: colors.amber },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: colors.track, fg: colors.muted },
};
export function Pill({ children, tone = "green" }: { children: ReactNode; tone?: Tone }) {
  const t = toneStyles[tone];
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: t.fg, fontFamily: fonts.bodyBold, fontSize: 11 }}>{children}</Text>
    </View>
  );
}

export function Progress({ value, color = colors.brand }: { value: number; color?: string }) {
  return (
    <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.track, overflow: "hidden" }}>
      <View style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: "100%", borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

const avatarColors = ["#d87747", "#588f75", "#d5a03e", "#7e6b9e"];
export function AvatarStack({ names, total }: { names: string[]; total?: number }) {
  const extra = (total ?? names.length) - Math.min(3, names.length);
  return (
    <View style={{ flexDirection: "row" }}>
      {names.slice(0, 3).map((n, i) => (
        <View key={n + i} style={[s.avatar, { backgroundColor: avatarColors[i], marginLeft: i ? -8 : 0 }]}>
          <Text style={s.avatarText}>{n.split(" ").map((w) => w[0]).join("").slice(0, 2)}</Text>
        </View>
      ))}
      {extra > 0 && (
        <View style={[s.avatar, { backgroundColor: "#edf2ee", marginLeft: -8 }]}>
          <Text style={[s.avatarText, { color: colors.muted }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

export function Button({ title, onPress, variant = "primary", icon, loading, disabled, small, style }: {
  title: string; onPress?: () => void; variant?: "primary" | "secondary" | "danger" | "light";
  icon?: IconName; loading?: boolean; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: colors.brand, fg: colors.white, border: colors.brand },
    secondary: { bg: colors.white, fg: colors.ink, border: colors.line },
    danger: { bg: colors.white, fg: colors.danger, border: "#efc9c1" },
    light: { bg: colors.white, fg: colors.brandDark, border: colors.white },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button, small && s.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : (
        <>
          {icon && <Icon name={icon} size={small ? 15 : 17} color={palette.fg} />}
          <Text style={[s.buttonText, small && { fontSize: 13 }, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TextInput placeholderTextColor="#9aa59f" style={[s.input, error && { borderColor: colors.danger }]} {...props} />
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)}
            style={[s.chip, active && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
            <Text style={[s.chipText, active && { color: colors.white }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stat({ value, label, icon }: { value: string; label: string; icon: IconName }) {
  return (
    <View style={[s.card, { flex: 1, padding: 14, gap: 8 }]}>
      <View style={s.iconTile}><Icon name={icon} size={17} color={colors.brand} /></View>
      <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink }}>{value}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.muted, lineHeight: 15 }}>{label}</Text>
    </View>
  );
}

export function Loading() {
  return <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={colors.brand} /></View>;
}

export function Empty({ icon, title, text, action, onAction }: { icon: IconName; title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={[s.card, { alignItems: "center", padding: 28, borderStyle: "dashed", backgroundColor: "transparent" }]}>
      <View style={s.iconTile}><Icon name={icon} color={colors.brand} /></View>
      <Text style={[s.h3, { marginTop: 14, textAlign: "center" }]}>{title}</Text>
      <Text style={[s.subtitle, { textAlign: "center" }]}>{text}</Text>
      {action && <Button title={action} onPress={onAction} small style={{ marginTop: 16 }} />}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[s.card, { backgroundColor: colors.dangerSoft, borderColor: "#efc9c1" }]}>
      <Text style={{ fontFamily: fonts.bodyMedium, color: colors.danger }}>{message}</Text>
      {onRetry && <Pressable onPress={onRetry}><Text style={[s.textButton, { marginTop: 8, color: colors.danger }]}>Reintentar</Text></Pressable>}
    </View>
  );
}

export const s = StyleSheet.create({
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.brand, marginBottom: 4 },
  h1: { fontFamily: fonts.displayHeavy, fontSize: 28, color: colors.ink, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  h3: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 21 },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, lineHeight: 21 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  strong: { fontFamily: fonts.bodyBold, color: colors.ink },
  textButton: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.brand },
  card: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: 18, ...shadow },
  iconTile: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.white, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10 },
  button: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18 },
  buttonSmall: { minHeight: 38, borderRadius: 12, paddingHorizontal: 14 },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink, marginBottom: 8 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 6 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.danger, marginTop: 6 },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 16 },
});
