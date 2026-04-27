import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { s } from '../styles/styles';
import C from '../constants/colors';

const StatCard = ({ label, value, iconName, onPress }) => (
  <TouchableOpacity style={s.statCard} onPress={onPress} activeOpacity={onPress ? 0.75 : 1}>
    <View style={s.statIconWrap}><Icon name={iconName} size={20} color={C.primaryDark} /></View>
    <Text style={s.statValue}>{value ?? '—'}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </TouchableOpacity>
);

export default StatCard;