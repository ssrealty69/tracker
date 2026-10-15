'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  X,
  ShieldCheck,
  Building2,
  Calendar,
  AlertCircle,
  Eye,
  Check,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { TaskPhoto, SiteDailyTaskData } from '@/lib/siteTaskStore';

const COMMON_CONSTRUCTION_TASKS = [
  { id: 'plaster', label: 'Plastering (प्लास्टर)', icon: '🧱' },
  { id: 'pop', label: 'POP Work (पीओपी / सीलिंग)', icon: '🏛️' },
  { id: 'tank', label: 'Water Tank (पानी की टंकी)', icon: '🚰' },
  { id: 'cleaning', label: 'Site Cleaning (सफाई / मलबा)', icon: '🧹' },
  { id: 'brickwork', label: 'Brickwork (चिनाई का काम)', icon: '🧱' },
  { id: 'tile', label: 'Tile Fixing (टाइल वर्क)', icon: '🔲' },
  { id: 'plumbing', label: 'Plumbing (प्लंबिंग वर्क)', icon: '🚿' },
  { id: 'electrical', label: 'Electrical (बिजली फिटिंग)', icon: '⚡' },
  { id: 'painting', label: 'Painting / Putty (पेंट / पुट्टी)', icon: '🎨' },
  { id: 'other', label: 'Other Work (अन्य काम)', icon: '✍️' },
];

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

  // Morning States
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [taskDescription, setTaskDescription] = useState('');
  const [morningPhotos, setMorningPhotos] = useState<TaskPhoto[]>([]);

  // Evening States
  const [completionStatus, setCompletionStatus] = useState<'COMPLETED' | 'PARTIAL' | 'IN_PROGRESS'>('COMPLETED');
  const [completionNotes, setCompletionNotes] = useState('');
  const [eveningPhotos, setEveningPhotos] = useState<TaskPhoto[]>([]);

  // Existing Morning Data loaded when in Evening mode
  const [existingData, setExistingData] = useState<SiteDailyTaskData | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

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
      setLoadingExisting(true);
      try {
        const res = await fetch(
          `/api/attendance/tasks?dateKey=${effectiveDateKey}&employeeName=${encodeURIComponent(
            employeeName
          )}&projectName=${encodeURIComponent(projectName)}`
        );
        const data = await res.json();
        if (data.success && data.task) {
          setExistingData(data.task);
          if (mode === 'MORNING') {
            if (data.task.tasks) setSelectedTasks(data.task.tasks);
            if (data.task.tasksDescription) setTaskDescription(data.task.tasksDescription);
            if (data.task.morningPhotos) setMorningPhotos(data.task.morningPhotos);
          } else {
            // Evening mode: load any previously saved evening data
            if (data.task.completionStatus) setCompletionStatus(data.task.completionStatus);
            if (data.task.completionNotes) setCompletionNotes(data.task.completionNotes);
            if (data.task.eveningPhotos) setEveningPhotos(data.task.eveningPhotos);
          }
        }
      } catch (err) {
        console.error('Error fetching existing site task:', err);
      } finally {
        setLoadingExisting(false);
      }
    };

    fetchExisting();
  }, [isOpen, effectiveDateKey, employeeName, projectName, mode]);

  if (!isOpen) return null;

  // Toggle task category
  const toggleTask = (taskLabel: string) => {
    if (selectedTasks.includes(taskLabel)) {
      setSelectedTasks(selectedTasks.filter((t) => t !== taskLabel));
    } else {
      setSelectedTasks([...selectedTasks, taskLabel]);
    }
  };

  // Stamp Live Watermark & Compress to WebP
  const processCapturedPhotoToWebP = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Optimize resolution for mobile back camera (max 1280px)
        const maxDim = 1280;
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
        const barHeight = Math.max(68, height * 0.13);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(0, height - barHeight, width, barHeight);

        // Watermark Banner (Top-Right Badge)
        const badgeWidth = Math.min(220, width * 0.35);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(width - badgeWidth - 14, 14, badgeWidth, 34);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(width - badgeWidth - 14, 14, badgeWidth, 34);

        // Verified indicator dot
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(width - badgeWidth + 4, 31, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(11, Math.round(width * 0.022))}px sans-serif`;
        ctx.fillText('LIVE BACK CAMERA', width - badgeWidth + 16, 35);

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
          mode === 'MORNING' ? 'SS REALTY • MORNING TASK PLAN' : 'SS REALTY • EVENING COMPLETION PROOF';

        // Title line
        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold ${Math.max(14, Math.round(width * 0.028))}px sans-serif`;
        ctx.fillText(bannerTitle, 16, height - barHeight + 24);

        // Details line
        ctx.fillStyle = '#cbd5e1';
        ctx.font = `${Math.max(11, Math.round(width * 0.022))}px sans-serif`;
        const taskSummary = selectedTasks.slice(0, 3).join(', ') || 'Site Work';
        ctx.fillText(
          `${employeeName} | ${projectName} | ${dateStr} ${timeStr}`,
          16,
          height - barHeight + 45
        );

        // GPS line
        ctx.fillStyle = '#94a3b8';
        ctx.font = `monospace ${Math.max(10, Math.round(width * 0.019))}px`;
        ctx.fillText(
          `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} | Work: ${taskSummary}`,
          16,
          height - 10
        );

        // Convert to WebP format (0.84 quality factor for small size & HD sharpness)
        try {
          const webpUrl = canvas.toDataURL('image/webp', 0.84);
          resolve(webpUrl);
        } catch {
          // Fallback to jpeg if browser doesn't support webp canvas export
          resolve(canvas.toDataURL('image/jpeg', 0.84));
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
        const webpStampted = await processCapturedPhotoToWebP(rawSrc);

        const now = new Date();
        const newPhoto: TaskPhoto = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          url: webpStampted,
          caption: mode === 'MORNING' ? (selectedTasks[0] || 'Site Work Area') : 'Completed Work',
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

        toast.success('Live back-camera photo add ho gayi! (WebP Compressed)', { id: toastId });
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

  // Update caption
  const handleUpdateCaption = (photoId: string, caption: string) => {
    if (mode === 'MORNING') {
      setMorningPhotos(
        morningPhotos.map((p) => (p.id === photoId ? { ...p, caption } : p))
      );
    } else {
      setEveningPhotos(
        eveningPhotos.map((p) => (p.id === photoId ? { ...p, caption } : p))
      );
    }
  };

  // Final Submit
  const handleSubmit = async () => {
    const activePhotos = mode === 'MORNING' ? morningPhotos : eveningPhotos;

    if (activePhotos.length === 0) {
      toast.error('Kripya back camera se kam se kam ek live site photo zaroor lein!');
      return;
    }

    if (mode === 'MORNING' && selectedTasks.length === 0 && !taskDescription.trim()) {
      toast.error('Kripya aaj ka task select karein (e.g. Plaster, POP, Tank etc.)');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(
      mode === 'MORNING'
        ? 'Morning task plan save ho raha hai...'
        : 'Evening completion report save ho rahi hai...'
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
              tasks: selectedTasks,
              tasksDescription: taskDescription,
              morningPhotos,
            }
          : {
              type: 'EVENING_REPORT',
              dateKey: effectiveDateKey,
              formattedDate: effectiveFormattedDate,
              employeeName,
              projectName,
              completionStatus,
              completionNotes,
              eveningPhotos,
            };

      const res = await fetch('/api/attendance/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Saved successfully!', { id: toastId, duration: 5000 });
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

      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
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
                  {mode === 'MORNING' ? "Today's Site Tasks (Subah Ka Plan)" : "Evening Work Completion Proof (Shaam Ka Jaiza)"}
                </h3>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    mode === 'MORNING'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {mode === 'MORNING' ? 'Morning Plan' : 'Evening Result'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {employeeName} &bull; {projectName} &bull; {effectiveFormattedDate}
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Strict Back-Camera Warning Banner */}
          <div className="p-3 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-slate-300">
              <p className="font-bold text-white text-xs">Live Back-Camera Only (Gallery Upload Blocked)</p>
              <p className="text-[11px] text-slate-400">
                Site par live camera khol kar hi photo li jayegi. AI ya puraani gallery photo upload karna sakht mana hai. Photos WebP me save hongi.
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: MORNING PLANNING OR EVENING REVIEW                       */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {mode === 'MORNING' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-2 uppercase tracking-wider">
                  1. Aaj Site Par Kya-Kya Kaam Hoga? (Select Tasks)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COMMON_CONSTRUCTION_TASKS.map((task) => {
                    const isSelected = selectedTasks.includes(task.label);
                    return (
                      <button
                        type="button"
                        key={task.id}
                        onClick={() => toggleTask(task.label)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400/80 text-amber-200 font-bold shadow-xs'
                            : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="text-base">{task.icon}</span>
                        <span className="text-[11px] leading-tight truncate">{task.label.split(' ')[0]}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5 uppercase tracking-wider">
                  Task Details &amp; Notes (Specific Jagah / Kamra)
                </label>
                <textarea
                  rows={2}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Jaise: Hall me POP false ceiling, Bedroom 1 me plaster, aur ground floor par tank ka kaam..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          ) : (
            /* EVENING MODE: Show Morning Planned Tasks First */
            <div className="space-y-4">
              {/* Morning Plan Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Subah Ka Plan (Morning Target):
                  </span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Logged at {existingData?.morningTimeStr || 'Morning'}
                  </span>
                </div>

                {existingData?.tasks && existingData.tasks.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {existingData.tasks.map((t) => (
                      <span
                        key={t}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-[11px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Subah koi specific task select nahi tha.</p>
                )}

                {existingData?.tasksDescription && (
                  <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    &ldquo;{existingData.tasksDescription}&rdquo;
                  </p>
                )}

                {/* Morning Photos Thumbnails */}
                {existingData?.morningPhotos && existingData.morningPhotos.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                      Subah Ki Li Gayi Live Photos ({existingData.morningPhotos.length}):
                    </span>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {existingData.morningPhotos.map((photo, i) => (
                        <div
                          key={photo.id || i}
                          onClick={() => setPreviewPhoto(photo.url)}
                          className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-700 shrink-0 cursor-pointer group"
                        >
                          <img src={photo.url} alt="Morning View" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                            <Eye className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Completion Status Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-2 uppercase tracking-wider">
                  2. Shaam Tak Kaam Kitna Hua? (Completion Status)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCompletionStatus('COMPLETED')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      completionStatus === 'COMPLETED'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold shadow-xs'
                        : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-lg block mb-0.5">🟢</span>
                    <span className="text-[11px] font-bold block">100% Poora Hua</span>
                    <span className="text-[9.5px] text-slate-400">Completed</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompletionStatus('PARTIAL')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      completionStatus === 'PARTIAL'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-xs'
                        : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-lg block mb-0.5">🟡</span>
                    <span className="text-[11px] font-bold block">Aadha / Kuch Hua</span>
                    <span className="text-[9.5px] text-slate-400">Partial</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompletionStatus('IN_PROGRESS')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      completionStatus === 'IN_PROGRESS'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold shadow-xs'
                        : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-lg block mb-0.5">⏳</span>
                    <span className="text-[11px] font-bold block">Kaam Chal Raha Hai</span>
                    <span className="text-[9.5px] text-slate-400">In Progress</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5 uppercase tracking-wider">
                  Shaam Ki Pragati Ka Vivran (Notes on Work Done)
                </label>
                <textarea
                  rows={2}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Jaise: Hall plaster complete ho gaya hai, room 2 ka kal subah karenge..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: LIVE BACK CAMERA PHOTO UPLOAD & ADD MORE                 */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {mode === 'MORNING'
                    ? '2. Kaam Ki Shuruat Ki Photo (Back Camera)'
                    : '3. Taiyaar Kaam Ki Photo (Back Camera Completion Proof)'}
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Live photo lein jisme jagah saaf dikhe. Aap multiple photos jod sakte hain.
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
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

                    <div className="p-2 bg-slate-900 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={photo.caption}
                        onChange={(e) => handleUpdateCaption(photo.id, e.target.value)}
                        placeholder="Room / Wall name..."
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                      />
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

            {/* Big Launch Back Camera Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleTriggerBackCamera}
                disabled={isCapturing}
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 active:scale-[0.99] transition-all font-black text-sm text-white shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 cursor-pointer border border-indigo-400/30"
              >
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white animate-pulse" />
                </div>
                <span>
                  {currentPhotos.length === 0
                    ? '📸 Open Back Camera & Take Live Photo'
                    : '➕ Add More Photos (और फोटो जोड़ें)'}
                </span>
              </button>
              <p className="text-center text-[10.5px] text-slate-400 mt-2">
                Back camera automatically opens with date, GPS coordinates, and task watermark.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cancel / Later
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
              <span>Saving Report...</span>
            ) : (
              <>
                <span>
                  {mode === 'MORNING' ? '✅ Save Morning Task Plan' : '✅ Submit Evening Work Report'}
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
