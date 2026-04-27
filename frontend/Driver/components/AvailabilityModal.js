import React from "react";
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { driverStyles } from "../constants/driverStyles";

export default function AvailabilityModal({
  visible,
  onClose,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  onConfirm,
  loading,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={driverStyles.modalOverlay}>
        <View style={driverStyles.modalContent}>
          <View style={driverStyles.modalHeader}>
            <Text style={driverStyles.modalTitle}>Confirm Availability</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <Text style={{ color: "#666", marginBottom: 16 }}>Set your timing for tomorrow</Text>

          <TextInput
            style={{
              backgroundColor: "#f9f9f9",
              borderWidth: 1,
              borderColor: "#e5e5e5",
              borderRadius: 12,
              padding: 14,
              marginBottom: 14,
              fontSize: 15,
            }}
            placeholder="Start Time e.g. 07:00 AM"
            value={startTime}
            onChangeText={setStartTime}
          />

          <TextInput
            style={{
              backgroundColor: "#f9f9f9",
              borderWidth: 1,
              borderColor: "#e5e5e5",
              borderRadius: 12,
              padding: 14,
              marginBottom: 20,
              fontSize: 15,
            }}
            placeholder="End Time e.g. 06:00 PM"
            value={endTime}
            onChangeText={setEndTime}
          />

          <TouchableOpacity style={driverStyles.button} onPress={onConfirm} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={driverStyles.buttonText}>Confirm</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
