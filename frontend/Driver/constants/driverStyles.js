import { StyleSheet, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

export const COLORS = {
  dark:        "#2D3E2F",
  darkGreen:   "#439b4e", // Aapka primary brand color
  sage:        "#ACC5A8",
  sageLight:   "#EEF4ED",
  white:       "#FFFFFF",
  cardBorder:  "#E0E7E0",
  
  textMain:    "#1A241B", // Clear dark text
  textMuted:   "#6B7A6B", // Readable muted text
  danger:      "#C0392B",
};

export const driverStyles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#F9FBF9" },
  scrollContent:  { flex: 1, backgroundColor: "#F9FBF9" },
  contentPadding: { padding: 18, paddingBottom: 36 },

  // ── Header (Appbar) ───────────────────────────────────────────────────────
  header: {
    backgroundColor:   COLORS.darkGreen, 
    paddingTop:        55,
    paddingBottom:     18,
    paddingHorizontal: 20,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    elevation:         10,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.2,
    shadowRadius:      8,
  },

  headerTitle: {
    fontSize:   20,
    fontWeight: "900",
    color:      "#FFFFFF",
    letterSpacing: 0.5,
  },

  headerSubtitle: {
    fontSize:   12,
    fontWeight: "700",
    color:      "#E8F5E9", // Light contrast text
    marginTop:  2,
    opacity:    0.9,
  },

  // ── Sidebar (Drawer) ──────────────────────────────────────────────────────
  sidebar: {
    position:        "absolute",
    top: 0, left: 0, bottom: 0,
    width:           width * 0.78,
    backgroundColor: "#FFFFFF",
    zIndex:          11,
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
  },

  sidebarHeader: {
    backgroundColor:   COLORS.darkGreen,
    paddingTop:        60,
    paddingBottom:     30,
    paddingHorizontal: 22,
    borderBottomRightRadius: 20,
  },

  sidebarHeaderText: {
    fontSize:   22,
    fontWeight: "900",
    color:      "#FFFFFF",
  },

  sidebarItem: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   14,
    paddingHorizontal: 16,
    marginHorizontal:  12,
    marginVertical:    4,
    borderRadius:      15,
  },

  // Jab click/hover ho toh ye color aayega (Fresh Sage Green)
  sidebarItemActive: {
    backgroundColor: "#E8F5E9", 
    borderLeftWidth: 5,
    borderLeftColor: COLORS.darkGreen,
  },

  sidebarItemText: {
    fontSize:   16,
    color:      "#4A554A", // Non-active text color
    marginLeft: 15,
    fontWeight: "600",
  },

  sidebarItemTextActive: {
    color:      COLORS.darkGreen, // Active text color
    fontWeight: "800",
  },

  // ── Modern Stats ──────────────────────────────────────────────────────────
  statCard: {
    flex: 1, 
    backgroundColor: "#FFFFFF", 
    borderRadius: 20,
    padding: 16, 
    alignItems: "center",
    borderWidth: 1, 
    borderColor: "#F0F0F0",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
  },

  statValue: { 
    fontSize: 24, 
    fontWeight: "900", 
    color: COLORS.darkGreen, // Highlight values
    marginTop: 8 
  },

  statLabel: { 
    fontSize: 11, 
    color: "#889988", 
    marginTop: 2, 
    fontWeight: "700",
    textTransform: 'uppercase'
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabContainer: {
    flexDirection: "row", 
    backgroundColor: "#EEEEEE",
    borderRadius: 15, 
    padding: 5, 
    marginBottom: 16,
  },

  tab:           { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12 },
  tabActive:     { backgroundColor: COLORS.darkGreen, elevation: 3 },
  tabText:       { fontSize: 13, fontWeight: "700", color: "#778877" },
  tabTextActive: { color: "#FFFFFF", fontWeight: "800" },

  // ── Button ────────────────────────────────────────────────────────────────
  button: {
    backgroundColor: COLORS.darkGreen,
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      "center",
    elevation:       5,
    shadowColor:     COLORS.darkGreen,
    shadowOpacity:   0.3,
    shadowRadius:    10,
  },

  buttonText: {
    color:      "#FFFFFF",
    fontWeight: "900",
    fontSize:   16,
  },

  // ── Input Fixes ───────────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row", 
    alignItems: "center",
    backgroundColor: "#FFFFFF", 
    borderRadius: 15,
    paddingHorizontal: 16, 
    height: 52,
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: "#E0E0E0",
  },

  // ── Loading ───────────────────────────────────────────────────────────────
  loadingOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(255,255,255,0.8)", // Professional blurred look
    alignItems: "center", justifyContent: "center", zIndex: 99,
  },
});