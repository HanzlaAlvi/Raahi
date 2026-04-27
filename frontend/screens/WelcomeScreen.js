import React, { useEffect } from "react";
import { View, Text, Image, StyleSheet, Dimensions, StatusBar, Animated } from "react-native";

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen({ navigation }) {
  // Fade animation for smooth entrance
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    // Logo fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // 3 seconds baad Onboarding par switch
    const timer = setTimeout(() => {
      navigation.replace("Onboarding"); 
    }, 3500); 

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={s.container}>
      {/* Status bar white rakhi h logo se match karne ke liye */}
      <StatusBar barStyle="dark-content" backgroundColor="#fffff" />
      
      <Animated.View style={[s.content, { opacity: fadeAnim }]}>
        {/* Aapka naya Raahi Logo */}
        <View style={s.logoWrapper}>
          <Image 
            source={require("./Raahi.png")} 
            style={s.logo} 
            resizeMode="contain" 
          />
        </View>

        {/* Minimal Tagline - Logo ke niche space balance karne ke liye */}
        <View style={s.textGroup}>
          <Text style={s.subtitle}>Economy in Every Journey</Text>
          
          {/* Subtle loading indicator line (optional) */}
          <View style={s.loadingTrack}>
            <View style={s.loadingBar} />
          </View>
        </View>
      </Animated.View>

      <View style={s.footer}>
        <Text style={s.version}>v 1.0.1</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f5f6f5", // Pure white background for that clean logo look
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: width * 0.8,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: { 
    width: '100%', 
    height: '100%' 
  },
  textGroup: {
    marginTop: 20,
    alignItems: 'center'
  },
  subtitle: { 
    fontSize: 16, 
    color: "#64748B", 
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase'
  },
  loadingTrack: {
    width: 100,
    height: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginTop: 30,
    overflow: 'hidden'
  },
  loadingBar: {
    width: '40%',
    height: '100%',
    backgroundColor: '#439b4e',
    borderRadius: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
  },
  version: {
    fontSize: 12,
    color: "#CBD5E1",
    fontWeight: '700'
  }
});