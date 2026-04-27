import { StyleSheet, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    centerContent: {
        flex: 1,
        justifyContent: "center", // ✅ center vertically
        alignItems: "center",     // ✅ center horizontally
        paddingHorizontal: 20,
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
        width: width * 0.85, // ✅ responsive (85% of screen width)
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
        width: width * 0.85, // ✅ responsive button width
    },
    submitText: {
        color: "#ffffff",
        fontWeight: "700",
        fontSize: 16,
    },
    linkText: {
        marginTop: 20,
        color: "#afd826", // ✅ green shade
        fontSize: 15,
        fontWeight: "600",
        textAlign: "center", // ✅ centered text
    },
});
