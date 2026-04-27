import React, { useState } from "react";
import {
  ScrollView, View, Text, TouchableOpacity, ActivityIndicator,
  Modal, Dimensions, Alert,
} from "react-native";
import StatusBadge from "../components/StatusBadge";

const { width } = Dimensions.get("window");

const G      = "#415844";
const G2     = "#4c8853";
const GLIGHT = "#eaf3de";
const GBORDER= "#c0dd97";
const GTEXT  = "#27500a";
const GSUB   = "#639922";

export default function AvailabilityScreen({
  loading,
  available,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  availabilityHistory,
  confirmAvailability,
  markUnavailable,
}) {
  const [clockVisible, setClockVisible] = useState(false);
  const [pickerMode,   setPickerMode]   = useState("start");
  const [activeStep,   setActiveStep]   = useState("h");

  // null = show banner | "confirmed" = show update card | "dismissed" = hidden
  const [nightState, setNightState] = useState(null);

  const hoursData   = [12,1,2,3,4,5,6,7,8,9,10,11];
  const minutesData = ["00","05","10","15","20","25","30","35","40","45","50","55"];

  const formatDate = (ds) =>
    new Date(ds).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });

  const openClock = (mode) => {
    setPickerMode(mode);
    setActiveStep("h");
    setClockVisible(true);
  };

  const updateTime = (type, val) => {
    if (!val) return;
    const current = (pickerMode === "start" ? startTime : endTime) || "07:00 AM";
    const parts = current.split(" ");
    const tp = parts[0].split(":");
    let h = tp[0] || "07";
    let m = tp[1] || "00";
    let p = parts[1] || "AM";
    if (type === "h") { h = val.toString().padStart(2,"0"); setActiveStep("m"); }
    if (type === "m")   m = val.toString().padStart(2,"0");
    if (type === "p")   p = val;
    const formatted = `${h}:${m} ${p}`;
    if (pickerMode === "start") setStartTime(formatted);
    else setEndTime(formatted);
  };

  const handleConfirm = () => {
    confirmAvailability();
    setNightState("confirmed");
  };

  const handleUpdate = () => {
    confirmAvailability();
    Alert.alert("Updated!", "Your availability has been updated.", [{ text: "OK" }]);
  };

  const handleUnavailable = () => {
    setNightState("dismissed");
    if (markUnavailable) markUnavailable();
  };

  const currentTime = (mode) =>
    (mode === "start" ? startTime : endTime) || (mode === "start" ? "07:00 AM" : "06:00 PM");

  const getHour   = (mode) => currentTime(mode).split(":")[0];
  const getMin    = (mode) => currentTime(mode).split(":")[1]?.split(" ")[0] || "00";
  const getPeriod = (mode) => currentTime(mode).split(" ")[1] || "AM";

  return (
    <View style={{ flex:1, backgroundColor:"#fff" }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16, gap:10 }}>

        {/* Header */}
        <View style={{
          backgroundColor:G, borderRadius:16, padding:16,
          flexDirection:"row", alignItems:"center", justifyContent:"space-between",
        }}>
          <View>
            <Text style={{ fontSize:17, fontWeight:"500", color:"#fff" }}>My availability</Text>
            <Text style={{ fontSize:12, color:"rgba(255,255,255,.6)", marginTop:2 }}>
              Mark your shift for tomorrow
            </Text>
          </View>
          <View style={{
            flexDirection:"row", alignItems:"center", gap:5,
            backgroundColor:"rgba(255,255,255,.15)", borderRadius:20,
            paddingHorizontal:10, paddingVertical:5,
          }}>
            <View style={{ width:6, height:6, borderRadius:3, backgroundColor:"#7ec87f" }} />
            <Text style={{ fontSize:12, color:"#fff", fontWeight:"500" }}>
              {available ? "Online" : "Offline"}
            </Text>
          </View>
        </View>

        {loading && <ActivityIndicator color={G} style={{ marginVertical:6 }} />}

        {/* Night banner */}
        {nightState === null && (
          <View style={{
            backgroundColor:"#fff", borderRadius:14,
            borderWidth:0.5, borderColor:GBORDER, padding:16,
          }}>
            <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <Text style={{ fontSize:14, fontWeight:"500", color:GTEXT }}>
                Confirm tomorrow's shift
              </Text>
              <View style={{ backgroundColor:GLIGHT, borderRadius:20, paddingHorizontal:10, paddingVertical:4 }}>
                <Text style={{ fontSize:11, color:GTEXT, fontWeight:"500" }}>Window open</Text>
              </View>
            </View>

            <View style={{ flexDirection:"row", gap:8, marginBottom:12 }}>
              <TimeSlot label="START"  value={startTime || "07:00 AM"} onPress={() => openClock("start")} />
              <TimeSlot label="FINISH" value={endTime   || "06:00 PM"} onPress={() => openClock("end")}   />
            </View>

            <View style={{ flexDirection:"row", gap:8 }}>
              <TouchableOpacity
                style={{ flex:2, backgroundColor:G, borderRadius:10, paddingVertical:13, alignItems:"center" }}
                onPress={handleConfirm}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={{ color:"#fff", fontSize:14, fontWeight:"500" }}>Confirm available</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex:1, backgroundColor:"#fcebeb", borderRadius:10,
                  paddingVertical:13, alignItems:"center",
                  borderWidth:0.5, borderColor:"#f09595",
                }}
                onPress={handleUnavailable}
                activeOpacity={0.8}
              >
                <Text style={{ color:"#791f1f", fontSize:13, fontWeight:"500" }}>Not available</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ textAlign:"center", color:GSUB, fontSize:11, marginTop:8, fontWeight:"500" }}>
              Confirm between 6 PM – 10 PM daily
            </Text>
          </View>
        )}

        {/* After confirm: green strip + update duty card */}
        {nightState === "confirmed" && (
          <>
            <View style={{
              backgroundColor:GLIGHT, borderRadius:12,
              borderWidth:0.5, borderColor:GBORDER,
              padding:12, flexDirection:"row", alignItems:"center", gap:10,
            }}>
              <View style={{
                width:32, height:32, borderRadius:16,
                backgroundColor:G, alignItems:"center", justifyContent:"center",
              }}>
                <Text style={{ color:"#fff", fontSize:16, fontWeight:"500" }}>✓</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:13, fontWeight:"500", color:GTEXT }}>Availability confirmed</Text>
                <Text style={{ fontSize:11, color:GSUB, marginTop:2 }}>
                  {startTime || "07:00 AM"} – {endTime || "06:00 PM"} · Transporter will assign route soon
                </Text>
              </View>
            </View>

            <View style={{
              backgroundColor:"#fff", borderRadius:14,
              borderWidth:0.5, borderColor:GBORDER, padding:16,
            }}>
              <Text style={{ fontSize:14, fontWeight:"500", color:GTEXT, marginBottom:4 }}>
                Update duty hours
              </Text>
              <Text style={{ fontSize:11, color:GSUB, marginBottom:12 }}>
                Change your times and tap update
              </Text>
              <View style={{ flexDirection:"row", gap:8, marginBottom:12 }}>
                <TimeSlot label="START"  value={startTime || "07:00 AM"} onPress={() => openClock("start")} />
                <TimeSlot label="FINISH" value={endTime   || "06:00 PM"} onPress={() => openClock("end")}   />
              </View>
              <TouchableOpacity
                style={{ backgroundColor:G2, borderRadius:10, paddingVertical:13, alignItems:"center" }}
                onPress={handleUpdate}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color:"#fff", fontSize:14, fontWeight:"500" }}>Update availability</Text>
                }
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Recent activity */}
        <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginTop:4 }}>
          <View style={{ width:6, height:6, borderRadius:3, backgroundColor:G }} />
          <Text style={{ fontSize:13, fontWeight:"500", color:GTEXT }}>Recent activity</Text>
        </View>

        {availabilityHistory.slice(0,3).map((item, i) => (
          <View key={i} style={{
            backgroundColor:"#fff", borderRadius:12,
            borderWidth:0.5, borderColor:GBORDER,
            padding:13, flexDirection:"row",
            justifyContent:"space-between", alignItems:"center",
          }}>
            <View>
              <Text style={{ fontSize:13, fontWeight:"500", color:GTEXT }}>{formatDate(item.date)}</Text>
              <Text style={{ fontSize:11, color:GSUB, marginTop:2 }}>{item.startTime} – {item.endTime}</Text>
              {item.status === "available" && (
                <Text style={{ fontSize:10, color:GSUB, marginTop:2 }}>
                  {item.confirmed ? "Confirmed by transporter" : "Pending confirmation"}
                </Text>
              )}
            </View>
            <StatusBadge status={item.status === "available" ? "Active" : "Closed"} />
          </View>
        ))}

        {availabilityHistory.length === 0 && (
          <Text style={{ color:"#b4b2a9", fontSize:13, textAlign:"center", marginTop:16 }}>
            No availability history yet.
          </Text>
        )}

      </ScrollView>

      {/* Clock Modal */}
      <Modal visible={clockVisible} transparent animationType="fade">
        <View style={{
          flex:1, backgroundColor:"rgba(65,88,68,.65)",
          justifyContent:"center", alignItems:"center",
        }}>
          <View style={{
            width:width*0.82, backgroundColor:"#fff",
            borderRadius:24, padding:24, alignItems:"center",
          }}>
            <View style={{ flexDirection:"row", alignItems:"center", marginBottom:18 }}>
              <TouchableOpacity onPress={() => setActiveStep("h")}>
                <Text style={{ fontSize:34, fontWeight:"500", color:activeStep==="h"?G:"#b4b2a9", paddingHorizontal:6 }}>
                  {getHour(pickerMode)}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize:34, fontWeight:"500", color:G }}>:</Text>
              <TouchableOpacity onPress={() => setActiveStep("m")}>
                <Text style={{ fontSize:34, fontWeight:"500", color:activeStep==="m"?G:"#b4b2a9", paddingHorizontal:6 }}>
                  {getMin(pickerMode)}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize:14, fontWeight:"500", color:GSUB, marginLeft:8 }}>
                {getPeriod(pickerMode)}
              </Text>
            </View>

            <View style={{
              width:210, height:210, borderRadius:105,
              backgroundColor:GLIGHT, justifyContent:"center",
              alignItems:"center", marginBottom:20, position:"relative",
            }}>
              <View style={{ width:6, height:6, borderRadius:3, backgroundColor:G, position:"absolute" }} />
              {(activeStep==="h" ? hoursData : minutesData).map((num, i) => {
                const angle = (i*30-90)*(Math.PI/180);
                const x = 82*Math.cos(angle);
                const y = 82*Math.sin(angle);
                const curVal = activeStep==="h" ? parseInt(getHour(pickerMode)) : parseInt(getMin(pickerMode));
                const isSelected = parseInt(num)===curVal;
                return (
                  <TouchableOpacity
                    key={num}
                    onPress={() => updateTime(activeStep, num)}
                    style={{
                      position:"absolute",
                      transform:[{ translateX:x-17 },{ translateY:y-17 }],
                      width:34, height:34, borderRadius:17,
                      backgroundColor:isSelected?G:"transparent",
                      alignItems:"center", justifyContent:"center",
                    }}
                  >
                    <Text style={{ fontSize:13, fontWeight:"500", color:isSelected?"#fff":GTEXT }}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection:"row", gap:8, width:"100%", marginBottom:16 }}>
              {["AM","PM"].map(p => (
                <TouchableOpacity
                  key={p}
                  onPress={() => updateTime("p", p)}
                  style={{
                    flex:1, paddingVertical:10, borderRadius:10, alignItems:"center",
                    backgroundColor:getPeriod(pickerMode)===p?G:GLIGHT,
                    borderWidth:0.5, borderColor:GBORDER,
                  }}
                >
                  <Text style={{ fontWeight:"500", color:getPeriod(pickerMode)===p?"#fff":GTEXT }}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setClockVisible(false)}
              style={{ width:"100%", backgroundColor:G2, borderRadius:10, paddingVertical:13, alignItems:"center" }}
            >
              <Text style={{ color:"#fff", fontWeight:"500", fontSize:14 }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TimeSlot({ label, value, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flex:1, backgroundColor:"#eaf3de", borderRadius:10,
        padding:12, alignItems:"center",
        borderWidth:0.5, borderColor:"#c0dd97",
      }}
    >
      <Text style={{ fontSize:10, color:"#3b6d11", fontWeight:"500", letterSpacing:0.6, marginBottom:4 }}>
        {label}
      </Text>
      <Text style={{ fontSize:17, fontWeight:"500", color:"#27500a" }}>{value}</Text>
    </TouchableOpacity>
  );
}