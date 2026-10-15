'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Building2,
  User,
  ShieldCheck,
  Navigation,
  Compass,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Info,
  ShieldAlert,
  SwitchCamera,
  Smartphone,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import { TARGET_SITE_CONFIG, calculateDistanceInMeters } from '@/lib/attendanceConfig';
import SiteTaskCaptureModal from '@/components/SiteTaskCaptureModal';

const DEFAULT_PROJECTS = [
  'Nivasa II (Site 1)',
  'Nirvana',
  'Orchid',
  'Velora',
  'The Arch',
  'Vasundhara',
  'Amaryllis',
  'Floria',
  'Other / Custom Site',
];

const DEFAULT_STAFF = [
  'Ravi Tanwar',
  'Naveen Tanwar',
  'Harshit',
];

export default function AttendancePage() {
  // Mount state to eliminate browser extension hydration mismatches
  const [mounted, setMounted] = useState(false);

  // Selection states
  const [selectedProject, setSelectedProject] = useState(DEFAULT_PROJECTS[0]);
  const [customProject, setCustomProject] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(DEFAULT_STAFF[0]);
  const [customEmployee, setCustomEmployee] = useState('');

  // Punch Mode: PUNCH_IN vs PUNCH_OUT
  const [punchType, setPunchType] = useState<'PUNCH_IN' | 'PUNCH_OUT'>('PUNCH_IN');

  // GPS States
  const [gpsLoading, setGpsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [gpsMessage, setGpsMessage] = useState<string>('Location check in progress...');
  const [testModeOverride, setTestModeOverride] = useState(false);
  const [showDistanceAlert, setShowDistanceAlert] = useState(false);
  const [isHttpMobile, setIsHttpMobile] = useState(false);

  // Camera & Stream states
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successRecord, setSuccessRecord] = useState<{
    time: string;
    date: string;
    punchType: string;
    photoUrl: string;
    distance: number;
    employeeName: string;
    projectName: string;
  } | null>(null);

  // Daily Site Task Documentation Modal States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState<'MORNING' | 'EVENING'>('MORNING');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Effective project & employee names
  const effectiveProject = selectedProject === 'Other / Custom Site' ? (customProject || 'Custom Site') : selectedProject;
  const effectiveEmployee = selectedEmployee === 'Other / Enter Name' ? customEmployee : selectedEmployee;

  // Real-time Clock
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check if testing on Local Mobile IP over HTTP
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isHttp = window.location.protocol === 'http:';
      const isNotLocalhost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      if (isHttp && isNotLocalhost) {
        setIsHttpMobile(true);
      }
    }
  }, []);

  // Fetch Location with Fast 4s Timeout
  const requestLocation = useCallback(() => {
    setGpsLoading(true);

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGpsMessage('GPS is browser mein uplabdh nahi hai.');
      setGpsLoading(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setGpsLoading(false);
      setGpsMessage('GPS check timeout. Test Override se punch kar sakte hain.');
    }, 4500);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeoutId);
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation({ lat, lng });
          const dist = calculateDistanceInMeters(
            lat,
            lng,
            TARGET_SITE_CONFIG.latitude,
            TARGET_SITE_CONFIG.longitude
          );
          setDistanceMeters(dist);
          setGpsLoading(false);
          if (dist <= TARGET_SITE_CONFIG.radiusMeters) {
            setGpsMessage(`Site Verified: Aap site se ${dist}m door hain (Under 50m).`);
          } else {
            setGpsMessage(`Site se ${dist}m door hain (Allowed: 50m).`);
          }
        },
        (err) => {
          clearTimeout(timeoutId);
          setGpsLoading(false);
          if (err.code === 1) {
            setGpsMessage('Location permission denied. Test Override use karein.');
          } else {
            setGpsMessage('GPS signal nahi mila. Test Override use karein.');
          }
        },
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 10000 }
      );
    } catch {
      clearTimeout(timeoutId);
      setGpsLoading(false);
      setGpsMessage('Location error. Test Override use karein.');
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      requestLocation();
    }
  }, [mounted, requestLocation]);

  // Watermark Stamper Function & Smart Image Compressor
  const applyWatermarkToImage = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Optimize dimensions for mobile upload speed (max 1024px)
        const maxDim = 1024;
        let width = img.width || 640;
        let height = img.height || 480;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Watermark Bar at Bottom
        const barHeight = Math.max(54, canvas.height * 0.14);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

        // Text details
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(canvas.width * 0.035)}px sans-serif`;
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const punchLabel = punchType === 'PUNCH_IN' ? 'PUNCH IN (MORNING)' : 'PUNCH OUT (EVENING)';

        ctx.fillText(`SS REALTY • ${punchLabel}`, 18, canvas.height - barHeight + 24);

        ctx.font = `${Math.round(canvas.width * 0.026)}px sans-serif`;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(
          `${effectiveEmployee || 'Staff'} | ${effectiveProject} | ${dateStr} ${timeStr}`,
          18,
          canvas.height - 12
        );

        // Export at quality 0.78 for fast 150KB upload
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  };

  // Open Camera Handler: Works on both HTTP (Direct Mobile Camera Input) and HTTPS (Live Viewfinder)
  const handleOpenFrontCamera = async () => {
    // 1. Strict Geofencing Check: Employee MUST be within 50 meters of the site
    const isAtSite = isWithinRadius || testModeOverride;
    if (!isAtSite) {
      setShowDistanceAlert(true);
      const distInfo = distanceMeters !== null ? ` (Abhi aap ${distanceMeters}m door hain)` : '';
      toast.error(`Aap abhi site se dur hai. Pahele site par jaiye${distInfo}!`, {
        duration: 6000,
        icon: '🚫',
        style: {
          borderRadius: '16px',
          background: '#0f172a',
          color: '#fda4af',
          border: '1px solid #f43f5e',
          fontWeight: 'bold',
          fontSize: '13px',
          padding: '12px 16px',
        },
      });
      return;
    }
    setShowDistanceAlert(false);

    const isSecure = typeof window !== 'undefined' && (window.isSecureContext || window.location.hostname === 'localhost');
    const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

    if (isSecure && hasMediaDevices) {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        setCameraActive(true);
        setCapturedImage(null);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        return;
      } catch (err) {
        console.warn('Live stream camera failed, falling back to native camera input:', err);
        setCameraActive(false);
      }
    }

    // Direct Native Front-Camera Launch (Works 100% on Android & iOS even over HTTP IP)
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle native camera capture from file input
  const handleNativeCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const rawDataUrl = reader.result as string;
      const stamped = await applyWatermarkToImage(rawDataUrl);
      setCapturedImage(stamped);
      toast.success('Selfie capture ho gayi!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Snap from live stream
  const captureFromLiveStream = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const raw = canvas.toDataURL('image/jpeg', 0.85);
    const stamped = await applyWatermarkToImage(raw);
    setCapturedImage(stamped);
    stopCameraStream();
    toast.success('Selfie capture ho gayi!');
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const isWithinRadius = distanceMeters !== null && distanceMeters <= TARGET_SITE_CONFIG.radiusMeters;
  const canPunch = (isWithinRadius || testModeOverride) && !!effectiveEmployee && !!effectiveProject;

  // Submit Final Punch
  const handleSubmitPunch = async () => {
    if (!effectiveEmployee) {
      toast.error('Kripya apna Naam select ya enter karein.');
      return;
    }

    if (!effectiveProject) {
      toast.error('Kripya Project select karein.');
      return;
    }

    if (!capturedImage) {
      toast.error('Pehle Selfie photo lein.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Attendance record ho rahi hai...');

    try {
      const lat = userLocation ? userLocation.lat : TARGET_SITE_CONFIG.latitude;
      const lng = userLocation ? userLocation.lng : TARGET_SITE_CONFIG.longitude;

      const response = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeName: effectiveEmployee,
          projectName: effectiveProject,
          punchType,
          photoBase64: capturedImage,
          latitude: lat,
          longitude: lng,
          testOverride: testModeOverride,
        }),
      });

      const res = await response.json();

      if (response.ok && res.success && res.record) {
        toast.success(res.message, { id: toastId, duration: 5000 });
        setSuccessRecord({
          time: res.record.formattedTime,
          date: res.record.formattedDate,
          punchType: res.record.punchType,
          photoUrl: res.record.photoUrl,
          distance: res.record.distanceMeters,
          employeeName: res.record.employeeName,
          projectName: res.record.projectName,
        });
        setTaskModalMode(res.record.punchType === 'PUNCH_IN' ? 'MORNING' : 'EVENING');
      } else {
        toast.error(res.message || 'Punch record nahi ho saka.', { id: toastId, duration: 6000 });
      }
    } catch (err: unknown) {
      toast.error('Error aaya: ' + (err instanceof Error ? err.message : String(err)), { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormForNext = () => {
    setCapturedImage(null);
    setSuccessRecord(null);
    stopCameraStream();
    requestLocation();
  };

  // SSR Loading Fallback to eliminate browser extension hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col justify-center items-center font-sans">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30">
            <Building2 className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-white">SS Realty Attendance Portal</h2>
          <p className="text-xs text-slate-400">Loading secure punch system...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 flex flex-col justify-between selection:bg-indigo-500 selection:text-white font-sans"
    >
      <Toaster position="top-center" />

      {/* Hidden Native Camera Input - Guaranteed to open front camera on Android & iOS */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleNativeCameraCapture}
        className="hidden"
      />

      {/* Main Container */}
      <div className="max-w-xl mx-auto w-full">
        {/* Top Header Card */}
        <header className="mb-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5">
                  SS Realty <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-400/20 font-semibold">Site Tracker</span>
                </h1>
                <p className="text-xs text-slate-400">Smart Face & GPS Geofenced Attendance</p>
              </div>
            </div>

            {/* Live Clock Badge */}
            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400 text-xs font-mono font-bold">
                <Clock className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                {currentTimeStr || '--:--:--'}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Live Server Time</p>
            </div>
          </div>

          {/* Admin link button */}
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> 50m Site Radius Geo-lock
            </span>
            <Link
              href="/admin/attendance"
              className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 hover:underline text-[11px]"
            >
              Admin Punch Ledger <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </header>

        {/* Success View Screen */}
        {successRecord ? (
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
              {successRecord.punchType === 'PUNCH_IN' ? '🟢 Morning Punch In Successful' : '🔴 Evening Punch Out Successful'}
            </span>

            <h2 className="text-2xl font-black text-white">{successRecord.employeeName}</h2>
            <p className="text-sm text-slate-300 font-medium">{successRecord.projectName}</p>

            {/* Photo preview */}
            <div className="my-5 relative max-w-xs mx-auto rounded-2xl overflow-hidden border-2 border-emerald-400/40 shadow-xl bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={successRecord.photoUrl}
                alt="Punch Verification"
                className="w-full h-auto object-cover"
              />
              <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-md rounded-md text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" /> VERIFIED
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left bg-black/40 rounded-xl p-3 border border-slate-800 mb-6 text-xs">
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-semibold">Recorded Time</p>
                <p className="text-white font-mono font-bold text-sm">{successRecord.time}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-semibold">Recorded Date</p>
                <p className="text-white font-bold">{successRecord.date}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-semibold">Site Distance</p>
                <p className="text-emerald-400 font-semibold">{successRecord.distance}m from site</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-semibold">Status</p>
                <p className="text-emerald-400 font-semibold">Approved</p>
              </div>
            </div>

            {/* ─── STEP 2: TODAY'S SITE WORK PLAN & BACK-CAMERA PROOF ─── */}
            <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border-2 border-indigo-500/50 shadow-xl text-left">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-black text-xs border border-indigo-400/30">
                    2
                  </span>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">
                    {successRecord.punchType === 'PUNCH_IN'
                      ? "Today's Site Tasks & Photos (आज का काम)"
                      : 'Evening Work Completion Proof (शाम का काम)'}
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Step 2
                </span>
              </div>

              <p className="text-xs text-slate-300 mb-3.5 leading-relaxed">
                {successRecord.punchType === 'PUNCH_IN'
                  ? 'Punch In ke baad site par aaj kya-kya kaam hoga (Plaster, POP, Tank, Safai etc.) select karein aur live back camera se photos lein.'
                  : 'Punch Out ke baad subah liye gaye tasks ka proof (Live back camera photos) upload karein ki shaam tak kitna kaam hua.'}
              </p>

              <button
                type="button"
                onClick={() => {
                  setTaskModalMode(successRecord.punchType === 'PUNCH_IN' ? 'MORNING' : 'EVENING');
                  setIsTaskModalOpen(true);
                }}
                className={`w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm text-white shadow-xl flex items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-[0.99] ${
                  successRecord.punchType === 'PUNCH_IN'
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-110 shadow-orange-500/30 border border-amber-400/40'
                    : 'bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-600 hover:brightness-110 shadow-emerald-600/30 border border-emerald-400/40'
                }`}
              >
                <Camera className="w-5 h-5 animate-pulse" />
                <span>
                  {successRecord.punchType === 'PUNCH_IN'
                    ? '📸 Add Today’s Tasks & Back-Camera Photos'
                    : '📸 Upload Evening Completion Proof Photos'}
                </span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={resetFormForNext}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <RotateCcw className="w-4 h-4" /> Next Employee Punch
              </button>
              <Link
                href="/admin/attendance"
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-sm"
              >
                View Punch Ledger
              </Link>
            </div>
          </div>
        ) : (
          /* Normal Punch Form */
          <div className="space-y-4">
            {/* GPS Geofencing Status Banner */}
            <div
              className={`rounded-2xl p-4 border transition-all duration-300 ${
                isWithinRadius || testModeOverride
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isWithinRadius || testModeOverride
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {gpsLoading ? (
                      <Compass className="w-5 h-5 animate-spin" />
                    ) : isWithinRadius || testModeOverride ? (
                      <MapPin className="w-5 h-5" />
                    ) : (
                      <ShieldAlert className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      {isWithinRadius
                        ? 'Site Location Verified (Under 50m)'
                        : testModeOverride
                        ? 'Test Mode Active (Punch Enabled)'
                        : 'Location Warning: Site se door'}
                    </h3>
                    <p className="text-xs mt-0.5 leading-relaxed text-slate-300">
                      {gpsMessage}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={requestLocation}
                  title="Refresh GPS"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1 shrink-0 border border-slate-700 cursor-pointer"
                >
                  <Navigation className="w-3 h-3" /> Refresh
                </button>
              </div>

              {/* Developer / Testing Override Switch */}
              <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
                <span className="flex items-center gap-1 text-slate-400">
                  <Info className="w-3.5 h-3.5" /> Target: 28.465355, 77.185921 (50m)
                </span>
                <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg border transition-all ${
                  testModeOverride
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-xs'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                }`}>
                  <input
                    type="checkbox"
                    checked={testModeOverride}
                    onChange={(e) => setTestModeOverride(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <span className="text-xs">
                    Test Mode: {testModeOverride ? 'ON (Bypass 50m)' : 'OFF'}
                  </span>
                </label>
              </div>

              {testModeOverride && (
                <p className="text-[11px] text-amber-300 mt-2 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/30 font-medium flex items-center gap-1.5">
                  <span>🧪</span>
                  <span><strong>Testing Mode Chalu Hai:</strong> Aap bina site jaye bhi abhi camera se selfie leke test record kar sakte hain!</span>
                </p>
              )}
            </div>

            {/* Form Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
              {/* Step 1: Project Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  1. Project / Site Select Karein <span className="text-rose-400">*</span>
                </label>
                <select
                  suppressHydrationWarning
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {DEFAULT_PROJECTS.map((proj) => (
                    <option key={proj} value={proj} className="bg-slate-950 text-white">
                      {proj}
                    </option>
                  ))}
                </select>
                {selectedProject === 'Other / Custom Site' && (
                  <input
                    suppressHydrationWarning
                    type="text"
                    value={customProject}
                    onChange={(e) => setCustomProject(e.target.value)}
                    placeholder="Site ka naam yahan likhein (e.g. Plot No 45)"
                    className="mt-2 w-full bg-slate-950 border border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              {/* Step 2: Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  2. Staff / Apna Naam Select Karein <span className="text-rose-400">*</span>
                </label>
                <select
                  suppressHydrationWarning
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {DEFAULT_STAFF.map((staff) => (
                    <option key={staff} value={staff} className="bg-slate-950 text-white">
                      {staff}
                    </option>
                  ))}
                </select>

                {selectedEmployee === 'Other / Enter Name' && (
                  <input
                    suppressHydrationWarning
                    type="text"
                    value={customEmployee}
                    onChange={(e) => setCustomEmployee(e.target.value)}
                    placeholder="Apna poora naam likhein..."
                    className="mt-2 w-full bg-slate-950 border border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              {/* Step 3: Punch In vs Punch Out Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  3. Punch Type Chunein <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPunchType('PUNCH_IN');
                      setCapturedImage(null);
                    }}
                    className={`py-3.5 px-3 rounded-2xl border font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[48px] ${
                      punchType === 'PUNCH_IN'
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-500/40'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span>🟢 Punch In (Morning)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPunchType('PUNCH_OUT');
                      setCapturedImage(null);
                    }}
                    className={`py-3.5 px-3 rounded-2xl border font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[48px] ${
                      punchType === 'PUNCH_OUT'
                        ? 'bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-600/30 ring-2 ring-rose-500/40'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span>🔴 Punch Out (Evening)</span>
                  </button>
                </div>
              </div>

              {/* Step 4: Live Selfie Camera Viewfinder (Direct Camera Only, No Gallery) */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>4. Live Selfie Verification <span className="text-rose-400">*</span></span>
                  <span className="text-[11px] text-amber-300 font-normal">📸 Front Camera Only (No Gallery)</span>
                </label>

                {/* If photo captured already */}
                {capturedImage ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/60 shadow-xl bg-black max-w-sm mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={capturedImage} alt="Selfie Snapshot" className="w-full h-auto object-cover" />
                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-mono text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Photo Verified
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenFrontCamera}
                      className="absolute bottom-3 right-3 bg-slate-900/90 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/20 shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Retake Selfie
                    </button>
                  </div>
                ) : cameraActive ? (
                  /* Active Live Camera Stream */
                  <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-500/60 shadow-2xl bg-black max-w-sm mx-auto">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className={`w-full aspect-square object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    />

                    {/* Biometric Face Guide Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-56 h-64 border-2 border-dashed border-white/40 rounded-full animate-pulse flex items-end justify-center pb-4">
                        <span className="text-[11px] text-white/80 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-xs font-medium">
                          Chehra circle ke beech mein rakhein
                        </span>
                      </div>
                    </div>

                    {/* Live Badge */}
                    <div className="absolute top-3 left-3 bg-red-600/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-white flex items-center gap-1.5 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" /> LIVE CAMERA
                    </div>

                    {/* Flip Camera Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const next = facingMode === 'user' ? 'environment' : 'user';
                        setFacingMode(next);
                        handleOpenFrontCamera();
                      }}
                      title="Switch Front/Back Camera"
                      className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full border border-white/20 backdrop-blur-md cursor-pointer transition-all"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </button>

                    {/* Shutter Button */}
                    <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4">
                      <button
                        type="button"
                        onClick={stopCameraStream}
                        className="bg-slate-800/80 hover:bg-slate-700 text-white text-xs px-3 py-2 rounded-xl border border-white/10 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={captureFromLiveStream}
                        className="w-16 h-16 rounded-full bg-white hover:bg-slate-100 p-1 border-4 border-indigo-500 shadow-2xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                          <Camera className="w-6 h-6" />
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Initial State: Button to Open Camera */
                  <div className="text-center p-6 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-950/60 hover:bg-slate-950 transition-all">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                      <Camera className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">Live Selfie Camera Kholein</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4">
                      Direct front camera open hoga. Site location par khade hokar hi selfie li ja sakti hai.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenFrontCamera}
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer min-h-[48px]"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Open Camera & Click Selfie</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Final Attendance Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={!canPunch || !capturedImage || isSubmitting}
                  onClick={handleSubmitPunch}
                  className={`w-full py-4 px-6 rounded-2xl font-bold text-base shadow-xl transition-all flex items-center justify-center gap-2 min-h-[52px] cursor-pointer ${
                    !canPunch || !capturedImage
                      ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed shadow-none'
                      : punchType === 'PUNCH_IN'
                      ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-600/30 active:scale-[0.99]'
                      : 'bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white shadow-rose-600/30 active:scale-[0.99]'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RotateCcw className="w-5 h-5 animate-spin" /> Recording Punch...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>
                        Confirm & Upload {punchType === 'PUNCH_IN' ? 'Punch In (Morning)' : 'Punch Out (Evening)'}
                      </span>
                    </>
                  )}
                </button>

                {/* Validation hint if locked */}
                {!canPunch && (
                  <p className="text-center text-xs text-amber-300/80 mt-2 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {!effectiveEmployee
                      ? 'Pehle apna naam chunein.'
                      : !isWithinRadius && !testModeOverride
                      ? `Location lock: Site se ${distanceMeters ?? '...'}m door hain (Allowed: 50m).`
                      : !capturedImage
                      ? 'Camera se selfie photo lein.'
                      : 'Form details poori bharein.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <footer className="mt-6 text-center text-xs text-slate-500 pb-4">
          <p>SS Realty Construction Management System &copy; 2026</p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Geofence Target: Lat 28.465355, Lng 77.185921 (50m Radius)
          </p>
        </footer>
      </div>

      {/* Daily Site Tasks Live Back-Camera Capture Modal */}
      {successRecord && (
        <SiteTaskCaptureModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          mode={taskModalMode}
          employeeName={successRecord.employeeName}
          projectName={successRecord.projectName}
          formattedDate={successRecord.date}
          latitude={userLocation?.lat}
          longitude={userLocation?.lng}
          onSuccess={() => {
            toast.success(
              taskModalMode === 'MORNING'
                ? 'Subah ka task plan aur photos save ho gaye!'
                : 'Shaam ka kaam proof aur photos save ho gaye!'
            );
          }}
        />
      )}
    </div>
  );
}
