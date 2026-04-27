import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
  },

 
// Header
header: {
  marginTop: 30,
  paddingVertical: 30,
  paddingHorizontal: 20,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#fff",

  borderTopWidth: 2,           
  borderBottomWidth: 2,        
  borderColor: "#afd826",      

  marginBottom: 25,
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 3,
  borderBottomLeftRadius: 20,
  borderBottomRightRadius: 20,
},



title: {
  fontSize: 24,
  fontWeight: "700",
  color: "#111",
  marginBottom: 6,
},

subtitle: {
  fontSize: 14,
  color: "#555",
  textAlign: "center",
  maxWidth: "85%",
  lineHeight: 20,
},

headerDivider: {
  width: 50,
  height: 3,
  backgroundColor: "#afd826",
  borderRadius: 3,
  marginTop: 12,
},

  // Stats
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#afd826",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardLabel: {
    fontSize: 13,
    color: "#444",
    marginTop: 8,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    marginTop: 4,
  },

  // Section titles
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginVertical: 16,
    color: "#111",
    borderLeftWidth: 4,
    borderLeftColor: "#afd826",
    paddingLeft: 10,
  },

  // Quick Actions
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  actionBtn: {
    width: "48%",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#afd826",
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#111",
    textAlign: "center",
  },

  // Network Cards
  networkCard: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#afd826",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  networkName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  networkDetail: {
    fontSize: 13,
    color: "#444",
    marginTop: 2,
  },

  activeBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    backgroundColor: "#afd826",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  inactiveBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111",
    backgroundColor: "#eee",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },

  utilizationBar: {
    flexDirection: "row",
    height: 8,
    backgroundColor: "#eee",
    borderRadius: 6,
    marginTop: 8,
    overflow: "hidden",
  },
  utilizationFill: {
    backgroundColor: "#afd826",
    borderRadius: 6,
  },

  // Activity
  activityCard: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "#afd826",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activityText: {
    fontSize: 14,
    color: "#111",
    marginTop: 6,
    marginBottom: 4,
  },
  activityTag: {
    fontSize: 12,
    fontWeight: "600",
    color: "#afd826",
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    color: "#666",
  },
});