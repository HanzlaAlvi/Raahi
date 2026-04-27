// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: PollAlertBanner
// Shown on Dashboard when an unanswered active poll exists
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

export default function PollAlertBanner({
  poll,
  slideAnim,
  pulseAnim,
  fadeAnim,
  travelResponse,
  selectedTimeSlot,
  pickupPoint,
  loading,
  onYes,
  onNo,
  onSelectSlot,
  onPickupChange,
  onConfirm,
}) {
  if (!poll) return null;

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: pulseAnim }],
        marginTop: 16,
        marginBottom: 4,
      }}
    >
      <LinearGradient
        colors={['#FF6B6B', '#EE5A52']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.alertBox}
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Icon name="help-circle" size={26} color="#fff" />
        </Animated.View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.alertTitle}>{poll.title}</Text>
          <Text style={styles.alertText}>{poll.question || 'Will you travel tomorrow?'}</Text>
          {poll.closesAt && (
            <Text style={styles.alertText}>Closes at: {poll.closesAt}</Text>
          )}

          {/* Yes / No buttons */}
          <View style={styles.alertBtns}>
            <TouchableOpacity style={styles.confirmBtn} onPress={onYes}>
              <Icon name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.btnText}>Yes, I'll Travel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onNo}>
              <Icon name="close-circle" size={16} color="#fff" />
              <Text style={styles.btnText}>No</Text>
            </TouchableOpacity>
          </View>

          {/* Extra fields when "yes" selected */}
          {travelResponse === 'yes' && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.alertText, { fontWeight: '700', marginBottom: 8 }]}>
                Select Time Slot:
              </Text>
              {poll.timeSlots?.length > 0
                ? poll.timeSlots.map((slot, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.slotBtn, selectedTimeSlot === slot && styles.slotBtnActive]}
                      onPress={() => onSelectSlot(slot)}
                    >
                      <Text
                        style={[
                          styles.slotText,
                          selectedTimeSlot === slot && { color: '#439b4e', fontWeight: '700' },
                        ]}
                      >
                        {slot}
                      </Text>
                    </TouchableOpacity>
                  ))
                : (
                  <Text style={[styles.alertText, { fontSize: 12, opacity: 0.7 }]}>
                    No time slots available
                  </Text>
                )}

              <Text style={[styles.alertText, { fontWeight: '700', marginTop: 12, marginBottom: 8 }]}>
                Pickup Point:
              </Text>
              <TextInput
                style={styles.pickupInput}
                placeholder="Enter pickup point"
                placeholderTextColor="#ffaaaa"
                value={pickupPoint}
                onChangeText={onPickupChange}
              />

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  {
                    marginTop: 12,
                    opacity: loading || !selectedTimeSlot || !pickupPoint ? 0.5 : 1,
                  },
                ]}
                onPress={onConfirm}
                disabled={loading || !selectedTimeSlot || !pickupPoint}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="checkmark-done" size={16} color="#fff" />
                    <Text style={styles.btnText}>Confirm Response</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = {
  alertBox: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  alertTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  alertText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
  alertBtns: { flexDirection: 'row', marginTop: 10, gap: 8 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  slotBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  slotBtnActive: { backgroundColor: '#fff' },
  slotText: { color: '#fff', fontWeight: '600' },
  pickupInput: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 10,
    color: '#fff',
    fontSize: 14,
  },
};