// frontend/Passenger/src/constants/quickReplies.js
// Formal predefined quick reply messages — Passenger → Driver

export const PASSENGER_QUICK_REPLIES = [
  { id: 'pqr1', text: 'I am on my way to the stop.' },
  { id: 'pqr2', text: 'I will need approximately 2 minutes.' },
  { id: 'pqr3', text: 'I will need approximately 5 minutes.' },
  { id: 'pqr4', text: 'I am currently delayed. Please wait.' },
  { id: 'pqr5', text: 'I am reaching the stop now.' },
  { id: 'pqr6', text: 'I have arrived at the stop.' },
  { id: 'pqr7', text: 'Please proceed. I am ready.' },
  { id: 'pqr8', text: 'Kindly wait for 1 minute.' },
];

// Formal predefined quick replies — Driver → Passenger
export const DRIVER_QUICK_REPLIES = [
  { id: 'dqr1', text: 'I have arrived at your stop.' },
  { id: 'dqr2', text: 'I am on my way.' },
  { id: 'dqr3', text: 'Please come outside now.' },
  { id: 'dqr4', text: 'I will be there in 2 minutes.' },
  { id: 'dqr5', text: 'I will be there in 5 minutes.' },
  { id: 'dqr6', text: 'Kindly be ready at the stop.' },
  { id: 'dqr7', text: 'Route has started.' },
  { id: 'dqr8', text: 'Acknowledged.' },
];
