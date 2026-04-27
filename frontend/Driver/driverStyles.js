import { StyleSheet, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

export const driverStyles = StyleSheet.create({

  // ── Layout ────────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },

  scrollContent: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },

  contentPadding: {
    padding: 16,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: "#1A1A2E",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  menuButton: {
    padding: 4,
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },

  headerSubtitle: {
    fontSize: 12,
    color: "#A1D826",
    marginTop: 2,
  },

  // ── Sidebar ───────────────────────────────────────────────────────────────
  sidebarOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 10,
  },

  sidebar: {
    position: "absolute",
    top: 0, left: 0, bottom: 0,
    width: width * 0.72,
    backgroundColor: "#fff",
    zIndex: 11,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },

  sidebarHeader: {
    backgroundColor: "#1A1A2E",
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },

  sidebarHeaderText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },

  sidebarHeaderSubtext: {
    fontSize: 13,
    color: "#A1D826",
    marginTop: 4,
  },

  sidebarMenu: {
    flex: 1,
    paddingTop: 8,
  },

  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginHorizontal: 10,
    marginVertical: 2,
  },

  sidebarItemActive: {
    backgroundColor: "#F0F9D9",
  },

  sidebarItemText: {
    fontSize: 15,
    color: "#555",
    marginLeft: 14,
    fontWeight: "500",
  },

  sidebarItemTextActive: {
    color: "#A1D826",
    fontWeight: "700",
  },

  sidebarFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },

  logoutButton: {
    backgroundColor: "#F44336",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
  },

  logoutButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
  },

  cardText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },

  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },

  menuCardText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },

  // ── Stats grid ────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 10,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },

  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginTop: 6,
  },

  statLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
    fontWeight: "500",
  },

  // ── Section title ─────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
    marginTop: 6,
  },

  // ── Button ────────────────────────────────────────────────────────────────
  button: {
    backgroundColor: "#A1D826",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  // ── Search & Tabs ─────────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    marginLeft: 8,
  },

  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },

  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },

  tabActive: {
    backgroundColor: "#A1D826",
  },

  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
  },

  tabTextActive: {
    color: "#fff",
  },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "85%",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },

  // ── Loading overlay ───────────────────────────────────────────────────────
  loadingOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
  },
});
