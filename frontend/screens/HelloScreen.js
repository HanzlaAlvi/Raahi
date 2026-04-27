import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, SafeAreaView, Dimensions, StatusBar, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");
import LoginScreen from "../auth/LoginScreen";
export default function HelloScreen({ navigation }) {
  const brandGreen = "#415844";

  return (
    <View style={hs.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* ── Top Section: Length Balanced Image ── */}
      <View style={hs.imageWrapper}>
        <Image 
          source={require("./van_1.png")} 
          style={hs.mainImage}
          resizeMode="cover"
        />
        <View style={hs.imageOverlay} />
      </View>

      {/* ── Content Section: Balanced Spacing ── */}
      <SafeAreaView style={hs.contentWrapper}>
        <View style={hs.content}>
          
          {/* Minimal & Centered Text */}
          <View style={hs.textGroup}>
            <Text style={hs.helloText}>Welcome to Raahi</Text>
            <Text style={hs.description}>
              Premium pick & drop services for your daily commute.
            </Text>
          </View>

          {/* Action Area - Balanced at bottom */}
          <View style={hs.actionArea}>
            <TouchableOpacity 
              activeOpacity={0.85}
              style={[hs.btn, { backgroundColor: brandGreen }]} 
              onPress={() => navigation.navigate("Login")}>
              <Text style={hs.btnTextWhite}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.7}
              style={[hs.btn, hs.outlineBtn, { borderColor: brandGreen }]}
              onPress={() => navigation.navigate("DashboardRegister")}
            >
              <Text style={[hs.btnTextGreen, { color: brandGreen }]}>Create Account</Text>
            </TouchableOpacity>
            
            <View style={hs.trustBadge}>
              <Ionicons name="shield-checkmark-sharp" size={14} color="#CBD5E1" />
              <Text style={hs.footerTag}>Safe • Punctual • Reliable</Text>
            </View>
          </View>
          
        </View>
      </SafeAreaView>
    </View>
  );
}

const hs = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#FFFFFF" 
  },
  
  imageWrapper: {
    width: width,
    height: height * 0.48, // Length wise balance ke liye height thodi badhai h
    borderBottomLeftRadius: 55,
    borderBottomRightRadius: 55,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    elevation: 15,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 }
  },
  mainImage: { 
    width: '100%', 
    height: '100%' 
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.03)'
  },

  contentWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 35,
    paddingTop: 40,
    paddingBottom: Platform.OS === 'ios' ? 20 : 30,
    justifyContent: 'space-between', // Elements ko poori length par distribute karega
  },
  
  textGroup: {
    alignItems: 'center',
    width: '100%',
  },
  helloText: {
    fontSize: 32,
    fontWeight: '900',
    color: "#1E293B",
    textAlign: 'center',
    letterSpacing: -0.5
  },
  description: {
    fontSize: 16,
    color: "#64748B",
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
    fontWeight: '500',
  },

  actionArea: {
    width: '100%',
    gap: 15,
    alignItems: 'center',
  },
  btn: {
    width: '100%',
    height: 62,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: "#439b4e",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 }
  },
  outlineBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    elevation: 0,
    shadowOpacity: 0,
    shadowColor: 'transparent'
  },
  btnTextWhite: { 
    color: "#fff", 
    fontSize: 18, 
    fontWeight: '800' 
  },
  btnTextGreen: { 
    fontSize: 18, 
    fontWeight: '800' 
  },

  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 6
  },
  footerTag: {
    fontSize: 11,
    color: "#CBD5E1",
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  }
});