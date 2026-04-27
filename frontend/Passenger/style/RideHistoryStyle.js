import { StyleSheet, Dimensions, Platform } from 'react-native';

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
  danger:       '#E53935',
  dangerLight:  '#FFEBEE',
  warning:      '#F57C00',
  warningLight: '#FFF3E0',
};

export default StyleSheet.create({

  container: { flex: 1, backgroundColor: C.bg },

  // ── Header ────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 54 : 46,
    paddingBottom: 16,
    elevation: 6,
    shadowColor: C.primaryDark, shadowOpacity: 0.22,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  backButton: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  downloadButton: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18, fontWeight: '800',
    color: C.white, letterSpacing: 0.3,
  },

  // ── Loading ───────────────────────────────────────────────────
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingText: { fontSize: 13, color: C.textMuted, fontWeight: '500' },

  // ── Filter tabs ───────────────────────────────────────────────
  filterContainer: {
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.primaryMid,
    elevation: 2, shadowColor: '#000',
    shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  filterContentContainer: {
    paddingHorizontal: 14, paddingVertical: 10,
    gap: 8, alignItems: 'center',
  },
  filterTab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 20, backgroundColor: C.white,
    borderWidth: 1.5, borderColor: C.primaryMid, gap: 4,
  },
  filterTabActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterText:      { fontSize: 12, fontWeight: '600', color: C.primary },
  filterTextActive:{ color: C.white, fontWeight: '700' },

  // ── List ──────────────────────────────────────────────────────
  listContainer: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 36,
  },

  // ── Ride Card ─────────────────────────────────────────────────
  rideCard: {
    backgroundColor: C.cardBg, borderRadius: 18,
    marginBottom: 14, overflow: 'hidden',
    borderLeftWidth: 4, borderLeftColor: C.primary,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  routeText: {
    fontSize: 14, fontWeight: '700',
    color: C.textDark, lineHeight: 20,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, alignSelf: 'flex-start', gap: 3,
  },
  statusText:  { fontSize: 11, fontWeight: '700', color: C.white },
  dateText:    { fontSize: 11, color: C.textMuted, fontWeight: '500', marginTop: 4, textAlign: 'right' },

  cardContent: {
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12,
  },

  // Time block
  timeInfo: {
    backgroundColor: C.bg, borderRadius: 10,
    padding: 10, marginBottom: 10, gap: 6,
  },
  timeRow:   { flexDirection: 'row', alignItems: 'center' },
  timeLabel: { fontSize: 12, color: C.textMuted, marginLeft: 6, width: 72 },
  timeValue: { fontSize: 12, fontWeight: '700', color: C.textDark },

  // Delay
  delayInfo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.warningLight,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: C.warning, gap: 6,
  },
  delayText: { fontSize: 12, fontWeight: '600' },

  // Driver / vehicle
  driverInfo:   { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  driverDetail: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 },
  driverText:   { fontSize: 12, color: C.textSub, flexShrink: 1 },

  // Rating
  ratingContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFDE7',
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, alignSelf: 'flex-start',
    marginTop: 6, gap: 2,
  },
  ratingText:  { fontSize: 13, fontWeight: '700', color: C.textDark, marginLeft: 4, marginRight: 6 },
  ratingLabel: { fontSize: 11, color: C.textMuted },

  // Missed strip
  missedOverlay: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.dangerLight,
    marginHorizontal: 14, marginBottom: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, gap: 6,
  },
  missedMessage: { fontSize: 12, color: C.danger, fontWeight: '600' },

  // Empty state
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 72, paddingHorizontal: 32,
  },
  emptyStateText:    { fontSize: 17, fontWeight: '800', color: C.textSub, marginTop: 16, marginBottom: 6 },
  emptyStateSubtext: { fontSize: 13, color: C.textLight, textAlign: 'center', lineHeight: 20 },
});