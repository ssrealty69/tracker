'use client';

import { useState } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Calendar,
  Building2,
  ShieldCheck,
  Eye,
  Camera,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { SiteDailyTaskData } from '@/lib/siteTaskStore';

export interface SiteTaskViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskData: SiteDailyTaskData | null;
  employeeName: string;
  formattedDate: string;
  projectName: string;
}

export default function SiteTaskViewerModal({
  isOpen,
  onClose,
  taskData,
  employeeName,
  formattedDate,
  projectName,
}: SiteTaskViewerModalProps) {
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasMorning = taskData && ((taskData.tasks && taskData.tasks.length > 0) || (taskData.morningPhotos && taskData.morningPhotos.length > 0));
  const hasEvening = taskData && (taskData.completionStatus || (taskData.eveningPhotos && taskData.eveningPhotos.length > 0));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-slate-900 overflow-hidden my-auto border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
                  Daily Site Work Verification &amp; Photo Proof
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Subah vs Shaam
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-bold text-slate-800">{employeeName}</span> &bull; {projectName} &bull; {formattedDate}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-xs space-y-6">
          {!hasMorning && !hasEvening ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <Camera className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-sm text-slate-700">No Task Photos Logged For This Day</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Is din ke liye employee ne subah ya shaam ke task photos submit nahi kiye hain.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* LEFT COLUMN: MORNING TASK PLAN (BEFORE PHOTOS)                  */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <div className="space-y-4 bg-amber-50/40 p-4 sm:p-5 rounded-2xl border border-amber-200/80">
                <div className="flex items-center justify-between pb-3 border-b border-amber-200/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <h4 className="font-black text-sm text-amber-950 uppercase tracking-wider">
                      Morning Work Plan (सुबह का प्लान)
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                    {taskData?.morningTimeStr || 'Morning'}
                  </span>
                </div>

                {/* Selected Tasks Badges */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
                    Planned Tasks:
                  </span>
                  {taskData?.tasks && taskData.tasks.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {taskData.tasks.map((task) => (
                        <span
                          key={task}
                          className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold text-xs shadow-2xs"
                        >
                          {task}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No specific task category selected.</p>
                  )}
                </div>

                {/* Notes */}
                {taskData?.tasksDescription && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                      Task Description:
                    </span>
                    <p className="text-xs text-slate-800 bg-white p-2.5 rounded-xl border border-amber-200">
                      &ldquo;{taskData.tasksDescription}&rdquo;
                    </p>
                  </div>
                )}

                {/* Morning Back-Camera Photos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Live Site Photos ({taskData?.morningPhotos?.length || 0}):
                    </span>
                    <span className="text-[9.5px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Back Camera
                    </span>
                  </div>

                  {taskData?.morningPhotos && taskData.morningPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {taskData.morningPhotos.map((photo, i) => (
                        <div
                          key={photo.id || i}
                          onClick={() => setZoomPhoto(photo.url)}
                          className="group relative rounded-xl overflow-hidden border border-amber-200/80 bg-black shadow-2xs cursor-pointer"
                        >
                          <img
                            src={photo.url}
                            alt="Morning Proof"
                            className="w-full h-32 object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 backdrop-blur-md rounded text-[9px] font-mono text-white font-bold">
                            {photo.timeStr || `Photo #${i + 1}`}
                          </div>
                          {photo.caption && (
                            <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-1 text-[9.5px] text-slate-200 truncate">
                              {photo.caption}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Eye className="w-5 h-5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-center py-4 bg-white/60 rounded-xl border border-dashed border-amber-200">
                      No morning photos uploaded.
                    </p>
                  )}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* RIGHT COLUMN: EVENING WORK COMPLETION (AFTER PHOTOS)            */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <div className="space-y-4 bg-emerald-50/40 p-4 sm:p-5 rounded-2xl border border-emerald-200/80">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <h4 className="font-black text-sm text-emerald-950 uppercase tracking-wider">
                      Evening Completion Proof (शाम का काम)
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                    {taskData?.eveningTimeStr || 'Pending'}
                  </span>
                </div>

                {/* Completion Status Badge */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
                    Completion Result:
                  </span>
                  {taskData?.completionStatus === 'COMPLETED' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs shadow-2xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 100% Completed (काम पूरा हो गया)
                    </span>
                  ) : taskData?.completionStatus === 'PARTIAL' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs shadow-2xs">
                      <Clock className="w-4 h-4 text-amber-600" /> Partially Done (आधा / कुछ काम हुआ)
                    </span>
                  ) : taskData?.completionStatus === 'IN_PROGRESS' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-100 text-sky-900 border border-sky-300 font-bold text-xs shadow-2xs">
                      <Clock className="w-4 h-4 text-sky-600" /> In Progress (काम चालू है)
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-slate-500 font-medium text-xs">
                      Evening punch / report pending
                    </span>
                  )}
                </div>

                {/* Notes */}
                {taskData?.completionNotes && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                      Evening Progress Notes:
                    </span>
                    <p className="text-xs text-slate-800 bg-white p-2.5 rounded-xl border border-emerald-200">
                      &ldquo;{taskData.completionNotes}&rdquo;
                    </p>
                  </div>
                )}

                {/* Evening Back-Camera Photos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Completion Proof Photos ({taskData?.eveningPhotos?.length || 0}):
                    </span>
                    <span className="text-[9.5px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Back Camera
                    </span>
                  </div>

                  {taskData?.eveningPhotos && taskData.eveningPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {taskData.eveningPhotos.map((photo, i) => (
                        <div
                          key={photo.id || i}
                          onClick={() => setZoomPhoto(photo.url)}
                          className="group relative rounded-xl overflow-hidden border border-emerald-200/80 bg-black shadow-2xs cursor-pointer"
                        >
                          <img
                            src={photo.url}
                            alt="Evening Proof"
                            className="w-full h-32 object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 backdrop-blur-md rounded text-[9px] font-mono text-white font-bold">
                            {photo.timeStr || `Photo #${i + 1}`}
                          </div>
                          {photo.caption && (
                            <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-1 text-[9.5px] text-slate-200 truncate">
                              {photo.caption}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Eye className="w-5 h-5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-center py-4 bg-white/60 rounded-xl border border-dashed border-emerald-200">
                      Evening completion photos not uploaded yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Tamper-Proof GPS &amp; Timestamp WebP Stamped
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* HD Zoom Modal */}
      {zoomPhoto && (
        <div
          onClick={() => setZoomPhoto(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl w-full max-h-[92vh] flex flex-col items-center">
            <button
              onClick={() => setZoomPhoto(null)}
              className="absolute -top-10 right-0 text-white hover:text-rose-400 flex items-center gap-1 text-xs font-bold"
            >
              <X className="w-5 h-5" /> Close
            </button>
            <img
              src={zoomPhoto}
              alt="Zoomed Task Photo"
              className="max-h-[85vh] w-auto max-w-full rounded-2xl border-2 border-emerald-500 shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
