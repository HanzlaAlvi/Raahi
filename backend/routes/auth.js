'use strict';
// routes/auth.js

const express   = require('express');
const jwt       = require('jsonwebtoken');
const mongoose  = require('mongoose');
const nodemailer = require('nodemailer');
const router    = express.Router();

const User             = require('../models/User');
const JoinRequest      = require('../models/JoinRequest');
const sendNotification = require('../helpers/notification');
const auth             = require('../middleware/auth');
const { JWT_SECRET }   = require('../config/constants');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─────────────────────────────────────────────────────────────────────────────
// Email Validation — TWO LAYER CHECK
//
// LAYER 1 — DNS MX Check (built-in dns module, no package needed)
//   → Domain ke MX records check karta hai
//   → Fake/non-existent domains (abc@fakesite.xyz) yahan hi block ho jaate hain
//   → gmail.com, yahoo.com etc. ke MX records exist karte hain → pass
//
// LAYER 2 — SMTP Existence Check (email-existence npm package)
//   → Domain ke mail server se directly SMTP handshake karta hai
//   → Confirm karta hai ke email address actually accept hota hai ya nahi
//   → IMPORTANT: Gmail/Yahoo/Outlook SMTP block karte hain → inhe skip karo
//   → Sirf unknown/custom domains pe yeh check lagao (e.g. company.com etc.)
//   → Agar SMTP bhi false return kare → block
//
// RESULT: Fake domains guaranteed block. Real known providers (Gmail etc.) DNS
// check se pass hote hain. Unknown domains dono checks se guzarte hain.
// ─────────────────────────────────────────────────────────────────────────────
const dns            = require('dns').promises;
const emailExistence = require('email-existence');

// Yeh domains SMTP block karte hain — sirf DNS check kaafi hai inke liye
const SMTP_SKIP_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.in', 'yahoo.co.in',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me',
  'aol.com',
]);

// SMTP check — Promise wrapper with timeout
const smtpCheck = (email) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), 8000); // 8s timeout → allow
    emailExistence.check(email, (err, exists) => {
      clearTimeout(timer);
      if (err) return resolve(true); // error → allow (real users block na hon)
      resolve(exists);
    });
  });

const verifyEmailDomain = async (email) => {
  try {
    const domain = (email.split('@')[1] || '').toLowerCase();
    if (!domain) return { valid: false, reason: 'Invalid email format.' };

    // ── LAYER 1: DNS MX Check ──────────────────────────────────────────────
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0)
        return { valid: false, reason: `"${domain}" ek valid email domain nahi hai. Kripya apna asli email address use karein (jaise Gmail, Yahoo, Outlook).` };
    } catch (dnsErr) {
      if (['ENOTFOUND', 'ENODATA', 'ESERVFAIL', 'EREFUSED'].includes(dnsErr.code))
        return { valid: false, reason: `"${domain}" exist nahi karta. Kripya ek real email address enter karein.` };
      // Unexpected DNS error → layer 2 pe ja
    }

    // ── LAYER 2: SMTP Check (skip for known providers) ────────────────────
    if (!SMTP_SKIP_DOMAINS.has(domain)) {
      console.log(`[emailVerify] Running SMTP check for unknown domain: ${domain}`);
      const smtpOk = await smtpCheck(email);
      if (!smtpOk)
        return { valid: false, reason: `"${email}" koi valid email address nahi lagta. Kripya apna asli email address enter karein.` };
    }

    return { valid: true };
  } catch (err) {
    console.warn('[verifyEmailDomain] Unexpected error:', err.message);
    return { valid: true }; // unexpected error → allow
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Nodemailer transporter — reads from Render environment variables
// Set these in Render dashboard → Environment:
//   EMAIL_USER = your Gmail address  (e.g. raahi.app@gmail.com)
//   EMAIL_PASS = your Gmail App Password (16 chars, no spaces)
// ─────────────────────────────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (toEmail, otp, userName) => {
  await mailer.sendMail({
    from: `"Raahi App" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your Raahi Password Reset OTP',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:12px;">
        <h2 style="color:#415844;margin-bottom:8px;">Raahi Password Reset</h2>
        <p style="color:#555;">Hi ${userName || 'there'},</p>
        <p style="color:#555;">Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.</p>
        <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#415844;text-align:center;padding:24px;background:#EAF4EB;border-radius:8px;margin:24px 0;">
          ${otp}
        </div>
        <p style="color:#999;font-size:12px;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const u = await User.findOne({ email: email.toLowerCase(), password });
    if (!u) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const ar = u.role || u.type;
    if (role && ar !== role)
      return res.status(403).json({ success: false, message: `Account role is "${ar}", not "${role}".` });
    const token = jwt.sign({ userId: u._id, email: u.email, role: ar }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true, token,
      user: {
        id: u._id, name: u.name, email: u.email, role: ar, type: ar,
        phone: u.phone, company: u.company, status: u.status,
        approved: u.status === 'active', isApproved: u.status === 'active',
        isVerified: u.status === 'active', pickupPoint: u.pickupPoint,
        destination: u.destination, preferredTimeSlot: u.preferredTimeSlot,
        address: u.address, latitude: u.latitude, longitude: u.longitude,
        transporterId: u.transporterId || (ar === 'transporter' ? u._id : null),
        license: u.license, van: u.van, vehicleNo: u.vehicleNo,
        capacity: u.capacity, vehicle: u.vehicle, vehicleType: u.vehicleType,
        experience: u.experience, availableTimeSlots: u.availableTimeSlots,
        country: u.country, city: u.city, zone: u.zone,
        profileImage: u.profileImage, registrationDate: u.registrationDate,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', auth, async (req, res) => {
  try {
    const u = await User.findById(req.userId);
    if (!u) return res.status(404).json({ message: 'User not found' });
    res.json({
      id: u._id, name: u.name, email: u.email, phone: u.phone,
      company: u.company,
      registrationDate: u.registrationDate
        ? new Date(u.registrationDate).toLocaleDateString()
        : new Date().toLocaleDateString(),
      address: u.address, license: u.license || 'N/A', location: u.address || 'N/A',
      profileImage: u.profileImage || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      country: u.country, city: u.city, zone: u.zone, status: u.status,
      transporterId: u.transporterId || (u.role === 'transporter' ? u._id : null),
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/profile
// ─────────────────────────────────────────────────────────────────────────────
router.put('/profile', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, req.body);
    res.json({ success: true, message: 'Profile updated' });
  } catch {
    res.status(500).json({ message: 'Update failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/transporter/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/transporter/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const t = await User.findOne({
      email: email.toLowerCase(),
      $or: [{ role: 'transporter' }, { type: 'transporter' }],
    });
    if (!t || password !== t.password)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const token = jwt.sign({ userId: t._id, email: t.email, role: 'transporter' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true, message: 'Login successful', token,
      transporter: {
        id: t._id, name: t.name, email: t.email, phone: t.phone,
        company: t.company, status: t.status,
        approved: t.status === 'active', isApproved: t.status === 'active',
        isVerified: t.status === 'active', address: t.address,
        country: t.country, city: t.city, zone: t.zone,
        profileImage: t.profileImage, registrationDate: t.registrationDate,
        transporterId: t._id,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/transporter/register
// ─────────────────────────────────────────────────────────────────────────────
router.post('/transporter/register', async (req, res) => {
  try {
    const {
      fullName, name, companyName, company,
      email, password, phone,
      address, license, country, city, zone,
      latitude, longitude,
    } = req.body;

    const resolvedName    = (fullName || name || '').trim();
    const resolvedCompany = (companyName || company || '').trim();

    if (!resolvedName || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });

    // ── DNS MX Check ──────────────────────────────────────────────────────────
    const domainCheck = await verifyEmailDomain(email.toLowerCase().trim());
    if (!domainCheck.valid)
      return res.status(400).json({ success: false, message: domainCheck.reason });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(400).json({ success: false, message: 'Email already in use' });

    const t = new User({
      name: resolvedName, email: email.toLowerCase().trim(),
      password, phone: phone ? phone.trim() : '',
      company: resolvedCompany, address: address || '',
      license: license || '', country: country || '',
      city: city || '', zone: zone || '',
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      role: 'transporter', type: 'transporter',
      status: 'active', registrationDate: new Date(),
    });

    await t.save();
    const token = jwt.sign({ userId: t._id, email: t.email, role: 'transporter' }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      success: true, message: 'Transporter account created successfully!', token,
      transporter: {
        id: t._id, name: t.name, email: t.email, phone: t.phone,
        company: t.company, country: t.country, city: t.city,
        zone: t.zone, transporterId: t._id,
      },
    });
  } catch (err) {
    console.error('Transporter register error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/transporter/profile/:tid
// ─────────────────────────────────────────────────────────────────────────────
router.get('/transporter/profile/:tid', auth, async (req, res) => {
  try {
    const t = await User.findById(req.params.tid);
    if (!t) return res.status(404).json({ success: false, message: 'Transporter not found' });
    res.json({
      success: true,
      transporter: {
        id: t._id, name: t.name, email: t.email, phone: t.phone,
        company: t.company, address: t.address, status: t.status,
        country: t.country, city: t.city, zone: t.zone,
        profileImage: t.profileImage, registrationDate: t.registrationDate,
        transporterId: t._id,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/transporter/profile/:tid
// ─────────────────────────────────────────────────────────────────────────────
router.put('/transporter/profile/:tid', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.tid, req.body);
    res.json({ success: true, message: 'Updated' });
  } catch {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/driver-requests
// ─────────────────────────────────────────────────────────────────────────────
router.post('/driver-requests', async (req, res) => {
  try {
    const {
      fullName, email, phone, password, license, vehicleNo, vehicleType,
      vehicle, capacity, address, location, latitude, longitude,
      transporterId, transporterName,
    } = req.body;

    const miss = ['fullName', 'email', 'phone', 'password', 'license', 'vehicleNo', 'transporterId']
      .filter(f => !req.body[f]);
    if (miss.length)
      return res.status(400).json({ success: false, message: `Missing fields: ${miss.join(', ')}` });

    // ── DNS MX Check ──────────────────────────────────────────────────────────
    const domainCheck = await verifyEmailDomain(email.toLowerCase().trim());
    if (!domainCheck.valid)
      return res.status(400).json({ success: false, message: domainCheck.reason });

    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ success: false, message: 'Email already registered.' });

    if (await JoinRequest.findOne({ email: email.toLowerCase(), status: 'pending' }))
      return res.status(400).json({ success: false, message: 'A pending request already exists.' });

    let tid;
    try { tid = new mongoose.Types.ObjectId(transporterId); }
    catch { return res.status(400).json({ success: false, message: 'Invalid transporter ID.' }); }

    const tr = await User.findById(tid);
    if (!tr) return res.status(404).json({ success: false, message: 'Transporter not found.' });

    const CAPS = { car: 4, van: 12, bus: 30 };
    const rvt  = vehicleType || vehicle || null;
    const rc   = capacity ? +capacity : (rvt ? CAPS[rvt] || 4 : 4);

    let lat = latitude  ? +latitude  : null;
    let lng = longitude ? +longitude : null;
    if (!lat && location?.coordinates?.length === 2) {
      lng = location.coordinates[0];
      lat = location.coordinates[1];
    }

    const jr = new JoinRequest({
      name: fullName.trim(), fullName: fullName.trim(),
      email: email.trim().toLowerCase(), phone: phone.trim(),
      password: password.trim(), type: 'driver',
      license: license.trim().toUpperCase(),
      vehicleNo: vehicleNo.trim().toUpperCase(),
      vehicle: vehicleNo.trim().toUpperCase(),
      vehicleType: rvt, capacity: rc,
      address: address || location?.address || 'Not provided',
      location: location || {}, latitude: lat, longitude: lng,
      pickupPoint: address || location?.address || 'Not provided',
      transporterId: tid,
      transporterName: transporterName || tr.name || 'Transporter',
      vehiclePreference: null, status: 'pending', createdAt: new Date(),
    });

    await jr.save();

    try {
      await sendNotification(
        tid, 'transporter', 'New Driver Request',
        `${fullName} wants to join. Vehicle: ${rvt || vehicleNo} | Capacity: ${rc}`,
        'request', jr._id, 'driver_request', true, 'review_driver_request'
      );
    } catch {}

    res.status(201).json({ success: true, message: 'Driver request submitted successfully!', requestId: jr._id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// User sends their email → system finds account → sends OTP to that email
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ success: false, message: 'Email address is required' });

    const cleanEmail = email.toString().trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });

    const user = await User.findOne({ email: cleanEmail }).lean();

    console.log('[forgot-password] Looking for:', cleanEmail, '| Found:', user ? 'YES' : 'NO');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.',
      });
    }

    const otp       = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          'resetOTP.code':      otp,
          'resetOTP.expiresAt': expiresAt,
          'resetOTP.email':     cleanEmail,
        },
      }
    );

    // Send OTP email
    await sendOTPEmail(cleanEmail, otp, user.name);

    const masked = cleanEmail.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c);
    console.log(`[OTP] Sent to ${cleanEmail} → ${otp}`);

    return res.json({
      success:      true,
      message:      'OTP sent to your email',
      maskedEmail:  masked,
    });

  } catch (err) {
    console.error('[forgot-password] CRASH:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const cleanEmail = email.toString().trim().toLowerCase();
    const otpCleaned = otp.toString().trim();

    const user = await User.findOne({ email: cleanEmail }).lean();

    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    const r = user.resetOTP;

    if (!r || !r.code)
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });

    if (new Date(r.expiresAt) < new Date())
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });

    if (r.code !== otpCleaned)
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' });

    res.json({ success: true, message: 'OTP verified successfully' });

  } catch (err) {
    console.error('[verify-otp] CRASH:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const cleanEmail = email.toString().trim().toLowerCase();
    const otpCleaned = otp.toString().trim();

    const user = await User.findOne({ email: cleanEmail }).lean();

    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    const r = user.resetOTP;

    if (!r || !r.code)
      return res.status(400).json({ success: false, message: 'No OTP found. Please start over.' });

    if (new Date(r.expiresAt) < new Date())
      return res.status(400).json({ success: false, message: 'OTP expired. Please start over.' });

    if (r.code !== otpCleaned)
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          password:             newPassword,
          'resetOTP.code':      null,
          'resetOTP.expiresAt': null,
          'resetOTP.email':     null,
        },
      }
    );

    res.json({ success: true, message: 'Password reset successfully! You can now log in.' });

  } catch (err) {
    console.error('[reset-password] CRASH:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/send-email-verification
// Called during registration — sends OTP to verify email ownership
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send-email-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ success: false, message: 'Email address is required' });

    const cleanEmail = email.toString().trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });

    // ── DNS MX Check: fake/non-existent domains ko yahan rok do ──────────────
    const domainCheck = await verifyEmailDomain(cleanEmail);
    if (!domainCheck.valid)
      return res.status(400).json({ success: false, message: domainCheck.reason });

    // Check if email is already registered
    const existing = await User.findOne({ email: cleanEmail }).lean();
    if (existing)
      return res.status(400).json({ success: false, message: 'This email is already registered. Please use a different email.' });

    const otp       = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP temporarily in a pending verification map (in-memory, simple)
    // We store it in a short-lived way — user must verify within 10 min
    // Since we have no separate collection, we'll return OTP and verify on confirm
    // In production you'd store in Redis or a VerificationToken collection

    // Send verification email
    await mailer.sendMail({
      from: `"Raahi App" <${process.env.EMAIL_USER}>`,
      to: cleanEmail,
      subject: 'Verify Your Email - Raahi App',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:12px;">
          <h2 style="color:#415844;margin-bottom:8px;">Verify Your Email</h2>
          <p style="color:#555;">You're registering on Raahi. Use this OTP to verify your email address:</p>
          <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#415844;text-align:center;padding:24px;background:#EAF4EB;border-radius:8px;margin:24px 0;">
            ${otp}
          </div>
          <p style="color:#555;">This code expires in <strong>10 minutes</strong>.</p>
          <p style="color:#999;font-size:12px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    console.log(`[Email Verify] OTP sent to ${cleanEmail} → ${otp}`);

    return res.json({
      success:    true,
      message:    'Verification OTP sent to your email',
      otp,        // Returned for client-side verification (no DB storage needed)
      expiresAt:  expiresAt.toISOString(),
    });

  } catch (err) {
    console.error('[send-email-verification] CRASH:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;