// styles/PassengerTransporterSelectionStyles.js
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 30,
  },
  backBtn: { marginRight: 10 },
  title: { fontSize: 20, fontWeight: "700", color: "#0a0a0a" },

  // Search Bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f3f3",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#afd826", // ✅ green border
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: { flex: 1, marginLeft: 6 },

  // Filter Buttons Row
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#fff", // ✅ white background
    borderWidth: 2,
    borderColor: "#afd826", // ✅ green border
  },
  filterBtnActive: { backgroundColor: "#afd826" },
  filterBtnText: { color: "#000", fontWeight: "600" }, // ✅ black text
  filterBtnTextActive: { color: "#000", fontWeight: "600" }, // ✅ black text on active

  // Transporter Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#afd826",
    marginTop: 5,
  },
  selectedCard: {
    borderColor: "#afd826",
    backgroundColor: "#f9ffe6",
  },
  cardContent: { flexDirection: "row", alignItems: "center" },

  iconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: "#afd82620",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  name: { fontSize: 16, fontWeight: "600", color: "#0a0a0a" },
  zoneRow: { flexDirection: "row", alignItems: "center", marginVertical: 4 },
  zone: { fontSize: 13, color: "#7e8185", marginLeft: 4 },

  // Badge
  badge: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  activeBadge: { backgroundColor: "#afd826", color: "#047857" },
  inactiveBadge: { backgroundColor: "#fecdcdff", color: "#b91c1c" },

  // Messages
  error: { color: "#dc2626", textAlign: "center", marginVertical: 6 },
  success: { color: "#16a34a", textAlign: "center", marginVertical: 6 },

  // Continue Button
  button: {
    backgroundColor: "#afd826",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  buttonText: { color: "#0f172a", fontWeight: "700", fontSize: 16 },

  // Helper
  helperText: {
    textAlign: "center",
    color: "#010101ff",
    fontSize: 13,
    marginBottom: 20,
  },
});
