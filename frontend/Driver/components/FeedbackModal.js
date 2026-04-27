import React from "react";
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { driverStyles } from "../constants/driverStyles";

export default function FeedbackModal({
  visible,
  onClose,
  feedbackRating,
  setFeedbackRating,
  feedbackComment,
  setFeedbackComment,
  onSubmit,
  loading,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={driverStyles.modalOverlay}>
        <View style={driverStyles.modalContent}>
          <View style={driverStyles.modalHeader}>
            <Text style={driverStyles.modalTitle}>Rate This Route</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <Text style={{ textAlign: "center", color: "#666", marginBottom: 16 }}>
            How did today's route go?
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 20 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setFeedbackRating(s)} style={{ marginHorizontal: 6 }}>
                <Ionicons
                  name={s <= feedbackRating ? "star" : "star-outline"}
                  size={40}
                  color={s <= feedbackRating ? "#FFD700" : "#ccc"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={{
              backgroundColor: "#f9f9f9",
              borderWidth: 1,
              borderColor: "#e5e5e5",
              borderRadius: 12,
              padding: 14,
              marginBottom: 20,
              height: 100,
              textAlignVertical: "top",
            }}
            placeholder="Comments (optional)"
            value={feedbackComment}
            onChangeText={setFeedbackComment}
            multiline
          />

          <TouchableOpacity
            style={driverStyles.button}
            onPress={onSubmit}
            disabled={feedbackRating === 0 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={driverStyles.buttonText}>Submit Feedback</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
