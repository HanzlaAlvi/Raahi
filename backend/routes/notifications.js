'use strict';
const express       = require('express');
const router        = express.Router();
const Notification  = require('../models/Notification');
const auth          = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try { const n=await Notification.find({userId:req.userId}).sort({createdAt:-1}).limit(50); res.json({success:true,notifications:n,data:n}); }
  catch { res.status(500).json({success:false}); }
});
router.put('/read-all', auth, async (req, res) => {
  try { await Notification.updateMany({userId:req.userId,read:false},{read:true}); res.json({success:true,message:'All marked read'}); }
  catch { res.status(500).json({success:false}); }
});
router.put('/:id/read', auth, async (req, res) => {
  try { const n=await Notification.findByIdAndUpdate(req.params.id,{read:true},{new:true}); if(!n) return res.status(404).json({success:false}); res.json({success:true,notification:n}); }
  catch { res.status(500).json({success:false}); }
});
router.delete('/:id', auth, async (req, res) => {
  try { await Notification.findByIdAndDelete(req.params.id); res.json({success:true}); }
  catch { res.status(500).json({success:false}); }
});

module.exports = router;