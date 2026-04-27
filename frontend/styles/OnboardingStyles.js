// OnboardStyle.js
import { StyleSheet, Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

export default StyleSheet.create({
  // ---- Onboarding Styles (same as before) ----
  container: {
    flex: 1,
    backgroundColor: "#ffffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  image: {
    width: width * 0.8,
    height: height * 0.4,
    marginBottom: 30,
  },
  title: {
    color: "#0f0f0fff",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    color: "#070707ff",
    fontSize: 16,
    textAlign: "center",
    marginHorizontal: 20,
    lineHeight: 24,
    marginBottom: 30,
  },
  skipButtonTop: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 1,
  },
  skipText: {
    color: "#7e8185ff",
    fontSize: 16,
  },
  nextButton: {
    backgroundColor: "#afd826",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginBottom: 20,
  },
  nextText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0f172a",
    marginHorizontal: 5,
  },
  startButton: {
    backgroundColor: "#afd826",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  startText: {
    color: "#121212ff",
    fontSize: 18,
    fontWeight: "600",
  },
  welcomeContainer: {
    flex: 1,
    backgroundColor: "#afd826", // Green background
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  welcomeLogo: {
    width: 400,
    height: 300,
    resizeMode: "contain",
    marginBottom: 30,
  },
  welcomeTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  startButton: {
    backgroundColor: "#fff", // White button
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 15,
    shadowOpacity: 0.2,
    elevation: 5,
  },
  startText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});