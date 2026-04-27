import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#A1D826",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  summaryContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  summaryLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 6,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  summaryStatus: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  summaryStatusLabel: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 4,
  },
  summaryStatusValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2C2C2C",
  },
  paymentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  paymentMonth: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2C2C2C",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusPaid: {
    backgroundColor: "#E8F5E9",
  },
  statusPending: {
    backgroundColor: "#FFEBEE",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  paymentDetails: {
    gap: 10,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  paymentLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
    flex: 1,
  },
  paymentValue: {
    fontSize: 14,
    color: "#2C2C2C",
    fontWeight: "700",
  },
});