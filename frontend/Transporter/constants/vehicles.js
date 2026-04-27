// frontend/Transporter/constants/vehicles.js
export const VEHICLE_CAPS = { car: 4, van: 12, bus: 30 };

export const VEHICLE_INFO = {
  car: { icon: 'car-outline',   label: 'Car', desc: 'Suzuki/Toyota City Car',  capacity: 4  },
  van: { icon: 'bus-outline',   label: 'Van', desc: 'Toyota HiAce/Shehzore',   capacity: 12 },
  bus: { icon: 'train-outline', label: 'Bus', desc: 'Hino/Isuzu Coach Bus',     capacity: 30 },
};

// ── Profile & Notifications removed from menu
// ── Driver Requests + Passenger Requests merged into single "Requests" item
export const MENU_ITEMS = [
  { key: 'overview',      label: 'Dashboard',          ionIcon: 'grid-outline'               },
  { key: 'poll',          label: 'Availability Polls',  ionIcon: 'bar-chart-outline'          },
  { key: 'smart-route',   label: 'Smart Routes',        ionIcon: 'flash-outline'              },
  { key: 'routes',        label: 'Routes',              ionIcon: 'map-outline'                },
  { key: 'assign',        label: 'Assign Driver',       ionIcon: 'person-add-outline'         },
  { key: 'tracking',      label: 'Live Tracking',       ionIcon: 'navigate-outline'           },
  { key: 'requests',      label: 'Requests',            ionIcon: 'people-outline'             },
  { key: 'payments',      label: 'Payments',            ionIcon: 'card-outline'               },
  { key: 'complaints',    label: 'Complaints',          ionIcon: 'chatbubble-ellipses-outline' },
];

export const ROUTE_COLORS = [
  '#415844', '#FF9800', '#2196F3',
  '#E91E63', '#9C27B0', '#00BCD4', '#FF5722',
];