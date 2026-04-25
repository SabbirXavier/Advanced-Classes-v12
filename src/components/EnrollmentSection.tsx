import React, { useState, useEffect } from 'react';
import { Plus, Link as LinkIcon, AlertCircle, CheckCircle, UserPlus, X, Settings, Edit, Trash2, Check, FileText, Lock, Download, FileUp, DollarSign, ChevronDown, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import toast, { Toaster } from 'react-hot-toast';
import { firestoreService } from '../services/firestoreService';
import { authService } from '../services/authService';

import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface Enrollment {
  id: string;
  name: string;
  email?: string;
  grade: string;
  whatsapp: string;
  instagram: string;
  subjects: string[];
  feeStatus: string;
  notes: string;
}

export default function EnrollmentSection() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<Enrollment | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [expandedBatchStudents, setExpandedBatchStudents] = useState<Record<string, boolean>>({});

  const handleLogPayment = async () => {
    if (!selectedStudent || !paymentAmount) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) return toast.error('Enter a valid amount');
    
    // 50-50 Split
    const adminCut = Math.floor(amount * 0.5);
    const facultyCut = amount - adminCut;
    
    try {
      // Fetch fees to calculate subject splits
      const feesSnap = await getDocs(query(collection(db, 'fees')));
      const feesData = feesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      const selectedFees = feesData.filter(f => 
        (selectedStudent.subjects || []).includes(f.subject) &&
        (f.grade === selectedStudent.grade || (f.grades && f.grades.includes(selectedStudent.grade)))
      );
      const totalBasePrice = selectedFees.reduce((sum, f) => sum + (f.originalPrice - f.discount), 0);
      
      const subjectSplits: Record<string, number> = {};
      if (totalBasePrice > 0) {
         selectedFees.forEach(f => {
           const ratio = (f.originalPrice - f.discount) / totalBasePrice;
           subjectSplits[f.subject] = Math.floor(facultyCut * ratio);
         });
      } else {
         (selectedStudent.subjects || []).forEach(sub => {
           subjectSplits[sub] = Math.floor(facultyCut / (selectedStudent.subjects?.length || 1));
         });
      }

      await firestoreService.addItem('finance_ledger', {
        date: new Date().toISOString(),
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        amountPaid: amount,
        adminCut,
        facultyCut,
        subjectSplits,
        subjects: selectedStudent.subjects || []
      });
      
      const newTotal = (selectedStudent as any).totalPaid ? (selectedStudent as any).totalPaid + amount : amount;
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(5); // 5th of next month

      await firestoreService.updateItem('enrollments', selectedStudent.id, {
        feeStatus: 'Paid',
        totalPaid: newTotal,
        expiryDate: nextMonth.toISOString()
      });
      
      toast.success('Payment logged & splits calculated!');
      setShowPaymentModal(false);
      setPaymentAmount('');
      
    } catch (error) {
      toast.error('Failed to log payment');
    }
  };
  
  useEffect(() => {
    const unsubEnrollments = firestoreService.listenToCollection('enrollments', setEnrollments);
    const unsubBatches = firestoreService.listenToCollection('batches', setBatches);
    
    const unsubAuth = authService.onAuthChange((u) => {
      setUser(u);
      if (u) {
        // Check if admin
        const adminEmail1 = import.meta.env.VITE_ADMIN_EMAIL_1 || 'xavierscot3454@gmail.com';
        const adminEmail2 = import.meta.env.VITE_ADMIN_EMAIL_2 || 'helixsmith.xavy@gmail.com';
        const adminEmail3 = 'makeitawesom3@gmail.com';
        if (u.email === adminEmail1 || u.email === adminEmail2 || u.email === adminEmail3) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      unsubEnrollments();
      unsubBatches();
      unsubAuth();
    };
  }, []);

  const handleAdminUpdate = async (id: string, updates: Partial<Enrollment>) => {
    try {
      await firestoreService.updateItem('enrollments', id, updates);
      if (selectedStudent?.id === id) {
        setSelectedStudent(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      console.error("Failed to update", err);
    }
  };

  const handleAdminDelete = async (id: string) => {
    try {
      await firestoreService.deleteItem('enrollments', id);
      setShowAdminModal(false);
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(enrollments, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `enrollments_export_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast.success('Enrollments exported successfully!');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!Array.isArray(json)) {
          toast.error('Invalid format: Expected an array of enrollments');
          return;
        }

        setIsImporting(true);
        const results = await firestoreService.bulkAdd('enrollments', json);
        setIsImporting(false);
        
        toast.success(`Import complete: ${results.success} success, ${results.failed} failed`);
        e.target.value = ''; // Reset input
      } catch (err) {
        toast.error('Failed to parse JSON file');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const renderBatch = (gradeTitle: string, gradeLevel: string) => {
    const batchStudents = enrollments.filter(s => s.grade === gradeLevel);
    const isExpanded = !!expandedBatchStudents[gradeLevel];
    const previewLimit = 6;
    const visibleBatchStudents = isExpanded ? batchStudents : batchStudents.slice(0, previewLimit);
    const hiddenCount = Math.max(0, batchStudents.length - previewLimit);
    if (gradeLevel !== 'XII' && gradeLevel !== 'XI' && gradeLevel !== 'X') return null;
    
    // Find matching batch config
    const batchConfig = batches.find(b => b.name.includes(gradeLevel));
    
    const maxCapacity = batchConfig?.capacity || 24;
    const filledSeats = batchStudents.length;
    const remainingSeats = maxCapacity - filledSeats;
    const progressPercentage = Math.min((filledSeats / maxCapacity) * 100, 100);

    return (
      <div className="mb-6 bg-white/5 dark:bg-[#111928]/40 rounded-2xl border border-[var(--border-color)] overflow-hidden">
        {batchConfig?.showProgressBar && (
          <div className="p-4 border-b border-[var(--border-color)] bg-white/5">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-bold opacity-80">Batch Capacity</span>
              <span className="text-sm font-black text-[var(--danger)]">{filledSeats}/{maxCapacity} Seats Filled. Only {Math.max(0, remainingSeats)} Seats Remaining!</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-3 overflow-hidden">
              <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--danger)] h-2.5 rounded-full transition-all duration-1000" style={{ width: `${progressPercentage}%` }}></div>
            </div>
            {batchConfig.waitlistMessage && (
              <p
                className="leading-relaxed"
                style={{
                  color: batchConfig.waitlistTextColor || 'var(--danger)',
                  fontFamily: batchConfig.waitlistFontFamily || 'inherit',
                  fontSize: `${batchConfig.waitlistFontSize || 12}px`,
                  fontWeight: 700,
                }}
              >
                {batchConfig.waitlistMessage}
              </p>
            )}
          </div>
        )}

        <div className="bg-[var(--primary)]/10 p-3 border-b border-[var(--border-color)] flex justify-between items-center">
          <h4 className="font-bold text-[var(--primary)]">{gradeTitle}</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold bg-[var(--primary)] text-white px-2 py-1 rounded-full">
              {batchStudents.length} Enrolled
            </span>
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-enrollment', { detail: { grade: gradeLevel } }));
              }}
              className="bg-[var(--primary)] text-white w-6 h-6 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        
        <div className="p-3">
          {batchStudents.length === 0 ? (
            <p className="text-sm opacity-50 text-center py-4">No students enrolled yet. Be the first!</p>
          ) : (
            <>
              <ul className="space-y-2">
                {visibleBatchStudents.map(student => (
                <li 
                  key={student.id} 
                  className={`flex items-center justify-between bg-white/50 dark:bg-black/20 p-2.5 rounded-xl border border-white/10 ${isAdmin ? 'cursor-pointer hover:bg-white/80 dark:hover:bg-white/5' : ''}`}
                  onClick={() => {
                    if (isAdmin) {
                      setSelectedStudent(student);
                      setShowAdminModal(true);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-[var(--success)]" />
                    <span className="font-semibold text-sm">{student.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {student.instagram && (
                      <a href={`https://instagram.com/${student.instagram}`} target="_blank" rel="noreferrer" className="text-pink-500 hover:scale-110 transition-transform" onClick={e => e.stopPropagation()}>
                        <LinkIcon size={18} />
                      </a>
                    )}
                    {user && user.email === student.email && !isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); alert('Removal request sent to admin.'); }} className="text-[var(--danger)]/70 hover:text-[var(--danger)]" title="Request Removal">
                        <AlertCircle size={16} />
                      </button>
                    )}
                  </div>
                </li>
                ))}
              </ul>

              {batchStudents.length > previewLimit && (
                <button
                  onClick={() => setExpandedBatchStudents((prev) => ({ ...prev, [gradeLevel]: !prev[gradeLevel] }))}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-all"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {isExpanded ? 'Collapse Student List' : `Expand Student List (${hiddenCount} more)`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div id="enrollment-section" className="glass-card mt-5 relative z-20">
      <Toaster position="top-center" />
      <div className="text-center mb-6 p-4 bg-[var(--primary)]/5 rounded-xl border border-[var(--primary)]/20">
        <p className="text-sm font-bold text-[var(--primary)]">
          Physics, Chemistry, Mathematics Tuition at Sonai. Scroll above & tap on Locate Us for the Google map link.
        </p>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h3 className="uppercase text-[var(--primary)] font-bold tracking-wide flex items-center gap-2">
          <UserPlus size={20} /> Live Batch Enrollment
        </h3>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex items-center gap-2 mr-2">
              <button 
                onClick={handleExport}
                className="p-2 text-gray-500 hover:text-[var(--primary)] transition-colors"
                title="Export Enrollments"
              >
                <Download size={20} />
              </button>
              <label className="p-2 text-gray-500 hover:text-[var(--primary)] transition-colors cursor-pointer" title="Import Enrollments">
                <FileUp size={20} />
                <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={isImporting} />
              </label>
            </div>
          )}
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-enrollment'))}
            className="bg-[var(--primary)] text-white w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-[0_4px_15px_rgba(79,70,229,0.4)]"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {renderBatch("Class XII Batch", "XII")}
      {renderBatch("Class XI Batch", "XI")}
      {renderBatch("Class X Batch", "X")}

      <div className="glass-card relative overflow-hidden mb-6 border border-white/10 bg-white/5 backdrop-blur-md">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3 shadow-inner">
            <Lock size={24} className="text-gray-400" />
          </div>
          <h4 className="font-bold text-lg mb-2 opacity-90">Community Vault</h4>
          <p className="text-sm opacity-70 max-w-[250px]">
            🔒 Free Gift for Everyone. This unlocks automatically for all enrolled students as soon as the batch hits 24/24.
          </p>
        </div>
      </div>

      <div className="text-center mt-6 p-4 bg-gradient-to-r from-[var(--primary)]/10 to-[var(--secondary)]/10 rounded-xl border border-[var(--border-color)]">
        <p className="text-sm font-bold opacity-90">
          As soon as the Batch Fills, we will start the batch! 🚀
        </p>
        <p className="text-xs opacity-75 mt-1">
          Fill the batch. Enroll your friend as well & join the class together.
        </p>
      </div>

      {/* Admin Modal */}
      {showAdminModal && selectedStudent && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md relative">
            <button onClick={() => setShowAdminModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold mb-1 text-[var(--primary)] flex items-center gap-2">
              <Settings size={20} /> Admin Controls
            </h2>
            <p className="text-sm opacity-70 mb-4">Managing {selectedStudent.name}</p>

            <div className="space-y-4">
              {isEditingAdmin ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold opacity-70 mb-1 block">Name</label>
                    <input type="text" value={selectedStudent.name} onChange={e => setSelectedStudent({...selectedStudent, name: e.target.value})} className="w-full p-2 rounded bg-white/10 border border-[var(--border-color)] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold opacity-70 mb-1 block">WhatsApp</label>
                    <input type="text" value={selectedStudent.whatsapp} onChange={e => setSelectedStudent({...selectedStudent, whatsapp: e.target.value})} className="w-full p-2 rounded bg-white/10 border border-[var(--border-color)] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold opacity-70 mb-1 block">Instagram</label>
                    <input type="text" value={selectedStudent.instagram} onChange={e => setSelectedStudent({...selectedStudent, instagram: e.target.value})} className="w-full p-2 rounded bg-white/10 border border-[var(--border-color)] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold opacity-70 mb-1 block">Grade</label>
                    <select value={selectedStudent.grade} onChange={e => setSelectedStudent({...selectedStudent, grade: e.target.value})} className="w-full p-2 rounded bg-white/10 border border-[var(--border-color)] outline-none [&>option]:bg-gray-900">
                      <option value="XII">Class XII</option>
                      <option value="XI">Class XI</option>
                      <option value="X">Class X</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => {
                      handleAdminUpdate(selectedStudent.id, {
                        name: selectedStudent.name,
                        whatsapp: selectedStudent.whatsapp,
                        instagram: selectedStudent.instagram,
                        grade: selectedStudent.grade
                      });
                      setIsEditingAdmin(false);
                    }} className="flex-1 py-2 bg-[var(--success)] text-white rounded-xl text-sm font-bold">Save</button>
                    <button onClick={() => setIsEditingAdmin(false)} className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-white/5 border border-[var(--border-color)] p-3 rounded-xl">
                    <div className="text-xs opacity-70 mb-1">Contact Info</div>
                    <div className="font-bold">{selectedStudent.whatsapp}</div>
                    {selectedStudent.instagram && <div className="text-sm text-pink-500 mt-1">@{selectedStudent.instagram}</div>}
                  </div>

                  <div className="bg-white/5 border border-[var(--border-color)] p-3 rounded-xl">
                    <div className="text-xs opacity-70 mb-1">Subjects Selected</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedStudent.subjects.map(s => (
                        <span key={s} className="text-xs bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-1 rounded-md">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white/5 border border-[var(--border-color)] p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs opacity-70 mb-1">Fee Status</div>
                      <div className={`font-bold ${selectedStudent.feeStatus === 'Paid' ? 'text-[var(--success)]' : 'text-yellow-500'}`}>
                        {selectedStudent.feeStatus}
                      </div>
                      {(selectedStudent as any).totalPaid && (
                        <div className="text-xs opacity-60 mt-0.5">Paid: ₹{(selectedStudent as any).totalPaid}</div>
                      )}
                    </div>
                    <button 
                      onClick={() => setShowPaymentModal(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--success)]/20 text-[var(--success)] hover:bg-[var(--success)]/30 flex items-center gap-1.5 transition-all`}
                    >
                      <DollarSign size={14} /> Log Custom Payment
                    </button>
                  </div>

                  <div className="bg-white/5 border border-[var(--border-color)] p-3 rounded-xl">
                    <div className="text-xs opacity-70 mb-1 flex items-center gap-1"><FileText size={14} /> Notes</div>
                    <textarea 
                      className="w-full bg-transparent border-none outline-none text-sm resize-none" 
                      rows={2} 
                      placeholder="Add private notes here..."
                      value={selectedStudent.notes || ''}
                      onChange={(e) => handleAdminUpdate(selectedStudent.id, { notes: e.target.value })}
                      onBlur={(e) => handleAdminUpdate(selectedStudent.id, { notes: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => setIsEditingAdmin(true)}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Edit size={16} /> Edit Info
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to remove ${selectedStudent.name}?`)) {
                          handleAdminDelete(selectedStudent.id);
                        }
                      }}
                      className="flex-1 py-2 bg-[var(--danger)]/20 text-[var(--danger)] hover:bg-[var(--danger)]/30 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Remove
                    </button>
                  </div>
                </>
              )}
            </div>
            
            {/* Custom Payment Modal Overlay */}
            {showPaymentModal && (
              <div className="absolute inset-0 z-50 bg-gray-900 rounded-[var(--radius)] p-6 flex flex-col justify-center animate-in fade-in zoom-in duration-200">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-[var(--success)]">
                  <DollarSign /> Log Custom Payment
                </h3>
                <p className="text-xs opacity-70 mb-4">Enter payment amount. The system will automatically split this 50-50 between Admin Revenue and Faculty Pool.</p>
                
                <div className="space-y-4">
                  <div>
                     <label className="text-xs font-bold opacity-70 mb-1 block">Amount Received (₹)</label>
                     <input 
                       type="number" 
                       placeholder="e.g. 1500"
                       value={paymentAmount}
                       onChange={e => setPaymentAmount(e.target.value)}
                       className="w-full p-3 rounded-xl bg-white/10 border border-[var(--success)]/30 outline-none focus:border-[var(--success)] text-lg font-mono font-bold" 
                     />
                  </div>
                  
                  {paymentAmount && !isNaN(Number(paymentAmount)) && Number(paymentAmount) > 0 && (
                    <div className="p-4 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-xl text-sm border-dashed">
                      <div className="flex justify-between items-center mb-1">
                        <span className="opacity-70 font-bold">Admin Cut (50%)</span>
                        <span className="font-mono text-[var(--success)] font-black">₹{Number(paymentAmount) / 2}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="opacity-70 font-bold">Faculty Pool (50%)</span>
                        <span className="font-mono text-[var(--success)] font-black">₹{Number(paymentAmount) / 2}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={handleLogPayment}
                      className="flex-1 py-3 bg-[var(--success)] text-white hover:bg-[var(--success)]/90 rounded-xl text-sm font-black shadow-lg shadow-[var(--success)]/20"
                    >
                      Confirm Split & Log
                    </button>
                    <button 
                      onClick={() => setShowPaymentModal(false)}
                      className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}
