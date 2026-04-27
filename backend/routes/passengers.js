'use strict';
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const auth    = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try { const p=await User.find({$or:[{role:'passenger'},{type:'passenger'}],transporterId:req.query.transporterId||req.userId}).sort({name:1}); res.json({success:true,passengers:p,data:p}); }
  catch { res.status(500).json({success:false}); }
});
router.get('/:passengerId', auth, async (req, res) => {
  try { const p=await User.findById(req.params.passengerId); if(!p) return res.status(404).json({success:false}); res.json({success:true,passenger:p}); }
  catch { res.status(500).json({success:false}); }
});
router.put('/:passengerId', auth, async (req, res) => {
  try { const p=await User.findByIdAndUpdate(req.params.passengerId,req.body,{new:true}); if(!p) return res.status(404).json({success:false}); res.json({success:true,passenger:p}); }
  catch { res.status(500).json({success:false}); }
});

module.exports = router;