import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const STATUS_CONFIG = {
  completed:     { bg: "#ECFDF5", fg: "#059669", border: "#A7F3D0", icon: "checkmark-circle",           label: "Completed"   },
  picked:        { bg: "#ECFDF5", fg: "#059669", border: "#A7F3D0", icon: "checkmark-circle",           label: "Picked"      },
  resolved:      { bg: "#ECFDF5", fg: "#059669", border: "#A7F3D0", icon: "checkmark-circle",           label: "Resolved"    },
  available:     { bg: "#ECFDF5", fg: "#059669", border: "#A7F3D0", icon: "radio-button-on",            label: "Available"   },
  transferred:   { bg: "#ECFDF5", fg: "#059669", border: "#A7F3D0", icon: "arrow-up-circle",            label: "Transferred" },
  paid:          { bg: "#ECFDF5", fg: "#059669", border: "#A7F3D0", icon: "cash",                       label: "Paid"        },
  cancelled:     { bg: "#FFF1F2", fg: "#E11D48", border: "#FECDD3", icon: "close-circle",               label: "Cancelled"   },
  unavailable:   { bg: "#FFF1F2", fg: "#E11D48", border: "#FECDD3", icon: "radio-button-off",           label: "Unavailable" },
  missed:        { bg: "#FFF1F2", fg: "#E11D48", border: "#FECDD3", icon: "alert-circle",               label: "Missed"      },
  "in progress": { bg: "#EFF6FF", fg: "#2563EB", border: "#BFDBFE", icon: "time",                       label: "In Progress" },
  "in_progress": { bg: "#EFF6FF", fg: "#2563EB", border: "#BFDBFE", icon: "time",                       label: "In Progress" },
  "en route":    { bg: "#EFF6FF", fg: "#2563EB", border: "#BFDBFE", icon: "navigate",                   label: "En Route"    },
  started:       { bg: "#EFF6FF", fg: "#2563EB", border: "#BFDBFE", icon: "play-circle",                label: "Started"     },
  assigned:      { bg: "#F5F3FF", fg: "#7C3AED", border: "#DDD6FE", icon: "person",                     label: "Assigned"    },
  scheduled:     { bg: "#F5F3FF", fg: "#7C3AED", border: "#DDD6FE", icon: "calendar",                   label: "Scheduled"   },
  next:          { bg: "#FFF7ED", fg: "#D97706", border: "#FDE68A", icon: "arrow-forward-circle",        label: "Next"        },
  pending:       { bg: "#FFF7ED", fg: "#D97706", border: "#FDE68A", icon: "ellipsis-horizontal-circle",  label: "Pending"     },
};

export default function StatusBadge({ status, size = "sm" }) {
  const key    = (status || "").toLowerCase();
  const config = STATUS_CONFIG[key] || {
    bg: "#F9FAFB", fg: "#6B7280", border: "#E5E7EB", icon: "ellipse-outline", label: status || "—",
  };
  const isLarge = size === "lg";

  return (
    <View style={{
      flexDirection:     "row",
      alignItems:        "center",
      backgroundColor:   config.bg,
      borderWidth:       1,
      borderColor:       config.border,
      borderRadius:      20,
      paddingVertical:   isLarge ? 6 : 4,
      paddingHorizontal: isLarge ? 12 : 8,
      gap:               4,
      alignSelf:         "flex-start",
    }}>
      <Ionicons name={config.icon} size={isLarge ? 14 : 11} color={config.fg} />
      <Text style={{ color: config.fg, fontWeight: "700", fontSize: isLarge ? 13 : 11, letterSpacing: 0.3 }}>
        {config.label}
      </Text>
    </View>
  );
}