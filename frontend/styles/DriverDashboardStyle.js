import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  headerGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "700",
  },
  scrollContainer: {
    paddingBottom: 50,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    margin: 12,
    overflow: "hidden",
    elevation: 3,
  },
  sectionHeaderGradient: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  tripCardContainer: {
    padding: 15,
  },
  tripCard: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  tripCardText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#444",
  },
  mapWrapper: {
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 10,
    marginBottom: 15,
  },
  map: {
    flex: 1,
  },
  mapNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff8e1",
    padding: 8,
    borderRadius: 8,
    position: "absolute",
    bottom: 10,
    left: 10,
    elevation: 3,
  },
  noteText: {
    marginLeft: 6,
    color: "#666",
  },
  driverBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },
  driverCircle: {
    width: 65,
    height: 65,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  driverInitials: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  driverName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },
  driverSub: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  chatHeaderTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  messageWrapper: {
    marginVertical: 4,
  },
  chatBubble: {
    borderRadius: 12,
    padding: 10,
    maxWidth: "80%",
  },
  driverBubble: {
    backgroundColor: "#A1D826",
    alignSelf: "flex-end",
  },
  userBubble: {
    backgroundColor: "#E0E0E0",
    alignSelf: "flex-start",
  },
  chatText: {
    color: "#000",
    fontSize: 14,
  },
  chatTime: {
    fontSize: 10,
    color: "#555",
    textAlign: "right",
  },
  chatInputBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  chatInput: {
    flex: 1,
    padding: 10,
    backgroundColor: "#F3F3F3",
    borderRadius: 20,
    marginRight: 10,
  },
  sendButton: {
    width: 45,
    height: 45,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
