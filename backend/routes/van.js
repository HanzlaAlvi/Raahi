'use strict';
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');

// In-memory store (same as original)
let vans = [
  { id:'1', name:'Van-A', driver:'Ahmed Ali',  currentLocation:{latitude:33.6844,longitude:73.0479}, status:'En Route', passengers:12, capacity:20, eta:'5 mins',  color:'#FF5733' },
  { id:'2', name:'Van-B', driver:'Sajid Khan', currentLocation:{latitude:33.6484,longitude:73.0234}, status:'Delayed',  passengers:8,  capacity:15, eta:'12 mins', color:'#33FF57' },
];

router.get('/', auth, (req, res) => res.json({ success: true, vans, data: vans }));

router.put('/:id/location', auth, (req, res) => {
  const idx = vans.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false });
  vans[idx] = { ...vans[idx], currentLocation: req.body };
  res.json({ success: true, van: vans[idx] });
});

module.exports = router;