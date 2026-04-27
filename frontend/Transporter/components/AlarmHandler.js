import React, { useState, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import messaging from '@react-native-firebase/messaging';
import AlarmModal from './AlarmModal';

export default function AlarmHandler() {
  const [alarmVisible, setAlarmVisible] = useState(false);
  const alarmSound = useRef(null);
  const snoozeTimeout = useRef(null);

  // Play alarm sound
  const playAlarm = async () => {
    if (alarmSound.current) {
      await alarmSound.current.replayAsync();
      return;
    }
    const { sound } = await Audio.Sound.createAsync(
      require('../../../assets/sounds/alarm.mp3'),
      { shouldPlay: true, isLooping: true }
    );
    alarmSound.current = sound;
    await sound.playAsync();
  };

  // Stop alarm sound
  const stopAlarm = async () => {
    if (alarmSound.current) {
      await alarmSound.current.stopAsync();
      await alarmSound.current.unloadAsync();
      alarmSound.current = null;
    }
  };

  // Handle FCM alarm notification
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      if (remoteMessage.data?.type === 'alarm') {
        setAlarmVisible(true);
        playAlarm();
      }
    });
    return () => {
      unsubscribe();
      if (snoozeTimeout.current) clearTimeout(snoozeTimeout.current);
      stopAlarm();
    };
  }, []);

  // Snooze: hide modal, play again after 5 min
  const handleSnooze = () => {
    setAlarmVisible(false);
    stopAlarm();
    snoozeTimeout.current = setTimeout(() => {
      setAlarmVisible(true);
      playAlarm();
    }, 5 * 60 * 1000); // 5 minutes
  };

  // Stop: hide modal and stop sound
  const handleStop = () => {
    setAlarmVisible(false);
    stopAlarm();
    if (snoozeTimeout.current) clearTimeout(snoozeTimeout.current);
  };

  return (
    <AlarmModal visible={alarmVisible} onSnooze={handleSnooze} onStop={handleStop} />
  );
}
