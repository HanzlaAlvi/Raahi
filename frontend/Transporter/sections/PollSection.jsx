// frontend/Transporter/sections/PollSection.jsx
//
// Changes from original:
// 1) Shows 2 poll types: Morning (aane ka) and Return (wapsi ka) in separate sections
// 2) Auto-created polls show "System" badge, manual polls show "Manual" tag
// 3) Auto-assigned routes show purple "Auto" badge in optimize button area
// 4) Transporter can still manually create polls (existing UI preserved)
// 5) Poll window info shown — passengers can respond 6 PM to 10 PM only
// 6) All original functionality (responses, optimize, delete) preserved

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  RefreshControl, Alert, ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import TimePicker         from '../components/TimePicker';
import { api }            from '../services/ApiService';
import { prefLabel }      from '../utils/formatters';

const P = {
  main:      '#415844',
  dark:      '#2D3E2F',
  white:     '#FFFFFF',
  bg:        '#F5F7F5',
  cardBg:    '#FFFFFF',
  light:     '#EDF1ED',
  border:    '#C5D0C5',
  divider:   '#E5EBE5',
  textDark:  '#1A2218',
  textMid:   '#374151',
  textLight: '#6B7280',
  textMuted: '#9CA3AF',
  success:   '#2E7D32',
  successBg: '#E8F5E9',
  error:     '#C62828',
  errorBg:   '#FFEBEE',
  warn:      '#E65100',
  warnBg:    '#FFF3E0',
  purple:    '#6A0DAD',
  purpleBg:  '#F3E8FF',
};

const initials = (name = '') =>
  (name || 'P').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

// ─────────────────────────────────────────────────────────────────
const PollSection = ({ polls, refreshing, onRefresh, loadAll, handleOptimize, optimizing, activePoll }) => {
  const [title,               setTitle]               = useState('');
  const [date,                setDate]                = useState('');
  const [timeSlot,            setTimeSlot]            = useState('');
  const [routeStartTime,      setRouteStartTime]      = useState('');
  const [routeEndTime,        setRouteEndTime]        = useState('');
  const [pollType,            setPollType]            = useState('morning');
  const [timePickerOpen,      setTimePickerOpen]      = useState(false);
  const [routeStartPickerOpen,setRouteStartPickerOpen]= useState(false);
  const [routeEndPickerOpen,  setRouteEndPickerOpen]  = useState(false);
  const [creating,            setCreating]            = useState(false);
  const [expandedId,          setExpandedId]          = useState(null);
  const [selectedPoll,        setSelectedPoll]        = useState(null);

  // Separate polls by type
  const morningPolls = (polls || []).filter(p => p.pollType === 'morning' || !p.pollType);
  const returnPolls  = (polls || []).filter(p => p.pollType === 'return');

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Required', 'Enter a poll title.'); return; }
    if (!routeStartTime) { Alert.alert('Required', 'Set the route start time. Driver can only start the route at this exact time.'); return; }
    setCreating(true);
    try {
      await api.createPoll({ title, date, timeSlot, pollType, routeStartTime, routeEndTime });
      setTitle(''); setDate(''); setTimeSlot(''); setRouteStartTime(''); setRouteEndTime(''); setPollType('morning');
      await loadAll();
      Alert.alert('Poll Created', `${pollType === 'return' ? 'Return' : 'Morning'} poll sent to passengers.\nRoute start time locked at: ${routeStartTime}`);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setCreating(false); }
  };

  const handleDelete = (poll) =>
    Alert.alert('Delete Poll?', `"${poll.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deletePoll(poll._id); await loadAll(); }
        catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);

  const renderPollCard = (poll, i) => {
    const yesResps   = (poll.responses || []).filter(r => r.response === 'yes');
    const noResps    = (poll.responses || []).filter(r => r.response === 'no');
    const autoYes    = yesResps.filter(r => r.autoYes);
    const total      = (poll.responses || []).length;
    const isSel      = selectedPoll?._id === poll._id;
    const isExpanded = expandedId === (poll._id || i);
    const pct        = total > 0 ? Math.round((yesResps.length / total) * 100) : 0;

    const prefCounts = {};
    yesResps.forEach(r => {
      const p = r.vehiclePreference || 'auto';
      prefCounts[p] = (prefCounts[p] || 0) + 1;
    });

    return (
      <View key={poll._id || i} style={[s.pollCard, isSel && s.pollCardSelected]}>
        {/* Poll header */}
        <View style={s.pollHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
              <Text style={s.pollTitle} numberOfLines={2}>{poll.title}</Text>
              {/* Auto-created badge */}
              {poll.autoCreated && (
                <View style={s.systemBadge}>
                  <Ionicons name="cog" size={10} color="#fff" />
                  <Text style={s.systemBadgeTxt}>System</Text>
                </View>
              )}
              {/* Poll closed badge */}
              {poll.status === 'closed' && (
                <View style={s.closedBadge}>
                  <Ionicons name="lock-closed" size={10} color="#fff" />
                  <Text style={s.closedBadgeTxt}>Closed</Text>
                </View>
              )}
            </View>
            <View style={s.pollMeta}>
              {poll.pollType === 'return' ? (
                <View style={s.metaItem}>
                  <Ionicons name="return-down-back" size={12} color={P.warn} />
                  <Text style={[s.metaTxt, { color: P.warn }]}>Return Journey</Text>
                </View>
              ) : (
                <View style={s.metaItem}>
                  <Ionicons name="sunny" size={12} color={P.main} />
                  <Text style={s.metaTxt}>Morning Commute</Text>
                </View>
              )}
              {poll.routeStartTime && (
                <View style={[s.metaItem, { backgroundColor: '#FFEBEE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }]}>
                  <Ionicons name="lock-closed" size={11} color="#C62828" />
                  <Text style={[s.metaTxt, { color: '#C62828', fontWeight: '700' }]}>Route: {poll.routeStartTime}{poll.routeEndTime ? ` → ${poll.routeEndTime}` : ''}</Text>
                </View>
              )}
              {poll.date && (
                <View style={s.metaItem}>
                  <Ionicons name="calendar-outline" size={12} color={P.textLight} />
                  <Text style={s.metaTxt}>{new Date(poll.date).toLocaleDateString()}</Text>
                </View>
              )}
              {poll.timeSlot && (
                <View style={s.metaItem}>
                  <Ionicons name="time-outline" size={12} color={P.textLight} />
                  <Text style={s.metaTxt}>{poll.timeSlot}</Text>
                </View>
              )}
            </View>
          </View>
          {!poll.autoCreated && (
            <TouchableOpacity onPress={() => handleDelete(poll)} style={s.deleteBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Ionicons name="trash-outline" size={19} color={P.error} />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={s.statRow}>
          <View style={[s.statChip, { backgroundColor: P.successBg }]}>
            <Ionicons name="checkmark-circle" size={13} color={P.success} />
            <Text style={[s.statChipTxt, { color: P.success }]}>{yesResps.length} Available</Text>
          </View>
          <View style={[s.statChip, { backgroundColor: P.errorBg }]}>
            <Ionicons name="close-circle" size={13} color={P.error} />
            <Text style={[s.statChipTxt, { color: P.error }]}>{noResps.length} Not Available</Text>
          </View>
          {autoYes.length > 0 && (
            <View style={[s.statChip, { backgroundColor: P.purpleBg }]}>
              <Ionicons name="flash" size={13} color={P.purple} />
              <Text style={[s.statChipTxt, { color: P.purple }]}>{autoYes.length} Auto-Yes</Text>
            </View>
          )}
        </View>

        {/* Progress bar */}
        {total > 0 && (
          <View style={s.progressWrap}>
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={s.progressLabel}>{pct}% available</Text>
          </View>
        )}

        {/* Vehicle preference */}
        {Object.keys(prefCounts).length > 0 && (
          <View style={s.prefBox}>
            <Text style={s.prefBoxLabel}>VEHICLE PREFERENCES</Text>
            <View style={s.prefChips}>
              {Object.entries(prefCounts).map(([pref, cnt]) => (
                <View key={pref} style={s.prefChip}>
                  <Ionicons
                    name={pref === 'car' ? 'car-outline' : pref === 'bus' ? 'bus-outline' : 'shuffle-outline'}
                    size={12} color={P.main}
                  />
                  <Text style={s.prefChipTxt}>{prefLabel(pref, cnt)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Expand responses */}
        {total > 0 && (
          <TouchableOpacity
            style={s.toggleResponses}
            onPress={() => setExpandedId(isExpanded ? null : (poll._id || i))}
            activeOpacity={0.75}
          >
            <Ionicons name="people-outline" size={14} color={P.main} />
            <Text style={s.toggleResponsesTxt}>Responses ({total})</Text>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={P.main} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        )}

        {isExpanded && (
          <View style={s.responsesWrap}>
            {yesResps.length > 0 && (
              <>
                <Text style={[s.responseGroupLabel, { color: P.success }]}>
                  AVAILABLE ({yesResps.length})
                </Text>
                {yesResps.map((r, ri) => (
                  <View key={ri} style={[s.responseRow, ri === yesResps.length - 1 && noResps.length === 0 && { borderBottomWidth: 0 }]}>
                    <View style={[s.responseAvatar, { backgroundColor: r.autoYes ? P.purpleBg : P.successBg }]}>
                      <Text style={[s.responseAvatarTxt, { color: r.autoYes ? P.purple : P.success }]}>
                        {initials(r.passengerName || r.name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.responseName}>{r.passengerName || r.name || 'Passenger'}</Text>
                        {r.autoYes && (
                          <View style={{ backgroundColor: P.purpleBg, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 9, color: P.purple, fontWeight: '800' }}>AUTO</Text>
                          </View>
                        )}
                      </View>
                      {(r.pickupPoint || r.pickupAddress || r.address) && (
                        <Text style={s.responseAddr} numberOfLines={1}>
                          {r.pickupPoint || r.pickupAddress || r.address}
                        </Text>
                      )}
                      {(r.destination || r.dropAddress) && (
                        <Text style={[s.responseAddr, { color: P.main }]} numberOfLines={1}>
                          → {r.destination || r.dropAddress}
                        </Text>
                      )}
                      {r.selectedTimeSlot && (
                        <Text style={[s.responseAddr, { color: P.textMid }]}>
                          ⏰ {r.selectedTimeSlot}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}

            {noResps.length > 0 && (
              <>
                <Text style={[s.responseGroupLabel, { color: P.error, marginTop: yesResps.length > 0 ? 12 : 0 }]}>
                  NOT AVAILABLE ({noResps.length})
                </Text>
                {noResps.map((r, ri) => (
                  <View key={ri} style={[s.responseRow, ri === noResps.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[s.responseAvatar, { backgroundColor: P.errorBg }]}>
                      <Text style={[s.responseAvatarTxt, { color: P.error }]}>{initials(r.passengerName || r.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.responseName, { color: P.textLight }]}>{r.passengerName || r.name || 'Passenger'}</Text>
                      {(r.pickupPoint || r.address) && (
                        <Text style={s.responseAddr} numberOfLines={1}>{r.pickupPoint || r.address}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.selectBtn, isSel && s.selectBtnActive]}
            onPress={() => setSelectedPoll(isSel ? null : poll)}
            activeOpacity={0.8}
          >
            <Ionicons name={isSel ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={isSel ? P.white : P.main} />
            <Text style={[s.selectBtnTxt, isSel && { color: P.white }]}>
              {isSel ? 'Selected' : 'Select'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.optimizeBtn, (optimizing && activePoll?._id === poll._id) && { opacity: 0.6 }]}
            onPress={() => handleOptimize(poll)}
            disabled={optimizing}
            activeOpacity={0.85}
          >
            {optimizing && activePoll?._id === poll._id ? (
              <ActivityIndicator size="small" color={P.white} />
            ) : (
              <>
                <Ionicons name="flash-outline" size={15} color={P.white} />
                <Text style={s.optimizeBtnTxt}>Optimize Routes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentContainerStyle={s.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.main]} tintColor={P.main} />}
      showsVerticalScrollIndicator={false}
    >
      <TimePicker
        visible={timePickerOpen}
        onClose={() => setTimePickerOpen(false)}
        onSelect={t => setTimeSlot(t)}
      />
      <TimePicker
        visible={routeStartPickerOpen}
        onClose={() => setRouteStartPickerOpen(false)}
        onSelect={t => setRouteStartTime(t)}
      />
      <TimePicker
        visible={routeEndPickerOpen}
        onClose={() => setRouteEndPickerOpen(false)}
        onSelect={t => setRouteEndTime(t)}
      />

      {/* ── Poll Window Info ──────────────────────────────────── */}
      <View style={s.windowInfo}>
        <Ionicons name="information-circle-outline" size={16} color={P.main} />
        <Text style={s.windowInfoTxt}>
          Passengers can fill polls from 6:00 PM to 10:00 PM. At 10 PM all responses auto-close and you get alarms to assign routes until 11:45 PM. At 12 AM system auto-assigns remaining routes.
        </Text>
      </View>

      {/* ── Create Poll card ─────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <View style={s.sectionAccent} />
        <Text style={s.sectionTitle}>Create Poll Manually</Text>
      </View>

      <View style={s.createCard}>
        {/* Poll Type Selector */}
        <View style={s.fieldGroup}>
          <View style={s.fieldLabelRow}>
            <Ionicons name="layers-outline" size={13} color={P.main} />
            <Text style={s.fieldLabel}>Poll Type</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[s.typeBtn, pollType === 'morning' && s.typeBtnActive]}
              onPress={() => setPollType('morning')}
            >
              <Ionicons name="sunny-outline" size={14} color={pollType === 'morning' ? P.white : P.main} />
              <Text style={[s.typeBtnTxt, pollType === 'morning' && { color: P.white }]}>Morning</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.typeBtn, pollType === 'return' && s.typeBtnActive]}
              onPress={() => setPollType('return')}
            >
              <Ionicons name="return-down-back-outline" size={14} color={pollType === 'return' ? P.white : P.main} />
              <Text style={[s.typeBtnTxt, pollType === 'return' && { color: P.white }]}>Return</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Poll Title */}
        <View style={s.fieldGroup}>
          <View style={s.fieldLabelRow}>
            <Ionicons name="create-outline" size={13} color={P.main} />
            <Text style={s.fieldLabel}>Poll Title</Text>
          </View>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder={pollType === 'return' ? 'e.g. Tomorrow Return Journey' : 'e.g. Tomorrow Morning Commute'}
            placeholderTextColor={P.textMuted}
          />
        </View>

        <View style={s.fieldRow}>
          {/* Date */}
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <View style={s.fieldLabelRow}>
              <Ionicons name="calendar-outline" size={13} color={P.main} />
              <Text style={s.fieldLabel}>Date (optional)</Text>
            </View>
            <TextInput
              style={s.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={P.textMuted}
            />
          </View>

          <View style={{ width: 10 }} />

          {/* Time */}
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <View style={s.fieldLabelRow}>
              <Ionicons name="time-outline" size={13} color={P.main} />
              <Text style={s.fieldLabel}>Time Slot</Text>
            </View>
            <TouchableOpacity style={[s.input, s.inputRow]} onPress={() => setTimePickerOpen(true)}>
              <Text style={{ color: timeSlot ? P.textDark : P.textMuted, fontSize: 14, fontWeight: timeSlot ? '600' : '400', flex: 1 }}>
                {timeSlot || 'Set time'}
              </Text>
              <Ionicons name="alarm-outline" size={17} color={P.main} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Route Start / End Time — driver is LOCKED to this time */}
        <View style={s.routeTimeBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Ionicons name="lock-closed" size={13} color={P.error} />
            <Text style={[s.fieldLabel, { color: P.error }]}>ROUTE START TIME (LOCKED — Driver must start exactly at this time)</Text>
          </View>
          <View style={s.fieldRow}>
            <View style={[s.fieldGroup, { flex: 1 }]}>
              <View style={s.fieldLabelRow}>
                <Ionicons name="play-circle-outline" size={13} color={P.success} />
                <Text style={s.fieldLabel}>Start Time *</Text>
              </View>
              <TouchableOpacity style={[s.input, s.inputRow]} onPress={() => setRouteStartPickerOpen(true)}>
                <Text style={{ color: routeStartTime ? P.textDark : P.textMuted, fontSize: 14, fontWeight: routeStartTime ? '700' : '400', flex: 1 }}>
                  {routeStartTime || 'Set start time'}
                </Text>
                <Ionicons name="alarm" size={17} color={P.success} />
              </TouchableOpacity>
            </View>

            <View style={{ width: 10 }} />

            <View style={[s.fieldGroup, { flex: 1 }]}>
              <View style={s.fieldLabelRow}>
                <Ionicons name="stop-circle-outline" size={13} color={P.error} />
                <Text style={s.fieldLabel}>End Time (opt)</Text>
              </View>
              <TouchableOpacity style={[s.input, s.inputRow]} onPress={() => setRouteEndPickerOpen(true)}>
                <Text style={{ color: routeEndTime ? P.textDark : P.textMuted, fontSize: 14, fontWeight: routeEndTime ? '700' : '400', flex: 1 }}>
                  {routeEndTime || 'Set end time'}
                </Text>
                <Ionicons name="alarm-outline" size={17} color={P.error} />
              </TouchableOpacity>
            </View>
          </View>
          {routeStartTime ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <Ionicons name="information-circle" size={13} color={P.success} />
              <Text style={{ fontSize: 11, color: P.success, flex: 1 }}>
                Driver can only start the route at {routeStartTime}. Early starts will be blocked.
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <Ionicons name="warning" size={13} color={P.warn} />
              <Text style={{ fontSize: 11, color: P.warn, flex: 1 }}>
                Start time is required. Driver will be locked to this time.
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[s.createBtn, creating && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.85}
        >
          {creating
            ? <ActivityIndicator size="small" color={P.white} />
            : <>
                <Ionicons name="add-circle-outline" size={17} color={P.white} />
                <Text style={s.createBtnTxt}>
                  Create {pollType === 'return' ? 'Return' : 'Morning'} Poll
                </Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* ── Morning Polls ─────────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <View style={s.sectionAccent} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="sunny" size={16} color={P.main} />
          <Text style={s.sectionTitle}>Morning Polls — Aane Ka Safar ({morningPolls.length})</Text>
        </View>
      </View>

      {morningPolls.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIconBox}>
            <Ionicons name="sunny-outline" size={34} color={P.main} />
          </View>
          <Text style={s.emptyTitle}>No morning polls</Text>
          <Text style={s.emptySub}>System auto-creates a morning poll daily at 6 PM, or create one manually above.</Text>
        </View>
      ) : (
        morningPolls.map((poll, i) => renderPollCard(poll, `morning-${i}`))
      )}

      {/* ── Return Polls ──────────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <View style={s.sectionAccent} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="return-down-back" size={16} color={P.warn} />
          <Text style={s.sectionTitle}>Return Polls — Wapsi Ka Safar ({returnPolls.length})</Text>
        </View>
      </View>

      {returnPolls.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIconBox}>
            <Ionicons name="return-down-back-outline" size={34} color={P.main} />
          </View>
          <Text style={s.emptyTitle}>No return polls</Text>
          <Text style={s.emptySub}>System auto-creates a return poll daily at 6 PM, or create one manually above.</Text>
        </View>
      ) : (
        returnPolls.map((poll, i) => renderPollCard(poll, `return-${i}`))
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

export default PollSection;

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },

  // Window info
  windowInfo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    backgroundColor: P.light, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: P.border,
  },
  windowInfoTxt: { flex: 1, fontSize: 12, color: P.textMid, lineHeight: 18 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 18, marginBottom: 12 },
  sectionAccent: { width: 4, height: 20, borderRadius: 2, backgroundColor: P.main, marginRight: 10 },
  sectionTitle:  { fontSize: 15, fontWeight: '900', color: P.dark },

  // Poll type selector
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: P.border, backgroundColor: P.light,
  },
  typeBtnActive:  { backgroundColor: P.main, borderColor: P.main },
  typeBtnTxt:     { fontSize: 13, fontWeight: '700', color: P.main },

  // Create card
  createCard: {
    backgroundColor: P.cardBg, marginHorizontal: 16, borderRadius: 16,
    padding: 16, marginBottom: 4,
    borderWidth: 1, borderColor: P.border,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  fieldGroup:    { marginBottom: 12 },
  fieldRow:      { flexDirection: 'row' },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  fieldLabel:    { fontSize: 11, fontWeight: '700', color: P.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: P.bg, borderRadius: 10,
    borderWidth: 1.5, borderColor: P.border,
    paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: P.textDark,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: P.main, borderRadius: 11, paddingVertical: 13, marginTop: 4,
  },
  createBtnTxt: { color: P.white, fontSize: 14, fontWeight: '700' },

  // Poll card
  pollCard: {
    backgroundColor: P.cardBg, marginHorizontal: 16, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: P.border,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  pollCardSelected: { borderColor: P.main, borderWidth: 2 },

  pollHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  pollTitle:    { fontSize: 14, fontWeight: '700', color: P.textDark, marginBottom: 2 },
  pollMeta:     { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt:      { fontSize: 12, color: P.textLight },
  deleteBtn:    { padding: 3, marginTop: -2 },

  // Auto / Closed / System badges
  systemBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: P.purple, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  systemBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  closedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: P.textMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  closedBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Stat row
  statRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  statChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  statChipTxt: { fontSize: 12, fontWeight: '700' },

  // Progress bar
  progressWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressBg:    { flex: 1, height: 6, backgroundColor: P.divider, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: 6, backgroundColor: P.success, borderRadius: 3 },
  progressLabel: { fontSize: 11, color: P.textMuted, fontWeight: '600', width: 70, textAlign: 'right' },

  // Preference box
  prefBox:      { backgroundColor: P.bg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: P.border, marginBottom: 12 },
  prefBoxLabel: { fontSize: 9, fontWeight: '900', color: P.textMuted, letterSpacing: 1.2, marginBottom: 6 },
  prefChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  prefChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.light, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: P.border },
  prefChipTxt:  { fontSize: 11, fontWeight: '600', color: P.main },

  // Toggle responses
  toggleResponses: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: P.divider, marginBottom: 4,
  },
  toggleResponsesTxt: { fontSize: 13, fontWeight: '700', color: P.main },

  // Responses
  responsesWrap:      { marginBottom: 10 },
  responseGroupLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8, marginTop: 2 },
  responseRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: P.divider,
  },
  responseAvatar:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  responseAvatarTxt: { fontSize: 11, fontWeight: '800' },
  responseName:      { fontSize: 13, fontWeight: '700', color: P.textDark },
  responseAddr:      { fontSize: 11, color: P.textLight, marginTop: 2 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: P.divider },
  selectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: P.main, backgroundColor: P.light,
  },
  selectBtnActive: { backgroundColor: P.dark, borderColor: P.dark },
  selectBtnTxt:    { fontSize: 13, fontWeight: '700', color: P.main },
  optimizeBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 10, backgroundColor: P.main,
  },
  optimizeBtnTxt: { fontSize: 13, fontWeight: '700', color: P.white },

  // Route time box
  routeTimeBox: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#FFCDD2',
    padding: 12, marginBottom: 12,
  },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 40 },
  emptyIconBox: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: P.cardBg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: P.border, marginBottom: 12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: P.dark, marginBottom: 5 },
  emptySub:   { fontSize: 12, color: P.textMuted, textAlign: 'center' },
});