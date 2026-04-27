import { StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BRAND = "#415844";
const DARK  = "#2D3E2F";
const AMBER = "#F59E0B";
const GREEN = "#16A34A";
const RED   = "#EF4444";
const BLUE  = "#2563EB";

export const S = StyleSheet.create({
  stickyWrap: {
    backgroundColor: "#FFFBEB", borderBottomWidth: 2, borderBottomColor: AMBER,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, gap: 8, zIndex: 50,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 6 },
    }),
  },
  destPin: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: RED,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff"
  },
  // ... rest of existing styles
});

