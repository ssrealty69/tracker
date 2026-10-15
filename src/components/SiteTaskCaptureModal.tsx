'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Trash2,
  CheckCircle2,
  Clock,
  X,
  Eye,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { TaskPhoto, SiteDailyTaskData } from '@/lib/siteTaskStore';

export interface SiteTaskCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'MORNING' | 'EVENING';
  employeeName: string;
  projectName: string;
  dateKey?: string; // YYYY-MM-DD
  formattedDate?: string;
  latitude?: number;
  longitude?: number;
  onSuccess?: () => void;
}

export default function SiteTaskCaptureModal({
  isOpen,
  onClose,
  mode,
  employeeName,
  projectName,
  dateKey,
  formattedDate,
  latitude = 28.465355,
  longitude = 77.185921,
  onSuccess,
}: SiteTaskCaptureModalProps) {
  const effectiveDateKey = dateKey || new Date().toISOString().split('T')[0];
  const effectiveFormattedDate =
    formattedDate ||
    new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  // Morning States: Simple description of tasks
  const [taskDescription, setTaskDescription] = useState('');
  const [morningPhotos, setMorningPhotos] = useState<TaskPhoto[]>([]);

  // Evening States: Status, notes and completion photos
  const [completionStatus, setCompletionStatus] = useState<'COMPLETED' | 'PARTIAL' | 'IN_PROGRESS'>('COMPLETED');
  const [completionNotes, setCompletionNotes] = useState('');
  const [eveningPhotos, setEveningPhotos] = useState<TaskPhoto[]>([]);

  // Existing Morning Data loaded when in Evening mode
  const [existingData, setExistingData] = useState<SiteDailyTaskData | null>(null);

  // Camera & Capture States
  const [isCapturing, setIsCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Hidden Back-Camera Input: strictly forces rear camera and disables gallery selection
  const backCameraInputRef = useRef<HTMLInputElement>(null);

  // Load existing data on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchExisting = async () => {
      try {
        const res = await fetch(
          `/api/attendance/tasks?dateKey=${effectiveDateKey}&employeeName=${encodeURIComponent(
            employeeName
          )}&projectName=${encodeURIComponent(projectName)}`
        );
        const resText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(resText);
        } catch {
          // ignore non-json
        }
        if (data.success && data.task) {
          setExistingData(data.task);
          if (mode === 'MORNING') {
            if (data.task.tasksDescription) {
              setTaskDescription(data.task.tasksDescription);
            } else if (data.task.tasks && data.task.tasks.length > 0) {
              setTaskDescription(data.task.tasks.join(', '));
            }
            if (data.task.morningPhotos) setMorningPhotos(data.task.morningPhotos);
          } else {
            if (data.task.completionStatus) setCompletionStatus(data.task.completionStatus);
            if (data.task.completionNotes) setCompletionNotes(data.task.completionNotes);
            if (data.task.eveningPhotos) setEveningPhotos(data.task.eveningPhotos);
          }
        }
      } catch (err) {
        console.error('Error fetching existing site task:', err);
      }
    };

    fetchExisting();
  }, [isOpen, effectiveDateKey, employeeName, projectName, mode]);

  if (!isOpen) return null;

  // Stamp Live Watermark & Compress (WebP with safe JPEG fallback for iOS Safari)
  const processCapturedPhoto = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Optimize resolution for mobile back camera (max 900px keeps size ~40-60KB)
        const maxDim = 900;
        let width = img.width || 800;
        let height = img.height || 600;

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

        // Draw camera image
        ctx.drawImage(img, 0, 0, width, height);

        // Watermark Banner (Bottom)
        const barHeight = Math.max(55, height * 0.12);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
        ctx.fillRect(0, height - barHeight, width, barHeight);

        // Watermark Banner (Top-Right Badge)
        const badgeWidth = Math.min(180, width * 0.35);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(width - badgeWidth - 12, 12, badgeWidth, 30);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(width - badgeWidth - 12, 12, badgeWidth, 30);

        // Verified indicator dot
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(width - badgeWidth + 2, 27, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(10, Math.round(width * 0.02))}px sans-serif`;
        ctx.fillText('LIVE BACK CAMERA', width - badgeWidth + 14, 31);

        // Timestamp & details
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        const timeStr = now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });

        const bannerTitle =
          mode === 'MORNING' ? 'SS REALTY • MORNING TASK' : 'SS REALTY • EVENING PROOF';

        // Title line
        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold ${Math.max(12, Math.round(width * 0.024))}px sans-serif`;
        ctx.fillText(bannerTitle, 14, height - barHeight + 20);

        // Details line
        ctx.fillStyle = '#cbd5e1';
        ctx.font = `${Math.max(10, Math.round(width * 0.019))}px sans-serif`;
        ctx.fillText(
          `${employeeName} | ${projectName} | ${dateStr} ${timeStr}`,
          14,
          height - barHeight + 38
        );

        // GPS line
        ctx.fillStyle = '#94a3b8';
        ctx.font = `monospace ${Math.max(9, Math.round(width * 0.016))}px`;
        ctx.fillText(
          `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          14,
          height - 6
        );

        // Try WebP compression first; on iOS Safari if it returns PNG, fall back to JPEG to prevent giant payloads
        try {
          const webpUrl = canvas.toDataURL('image/webp', 0.80);
          if (webpUrl.startsWith('data:image/png')) {
            // Safari fell back to PNG! Use JPEG for tiny size
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          } else {
            resolve(webpUrl);
          }
        } catch {
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        }
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  };

  // Launch Live Back Camera
  const handleTriggerBackCamera = () => {
    if (backCameraInputRef.current) {
      backCameraInputRef.current.click();
    }
  };

  // Handle Back-Camera Capture
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCapturing(true);
    const toastId = toast.loading('Back camera photo process ho rahi hai...');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const rawSrc = reader.result as string;
        const compressed = await processCapturedPhoto(rawSrc);

        const now = new Date();
        const newPhoto: TaskPhoto = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          url: compressed,
          caption: mode === 'MORNING' ? 'Site Work' : 'Completed Work',
          timestamp: now.toISOString(),
          timeStr: now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }),
          cameraFacing: 'environment',
        };

        if (mode === 'MORNING') {
          setMorningPhotos((prev) => [...prev, newPhoto]);
        } else {
          setEveningPhotos((prev) => [...prev, newPhoto]);
        }

        toast.success('Live photo add ho gayi!', { id: toastId });
        setIsCapturing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error processing back camera photo:', err);
      toast.error('Photo process nahi ho paayi.', { id: toastId });
      setIsCapturing(false);
    }

    e.target.value = '';
  };

  // Delete photo
  const handleDeletePhoto = (photoId: string) => {
    if (mode === 'MORNING') {
      setMorningPhotos(morningPhotos.filter((p) => p.id !== photoId));
    } else {
      setEveningPhotos(eveningPhotos.filter((p) => p.id !== photoId));
    }
  };

  // Final Submit
  const handleSubmit = async () => {
    const activePhotos = mode === 'MORNING' ? morningPhotos : eveningPhotos;

    if (activePhotos.length === 0) {
      toast.error('Kripya back camera se kam se kam ek live photo zaroor lein!');
      return;
    }

    if (mode === 'MORNING' && !taskDescription.trim()) {
      toast.error('Kripya aaj ka kaam zaroor likhein (e.g. POP, Plaster, Tank etc.)');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(
      mode === 'MORNING'
        ? 'Task save ho raha hai...'
        : 'Shaam ka report save ho raha hai...'
    );

    try {
      const payload =
        mode === 'MORNING'
          ? {
              type: 'MORNING_PLAN',
              dateKey: effectiveDateKey,
              formattedDate: effectiveFormattedDate,
              employeeName,
              projectName,
              tasks: taskDescription.trim() ? [taskDescription.trim()] : [],
              tasksDescription: taskDescription.trim(),
              morningPhotos,
            }
          : {
              type: 'EVENING_REPORT',
              dateKey: effectiveDateKey,
              formattedDate: effectiveFormattedDate,
              employeeName,
              projectName,
              completionStatus,
              completionNotes: completionNotes.trim(),
              eveningPhotos,
            };

      const res = await fetch('/api/attendance/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        throw new Error(
          res.status === 413
            ? 'Photos ka file size zyaada hai, kripya 1-2 photos lein.'
            : `Server response error (${res.status})`
        );
      }

      if (res.ok && data.success) {
        toast.success(data.message || 'Saved successfully!', { id: toastId, duration: 4000 });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(data.message || 'Save nahi ho saka.', { id: toastId });
      }
    } catch (err: unknown) {
      toast.error('Error: ' + (err instanceof Error ? err.message : String(err)), { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const currentPhotos = mode === 'MORNING' ? morningPhotos : eveningPhotos;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* STRICT BACK-CAMERA INPUT:
          `capture="environment"` strictly launches the device's rear back-camera directly!
          No photo library / gallery picker is offered by iOS & Android. */}
      <input
        ref={backCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />

      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${
                mode === 'MORNING'
                  ? 'bg-gradient-to-tr from-amber-500 to-orange-500 shadow-orange-500/20'
                  : 'bg-gradient-to-tr from-indigo-500 to-emerald-500 shadow-emerald-500/20'
              }`}
            >
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  {mode === 'MORNING' ? "Today's Task (आज का काम)" : "Evening Work Proof (शाम का काम)"}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {employeeName} &bull; {projectName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: LIVE BACK-CAMERA PHOTOS                                  */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                {mode === 'MORNING' ? '1. Live Site Photo (Back Camera)' : '1. Taiyaar Kaam Ki Photo (Back Camera)'}
              </label>

              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                {currentPhotos.length} Photo{currentPhotos.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Photo Thumbnails Grid */}
            {currentPhotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {currentPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 flex flex-col group shadow-md"
                  >
                    <div
                      className="relative h-28 w-full cursor-pointer overflow-hidden bg-black"
                      onClick={() => setPreviewPhoto(photo.url)}
                    >
                      <img src={photo.url} alt="Task Proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 backdrop-blur-md rounded text-[9px] font-mono text-emerald-400 font-bold border border-emerald-500/30">
                        #{index + 1} &bull; {photo.timeStr}
                      </div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <Eye className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="p-1.5 bg-slate-900 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 truncate pl-1">Photo #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded transition-colors"
                        title="Delete photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Launch Back Camera Button */}
            <button
              type="button"
              onClick={handleTriggerBackCamera}
              disabled={isCapturing}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 active:scale-[0.99] transition-all font-black text-sm text-white shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2.5 cursor-pointer border border-indigo-400/30"
            >
              <Camera className="w-5 h-5 text-white animate-pulse" />
              <span>
                {currentPhotos.length === 0
                  ? '📸 Click Live Photo (Back Camera)'
                  : '➕ Add More Live Photos (और फोटो जोड़ें)'}
              </span>
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: WORK DESCRIPTION (PHOTO KE NICHE KYA KAAM HOGA)           */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {mode === 'MORNING' ? (
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                2. Aaj Site Par Kya-Kya Kaam Hoga?
              </label>
              <textarea
                rows={3}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Jaise: POP ka kaam hoga, plastering hogi, tank banega, safai hogi..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          ) : (
            /* EVENING MODE */
            <div className="space-y-4 pt-2 border-t border-slate-800">
              {/* Morning Plan Summary if available */}
              {(existingData?.tasksDescription || (existingData?.tasks && existingData.tasks.length > 0)) && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Subah Ka Plan (Morning Target):
                  </span>
                  <p className="text-xs text-amber-300 font-medium">
                    {existingData.tasksDescription || existingData.tasks?.join(', ')}
                  </p>
                </div>
              )}

              {/* Completion Status Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-2 uppercase tracking-wider">
                  2. Shaam Tak Kaam Kitna Hua?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCompletionStatus('COMPLETED')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      completionStatus === 'COMPLETED'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold shadow-xs'
                        : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base block mb-0.5">🟢</span>
                    <span className="text-[11px] font-bold block">100% Poora Hua</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompletionStatus('PARTIAL')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      completionStatus === 'PARTIAL'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-xs'
                        : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base block mb-0.5">🟡</span>
                    <span className="text-[11px] font-bold block">Aadha / Kuch Hua</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompletionStatus('IN_PROGRESS')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      completionStatus === 'IN_PROGRESS'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold shadow-xs'
                        : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base block mb-0.5">⏳</span>
                    <span className="text-[11px] font-bold block">Chal Raha Hai</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5 uppercase tracking-wider">
                  Kaam Ka Vivran (Notes)
                </label>
                <textarea
                  rows={2}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Jaise: Hall plaster complete ho gaya hai, safai ho gayi..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || currentPhotos.length === 0}
            className={`px-6 py-3 rounded-xl font-black text-xs text-white shadow-lg flex items-center gap-2 cursor-pointer transition-all ${
              currentPhotos.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : mode === 'MORNING'
                ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 shadow-amber-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-emerald-600/30'
            }`}
          >
            {submitting ? (
              <span>Saving...</span>
            ) : (
              <>
                <span>
                  {mode === 'MORNING' ? '✅ Save Task' : '✅ Submit Work Report'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Full HD Zoom Modal for Taken Photos */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-10 right-0 text-white hover:text-rose-400 flex items-center gap-1 text-xs font-bold"
            >
              <X className="w-5 h-5" /> Close
            </button>
            <img
              src={previewPhoto}
              alt="Task Preview"
              className="max-h-[85vh] w-auto max-w-full rounded-2xl border-2 border-emerald-500 shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
