import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Alert, StyleSheet, Platform, StatusBar, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const C = {
  primary:      '#415844',
  primaryDark:  '#2D3E2F',
  primaryLight: '#EDF1ED',
  primaryMid:   '#C5D0C5',
  white:        '#FFFFFF',
  bg:           '#F5F7F5',
  cardBg:       '#FFFFFF',
  textDark:     '#1A2218',
  textSub:      '#3D4D3D',
  textMuted:    '#7A8E7A',
  textLight:    '#9EAD9E',
  border:       '#E5EBE5',
  warning:      '#E65100',
  warningLight: '#FFF3E0',
};

const SECTIONS = [
  { id: 1, title: '1. Acceptance of Terms',     content: 'By accessing and using Raahi services, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree, please discontinue use immediately.' },
  { id: 2, title: '2. User Responsibilities',   content: 'Users must provide accurate information, maintain the confidentiality of their account credentials, and use the service in compliance with all applicable laws and regulations.' },
  { id: 3, title: '3. Ride Delays & Cancellation', content: 'You must be ready 5 minutes before van arrival. Rides cannot be cancelled once confirmed. You may mark yourself absent for the next day by responding to the daily attendance poll.' },
  { id: 4, title: '4. Payment Terms',           content: 'All subscription payments are processed securely. Users are responsible for maintaining a valid and up-to-date payment arrangement with their assigned transporter.' },
  { id: 5, title: '5. Safety & Conduct',        content: 'Users must follow safety guidelines, respect drivers and fellow passengers, and maintain proper decorum throughout the journey. Misconduct may result in account suspension.' },
  { id: 6, title: '6. Liability',               content: 'Raahi is not liable for delays caused by traffic, weather, or other unforeseen circumstances. Users are solely responsible for their personal belongings.' },
  { id: 7, title: '7. Privacy Policy',          content: 'We collect necessary data for service provision only. User data is protected and will never be shared with third parties without explicit consent, except as required by law.' },
  { id: 8, title: '8. Service Modifications',   content: 'Raahi reserves the right to modify or discontinue services with reasonable prior notice. Continued use of the service after notice constitutes acceptance of any changes.' },
];

export default function TermsConditionsScreen({ navigation }) {
  const [accepted, setAccepted] = useState(false);
  const [openSection, setOpenSection] = useState(null);

  const handleAccept = () => {
    if (!accepted) {
      Alert.alert('Accept Terms', 'Please read and check the box to accept the Terms & Conditions.');
      return;
    }
    Alert.alert('Terms Accepted', 'Thank you for accepting our Terms & Conditions.', [{ text: 'OK' }]);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />

      {/* ── AppBar ── */}
      <LinearGradient colors={[C.primary, C.primaryDark]} style={s.appBar}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Terms & Conditions</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Notice banner ── */}
        <View style={s.noticeBanner}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ionicons name="document-text" size={22} color={C.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.textDark, marginBottom: 2 }}>
              Important Legal Document
            </Text>
            <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 17 }}>
              Please read carefully before using our services.
            </Text>
          </View>
        </View>

        {/* Last updated */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, paddingHorizontal: 4 }}>
          <Ionicons name="time-outline" size={13} color={C.textLight} />
          <Text style={{ fontSize: 12, color: C.textLight, fontWeight: '500' }}>Last Updated: December 1, 2024</Text>
        </View>

        {/* ── Accordion sections ── */}
        <View style={s.card}>
          {SECTIONS.map((sec, i) => (
            <View key={sec.id}>
              <TouchableOpacity
                style={[s.secRow, i < SECTIONS.length - 1 && openSection !== sec.id && s.bordered]}
                onPress={() => setOpenSection(openSection === sec.id ? null : sec.id)}
                activeOpacity={0.8}
              >
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: openSection === sec.id ? C.primary : C.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: openSection === sec.id ? C.white : C.primary }}>{sec.id}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: openSection === sec.id ? C.primary : C.textDark }}>
                  {sec.title.replace(/^\d+\.\s/, '')}
                </Text>
                <Ionicons
                  name={openSection === sec.id ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={C.textMuted}
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
              {openSection === sec.id && (
                <View style={[s.secContent, i < SECTIONS.length - 1 && s.bordered]}>
                  <Text style={{ fontSize: 13, color: C.textSub, lineHeight: 21 }}>{sec.content}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* ── Acceptance ── */}
        <View style={[s.card, { padding: 18 }]}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}
            onPress={() => setAccepted(!accepted)}
            activeOpacity={0.8}
          >
            <View style={[s.checkbox, accepted && s.checkboxChecked]}>
              {accepted && <Ionicons name="checkmark" size={14} color={C.white} />}
            </View>
            <Text style={{ flex: 1, fontSize: 13, color: C.textSub, lineHeight: 20 }}>
              I have read and agree to the Terms & Conditions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ borderRadius: 12, overflow: 'hidden', opacity: accepted ? 1 : 0.45 }}
            onPress={handleAccept}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[C.primary, C.primaryDark]} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 }}>
              <Ionicons name="checkmark-circle-outline" size={18} color={C.white} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.white }}>Accept Terms & Conditions</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Questions card ── */}
        <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }]}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ionicons name="help-circle" size={20} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.textDark, marginBottom: 2 }}>Questions?</Text>
            <Text style={{ fontSize: 12, color: C.textMuted }}>Contact our legal team at legal@raahi.com</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  scroll:{ paddingHorizontal: 16, paddingTop: 18 },

  appBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 46,
    paddingBottom: 14,
    elevation: 6,
    shadowColor: C.primaryDark, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  iconBtn:      { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  appBarTitle:  { fontSize: 17, fontWeight: '800', color: C.white, letterSpacing: 0.3 },

  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.cardBg, borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#FFE0B2',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }),
  },

  card: {
    backgroundColor: C.cardBg, borderRadius: 16, marginBottom: 14, overflow: 'hidden',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }),
  },

  secRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  secContent: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2 },
  bordered:   { borderBottomWidth: 1, borderBottomColor: C.border },

  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: C.primaryMid,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: C.primary, borderColor: C.primary },
});