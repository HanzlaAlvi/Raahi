import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function AlarmModal({ visible, onSnooze, onStop }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>⏰ Alarm</Text>
          <Text style={styles.msg}>Poll response received! Take action.</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={onSnooze}>
              <Text style={styles.btnText}>Snooze</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={onStop}>
              <Text style={styles.btnText}>Stop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', alignItems:'center' },
  card: { backgroundColor:'#fff', borderRadius:20, padding:30, alignItems:'center', width:300 },
  title: { fontSize:28, fontWeight:'bold', marginBottom:10 },
  msg: { fontSize:16, marginBottom:30 },
  row: { flexDirection:'row', justifyContent:'space-between', width:'100%' },
  btn: { flex:1, marginHorizontal:10, backgroundColor:'#f5e6c8', borderRadius:10, padding:15, alignItems:'center' },
  btnText: { fontSize:18, color:'#b48a3c', fontWeight:'bold' }
});
