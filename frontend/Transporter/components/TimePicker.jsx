// frontend/Transporter/components/TimePicker.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const P = {
  main:     '#415844',
  dark:     '#2D3E2F',
  white:    '#FFFFFF',
  bg:       '#F5F7F5',
  light:    '#EDF1ED',
  border:   '#C5D0C5',
  textDark: '#1A2218',
  textMid:  '#374151',
  textMuted:'#9CA3AF',
};

const pad  = (n) => String(n).padStart(2, '0');
const mod  = (n, m) => ((n % m) + m) % m;

// ─────────────────────────────────────────────────────────────────
const TimePicker = ({ visible, onClose, onSelect, initialValue }) => {
  const [hour,   setHour]   = useState(8);   // 1–12
  const [minute, setMinute] = useState(0);   // 0–59
  const [ampm,   setAmpm]   = useState('AM');

  useEffect(() => {
    if (initialValue && visible) {
      const m = initialValue.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (m) {
        setHour(parseInt(m[1], 10));
        setMinute(parseInt(m[2], 10));
        setAmpm(m[3].toUpperCase());
      }
    }
  }, [initialValue, visible]);

  const stepHour   = (d) => setHour(h   => mod(h + d - 1, 12) + 1);
  const stepMinute = (d) => setMinute(m => mod(m + d, 60));

  const handleConfirm = () => {
    onSelect?.(`${pad(hour)}:${pad(minute)} ${ampm}`);
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <View style={s.sheet}>
        <View style={s.handle} />

        <View style={s.header}>
          <Text style={s.headerTitle}>Select Time</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={P.textMid} />
          </TouchableOpacity>
        </View>

        {/* Drum-roll pickers */}
        <View style={s.pickerRow}>

          {/* ── Hour ── */}
          <View style={s.drum}>
            <TouchableOpacity style={s.arrow} onPress={() => stepHour(1)}>
              <Ionicons name="chevron-up" size={24} color={P.main} />
            </TouchableOpacity>

            <View style={s.drumWindow}>
              <Text style={s.drumAbove}>{pad(mod(hour - 2, 12) + 1)}</Text>
              <View style={s.drumHighlight}>
                <Text style={s.drumValue}>{pad(hour)}</Text>
              </View>
              <Text style={s.drumBelow}>{pad(mod(hour, 12) + 1)}</Text>
            </View>

            <TouchableOpacity style={s.arrow} onPress={() => stepHour(-1)}>
              <Ionicons name="chevron-down" size={24} color={P.main} />
            </TouchableOpacity>
          </View>

          <Text style={s.separator}>:</Text>

          {/* ── Minute ── */}
          <View style={s.drum}>
            <TouchableOpacity style={s.arrow} onPress={() => stepMinute(5)}>
              <Ionicons name="chevron-up" size={24} color={P.main} />
            </TouchableOpacity>

            <View style={s.drumWindow}>
              <Text style={s.drumAbove}>{pad(mod(minute - 5, 60))}</Text>
              <View style={s.drumHighlight}>
                <Text style={s.drumValue}>{pad(minute)}</Text>
              </View>
              <Text style={s.drumBelow}>{pad(mod(minute + 5, 60))}</Text>
            </View>

            <TouchableOpacity style={s.arrow} onPress={() => stepMinute(-5)}>
              <Ionicons name="chevron-down" size={24} color={P.main} />
            </TouchableOpacity>
          </View>

          {/* ── AM / PM ── */}
          <View style={s.ampmCol}>
            <TouchableOpacity
              style={[s.ampmBtn, ampm === 'AM' && s.ampmActive]}
              onPress={() => setAmpm('AM')}
            >
              <Text style={[s.ampmTxt, ampm === 'AM' && s.ampmTxtActive]}>AM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.ampmBtn, ampm === 'PM' && s.ampmActive]}
              onPress={() => setAmpm('PM')}
            >
              <Text style={[s.ampmTxt, ampm === 'PM' && s.ampmTxtActive]}>PM</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick presets */}
        <View style={s.presets}>
          <Text style={s.presetsLabel}>QUICK SELECT</Text>
          <View style={s.presetsRow}>
            {[
              { h: 7,  m: 0,  a: 'AM' },
              { h: 8,  m: 0,  a: 'AM' },
              { h: 9,  m: 0,  a: 'AM' },
              { h: 5,  m: 0,  a: 'PM' },
              { h: 6,  m: 0,  a: 'PM' },
            ].map(t => {
              const isActive = hour === t.h && minute === t.m && ampm === t.a;
              return (
                <TouchableOpacity
                  key={`${t.h}${t.a}`}
                  style={[s.preset, isActive && s.presetActive]}
                  onPress={() => { setHour(t.h); setMinute(t.m); setAmpm(t.a); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.presetTxt, isActive && s.presetTxtActive]}>
                    {pad(t.h)}:{pad(t.m)} {t.a}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Confirm */}
        <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
          <Text style={s.confirmTxt}>Confirm  {pad(hour)}:{pad(minute)} {ampm}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export default TimePicker;

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },

  sheet: {
    backgroundColor: P.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: -6 } },
      android: { elevation: 16 },
    }),
  },

  handle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: P.border, alignSelf: 'center',
    marginTop: 12, marginBottom: 20,
  },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: P.textDark },

  // Drum row
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 28,
  },

  // One drum column
  drum:       { alignItems: 'center', width: 90 },
  arrow: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: P.light, borderWidth: 1, borderColor: P.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // The window showing 3 values
  drumWindow: { alignItems: 'center', paddingVertical: 8, width: 90 },
  drumAbove:  { fontSize: 22, color: P.textMuted, fontWeight: '500', marginBottom: 6, opacity: 0.5 },
  drumBelow:  { fontSize: 22, color: P.textMuted, fontWeight: '500', marginTop: 6, opacity: 0.5 },

  // Active / selected row
  drumHighlight: {
    backgroundColor: P.light, borderRadius: 14,
    width: 80, height: 54,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: P.main,
  },
  drumValue: { fontSize: 34, fontWeight: '900', color: P.main },

  separator: { fontSize: 36, fontWeight: '900', color: P.main, marginBottom: 8, alignSelf: 'center' },

  // AM/PM
  ampmCol:      { gap: 10, alignItems: 'center' },
  ampmBtn: {
    width: 62, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: P.border,
    backgroundColor: P.bg, alignItems: 'center',
  },
  ampmActive:   { backgroundColor: P.main, borderColor: P.main },
  ampmTxt:      { fontSize: 14, fontWeight: '700', color: P.textMid },
  ampmTxtActive:{ color: P.white },

  // Presets
  presets:      { marginBottom: 20 },
  presetsLabel: { fontSize: 10, fontWeight: '700', color: P.textMuted, letterSpacing: 1.2, marginBottom: 10 },
  presetsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: P.border,
    backgroundColor: P.bg,
  },
  presetActive:   { backgroundColor: P.main, borderColor: P.main },
  presetTxt:      { fontSize: 13, fontWeight: '600', color: P.textMid },
  presetTxtActive:{ color: P.white },

  // Confirm
  confirmBtn: {
    backgroundColor: P.main, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  confirmTxt: { fontSize: 16, fontWeight: '800', color: P.white },
});