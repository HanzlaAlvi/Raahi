import { StyleSheet } from 'react-native';
import C from '../constants/colors';

export const om = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '800', color: C.white },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  markerPin:   { justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3 },
  legendBox:   { position: 'absolute', bottom: 12, left: 12, right: 12 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderLeftWidth: 4, elevation: 3 },
  legendLabel: { fontSize: 12, fontWeight: '800', color: C.textDark },
  legendSub:   { fontSize: 10, color: C.textLight, marginTop: 1 },
  bottomPanel: { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 12 },
  summaryRow:  { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, alignItems: 'center' },
  summaryBox:  { flex: 1, alignItems: 'center', gap: 3 },
  summaryDiv:  { width: 1, height: 36, backgroundColor: C.divider },
  summaryVal:  { fontSize: 14, fontWeight: '900', color: C.textDark },
  summaryLbl:  { fontSize: 10, color: C.textLight, fontWeight: '600' },
});