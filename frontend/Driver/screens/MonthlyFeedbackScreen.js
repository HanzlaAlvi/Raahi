import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert,
  StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API_BASE_URL = "https://raahi-q2ur.onrender.com/api";

const P = {
  main:      "#415844",
  dark:      "#2D3E2F",
  white:     "#FFFFFF",
  bg:        "#F5F7F5",
  light:     "#EDF1ED",
  border:    "#C5D0C5",
  textDark:  "#1A2218",
  textMid:   "#374151",
  textLight: "#6B7280",
};

const FEEDBACK_QUESTIONS = [
  'How would you rate your overall driving experience this month?',
  'How satisfied are you with the route assigned to you?',
  'How would you rate communication with your transporter?',
  'How satisfied are you with your payment timelines?',
  'Would you recommend this service to other drivers?',
];
const RATING_OPTIONS = ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor'];

export default function MonthlyFeedbackScreen({ authTokenRef, getHeaders, navigateTo }) {
  const [feedbackWindow,    setFeedbackWindow]    = useState({ isOpen: false, month: '', alreadySubmitted: false });
  const [feedbackAnswers,   setFeedbackAnswers]   = useState({});
  const [feedbackSubject,   setFeedbackSubject]   = useState('');
  const [feedbackSaving,    setFeedbackSaving]    = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedbackWindow();
  }, []);

  const fetchFeedbackWindow = async () => {
    try {
      const tok = authTokenRef.current;
      const r = await fetch(`${API_BASE_URL}/feedback/monthly-window`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const d = await r.json();
      if (d.success) setFeedbackWindow(d);
    } catch { } finally { setLoading(false); }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackSubject.trim()) {
      Alert.alert('Subject Required', 'Please enter a subject for your feedback.');
      return;
    }
    const allAnswered = FEEDBACK_QUESTIONS.every((_, i) => feedbackAnswers[i]);
    if (!allAnswered) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }
    setFeedbackSaving(true);
    try {
      const tok = authTokenRef.current;
      const questions = FEEDBACK_QUESTIONS.map((q, i) => ({ question: q, answer: feedbackAnswers[i] }));
      const res = await fetch(`${API_BASE_URL}/feedback/monthly`, {
        method: 'POST',
        headers: { ...getHeaders(tok), 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: feedbackSubject.trim(), date: new Date().toISOString(), questions }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackSubmitted(true);
      } else {
        Alert.alert('Error', data.message || 'Could not submit feedback.');
      }
    } catch {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg }}>
        <ActivityIndicator size="large" color={P.main} />
        <Text style={{ marginTop: 12, color: P.textLight, fontWeight: '600' }}>Loading…</Text>
      </View>
    );
  }

  if (!feedbackWindow.isOpen || feedbackWindow.alreadySubmitted) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <Ionicons name="calendar-outline" size={48} color={P.border} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: P.textDark, marginTop: 16 }}>Feedback Window Closed</Text>
        <Text style={{ fontSize: 13, color: P.textLight, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
          The monthly feedback window is not currently open.{'\n'}Check back during the last week of the month.
        </Text>
        <TouchableOpacity style={{ marginTop: 20, backgroundColor: P.main, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }} onPress={() => navigateTo('Dashboard')}>
          <Text style={{ color: P.white, fontWeight: '800', fontSize: 14 }}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (feedbackSubmitted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: P.bg }}>
        <Ionicons name="checkmark-circle" size={52} color={P.main} />
        <Text style={{ fontSize: 22, fontWeight: '900', color: P.textDark, marginTop: 16, marginBottom: 8 }}>Thank You!</Text>
        <Text style={{ fontSize: 14, color: P.textLight, textAlign: 'center', lineHeight: 21 }}>
          Your feedback for {feedbackWindow.month} has been submitted. We appreciate your time.
        </Text>
        <TouchableOpacity style={{ marginTop: 24, backgroundColor: P.main, borderRadius: 12, paddingHorizontal: 30, paddingVertical: 13 }} onPress={() => navigateTo('Dashboard')}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: P.white }}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1, backgroundColor: P.bg }}>
        

        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={st.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#1565C0" />
            <Text style={st.infoTxt}>Monthly feedback window is now open. Your response helps us improve the service.</Text>
          </View>

          <Text style={st.label}>Subject *</Text>
          <TextInput
            style={st.input}
            value={feedbackSubject}
            onChangeText={setFeedbackSubject}
            placeholder={`e.g. ${feedbackWindow.month} Monthly Feedback`}
            placeholderTextColor="#9CA3AF"
          />

          {FEEDBACK_QUESTIONS.map((q, i) => (
            <View key={i} style={st.qCard}>
              <Text style={st.qText}>{i + 1}. {q}</Text>
              <View style={st.optionsRow}>
                {RATING_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[st.optionBtn, feedbackAnswers[i] === opt && st.optionBtnActive]}
                    onPress={() => setFeedbackAnswers(prev => ({ ...prev, [i]: opt }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[st.optionTxt, feedbackAnswers[i] === opt && st.optionTxtActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[st.submitBtn, (feedbackSaving || !FEEDBACK_QUESTIONS.every((_, i) => feedbackAnswers[i])) && { opacity: 0.5 }]}
            onPress={handleFeedbackSubmit}
            disabled={feedbackSaving || !FEEDBACK_QUESTIONS.every((_, i) => feedbackAnswers[i])}
            activeOpacity={0.85}
          >
            {feedbackSaving
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="send-outline" size={16} color="#fff" /><Text style={st.submitTxt}>Submit Feedback</Text></>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 14,
  },
  headerBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#fff', flex: 1, textAlign: 'center' },

  scroll: { padding: 18, paddingBottom: 40 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 18, borderWidth: 1, borderColor: '#BBDEFB' },
  infoTxt: { flex: 1, fontSize: 12, color: '#1565C0', fontWeight: '600' },

  label: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#C5D0C5', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A2218', marginBottom: 16 },

  qCard: { marginBottom: 16, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5EBE5' },
  qText: { fontSize: 13, fontWeight: '700', color: '#1A2218', marginBottom: 10, lineHeight: 19 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionBtn: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F5F7F5', borderRadius: 9, borderWidth: 1.5, borderColor: '#C5D0C5' },
  optionBtnActive: { backgroundColor: P.main, borderColor: P.main },
  optionTxt: { fontSize: 11, fontWeight: '600', color: '#374151' },
  optionTxtActive: { color: '#fff' },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: P.main, borderRadius: 14, paddingVertical: 15, marginTop: 10 },
  submitTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

