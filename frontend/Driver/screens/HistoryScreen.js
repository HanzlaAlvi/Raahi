import React from "react";
import { ScrollView, View, Text, TouchableOpacity, TextInput, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { driverStyles } from "../constants/driverStyles";
import AsyncStorage from "@react-native-async-storage/async-storage";
import StatusBadge from "../components/StatusBadge";

export default function HistoryScreen() {
  const [trips, setTrips] = React.useState([]);
  const [filteredTrips, setFilteredTrips] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("All");
  const [loading, setLoading] = React.useState(true);
  const [driverId, setDriverId] = React.useState(null);
  const [authToken, setAuthToken] = React.useState(null);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const token = await AsyncStorage.getItem("authToken");
        const userId = await AsyncStorage.getItem("userId") || await AsyncStorage.getItem("driverId");
        if (!token || !userId) return;
        setDriverId(userId);
        setAuthToken(token);
        const res = await fetch("https://raahi-q2ur.onrender.com/api/trips/driver/ride-history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setTrips(data.rides || data.data || []);
        setFilteredTrips(data.rides || data.data || []);
      } catch (e) {
        console.error("History load error:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  React.useEffect(() => {
    let result = trips;
    if (search) {
      result = trips.filter(trip =>
        trip.routeName?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (filter !== "All") {
      result = result.filter(trip => trip.status === filter);
    }
    setFilteredTrips(result);
  }, [trips, search, filter]);

  const sageColor = "#415844";
  const darkSage = "#415844";

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" }}>
        <ActivityIndicator size="large" color={sageColor} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* ── Search Bar Section ─────────────────────────────────────────── */}
      <View style={{ 
        paddingHorizontal: 20, 
        paddingTop: 15, 
        paddingBottom: 10,
        backgroundColor: "#F9FAFB" 
      }}>
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#fff",
          borderRadius: 16,
          paddingHorizontal: 15,
          height: 52,
          borderWidth: 1,
          borderColor: "#F0F0F0",
          ...Platform.select({
            ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
            android: { elevation: 2 }
          })
        }}>
          <Ionicons name="search" size={20} color={sageColor} />
          <TextInput
            style={{ flex: 1, marginLeft: 10, fontSize: 15, color: "#111827" }}
            placeholder="Search routes..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* ── Filter Tabs ────────────────────────────────────────────────── */}
      <View style={{ marginBottom: 15 }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10 }}
        >
          {["All", "Completed", "Missed", "Cancelled"].map((tab) => {
            const isActive = filter === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setFilter(tab)}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 12,
                  marginRight: 10,
                  backgroundColor: isActive ? sageColor : "#fff",
                  borderWidth: 1,
                  borderColor: isActive ? sageColor : "#F0F0F0",
                }}
              >
                <Text style={{ 
                  fontSize: 14, 
                  fontWeight: "700", 
                  color: isActive ? "#fff" : "#6B7280" 
                }}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Trip List ──────────────────────────────────────────────────── */}
      <ScrollView 
        style={driverStyles.scrollContent} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={driverStyles.contentPadding}>
          {filteredTrips.length > 0 ? (
            filteredTrips.map((trip) => (
              <TouchableOpacity 
                key={trip._id} 
                activeOpacity={0.9}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 22,
                  padding: 18,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: "#F0F0F0",
                  ...Platform.select({
                    ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10 },
                    android: { elevation: 2 }
                  })
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>
                      {trip.routeName || "Route"}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                      <Text style={{ fontSize: 12, color: "#9CA3AF", marginLeft: 4 }}>
                        {new Date(trip.createdAt).toLocaleDateString("en-US", { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                  </View>
                  <StatusBadge status={trip.status} />
                </View>

                {/* Divider Line */}
                <View style={{ height: 1, backgroundColor: '#F9FAFB', marginVertical: 12 }} />

                <View style={{ flexDirection: "row", alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#F3F4F6', padding: 6, borderRadius: 8 }}>
                      <Ionicons name="people" size={16} color={sageColor} />
                    </View>
                    <Text style={{ color: "#4B5563", fontSize: 13, fontWeight: "600", marginLeft: 8 }}>
                      {trip.passengers?.length || 0} Passengers
                    </Text>
                  </View>

                  {trip.timeSlot && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ backgroundColor: '#F3F4F6', padding: 6, borderRadius: 8 }}>
                        <Ionicons name="time" size={16} color={sageColor} />
                      </View>
                      <Text style={{ color: "#4B5563", fontSize: 13, fontWeight: "600", marginLeft: 8 }}>
                        {trip.timeSlot}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={{ alignItems: "center", marginTop: 60, opacity: 0.5 }}>
              <Ionicons name="bus-outline" size={60} color="#9CA3AF" />
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#4B5563", marginTop: 16 }}>No trips found</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}