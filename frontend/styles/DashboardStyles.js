import { StyleSheet, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 500,
    height: 200,
    alignSelf: "center",
    marginBottom: -1,
    marginTop: 18,
  },
  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 25,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#111827",
    borderWidth: 1.5,
    color: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 16,
    width: "100%",
  },
  pickerBox: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderColor: "#111827",
    borderWidth: 1.5,
    marginBottom: 16,
    width: "100%",
  },
  error: {
    color: "#ef4444",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  submitBtn: {
    backgroundColor: "#afd826",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
    width: width * 0.9,
    alignSelf: "center",
  },
  submitText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  sectionBox: {
    marginBottom: 20,
  },
});