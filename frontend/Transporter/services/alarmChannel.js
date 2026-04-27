import notifee, { AndroidImportance } from '@notifee/react-native';

export async function createAlarmChannel() {
  await notifee.createChannel({
    id: 'alarm_channel',
    name: 'Alarm Channel',
    sound: 'alarm', // no .mp3 extension
    importance: AndroidImportance.HIGH,
  });
}
