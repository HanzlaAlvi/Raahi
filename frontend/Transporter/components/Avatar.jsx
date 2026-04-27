import React, { useMemo } from 'react';
import { View, Text, Image } from 'react-native';
import C from '../constants/colors';

const Avatar = ({ uri, name, size = 60 }) => {
  const init = useMemo(() => {
    if (!name) return 'T';
    const pts = name.trim().split(' ');
    return pts.length > 1 ? `${pts[0][0]}${pts[1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
  }, [name]);

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      overflow: 'hidden', backgroundColor: C.primary,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: C.white,
    }}>
      {uri
        ? <Image source={{ uri }} style={{ width: size, height: size }} />
        : <Text style={{ color: C.black, fontSize: size * 0.35, fontWeight: '900' }}>{init}</Text>
      }
    </View>
  );
};

export default Avatar;