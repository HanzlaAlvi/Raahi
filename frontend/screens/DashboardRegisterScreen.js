import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, SafeAreaView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Linking } from "react-native"; 

const { width } = Dimensions.get("window");

export default function DashboardRegisterScreen({ navigation }) {
  const [role, setRole] = useState("");

  const brandGreen = "#415844";
  const darkSage = "#1E293B";

  const handleNext = () => {
    if (!role) return;

    // Navigation logic matching your App.js names
    switch (role) {
      case "Driver":
        navigation.navigate("DriverRegister");
        break;
      case "Transporter":
        navigation.navigate("TransporterRegister");
        break;
      case "Passenger":
        navigation.navigate("PassengerRequestScreen");
        break;
      default:
        break;
    }
  };

  const RoleOption = ({ title, value, icon, sub }) => {
    const isSelected = role === value;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setRole(value)}
        style={[
          s.roleCard,
          isSelected && { borderColor: brandGreen, backgroundColor: "#F0F9F0", borderWidth: 2 }
        ]}
      >
        <View style={[s.iconBox, isSelected && { backgroundColor: brandGreen }]}>
          <Ionicons name={icon} size={26} color={isSelected ? "#fff" : brandGreen} />
        </View>
        
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={[s.roleTitle, isSelected && { color: brandGreen }]}>{title}</Text>
          <Text style={s.roleSub}>{sub}</Text>
        </View>

        <View style={[s.checkCircle, isSelected && { backgroundColor: brandGreen, borderColor: brandGreen }]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        
        {/* Branding Section */}
        <View style={s.header}>
          <View style={s.logoCircle}>
             <Ionicons name="bus" size={35} color="#fff" />
          </View>
          <Text style={s.mainTitle}>Welcome to Raahi</Text>
          <Text style={s.mainSub}>Who are you joining us as today?</Text>
        </View>

        {/* Interactive Selection */}
        <View style={s.selectionArea}>
          <RoleOption 
            title="Passenger" 
            value="Passenger" 
            icon="people" 
            sub="I want to book a safe ride" 
          />
          <RoleOption 
            title="Driver" 
            value="Driver" 
            icon="car-sport" 
            sub="I want to drive and earn" 
          />
          <RoleOption 
            title="Transporter" 
            value="Transporter" 
            icon="business" 
            sub="I manage a fleet of vehicles" 
          />
        </View>

        {/* Call to Action */}
        <View style={s.footer}>
          <TouchableOpacity 
            style={[s.continueBtn, !role && s.btnDisabled]} 
            onPress={handleNext}
            disabled={!role}
          >
            <Text style={s.btnText}>Continue</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" style={{marginLeft: 5}} />
          </TouchableOpacity>
          
          <TouchableOpacity style={s.helpLink} onPress={() => Linking.openURL('mailto:raahi.support@gmail.com')}>
            <Text style={s.helpText}>Need help deciding? <Text style={{color: brandGreen, fontWeight: '700'}}>Contact Support</Text></Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#FFFFFF" 
  },
  content: { 
    flex: 1, 
    paddingHorizontal: 30, 
    justifyContent: 'center' 
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 50 
  },
  logoCircle: { 
    width: 75, 
    height: 75, 
    backgroundColor: "#415844", 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: "#415844", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 8 }
    })
  },
  mainTitle: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: "#1E293B", 
    letterSpacing: -0.5 
  },
  mainSub: { 
    fontSize: 15, 
    color: "#64748B", 
    marginTop: 8, 
    fontWeight: '500',
    textAlign: 'center'
  },
  selectionArea: { 
    gap: 16, 
    marginBottom: 50 
  },
  roleCard: {
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20,
    borderRadius: 24, 
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5, 
    borderColor: "#F1F5F9",
  },
  iconBox: {
    width: 54, 
    height: 54, 
    borderRadius: 16, 
    backgroundColor: "#fff",
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  roleTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: "#1E293B" 
  },
  roleSub: { 
    fontSize: 12, 
    color: "#94A3B8", 
    marginTop: 3, 
    fontWeight: '600' 
  },
  checkCircle: {
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    borderWidth: 2,
    borderColor: "#E2E8F0", 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  footer: { 
    alignItems: 'center' 
  },
  continueBtn: {
    backgroundColor: "#415844", 
    width: '100%', 
    height: 64,
    borderRadius: 20, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: "#439b4e", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 10 },
      android: { elevation: 6 }
    })
  },
  btnDisabled: { 
    backgroundColor: "#CBD5E1", 
    elevation: 0 
  },
  btnText: { 
    color: "#fff", 
    fontSize: 18, 
    fontWeight: '800', 
    letterSpacing: 0.5 
  },
  helpLink: { 
    marginTop: 25 
  },
  helpText: { 
    fontSize: 13, 
    color: "#64748B", 
    fontWeight: '600' 
  }
});