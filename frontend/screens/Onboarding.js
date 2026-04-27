import React, { useState } from "react";
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  StatusBar, 
  Dimensions,
  Platform 
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get("window");

const slides = [
  { 
    id: 1, 
    title: "Carpooling Reinvented", 
    subtitle: "Economy aur comfort ka behtareen imtizaj. Ab apne rozana ke safar mein paise aur waqt bachayein.", 
    image: "https://img.freepik.com/free-vector/city-driver-concept-illustration_114360-1209.jpg"  
  },
  { 
    id: 2, 
    title: "Dedicated Van Service", 
    subtitle: "Students aur office employees ke liye makhsoos pick and drop service, punctuality ke saath.", 
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSX1yiH1JZKIFbY_3UVnlO7OVO97yTp-607Ig&s" 
  },
  { 
    id: 3, 
    title: "Smart Ride Sharing", 
    subtitle: "Live tracking aur verified drivers ke saath mehfooz tareeqe se apni seat book karein.", 
    image: "https://www.shutterstock.com/image-vector/people-experiencing-carpool-share-service-600nw-2668344723.jpg" 
  },
];

export default function Onboarding({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const brandGreen = "#415844"; // ✅ Aapka Green Shade

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    navigation.replace("HelloScreen"); 
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) setCurrentIndex(currentIndex + 1);
    else completeOnboarding();
  };

  return (
    <View style={os.container}>
      <StatusBar barStyle="dark-content" transparent backgroundColor="transparent" />
      
      {/* ── Background Aesthetic Shapes ── */}
      <View style={os.circle1} />
      <View style={os.circle2} />
      <View style={os.circle3} />

      <SafeAreaView style={os.safeArea}>
        {/* Skip Button */}
        <TouchableOpacity style={os.skip} onPress={completeOnboarding}>
          <Text style={os.skipText}>Skip</Text>
        </TouchableOpacity>

        <View style={os.content}>
          {/* Illustration Container */}
          <View style={os.imageContainer}>
            <Image 
              source={{ uri: slides[currentIndex].image }} 
              style={os.image} 
              resizeMode="contain" 
            />
          </View>
          
          {/* Pagination Dots */}
          <View style={os.dotsRow}>
            {slides.map((_, i) => (
              <View 
                key={i} 
                style={[
                  os.dot, 
                  { 
                    width: i === currentIndex ? 20 : 8,
                    backgroundColor: i === currentIndex ? brandGreen : "#CBD5E1" 
                  }
                ]} 
              />
            ))}
          </View>

          {/* Text Content */}
          <View style={os.textWrapper}>
             <Text style={os.title}>{slides[currentIndex].title}</Text>
             <Text style={os.subtitle}>{slides[currentIndex].subtitle}</Text>
          </View>

          {/* ✅ Green Button (Matching your theme) ── */}
          <TouchableOpacity 
            style={[os.btn, { backgroundColor: brandGreen }]} 
            onPress={handleNext} 
            activeOpacity={0.8}
          >
            <Text style={os.btnText}>
              {currentIndex === slides.length - 1 ? "Get Started" : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const os = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", overflow: 'hidden' },
  safeArea: { flex: 1, zIndex: 10 },
  
  circle1: { position: 'absolute', top: -40, left: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: '#E8F5E9', opacity: 0.7 },
  circle2: { position: 'absolute', top: height * 0.35, right: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: '#F1F8E9', opacity: 0.6 },
  circle3: { position: 'absolute', bottom: -80, left: -20, width: 280, height: 280, borderRadius: 140, backgroundColor: '#E0F2F1', opacity: 0.5 },

  skip: { alignSelf: 'flex-end', paddingHorizontal: 25, marginTop: Platform.OS === 'android' ? 40 : 10 },
  skipText: { color: "#94A3B8", fontWeight: '700', fontSize: 16 },
  
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  imageContainer: {
    width: width * 0.8,
    height: height * 0.35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  image: { width: '100%', height: '100%' },
  
  dotsRow: { flexDirection: 'row', gap: 6, marginBottom: 25, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },

  textWrapper: { paddingHorizontal: 40, marginBottom: 45, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900', color: "#1E293B", textAlign: 'center' },
  subtitle: { fontSize: 15, color: "#64748B", textAlign: 'center', marginTop: 12, lineHeight: 22, fontWeight: '500' },
  
  btn: { 
    width: 160, // ✅ Slightly wider for better text fit
    height: 56, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: "#415844",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  btnText: { color: "#fff", fontSize: 18, fontWeight: '800' }
});