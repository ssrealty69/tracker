const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'attendance');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function createSvgSelfie(name, role, punchType, timeStr, dateStr, distance) {
  const isMorning = punchType === 'PUNCH_IN';
  const punchBadgeText = isMorning ? 'PUNCH IN (MORNING)' : 'PUNCH OUT (EVENING)';
  const badgeColor = isMorning ? '#10b981' : '#f43f5e';
  const badgeBg = isMorning ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="siteBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="45%" stop-color="#bae6fd"/>
        <stop offset="65%" stop-color="#cbd5e1"/>
        <stop offset="100%" stop-color="#64748b"/>
      </linearGradient>
      <linearGradient id="safetyVest" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#facc15"/>
        <stop offset="100%" stop-color="#eab308"/>
      </linearGradient>
      <linearGradient id="hardhatGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </linearGradient>
    </defs>
    
    <!-- Background Site Environment -->
    <rect width="600" height="600" fill="url(#siteBg)"/>
    
    <!-- Scaffold & Tower Crane Silhouettes -->
    <path d="M40 280 L110 200 L180 280 M110 200 L110 390 M370 290 L480 160 L590 290 M480 160 L480 400" stroke="#94a3b8" stroke-width="4" fill="none" opacity="0.45"/>
    <line x1="320" y1="160" x2="590" y2="160" stroke="#94a3b8" stroke-width="4" opacity="0.45"/>
    <rect x="30" y="340" width="90" height="150" fill="#64748b" opacity="0.3"/>
    <rect x="470" y="310" width="100" height="180" fill="#64748b" opacity="0.3"/>
    
    <!-- Worker Body (Fluorescent Vest with Reflective Straps) -->
    <path d="M170 480 Q300 440 430 480 L460 600 L140 600 Z" fill="url(#safetyVest)"/>
    <rect x="225" y="480" width="28" height="120" fill="#f8fafc" opacity="0.85"/>
    <rect x="345" y="480" width="28" height="120" fill="#f8fafc" opacity="0.85"/>
    
    <!-- Head & Neck -->
    <rect x="270" y="410" width="60" height="50" fill="#e2b192"/>
    <circle cx="300" cy="350" r="80" fill="#f5cbb0"/>
    
    <!-- Eyes, Eyebrows & Smile -->
    <ellipse cx="270" cy="345" rx="5" ry="7" fill="#1e293b"/>
    <ellipse cx="330" cy="345" rx="5" ry="7" fill="#1e293b"/>
    <path d="M260 332 Q270 327 282 332" stroke="#475569" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M318 332 Q330 327 340 332" stroke="#475569" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M280 375 Q300 395 320 375" stroke="#9a3412" stroke-width="4" stroke-linecap="round" fill="none"/>
    
    <!-- Construction White Hardhat -->
    <path d="M210 290 Q300 195 390 290 Q390 310 210 310 Z" fill="url(#hardhatGrad)" stroke="#cbd5e1" stroke-width="2"/>
    <path d="M190 300 Q300 286 410 300" stroke="#f1f5f9" stroke-width="12" stroke-linecap="round"/>
    
    <!-- Verified Badge (Top Right) -->
    <rect x="420" y="24" width="156" height="34" rx="8" fill="rgba(15,23,42,0.85)" stroke="#10b981" stroke-width="1.5"/>
    <circle cx="438" cy="41" r="5" fill="#10b981"/>
    <text x="452" y="46" fill="#ffffff" font-size="12" font-family="system-ui, sans-serif" font-weight="bold">GPS VERIFIED</text>
    
    <!-- Punch Type Tag (Top Left) -->
    <rect x="24" y="24" width="180" height="34" rx="8" fill="rgba(15,23,42,0.85)" stroke="${badgeColor}" stroke-width="1.5"/>
    <circle cx="42" cy="41" r="5" fill="${badgeColor}"/>
    <text x="56" y="46" fill="#ffffff" font-size="12" font-family="system-ui, sans-serif" font-weight="bold">${isMorning ? 'PUNCH IN' : 'PUNCH OUT'}</text>
    
    <!-- Watermark Stamp Banner (Bottom) -->
    <rect x="0" y="515" width="600" height="85" fill="rgba(15, 23, 42, 0.92)"/>
    <text x="20" y="545" fill="#ffffff" font-size="16" font-family="system-ui, sans-serif" font-weight="bold">SS REALTY • ${punchBadgeText}</text>
    <text x="20" y="570" fill="#cbd5e1" font-size="13" font-family="system-ui, sans-serif">${name} (${role}) | Nivasa II (Site 1) | ${dateStr} ${timeStr}</text>
    <text x="20" y="588" fill="#94a3b8" font-size="11" font-family="monospace">GPS: 28.465355, 77.185921 | Distance: ${distance} (Approved &lt;=50m)</text>
  </svg>`;
}

const today = new Date();
const formattedToday = today.toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const demoRecords = [
  {
    id: 'demo_att_01',
    employeeName: 'Ravi Tanwar',
    role: 'Site Supervisor',
    projectName: 'Nivasa II (Site 1)',
    punchType: 'PUNCH_IN',
    timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
    formattedDate: formattedToday,
    formattedTime: '08:52:14 AM',
    latitude: 28.465360,
    longitude: 77.185925,
    distanceMeters: 12,
    isWithinRadius: true,
    siteLatitude: 28.465355,
    siteLongitude: 77.185921,
    allowedRadiusMeters: 50,
    photoFile: 'demo_selfie_ravi_in.svg',
  },
  {
    id: 'demo_att_02',
    employeeName: 'Ravi Tanwar',
    role: 'Site Supervisor',
    projectName: 'Nivasa II (Site 1)',
    punchType: 'PUNCH_OUT',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    formattedDate: formattedToday,
    formattedTime: '05:48:32 PM',
    latitude: 28.465350,
    longitude: 77.185918,
    distanceMeters: 15,
    isWithinRadius: true,
    siteLatitude: 28.465355,
    siteLongitude: 77.185921,
    allowedRadiusMeters: 50,
    photoFile: 'demo_selfie_ravi_out.svg',
  },
  {
    id: 'demo_att_03',
    employeeName: 'Naveen Tanwar',
    role: 'Site Operations',
    projectName: 'Nivasa II (Site 1)',
    punchType: 'PUNCH_IN',
    timestamp: new Date(Date.now() - 7.5 * 3600000).toISOString(),
    formattedDate: formattedToday,
    formattedTime: '09:05:40 AM',
    latitude: 28.465358,
    longitude: 77.185922,
    distanceMeters: 8,
    isWithinRadius: true,
    siteLatitude: 28.465355,
    siteLongitude: 77.185921,
    allowedRadiusMeters: 50,
    photoFile: 'demo_selfie_naveen_in.svg',
  },
  {
    id: 'demo_att_04',
    employeeName: 'Naveen Tanwar',
    role: 'Site Operations',
    projectName: 'Nivasa II (Site 1)',
    punchType: 'PUNCH_OUT',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    formattedDate: formattedToday,
    formattedTime: '06:12:10 PM',
    latitude: 28.465345,
    longitude: 77.185930,
    distanceMeters: 22,
    isWithinRadius: true,
    siteLatitude: 28.465355,
    siteLongitude: 77.185921,
    allowedRadiusMeters: 50,
    photoFile: 'demo_selfie_naveen_out.svg',
  },
  {
    id: 'demo_att_05',
    employeeName: 'Harshit',
    role: 'Civil Project Lead',
    projectName: 'Nivasa II (Site 1)',
    punchType: 'PUNCH_IN',
    timestamp: new Date(Date.now() - 7 * 3600000).toISOString(),
    formattedDate: formattedToday,
    formattedTime: '09:18:22 AM',
    latitude: 28.465365,
    longitude: 77.185915,
    distanceMeters: 18,
    isWithinRadius: true,
    siteLatitude: 28.465355,
    siteLongitude: 77.185921,
    allowedRadiusMeters: 50,
    photoFile: 'demo_selfie_harshit_in.svg',
  },
];

// Write SVG files to public/uploads/attendance
demoRecords.forEach((d) => {
  const svg = createSvgSelfie(
    d.employeeName,
    d.role,
    d.punchType,
    d.formattedTime,
    d.formattedDate,
    `${d.distanceMeters}m`
  );
  fs.writeFileSync(path.join(uploadsDir, d.photoFile), svg, 'utf-8');
});

// Format records for attendanceStore.json
const storeRecords = demoRecords.map((d) => ({
  id: d.id,
  employeeName: d.employeeName,
  projectName: d.projectName,
  punchType: d.punchType,
  timestamp: d.timestamp,
  formattedDate: d.formattedDate,
  formattedTime: d.formattedTime,
  latitude: d.latitude,
  longitude: d.longitude,
  distanceMeters: d.distanceMeters,
  isWithinRadius: d.isWithinRadius,
  siteLatitude: d.siteLatitude,
  siteLongitude: d.siteLongitude,
  allowedRadiusMeters: d.allowedRadiusMeters,
  photoUrl: `/uploads/attendance/${d.photoFile}`,
  createdAt: d.timestamp,
}));

const storeFile = path.join(process.cwd(), 'src', 'lib', 'attendanceStore.json');
fs.writeFileSync(storeFile, JSON.stringify(storeRecords, null, 2), 'utf-8');

console.log(`Successfully generated ${storeRecords.length} demo attendance records with SVG biometric selfies!`);
