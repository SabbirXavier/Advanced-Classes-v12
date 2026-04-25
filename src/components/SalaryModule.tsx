import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  Settings, 
  History, 
  Plus, 
  TrendingUp, 
  CreditCard, 
  ExternalLink, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  User,
  Search,
  ChevronRight,
  TrendingDown,
  Upload,
  ArrowRight,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { firestoreService } from '../services/firestoreService';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

import { storageService } from '../services/storageService';

interface SalaryModuleProps {
  user: any;
  isAdmin: boolean;
  isFaculty: boolean;
  facultyBatches: any[];
}

export default function SalaryModule({ user, isAdmin, isFaculty, facultyBatches }: SalaryModuleProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'payouts' | 'student-payments' | 'admin-earnings'>(isAdmin ? 'settings' : 'overview');
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [facultySalaries, setFacultySalaries] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Faculty specific state
  const [mySalaryInfo, setMySalaryInfo] = useState<any>(null);
  const [isResigning, setIsResigning] = useState(false);
  const [resignationDate, setResignationDate] = useState('');
  const [resignationFile, setResignationFile] = useState<File | null>(null);
  const [resignationFileUploading, setResignationFileUploading] = useState(false);
  const [resignationFileProgress, setResignationFileProgress] = useState(0);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [resignations, setResignations] = useState<any[]>([]);
  const [isAddingPayout, setIsAddingPayout] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ userId: '', amount: '', transactionId: '', note: '', method: 'upi', periodMonth: new Date().toISOString().slice(0, 7) });
  
  // Faculty Custom Payment Edit & Wrapped
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [paymentUpi, setPaymentUpi] = useState('');
  const [paymentBank, setPaymentBank] = useState('');
  const [showWrapped, setShowWrapped] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0,7));

  const facultyManagedBatches = useMemo(() => 
    facultyBatches.filter(fb => fb.userId === user.uid || fb.email === user.email),
    [facultyBatches, user.uid, user.email]
  );

  const handleShareWrapped = async () => {
    const el = document.getElementById('faculty-wrapped-card');
    if (!el) return;
    try {
      toast.loading('Generating your flex card...', { id: 'wrapped' });
      const canvas = await html2canvas(el, { backgroundColor: '#0f0f13', scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = imgData;
      a.download = `Faculty_Wrapped_${user?.displayName || 'Card'}.png`;
      a.click();
      toast.success('Downloaded! Share it on WhatsApp \uD83D\uDD25', { id: 'wrapped' });
    } catch(err) {
      toast.error('Failed to generate image', { id: 'wrapped' });
    }
  };

  const [financeLedgers, setFinanceLedgers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [monthlyFeeLedger, setMonthlyFeeLedger] = useState<any[]>([]);
  const [studentStatusMonth, setStudentStatusMonth] = useState(new Date().toISOString().slice(0, 7));
  const [adminSelectedFacultyId, setAdminSelectedFacultyId] = useState('');

  useEffect(() => {
    let unsubSalaries = () => {};
    let unsubPayouts = () => {};
    let unsubAttendance = () => {};
    let unsubEnrollments = () => {};
    let unsubResignations = () => {};
    let unsubLedger = () => {};
    let unsubRequests = () => {};
    let unsubMonthlyLedger = () => {};

    if (isAdmin) {
      unsubSalaries = firestoreService.listenToCollection('faculty_salaries', (data) => {
        setFacultySalaries(data);
        if (isFaculty) {
          setMySalaryInfo(data.find(s => s.userId === user.uid));
        }
      });
      unsubPayouts = firestoreService.listenToCollection('payouts', (data) => {
        setPayouts(data.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)));
      });
      unsubAttendance = firestoreService.listenToCollection('faculty_attendance', (data) => {
        setAttendance(data);
      });
      unsubEnrollments = firestoreService.listenToCollection('enrollments', (data) => {
        setEnrollments(data);
      });
      unsubResignations = firestoreService.listenToCollection('resignations', (data) => {
        setResignations(data);
      });
      unsubLedger = firestoreService.listenToCollection('finance_ledger', setFinanceLedgers);
      unsubRequests = firestoreService.listenToCollection('payout_requests', (data) => {
        setRequests(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      });
      unsubMonthlyLedger = firestoreService.listenToCollection('student_monthly_fee_ledger', setMonthlyFeeLedger);

      const fetchFaculty = async () => {
         try {
           const [snap1, snap2] = await Promise.all([
             getDocs(query(collection(db, 'users'), where('roles', 'array-contains', 'faculty'))),
             getDocs(query(collection(db, 'users'), where('role', '==', 'faculty')))
           ]);
           const allUsers = new Map();
           snap1.docs.forEach(doc => allUsers.set(doc.id, { id: doc.id, ...doc.data() }));
           snap2.docs.forEach(doc => allUsers.set(doc.id, { id: doc.id, ...doc.data() }));
           setFacultyList(Array.from(allUsers.values()));
         } catch (err) {
           console.error("Error fetching faculty users:", err);
         }
         setLoading(false);
      };
      fetchFaculty();
    } else if (isFaculty) {
      unsubSalaries = onSnapshot(query(collection(db, 'faculty_salaries'), where('userId', '==', user.uid)), (snap) => {
        const data: any[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFacultySalaries(data);
        setMySalaryInfo(data.find(s => s.userId === user.uid));
      }, (err) => console.warn(err));
      unsubPayouts = onSnapshot(query(collection(db, 'payouts'), where('userId', '==', user.uid)), (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPayouts(data.sort((a: any, b: any) => (b.date?.seconds || 0) - (a.date?.seconds || 0)));
      }, (err) => console.warn(err));
      unsubAttendance = onSnapshot(query(collection(db, 'faculty_attendance'), where('userId', '==', user.uid)), (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAttendance(data);
      }, (err) => console.warn(err));
      unsubEnrollments = firestoreService.listenToCollection('enrollments', (data) => {
        setEnrollments(data);
      });
      unsubResignations = onSnapshot(query(collection(db, 'resignations'), where('userId', '==', user.uid)), (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setResignations(data);
      }, (err) => console.warn(err));
      unsubRequests = onSnapshot(query(collection(db, 'payout_requests'), where('userId', '==', user.uid)), (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRequests(data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      }, (err) => console.warn(err));
      unsubMonthlyLedger = firestoreService.listenToCollection('student_monthly_fee_ledger', setMonthlyFeeLedger);
      // Ledger might need manual fetching if they own subjects, but right now they fetch none.
      // Admin will be needed to calculate balances properly, unless ledger read is opened up.
      // Setting ledger to empty for faculty.
      setLoading(false);
    } else {
      setLoading(false);
    }

    return () => {
      unsubSalaries();
      unsubPayouts();
      unsubAttendance();
      unsubEnrollments();
      unsubResignations();
      unsubLedger();
      unsubRequests();
      unsubMonthlyLedger();
    };
  }, [user.uid, isAdmin, isFaculty]);

  const myBalance = useMemo(() => {
    if (!isFaculty) return 0;
    // Map finance ledgers where student is in faculty's assigned batches
    const facultyManagedBatches = facultyBatches.filter(fb => fb.userId === user.uid || fb.email === user.email);
    
    // We don't filter them all out first. We calculate per ledger, per block.
    // Ensure we avoid double counting if a faculty teaches multiple subjects in the same grade.
    const totalEarnedFromSplits = financeLedgers.reduce((sum, l) => {
       let blockEarnings = 0;
       
       facultyManagedBatches.forEach(fb => {
          // Does this batch match the ledger's student enrollment?
          if (fb.batchId === l.batchId || (fb.batchName === l.grade && (fb.subject === 'ALL' || l.subjects?.includes(fb.subject)))) {
             // Use exact subject split if available
             if (l.subjectSplits && l.subjectSplits[fb.subject]) {
                blockEarnings += l.subjectSplits[fb.subject];
             } else if (fb.subject === 'ALL') {
                // If the faculty teaches ALL subjects for this grade, they get the full cut
                blockEarnings += Number(l.facultyCut) || 0;
             } else if (l.facultyCut && l.subjects?.length > 0) {
                // Fallback equally if no explicit splits
                blockEarnings += Math.floor(Number(l.facultyCut) / l.subjects.length);
             }
          }
       });
       return sum + blockEarnings;
    }, 0);

    const totalPaidOut = payouts.filter(p => p.userId === user.uid).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return totalEarnedFromSplits - totalPaidOut;
  }, [financeLedgers, payouts, user.uid, facultyBatches, isFaculty]);

  const handlePayoutRequest = async () => {
    if (displayBalance <= 0) {
      toast.error('Insufficient balance for disbursement');
      return;
    }
    try {
      await addDoc(collection(db, 'payout_requests'), {
        userId: user.uid,
        userName: user.displayName || user.email,
        amount: displayBalance,
        status: 'pending',
        createdAt: serverTimestamp(),
        type: 'early_disbursement'
      });
      setIsRequestingPayout(false);
      toast.success('Early disbursement request submitted!');
    } catch (err) {
      toast.error('Failed to submit request');
    }
  };

  const getFacultyScopedStudents = (facultyId: string, month: string) => {
    const monthEnd = new Date(`${month}-01`);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    const batches = facultyBatches.filter(fb => fb.userId === facultyId);
    return enrollments.filter((e) => {
      const inAssigned = batches.some((fb) =>
        (fb.batchId && fb.batchId === e.batchId) ||
        (fb.batchName && fb.batchName === e.batchName) ||
        (fb.subject === 'ALL' || (e.subjects || []).includes(fb.subject))
      );
      if (!inAssigned) return false;
      const createdAtDate = e.createdAt?.seconds ? new Date(e.createdAt.seconds * 1000) : null;
      if (!createdAtDate) return true;
      return createdAtDate.getTime() <= monthEnd.getTime();
    });
  };

  const getMonthlySalaryBreakdown = (salaryInfo: any, month: string) => {
    if (!salaryInfo?.userId) {
      return { presentDays: 0, classDays: 0, totalAssignedStudents: 0, paidStudentsCount: 0, unpaidStudentsCount: 0, earnedAmount: 0, pendingPotentialAmount: 0 };
    }

    const presentDays = attendance.filter((a) => a.userId === salaryInfo.userId && a.isApproved && (a.dateStr || '').startsWith(month)).length;
    const classDays = Number(salaryInfo.totalClassDays || attendance.filter((a) => a.userId === salaryInfo.userId && (a.dateStr || '').startsWith(month)).length || 0);
    const assignedStudents = getFacultyScopedStudents(salaryInfo.userId, month);
    const assignedIds = new Set(assignedStudents.map((s: any) => s.id));
    const monthLedger = monthlyFeeLedger.filter((l: any) => l.month === month && assignedIds.has(l.studentId));
    const paidStudentsCount = monthLedger.filter((l: any) => Number(l.paidAmount || 0) > 0 || l.status === 'Paid').length;
    const totalAssignedStudents = assignedStudents.length;
    const unpaidStudentsCount = Math.max(0, totalAssignedStudents - paidStudentsCount);

    const model = salaryInfo.model || 'monthly';
    const rate = Number(salaryInfo.perStudentRate || salaryInfo.baseAmount || 0);
    let earnedAmount = 0;
    let pendingPotentialAmount = 0;

    if (model === 'monthly') {
      const totalFixedSalary = Number(salaryInfo.baseAmount || 0);
      earnedAmount = classDays > 0 ? (totalFixedSalary / classDays) * presentDays : 0;
    } else if (model === 'daily') {
      earnedAmount = Number(salaryInfo.baseAmount || 0) * presentDays;
    } else {
      const formulaMode = salaryInfo.perStudentFormulaMode || 'attendance_adjusted';
      const rateType = salaryInfo.perStudentRateType || 'fixed';
      if (formulaMode === 'paid_student') {
        if (rateType === 'percentage') {
          earnedAmount = monthLedger.reduce((sum: number, l: any) => sum + ((Number(l.paidAmount || 0) * rate) / 100), 0);
        } else {
          earnedAmount = rate * paidStudentsCount;
        }
      } else {
        earnedAmount = classDays > 0 ? ((rate * totalAssignedStudents) / classDays) * presentDays : 0;
      }
      pendingPotentialAmount = rateType === 'percentage'
        ? 0
        : Math.max(0, (rate * unpaidStudentsCount));
    }

    return { presentDays, classDays, totalAssignedStudents, paidStudentsCount, unpaidStudentsCount, earnedAmount, pendingPotentialAmount };
  };

  const calculateNetReceivable = (salaryInfo: any, month: string) => {
    const breakdown = getMonthlySalaryBreakdown(salaryInfo, month);
    const monthPayouts = payouts
      .filter((p) => p.userId === salaryInfo?.userId && (p.periodMonth || month) === month)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const monthAdjustments = requests
      .filter((r) => r.userId === salaryInfo?.userId && r.type === 'salary_adjustment' && r.periodMonth === month)
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
    return Math.max(0, breakdown.earnedAmount + monthAdjustments - monthPayouts);
  };

  const paidOutTotal = useMemo(
    () => payouts.filter(p => p.userId === user.uid).reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [payouts, user.uid]
  );
  const isPerStudentModel = mySalaryInfo?.model === 'per_student';
  const estimatedModelReceivable = useMemo(
    () => calculateNetReceivable(mySalaryInfo, selectedMonth),
    [mySalaryInfo, attendance, selectedMonth, payouts, monthlyFeeLedger, enrollments, facultyBatches, requests]
  );
  const displayBalance = useMemo(() => {
    if (isPerStudentModel) return myBalance;
    return Math.max(0, estimatedModelReceivable - paidOutTotal);
  }, [isPerStudentModel, myBalance, estimatedModelReceivable, paidOutTotal]);

  const saveSalarySettings = async (facId: string, data: any) => {
    try {
      const docId = `salary_${facId}`;
      await setDoc(doc(db, 'faculty_salaries', docId), {
        userId: facId,
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('Salary settings updated');
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const recordPayout = async (data: any) => {
    try {
      await addDoc(collection(db, 'payouts'), {
        ...data,
        method: data.method || 'upi',
        periodMonth: data.periodMonth || selectedMonth,
        approvedBy: data.approvedBy || user.email || 'system',
        approvedAt: serverTimestamp(),
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      toast.success('Payout record saved');
    } catch (err) {
      toast.error('Failed to save payout');
    }
  };

  const [isResignationSubmitted, setIsResignationSubmitted] = useState(false);

  const handleResignation = async () => {
    if (!resignationDate) {
        toast.error('Please select a resignation date');
        return;
    }
    if (!resignationFile) {
        toast.error('Please upload your resignation letter');
        return;
    }
    
    setResignationFileUploading(true);
    setResignationFileProgress(0);
    const toastId = toast.loading('Uploading resignation letter...');
    try {
      const { promise } = storageService.uploadFile(resignationFile, (progress) => {
          setResignationFileProgress(progress);
      });
      const uploadedFile = await promise;

      toast.loading('Saving resignation record...', { id: toastId });
      await addDoc(collection(db, 'resignations'), {
        userId: user.uid,
        userName: user.displayName || user.email,
        email: user.email,
        resignationDate,
        letterUrl: uploadedFile.url,
        letterName: resignationFile.name,
        submittedAt: serverTimestamp(),
        status: 'pending'
      });
      setIsResignationSubmitted(true);
      toast.success('Resignation successfully submitted.', { id: toastId });
      
      setTimeout(() => {
        setIsResigning(false);
        setIsResignationSubmitted(false);
        setResignationFile(null);
      }, 3000);
      
    } catch (err) {
      toast.error('Failed to submit: ' + (err as any).message, { id: toastId });
    } finally {
      setResignationFileUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 italic">
            <Wallet className="text-[var(--primary)]" />
            FACULTY & PAYROLL
          </h2>
          <p className="text-sm opacity-60">Salary management and payment tracking</p>
        </div>
        
        <div className="flex flex-wrap gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
          {isFaculty && (
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'overview' ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
            >
              My Earnings
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('settings' as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'settings' ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
            >
              Faculty Settings
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('requests' as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === ('requests' as any) ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
            >
              Requests
              {resignations.length > 0 && <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px]">{resignations.length}</span>}
            </button>
          )}
          <button 
            onClick={() => setActiveTab('payouts')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'payouts' ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
          >
            Payout History
          </button>
          {isFaculty && (
            <button 
              onClick={() => setActiveTab('student-payments')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'student-payments' ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
            >
              Student Fee Status
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin-earnings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'admin-earnings' ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
            >
              Earnings Monitor
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && isFaculty && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            
            {/* Top Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/20 p-6 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <User size={80} />
                </div>
                {isPerStudentModel ? (
                  <>
                    <h3 className="font-bold text-lg mb-1 tracking-tight z-10">Student Fee Summary</h3>
                    <p className="text-xs opacity-70 z-10 mb-4">Tracking for your assigned batches</p>
                    <div className="flex gap-8 z-10">
                      <div>
                        <div className="text-4xl font-black text-green-500">
                          {enrollments.filter(e => e.feeStatus === 'Paid' && facultyManagedBatches.some(fb => fb.batchName === e.batchName && (fb.subject === 'ALL' || fb.subject === e.subjects?.[0]))).length}
                        </div>
                        <div className="text-[10px] uppercase font-bold opacity-60 tracking-widest mt-1">Earned (Paid)</div>
                      </div>
                      <div>
                        <div className="text-4xl font-black text-amber-500">
                          {enrollments.filter(e => e.feeStatus !== 'Paid' && facultyManagedBatches.some(fb => fb.batchName === e.batchName && (fb.subject === 'ALL' || fb.subject === e.subjects?.[0]))).length}
                        </div>
                        <div className="text-[10px] uppercase font-bold opacity-60 tracking-widest mt-1">Pending Unpaid</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-lg mb-1 tracking-tight z-10">Attendance Salary Summary</h3>
                    <p className="text-xs opacity-70 z-10 mb-4">Monthly/Per-day payout is attendance linked</p>
                    <div className="flex gap-8 z-10">
                      <div>
                        <div className="text-4xl font-black text-green-500">
                          {attendance.filter(a => a.userId === user.uid && a.isApproved && a.dateStr.startsWith(selectedMonth)).length}
                        </div>
                        <div className="text-[10px] uppercase font-bold opacity-60 tracking-widest mt-1">Present Days</div>
                      </div>
                      <div>
                        <div className="text-4xl font-black text-blue-500">
                          ₹{Math.round(estimatedModelReceivable).toLocaleString()}
                        </div>
                        <div className="text-[10px] uppercase font-bold opacity-60 tracking-widest mt-1">Net Earned</div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="glass-card p-6 bg-indigo-500/10 border-indigo-500/20">
                <div className="text-[10px] uppercase font-black opacity-40 mb-1">Available to Withdraw</div>
                <div className="text-5xl font-black text-indigo-500 flex items-baseline gap-1 mt-2">
                  ₹{Math.round(displayBalance).toLocaleString()}
                </div>
                <div className="mt-4 flex flex-col gap-1">
                  <span className="text-[10px] opacity-60">
                    {isPerStudentModel ? 'Total earnings from paid enrollments' : 'Attendance-linked net earnings after disbursement'}
                  </span>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: '100%' }} 
                      className="h-full bg-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-6 bg-emerald-500/10 border-emerald-500/20">
                <div className="text-[10px] uppercase font-black opacity-40 mb-1">Monthly Estimations</div>
                <div className="text-3xl font-black text-emerald-500 mt-2">₹{Math.round(calculateNetReceivable(mySalaryInfo, selectedMonth)).toLocaleString()}</div>
                <div className="mt-4 flex items-center justify-between border-t border-emerald-500/20 pt-4">
                  <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="text-[10px] p-1.5 bg-white/10 rounded outline-none border border-white/10 w-28" />
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">{attendance.filter(a => a.userId === user.uid && a.isApproved && a.dateStr.startsWith(selectedMonth)).length} Present Days</span>
                </div>
              </div>
              
              <div className="glass-card p-6 flex flex-col justify-between">
                <div>
                   <div className="text-[10px] uppercase font-black opacity-40 mb-3 flex items-center justify-between">
                     Payout Method
                     <button onClick={() => {
                        setPaymentUpi(mySalaryInfo?.paymentMethod?.upiId || '');
                        setPaymentBank(mySalaryInfo?.paymentMethod?.bankDetails || '');
                        setIsEditingPayment(true);
                     }} className="text-indigo-500 hover:scale-110 transition-transform"><Edit2 size={12} /></button>
                   </div>
                   <div className="text-sm font-bold flex flex-col gap-3">
                     <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl"><CreditCard size={14} className="text-indigo-500" /> UPI: <span className="opacity-80 font-medium">{mySalaryInfo?.paymentMethod?.upiId || 'Not Set'}</span></div>
                     <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl text-xs"><Wallet size={14} className="opacity-70" /> {mySalaryInfo?.paymentMethod?.bankDetails?.substring(0, 20) || 'Bank Not Set'}...</div>
                   </div>
                </div>
                <button 
                  disabled={displayBalance <= 0}
                  onClick={() => setIsRequestingPayout(true)}
                  className={`mt-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    displayBalance > 0 
                    ? 'bg-indigo-500 text-white hover:scale-105 shadow-xl hover:shadow-indigo-500/20' 
                    : 'bg-white/5 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Request Early Disbursement
                </button>
              </div>

              <div className="glass-card p-6 flex flex-col justify-between">
                 <div>
                    <div className="text-[10px] uppercase font-black opacity-40 mb-3">Current Status</div>
                    <div className="text-sm font-bold text-green-500 flex items-center gap-2 bg-green-500/10 p-2 rounded-xl">
                      <CheckCircle2 size={16} /> Active Employee
                    </div>
                 </div>
                 <div className="flex flex-col gap-2 mt-4">
                   <button 
                    onClick={() => setShowWrapped(true)}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform flex justify-center items-center gap-2 shadow-lg"
                   >
                     <span>Generate Flex Card</span>
                   </button>
                   <button 
                    onClick={() => setIsResigning(true)}
                    className="w-full py-2 bg-white/5 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all flex justify-center items-center"
                   >
                     Resign
                   </button>
                 </div>
              </div>
            </div>

            <AnimatePresence>
              {isRequestingPayout && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsRequestingPayout(false)} />
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md bg-[#1e1e1e] rounded-3xl p-8 space-y-6">
                    <h3 className="text-xl font-black italic">REQUEST DISBURSEMENT</h3>
                    <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                      <div className="text-[10px] font-black uppercase opacity-40 mb-1">Disbursable Amount</div>
                      <div className="text-3xl font-black text-indigo-500">₹{Math.round(displayBalance).toLocaleString()}</div>
                      <p className="text-[10px] opacity-60 mt-2">This request will be processed within 24-48 hours after admin review.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="opacity-60">Admin Processing Fee:</span>
                        <span>₹0 (Helium Wave)</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-black border-t border-white/10 pt-4">
                        <span>Net Payout:</span>
                        <span className="text-indigo-400">₹{Math.round(displayBalance).toLocaleString()}</span>
                      </div>
                    </div>
                    <button 
                      onClick={handlePayoutRequest}
                      className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl"
                    >
                      Process Instant Request
                    </button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <div className="glass-card overflow-hidden">
               <div className="p-4 border-b border-white/5 bg-white/5 font-bold italic">MY PAYOUT LOGS</div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-white/5 text-[10px] font-black uppercase opacity-40">
                     <tr>
                       <th className="p-4">Date</th>
                       <th className="p-4">Amount</th>
                       <th className="p-4">Transaction ID</th>
                       <th className="p-4">Note</th>
                       <th className="p-4">Receipt</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5 text-xs">
                     {payouts.filter(p => p.userId === user.uid).map(p => (
                       <tr key={p.id}>
                         <td className="p-4 font-bold">{p.date?.toDate().toLocaleDateString()}</td>
                         <td className="p-4 font-black">₹{p.amount.toLocaleString()}</td>
                         <td className="p-4 font-mono opacity-60">{p.transactionId || '---'}</td>
                         <td className="p-4 italic opacity-60">{p.note || 'Regular Payout'}</td>
                         <td className="p-4">
                           {p.receiptUrl && <a href={p.receiptUrl} target="_blank" className="text-[var(--primary)] hover:underline">View</a>}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && isAdmin && (
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              {facultyList.map(faculty => {
                const salary = facultySalaries.find(s => s.userId === faculty.id);
                return (
                  <div key={faculty.id} className="glass-card p-6 flex flex-col md:flex-row gap-6 border-l-4 border-[var(--primary)]">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold">
                          {faculty.name?.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold">{faculty.name}</h4>
                          <p className="text-[10px] opacity-40">{faculty.email}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                         <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase opacity-40 pl-1">Salary Model</label>
                            <select 
                              value={salary?.model || 'monthly'}
                              onChange={(e) => saveSalarySettings(faculty.id, { model: e.target.value })}
                              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold"
                            >
                              <option value="monthly">Monthly Fixed</option>
                              <option value="daily">Per Day Fix</option>
                              <option value="per_student">Per Paid Student</option>
                            </select>
                         </div>
                         <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase opacity-40 pl-1">Base Amount (₹)</label>
                            <input 
                              type="number"
                              value={salary?.baseAmount || ''}
                              onChange={(e) => saveSalarySettings(faculty.id, { baseAmount: e.target.value })}
                              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold"
                            />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase opacity-40 pl-1">Per Student Rate (₹)</label>
                            <input 
                              type="number"
                              value={salary?.perStudentRate || ''}
                              onChange={(e) => saveSalarySettings(faculty.id, { perStudentRate: e.target.value })}
                              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold"
                            />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase opacity-40 pl-1">Class Days / Month</label>
                            <input
                              type="number"
                              value={salary?.totalClassDays || ''}
                              onChange={(e) => saveSalarySettings(faculty.id, { totalClassDays: e.target.value })}
                              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold"
                            />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase opacity-40 pl-1">Per Student Formula</label>
                            <select
                              value={salary?.perStudentFormulaMode || 'attendance_adjusted'}
                              onChange={(e) => saveSalarySettings(faculty.id, { perStudentFormulaMode: e.target.value })}
                              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold"
                            >
                              <option value="attendance_adjusted">Attendance Adjusted</option>
                              <option value="paid_student">Paid Student Direct</option>
                            </select>
                         </div>
                         <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase opacity-40 pl-1">Rate Type</label>
                            <select
                              value={salary?.perStudentRateType || 'fixed'}
                              onChange={(e) => saveSalarySettings(faculty.id, { perStudentRateType: e.target.value })}
                              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold"
                            >
                              <option value="fixed">Fixed ₹</option>
                              <option value="percentage">Percentage %</option>
                            </select>
                         </div>
                         <div className="flex items-end">
                            <button 
                              onClick={() => {
                                const amount = calculateNetReceivable(salary, selectedMonth);
                                const confirm = window.confirm(`Generate payout of ₹${Math.round(amount)} for ${faculty.name}?`);
                                if (confirm) {
                                  recordPayout({
                                    userId: faculty.id,
                                    userName: faculty.name,
                                    amount: Math.round(amount),
                                    periodMonth: selectedMonth,
                                    method: 'manual',
                                    approvedBy: user.email,
                                    note: `Auto-generated monthly payout`,
                                    transactionId: `TXN-${Date.now()}`
                                  });
                                }
                              }}
                              className="w-full p-2 bg-[var(--primary)] text-white rounded-lg text-[10px] font-black uppercase"
                            >
                              Process Payout
                            </button>
                         </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === 'payouts' && (
           <motion.div key="payouts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
             <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
               <span className="font-bold italic">ALL TRANSACTION LOGS</span>
               {isAdmin && (
                  <button onClick={() => setIsAddingPayout(true)} className="p-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-80 transition-opacity"><Plus size={16} /></button>
               )}
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-[10px] font-black uppercase opacity-40">
                    <tr>
                      <th className="p-4">Faculty</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Transaction ID</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {payouts.map(p => (
                      <tr key={p.id} className="hover:bg-white/5">
                        <td className="p-4">
                          <div className="font-bold">{p.userName}</div>
                          <div className="text-[8px] opacity-40 uppercase">Payout</div>
                        </td>
                        <td className="p-4">{p.date?.toDate().toLocaleDateString()}</td>
                        <td className="p-4 font-black">₹{p.amount.toLocaleString()}</td>
                        <td className="p-4 font-mono opacity-60">{p.transactionId}</td>
                        <td className="p-4 text-right">
                          {isAdmin && (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => firestoreService.deleteItem('payouts', p.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded"><Trash2 size={14}/></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </motion.div>
        )}

        {activeTab === 'student-payments' && isFaculty && (
          <motion.div key="students" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex justify-between items-center mb-4">
               <div>
                  <h3 className="font-bold">Student Fee Status</h3>
                  <p className="text-xs opacity-60">Monthly reporting section to monitor paid / unpaid students in your assigned batches.</p>
               </div>
               <input
                 type="month"
                 value={studentStatusMonth}
                 onChange={(e) => setStudentStatusMonth(e.target.value)}
                 className="px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10"
               />
            </div>
            {(() => {
              const scopedStudents = enrollments.filter((e) => facultyManagedBatches.some((fb) =>
                (fb.batchId && fb.batchId === e.batchId) ||
                (fb.batchName && fb.batchName === e.batchName) ||
                (fb.subject === 'ALL' || (e.subjects || []).includes(fb.subject))
              ));
              const scopedIds = new Set(scopedStudents.map((s) => s.id));
              const scopedLedger = monthlyFeeLedger.filter((l) => l.month === studentStatusMonth && scopedIds.has(l.studentId));
              const paidCount = scopedLedger.filter((l) => Number(l.paidAmount || 0) > 0 || l.status === 'Paid').length;
              const totalCount = scopedStudents.length;
              const unpaidCount = Math.max(0, totalCount - paidCount);

              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="glass-card p-3"><div className="text-[10px] opacity-60">Assigned Students</div><div className="text-2xl font-black">{totalCount}</div></div>
                  <div className="glass-card p-3"><div className="text-[10px] opacity-60">Paid ({studentStatusMonth})</div><div className="text-2xl font-black text-green-500">{paidCount}</div></div>
                  <div className="glass-card p-3"><div className="text-[10px] opacity-60">Unpaid ({studentStatusMonth})</div><div className="text-2xl font-black text-amber-500">{unpaidCount}</div></div>
                </div>
              );
            })()}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {enrollments
                 .filter(e => facultyManagedBatches.some(fb =>
                   (fb.batchId && fb.batchId === e.batchId) ||
                   (fb.batchName && fb.batchName === e.batchName) ||
                   (fb.subject === 'ALL' || (e.subjects || []).includes(fb.subject))
                 ))
                 .map(e => {
                 const monthLedger = monthlyFeeLedger.find((l) => l.studentId === e.id && l.month === studentStatusMonth);
                 const isPaid = Boolean((monthLedger && Number(monthLedger.paidAmount || 0) > 0) || monthLedger?.status === 'Paid');
                 const paidAmount = Number(monthLedger?.paidAmount || 0);
                 return (
                 <div key={e.id} className="glass-card p-4 flex items-center justify-between border-l-4 border-l-transparent" style={{ borderLeftColor: isPaid ? '#10b981' : '#ef4444' }}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isPaid ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {isPaid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      </div>
                      <div>
                        <div className="text-sm font-bold">{e.name}</div>
                        <div className="text-[10px] opacity-60">{e.batchName} • {e.subjects?.join(', ')}</div>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className={`text-[10px] font-black uppercase ${isPaid ? 'text-green-500' : 'text-red-500'}`}>
                         {isPaid ? 'Paid' : 'Pending'}
                       </span>
                       <div className="text-[8px] opacity-40">{studentStatusMonth}</div>
                       {isPaid && <div className="text-[10px] text-green-500 font-bold mt-1">₹{paidAmount}</div>}
                       {!isPaid && (
                         <div className="text-[10px] text-indigo-500 font-bold mt-1 cursor-pointer hover:underline" onClick={() => {
                           const msg = `Hi ${e.name},\nThis is a gentle reminder regarding your pending tuition fees. Please clear them.`;
                           window.open(`https://wa.me/${e.whatsapp?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`);
                         }}>Nudge</div>
                       )}
                    </div>
                 </div>
               )})}
               {enrollments.length === 0 && <div className="p-10 text-center opacity-40 italic">No assigned students found.</div>}
            </div>
          </motion.div>
        )}

        {activeTab === 'admin-earnings' && isAdmin && (
          <motion.div key="admin-earnings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-card p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div>
                <h3 className="font-bold">Admin Earnings Monitor</h3>
                <p className="text-xs opacity-60">Select a faculty and review month-wise earning labels.</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={adminSelectedFacultyId}
                  onChange={(e) => setAdminSelectedFacultyId(e.target.value)}
                  className="p-2 bg-white/5 border border-white/10 rounded-xl text-xs"
                >
                  <option value="">Select Faculty</option>
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>{f.name || f.email}</option>
                  ))}
                </select>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="p-2 bg-white/5 border border-white/10 rounded-xl text-xs" />
              </div>
            </div>
            {adminSelectedFacultyId && (() => {
              const salaryInfo = facultySalaries.find((s) => s.userId === adminSelectedFacultyId);
              const breakdown = getMonthlySalaryBreakdown(salaryInfo, selectedMonth);
              const alreadyDisbursed = payouts.filter((p) => p.userId === adminSelectedFacultyId && (p.periodMonth || selectedMonth) === selectedMonth)
                .reduce((sum, p) => sum + Number(p.amount || 0), 0);
              const netEarned = breakdown.earnedAmount;
              const available = Math.max(0, netEarned - alreadyDisbursed);
              return (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="glass-card p-4"><div className="text-[10px] opacity-60">Available to Withdraw</div><div className="text-2xl font-black text-indigo-500">₹{Math.round(available)}</div></div>
                  <div className="glass-card p-4"><div className="text-[10px] opacity-60">Already Disbursed</div><div className="text-2xl font-black text-blue-400">₹{Math.round(alreadyDisbursed)}</div></div>
                  <div className="glass-card p-4"><div className="text-[10px] opacity-60">Pending (Unpaid Students)</div><div className="text-2xl font-black text-amber-500">{breakdown.unpaidStudentsCount}</div></div>
                  <div className="glass-card p-4"><div className="text-[10px] opacity-60">Adjustments</div><div className="text-2xl font-black text-purple-400">₹0</div></div>
                  <div className="glass-card p-4"><div className="text-[10px] opacity-60">Net Earned Till Date</div><div className="text-2xl font-black text-green-500">₹{Math.round(netEarned)}</div></div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Requests Tab */}
      <AnimatePresence mode="wait">
        {(activeTab as any) === 'requests' && isAdmin && (
          <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h3 className="font-bold text-lg mb-4 text-amber-500 flex items-center gap-2">
              <AlertCircle size={20} /> Action Required
            </h3>
            
            <div className="space-y-4">
              {/* Resignation Requests */}
              {resignations.length > 0 && (
                <div className="space-y-4">
                  <div className="text-[10px] font-black uppercase opacity-40 ml-1">Resignations ({resignations.length})</div>
                  {resignations.map(req => (
                    <div key={req.id} className="glass-card p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-l-4 border-red-500">
                      <div>
                        <h4 className="font-bold">{req.userName} <span className={`text-[10px] px-2 py-0.5 rounded ml-2 uppercase tracking-widest ${req.status === 'approved' ? 'bg-green-500/10 text-green-500' : req.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>{req.status}</span></h4>
                        <p className="text-xs opacity-60 mt-1">LWD: {req.resignationDate}</p>
                        {req.letterUrl && (
                           <a href={req.letterUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline mt-2 inline-flex items-center gap-1">
                             <FileText size={10} /> View Resignation Letter
                           </a>
                        )}
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => firestoreService.updateItem('resignations', req.id, { status: 'approved' })} className="px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold transition-colors">Accept</button>
                         <button onClick={() => firestoreService.updateItem('resignations', req.id, { status: 'rejected' })} className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold transition-colors">Reject</button>
                         <button onClick={() => { if(window.confirm('Delete this request?')) firestoreService.deleteItem('resignations', req.id); }} className="px-4 py-2 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-xs font-bold transition-colors">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Payout Requests */}
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <div className="space-y-4">
                  <div className="text-[10px] font-black uppercase opacity-40 ml-1">Disbursement Requests ({requests.filter(r => r.status === 'pending').length})</div>
                  {requests.filter(r => r.status === 'pending').map(req => (
                    <div key={req.id} className="glass-card p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-l-4 border-indigo-500">
                      <div>
                        <h4 className="font-bold">{req.userName}</h4>
                        <p className="text-xs font-black text-indigo-500">Requesting ₹{req.amount.toLocaleString()}</p>
                        <p className="text-[10px] opacity-40 mt-1">Submitted: {req.createdAt?.toDate().toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const tid = prompt('Enter Transaction ID for Payout:');
                            if (!tid) return;
                            const amountInput = prompt('Enter amount to disburse (partial allowed):', String(req.amount || 0));
                            const amount = Number(amountInput || 0);
                            if (!amount || amount <= 0) return;
                            const note = prompt('Optional note for disbursement log:', 'Processed from disbursement request') || '';
                            recordPayout({
                              userId: req.userId,
                              userName: req.userName,
                              amount,
                              transactionId: tid,
                              note,
                              periodMonth: selectedMonth,
                              method: 'manual',
                              approvedBy: user.email
                            });
                            firestoreService.updateItem('payout_requests', req.id, {
                              status: amount === Number(req.amount || 0) ? 'processed' : 'partially_processed',
                              transactionId: tid,
                              processedAmount: amount,
                              approvedBy: user.email,
                              processedAt: serverTimestamp(),
                            });
                          }} 
                          className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          Confirm & Pay
                        </button>
                        <button onClick={() => firestoreService.updateItem('payout_requests', req.id, { status: 'rejected' })} className="px-4 py-2 bg-white/5 text-red-500 rounded-lg text-xs font-bold transition-colors">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {resignations.length === 0 && requests.filter(r => r.status === 'pending').length === 0 && (
                <div className="p-8 text-center text-sm opacity-50 italic border border-dashed border-white/10 rounded-2xl">
                  Clean slate! No pending requests.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Payout Modal */}
      <AnimatePresence>
        {isAddingPayout && isAdmin && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAddingPayout(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-3xl p-8 space-y-6">
              <h3 className="text-xl font-black italic">RECORD MANUAL PAYOUT</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Select Faculty</label>
                  <select
                    className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-xl text-sm"
                    value={payoutForm.userId}
                    onChange={e => setPayoutForm({...payoutForm, userId: e.target.value})}
                  >
                    <option value="">Select Faculty...</option>
                    {facultyList.map(f => (
                      <option key={f.id} value={f.id}>{f.name || f.email}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Amount (₹)</label>
                  <input
                    type="number"
                    className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-[var(--primary)]"
                    value={payoutForm.amount}
                    onChange={e => setPayoutForm({...payoutForm, amount: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Transaction ID</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-[var(--primary)]"
                    value={payoutForm.transactionId}
                    onChange={e => setPayoutForm({...payoutForm, transactionId: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Method</label>
                  <select
                    className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-xl text-sm"
                    value={payoutForm.method}
                    onChange={e => setPayoutForm({...payoutForm, method: e.target.value})}
                  >
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Period Month</label>
                  <input
                    type="month"
                    className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-[var(--primary)]"
                    value={payoutForm.periodMonth}
                    onChange={e => setPayoutForm({...payoutForm, periodMonth: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Cleared pending dues"
                    className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-[var(--primary)]"
                    value={payoutForm.note}
                    onChange={e => setPayoutForm({...payoutForm, note: e.target.value})}
                  />
                </div>
              </div>
              <button 
                onClick={() => {
                  const targetFaculty = facultyList.find(f => f.id === payoutForm.userId);
                  if (targetFaculty && payoutForm.amount) {
                    recordPayout({
                      userId: targetFaculty.id,
                      userName: targetFaculty.name || targetFaculty.email,
                      amount: Number(payoutForm.amount),
                      transactionId: payoutForm.transactionId,
                      note: payoutForm.note,
                      method: payoutForm.method,
                      periodMonth: payoutForm.periodMonth,
                      approvedBy: user.email
                    });
                    setIsAddingPayout(false);
                    setPayoutForm({ userId: '', amount: '', transactionId: '', note: '', method: 'upi', periodMonth: new Date().toISOString().slice(0, 7) });
                  } else {
                    toast.error('Select faculty and enter amount');
                  }
                }}
                className="w-full py-4 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-widest hover:opacity-90"
              >
                Save Payout Record
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resignation Modal */}
      <AnimatePresence>
        {isResigning && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !resignationFileUploading && setIsResigning(false)} />
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-3xl p-8 space-y-6">
                {isResignationSubmitted ? (
                  <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 size={40} />
                    </motion.div>
                    <h3 className="text-2xl font-black italic text-green-500">SUBMITTED!</h3>
                    <p className="text-sm opacity-70">Your resignation request and letter have been successfully securely submitted to the administration.</p>
                  </div>
                ) : (
                  <>
                    <h3 className="text-2xl font-black italic">SUBMIT RESIGNATION</h3>
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs space-y-2 text-amber-500">
                       <p className="font-bold flex items-center gap-2"><AlertCircle size={14}/> Notice Period Policy</p>
                       <p className="opacity-80">Employees must provide a 15-day notice period. A full calendar month notice is mandate to complete full calendar month.</p>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase opacity-40">Proposed Last Working Day</label>
                       <input 
                        type="date" 
                        value={resignationDate}
                        onChange={(e) => setResignationDate(e.target.value)}
                        disabled={resignationFileUploading}
                        className="w-full p-4 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-2xl outline-none disabled:opacity-50"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase opacity-40">Resignation Letter (PDF/Doc)</label>
                       <div className="relative">
                         <input 
                          type="file" 
                          onChange={(e) => setResignationFile(e.target.files ? e.target.files[0] : null)}
                          disabled={resignationFileUploading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          accept=".pdf,.doc,.docx,image/*"
                         />
                         <div className={`w-full p-4 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 border-dashed ${resignationFileUploading ? 'opacity-50' : 'hover:border-[var(--primary)] transition-colors'}`}>
                           <FileText size={18} className={resignationFile ? 'text-[var(--primary)]' : 'opacity-40'} />
                           <span className={`text-sm font-bold truncate max-w-[200px] ${resignationFile ? 'text-[var(--primary)]' : 'opacity-70'}`}>
                             {resignationFile ? resignationFile.name : 'Click or Drag Document Here'}
                           </span>
                         </div>
                       </div>
                       {resignationFileUploading && (
                         <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                           <div className="h-full bg-[var(--primary)] transition-all duration-300 relative" style={{ width: `${resignationFileProgress}%` }}>
                             <div className="absolute inset-0 bg-white/20 animate-pulse" />
                           </div>
                         </div>
                       )}
                       {resignationFileUploading && (
                         <div className="text-[10px] text-center mt-1 font-bold text-[var(--primary)] uppercase tracking-widest animate-pulse">
                           Uploading... {Math.round(resignationFileProgress)}%
                         </div>
                       )}
                    </div>
                    <button 
                      onClick={handleResignation}
                      disabled={resignationFileUploading}
                      className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      {resignationFileUploading ? 'Processing...' : 'Confirm Submission'}
                    </button>
                  </>
                )}
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editor Modal for Payment Info */}
      <AnimatePresence>
        {isEditingPayment && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsEditingPayment(false)} />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-sm bg-white dark:bg-[#1e1e1e] rounded-3xl p-8 space-y-6">
                <h3 className="text-xl font-black italic flex items-center gap-2"><CreditCard /> PAYMENT INFO</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase opacity-40">UPI ID</label>
                     <input 
                      type="text" 
                      value={paymentUpi}
                      onChange={(e) => setPaymentUpi(e.target.value)}
                      placeholder="e.g. name@okhdfcbank"
                      className="w-full p-4 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-2xl outline-none text-sm"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase opacity-40">Bank Details (Optional)</label>
                     <textarea 
                      value={paymentBank}
                      onChange={(e) => setPaymentBank(e.target.value)}
                      placeholder="Account No / IFSC"
                      rows={3}
                      className="w-full p-4 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-2xl outline-none text-sm resize-none"
                     />
                  </div>
                  <button 
                    onClick={() => {
                      saveSalarySettings(user.uid, { paymentMethod: { upiId: paymentUpi, bankDetails: paymentBank } });
                      setIsEditingPayment(false);
                    }}
                    className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                  >
                    Save Details
                  </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Spotify Wrapped Style Card */}
      <AnimatePresence>
        {showWrapped && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowWrapped(false)} />
             <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative w-full max-w-sm flex flex-col items-center gap-6">
                {/* Wrapped Card that gets exported */}
                <div id="faculty-wrapped-card" className="w-[320px] aspect-[9/16] bg-[#0c0c0e] rounded-[2.5rem] p-10 flex flex-col justify-between overflow-hidden relative shadow-2xl border border-white/5">
                  {/* Decorative Elements */}
                  <div className="absolute top-[-10%] right-[-10%] w-60 h-60 bg-[var(--primary)]/20 blur-[80px] rounded-full" />
                  <div className="absolute bottom-[-10%] left-[-10%] w-60 h-60 bg-indigo-500/20 blur-[80px] rounded-full" />
                  
                  <div className="relative z-10 w-full flex items-center justify-between">
                    <img src="/logo.png" alt="Logo" className="h-6 object-contain opacity-50" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <span className="text-white/40 font-black text-[10px] tracking-[0.2em] uppercase">Faculty Wrapped</span>
                  </div>

                  <div className="relative z-10 space-y-6">
                    <div>
                      <h2 className="text-2xl font-black text-white italic leading-tight tracking-tighter uppercase">
                        ADVANCED<br/>CLASSES,<br/><span className="text-[var(--primary)]">SONAI</span>
                      </h2>
                      <div className="h-1 w-12 bg-[var(--primary)] mt-3" />
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-white">{user?.displayName}</h3>
                      <p className="text-[10px] font-black text-[var(--primary)] uppercase tracking-widest opacity-80">
                         Faculty of {facultyManagedBatches[0]?.batchName || 'General'} & {facultyManagedBatches.map(b => b.subject).join(', ')}
                      </p>
                    </div>

                    {(() => {
                      const facultyAssignedBatches = facultyBatches.filter(fb => fb.userId === user.uid);
                      const monthLogs = attendance.filter(a => a.userId === user.uid && a.dateStr.startsWith(selectedMonth));
                      const presentDays = monthLogs.filter(a => a.status === 'present').length;
                      const attendanceRate = monthLogs.length > 0 ? Math.round((presentDays / monthLogs.length) * 100) : 100;

                      return (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                            <span className="text-white/40 text-[8px] font-black uppercase tracking-wider block mb-1">Impact</span>
                            <span className="text-white text-xl font-black">
                               {enrollments.filter(e => facultyAssignedBatches.some(fb => fb.batchId === e.batchId)).length}
                            </span>
                            <span className="text-[8px] block opacity-40">Students</span>
                          </div>
                          
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                            <span className="text-white/40 text-[8px] font-black uppercase tracking-wider block mb-1">Score</span>
                            <span className="text-white text-xl font-black">{attendanceRate}%</span>
                            <span className="text-[8px] block opacity-40">Reliability</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="relative z-10 w-full space-y-4">
                    <div className="p-6 bg-gradient-to-br from-[var(--primary)] to-indigo-600 rounded-3xl text-white shadow-xl">
                       <span className="text-[8px] font-black uppercase tracking-widest opacity-70 block mb-1">Total Payout Pending</span>
                      <div className="text-3xl font-black">₹{displayBalance.toLocaleString()}</div>
                       <div className="text-[8px] opacity-60 font-bold mt-1 uppercase tracking-tighter italic">— Secure Digital Split —</div>
                    </div>
                    <p className="text-[8px] text-white/30 text-center font-bold tracking-widest uppercase italic">Xavi x Sonai Internal Platform</p>
                  </div>
                </div>

                {/* Download Button */}
                <button 
                  onClick={handleShareWrapped}
                  className="w-[320px] py-4 bg-white text-black rounded-full font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2"
                >
                  <Download size={18} /> Share My Flex
                </button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
