import { StyleSheet, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 20,
  },

  image: {
    width: width * 0.95, // responsive full width
    height: 180,
    marginBottom: 20,
    borderRadius: 10,
  },

  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },

  input: {
    backgroundColor: "#f9fafb",
    borderColor: "#0c0c0c",
    borderWidth: 1.5,
    color: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 16,
    width: width * 0.9, // responsive (90% of screen)
    alignSelf: "center",
  },

  error: {
    color: "#ef4444",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  success: {
    color: "#22c55e",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },

  submitBtn: {
    backgroundColor: "#afd826",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    width: width * 0.9, // responsive button
    alignSelf: "center",
  },

  submitText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
});
