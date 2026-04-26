import React, { useState, useEffect } from 'react';
import { Wallet, QrCode, CreditCard, CheckCircle2, AlertCircle, Upload, Clock, Download as DownloadIcon, ExternalLink, UserPlus, Plus, Edit, Trash2, Save, X, Image as ImageIcon, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { updateDoc, doc, serverTimestamp, addDoc, collection, Timestamp } from 'firebase/firestore';
import { storageService } from '../services/storageService';
import { authService } from '../services/authService';
import { firestoreService } from '../services/firestoreService';
import { pricingService } from '../services/pricingService';
import EnrollmentSection from './EnrollmentSection';
import MarkdownRenderer from './MarkdownRenderer';
import toast, { Toaster } from 'react-hot-toast';

interface TabFeeProps {
  branding?: any;
}

function TabFee({ branding }: TabFeeProps) {
  const [user, setUser] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingFee, setEditingFee] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFee, setNewFee] = useState<{
    subject: string;
    originalPrice: number;
    discount: number;
    grade: string;
    grades?: string[];
  }>({
    subject: '',
    originalPrice: 0,
    discount: 0,
    grade: 'XII',
    grades: ['XII']
  });

  useEffect(() => {
    let mounted = true;
    const loadPricing = async () => {
      try {
        const pricing = await pricingService.getSubjectPricing();
        if (mounted) setFees(pricing as any[]);
      } catch (error) {
        console.error('Failed to load subject pricing, fallback to fees collection', error);
        const fallback = await firestoreService.getCollection('fees');
        if (mounted) setFees(fallback);
      }
    };
    loadPricing();

    const unsubscribeAuth = authService.onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Check if admin
        const adminEmail1 = import.meta.env.VITE_ADMIN_EMAIL_1 || 'xavierscot3454@gmail.com';
        const adminEmail2 = import.meta.env.VITE_ADMIN_EMAIL_2 || 'helixsmith.xavy@gmail.com';
        const adminEmail3 = 'makeitawesom3@gmail.com';
        if (firebaseUser.email === adminEmail1 || firebaseUser.email === adminEmail2 || firebaseUser.email === adminEmail3) {
          setIsAdmin(true);
        }

        if (firebaseUser.email) {
          const unsubEnroll = firestoreService.listenToUserEnrollment(firebaseUser.email, (data) => {
            setEnrollment(data);
            setLoading(false);
          });
          return () => {
            unsubEnroll();
          };
        }
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribeAuth();
    };
  }, []);

  const upiId = branding?.upiId || "advancedclasses@boi";
  const totalFee = enrollment?.totalFee || 0;
  const discount = enrollment?.discount || 0;
  const netPayable = totalFee - discount;
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    transactionId: '',
    screenshotUrl: '',
    notes: '',
    amount: ''
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [monthAllocations, setMonthAllocations] = useState<Array<{ id: string; month: string; amount: string }>>([
    { id: `month_${Date.now()}`, month: new Date().toISOString().slice(0, 7), amount: '' }
  ]);
  const [monthlyLedgerRows, setMonthlyLedgerRows] = useState<any[]>([]);
  const [feeReceipts, setFeeReceipts] = useState<any[]>([]);

  const availableMonths = React.useMemo(() => {
    const startRaw = enrollment?.enrollmentDate || enrollment?.joinedAt || enrollment?.createdAt || new Date();
    const start = startRaw?.toDate ? startRaw.toDate() : new Date(startRaw);
    if (Number.isNaN(start.getTime())) return [new Date().toISOString().slice(0, 7)];
    const months: string[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const until = new Date();
    until.setMonth(until.getMonth() + 6);
    while (cursor <= until) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }, [enrollment]);

  useEffect(() => {
    if (!enrollment?.id) {
      setMonthlyLedgerRows([]);
      setFeeReceipts([]);
      return;
    }
    const month = new Date();
    month.setMonth(month.getMonth() + 1);
    pricingService.ensureMonthlyLedger(
      enrollment.id,
      enrollment.name || enrollment.email || 'Student',
      enrollment,
      `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
    ).catch(() => null);
    const unsubLedger = firestoreService.listenToCollection('student_monthly_fee_ledger', (rows: any[]) => {
      setMonthlyLedgerRows(
        rows
          .filter((r: any) => r.studentId === enrollment.id)
          .sort((a: any, b: any) => String(a.month || '').localeCompare(String(b.month || '')))
      );
    });
    const unsubReceipts = firestoreService.listenToCollection('fee_receipts', (rows: any[]) => {
      setFeeReceipts(
        rows
          .filter((r: any) => r.studentId === enrollment.id)
          .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      );
    });
    return () => {
      unsubLedger();
      unsubReceipts();
    };
  }, [enrollment?.id]);

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    if (!paymentData.transactionId) return toast.error('Enter transaction ID');
    
    setIsSubmittingPayment(true);
    const toastId = toast.loading('Submitting payment proof...');
    
    try {
      const history = enrollment.paymentHistory || [];
      const newPayment = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        amount: paymentData.amount || netPayable.toString(),
        status: 'pending',
        transactionId: paymentData.transactionId,
        screenshot: paymentData.screenshotUrl,
        notes: paymentData.notes
      };
      
      const updatedHistory = [...history, newPayment];
      await updateDoc(doc(db, 'enrollments', enrollment.id), {
        paymentHistory: updatedHistory,
        lastPaymentAttempt: serverTimestamp()
      });

      const allocationResult = await pricingService.allocatePaymentToMonths({
        studentId: enrollment.id,
        studentName: enrollment.name,
        enrollment,
        amount: parseFloat(paymentData.amount || netPayable.toString()),
        paymentId: newPayment.id,
        transactionId: paymentData.transactionId,
        mode: 'upi',
        allocations: monthAllocations
          .map((row) => ({ month: row.month, amount: Number(row.amount || 0) }))
          .filter((row) => row.month && row.amount > 0),
        paidBy: user?.uid || enrollment.id,
        title: `Fee Receipt: ${enrollment.name}`,
        notes: paymentData.notes,
        screenshotUrl: paymentData.screenshotUrl,
      });
      
      // Also add to global finances for admin review
      await addDoc(collection(db, 'finances'), {
        type: 'income',
        category: 'Fee',
        amount: parseFloat(paymentData.amount || netPayable.toString()),
        title: `Fee Payment: ${enrollment.name}`,
        studentId: user?.uid || '',
        studentName: enrollment.name,
        transactionId: paymentData.transactionId,
        screenshotUrl: paymentData.screenshotUrl,
        receiptId: allocationResult.receiptId,
        feeAllocations: allocationResult.allocations,
        date: Timestamp.now(),
        status: 'pending',
        createdAt: serverTimestamp()
      });

      toast.success('Payment submitted! Admin will verify soon.', { id: toastId });
      setIsPaymentConfirmOpen(false);
      setPaymentData({ transactionId: '', screenshotUrl: '', notes: '', amount: '' });
      setMonthAllocations([{ id: `month_${Date.now()}`, month: new Date().toISOString().slice(0, 7), amount: '' }]);
    } catch (err) {
      toast.error('Failed to submit. Try again.', { id: toastId });
    } finally {
      setIsSubmittingPayment(false);
    }
  };
  const upiLink = `upi://pay?pa=${upiId}&pn=Advanced%20Classes&am=${netPayable}&cu=INR`;

  const confirmOnWhatsApp = async () => {
    if (!enrollment) return;
    
    // Record the payment in history as pending
    try {
      const paymentRecord = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        amount: netPayable,
        status: 'pending',
        screenshot: '' // Student will send via WhatsApp
      };
      await firestoreService.submitPayment(enrollment.id, paymentRecord);
    } catch (err) {
      console.error('Failed to record payment history', err);
    }

    const msg = `*PAYMENT CONFIRMATION*
👤 Student: ${enrollment.name}
📧 Email: ${enrollment.email}
📚 Batch: ${enrollment.grade}
💰 Amount: ₹${netPayable}
✅ Status: Payment Done. Please verify.`;

    window.open(
      "https://wa.me/916001539070?text=" + encodeURIComponent(msg),
      "_blank"
    );
  };

  const downloadQR = () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(upiLink)}`;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `Payment_QR_${enrollment?.name || 'Student'}.png`;
    link.target = "_blank";
    link.click();
  };

  const handleAddFee = async () => {
    if (!newFee.subject) return;
    try {
      await pricingService.createSubjectPricing({
        ...newFee,
        finalPrice: newFee.originalPrice - newFee.discount,
      });
      const refreshed = await pricingService.getSubjectPricing();
      setFees(refreshed as any[]);
      setShowAddForm(false);
      setNewFee({ subject: '', originalPrice: 0, discount: 0, grade: 'XII', grades: ['XII'] });
      toast.success('Fee added successfully!');
    } catch (err) {
      toast.error('Failed to add fee');
    }
  };

  const handleUpdateFee = async () => {
    if (!editingFee || !editingFee.subject) return;
    try {
      await pricingService.updateSubjectPricing(editingFee.id, {
        ...editingFee,
        finalPrice: editingFee.originalPrice - editingFee.discount,
      });
      const refreshed = await pricingService.getSubjectPricing();
      setFees(refreshed as any[]);
      setEditingFee(null);
      toast.success('Fee updated successfully!');
    } catch (err) {
      toast.error('Failed to update fee');
    }
  };

  const handleDeleteFee = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this fee?')) return;
    try {
      await pricingService.softDeleteSubjectPricing(id);
      setFees(prev => prev.filter((f: any) => f.id !== id));
      toast.success('Fee deleted successfully!');
    } catch (err) {
      toast.error('Failed to delete fee');
    }
  };

  if (loading) return <div className="text-center p-10 opacity-50 font-bold">Loading...</div>;

  if (!user || !enrollment) {
    return (
      <div className="space-y-6 pb-20">
        <Toaster position="top-center" />
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
              <Wallet size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-tight">FEE PAGE</h2>
              <p className="text-xs opacity-70 uppercase tracking-widest font-bold">Official Pricing & Billing</p>
              <a 
                href="https://drive.google.com/file/d/1RrGU4_efhj6XaEuQIauOAWiy6-KZi5sr/view" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-1 text-[10px] font-black text-[var(--primary)] uppercase tracking-wider hover:underline"
              >
                <FileText size={10} /> View Official 2026-27 Fee Policy
              </a>
            </div>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-2 bg-[var(--primary)] text-white rounded-lg hover:scale-110 transition-transform"
              title="Add New Fee"
            >
              <Plus size={20} />
            </button>
          )}
        </div>

        {isAdmin && showAddForm && (
          <div className="glass-card mb-6 border-[var(--primary)]/30">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Plus size={18} /> Add New Pricing</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <input 
                type="text" 
                placeholder="Subject Name" 
                value={newFee.subject} 
                onChange={e => setNewFee({...newFee, subject: e.target.value})}
                className="p-2 rounded bg-white/10 border border-[var(--border-color)] outline-none text-sm"
              />
              <div className="flex flex-wrap gap-2 items-center">
                {['IX', 'X', 'XI', 'XII'].map(g => (
                  <label key={g} className="flex items-center gap-1 text-xs bg-white/5 px-2 py-1 rounded border border-[var(--border-color)] cursor-pointer hover:bg-white/10">
                    <input 
                      type="checkbox" 
                      checked={(newFee.grades || [newFee.grade]).includes(g)}
                      onChange={e => {
                        const currentGrades = newFee.grades || (newFee.grade ? [newFee.grade] : []);
                        const newGrades = e.target.checked 
                          ? [...currentGrades, g]
                          : currentGrades.filter((cg: string) => cg !== g);
                        setNewFee({...newFee, grades: newGrades, grade: newGrades[0] || ''});
                      }}
                      className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    {g}
                  </label>
                ))}
              </div>
              <input 
                type="number" 
                placeholder="Original Price" 
                value={newFee.originalPrice || ''} 
                onChange={e => setNewFee({...newFee, originalPrice: Number(e.target.value)})}
                className="p-2 rounded bg-white/10 border border-[var(--border-color)] outline-none text-sm"
              />
              <input 
                type="number" 
                placeholder="Discount" 
                value={newFee.discount || ''} 
                onChange={e => setNewFee({...newFee, discount: Number(e.target.value)})}
                className="p-2 rounded bg-white/10 border border-[var(--border-color)] outline-none text-sm"
              />
              <div className="flex gap-2">
                <button onClick={handleAddFee} className="flex-1 bg-[var(--success)] text-white rounded-lg font-bold text-xs">Save</button>
                <button onClick={() => setShowAddForm(false)} className="px-3 bg-white/10 rounded-lg"><X size={16} /></button>
              </div>
            </div>
          </div>
        )}

        {!user && (
          <div className="glass-card bg-yellow-500/10 border-yellow-500/20 mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-500">
              <AlertCircle size={20} />
              <p className="text-sm font-bold">Login to view your personalized fee structure and pay online.</p>
            </div>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'settings' }))}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-xs font-bold"
            >
              Login Now
            </button>
          </div>
        )}

        {user && !enrollment && (
          <div className="glass-card bg-blue-500/10 border-blue-500/20 mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-500">
              <AlertCircle size={20} />
              <p className="text-sm font-bold">You are not enrolled in any batch yet. Enroll now to view your fees.</p>
            </div>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-enrollment'))}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold"
            >
              Enroll Now
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card overflow-hidden !p-0">
              <div className="p-5 border-b border-[var(--border-color)] bg-white/5">
                <h3 className="font-bold">Subject-wise Pricing</h3>
                <p className="text-xs opacity-60">Standard rates for session 2026-27</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-white/5">
                      <th className="p-4 text-xs font-bold uppercase opacity-60">Subject</th>
                      <th className="p-4 text-xs font-bold uppercase opacity-60">Class</th>
                      <th className="p-4 text-xs font-bold uppercase opacity-60">General Price</th>
                      <th className="p-4 text-xs font-bold uppercase opacity-60">Discount</th>
                      <th className="p-4 text-xs font-bold uppercase opacity-60">Final Price</th>
                      {isAdmin && <th className="p-4 text-xs font-bold uppercase opacity-60 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map(fee => (
                      <tr key={fee.id} className="border-b border-[var(--border-color)] hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold">
                          {editingFee?.id === fee.id ? (
                            <input 
                              type="text" 
                              value={editingFee.subject} 
                              onChange={e => setEditingFee({...editingFee, subject: e.target.value})}
                              className="w-full p-1 rounded bg-white/10 border border-[var(--primary)] outline-none text-sm"
                            />
                          ) : (
                            <div className="flex items-center gap-2 group/name">
                              <MarkdownRenderer content={fee.subject} inline />
                              {isAdmin && (
                                <button 
                                  onClick={() => setEditingFee(fee)}
                                  className="p-1 opacity-0 group-hover/name:opacity-100 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-all text-gray-400"
                                  title="Edit Subject"
                                >
                                  <Edit size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-4 opacity-70">
                          {editingFee?.id === fee.id ? (
                            <div className="flex flex-wrap gap-1">
                              {['IX', 'X', 'XI', 'XII'].map(g => (
                                <label key={g} className="flex items-center gap-1 text-[10px] bg-white/5 px-1.5 py-0.5 rounded border border-[var(--border-color)] cursor-pointer hover:bg-white/10">
                                  <input 
                                    type="checkbox" 
                                    checked={(editingFee.grades || [editingFee.grade]).includes(g)}
                                    onChange={e => {
                                      const currentGrades = editingFee.grades || (editingFee.grade ? [editingFee.grade] : []);
                                      const newGrades = e.target.checked 
                                        ? [...currentGrades, g]
                                        : currentGrades.filter((cg: string) => cg !== g);
                                      setEditingFee({...editingFee, grades: newGrades, grade: newGrades[0] || ''});
                                    }}
                                    className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)] w-3 h-3"
                                  />
                                  {g}
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(fee.grades || [fee.grade || 'XII']).map((g: string) => (
                                <span key={g} className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {g}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-4 opacity-70">
                          {editingFee?.id === fee.id ? (
                            <input 
                              type="number" 
                              value={editingFee.originalPrice} 
                              onChange={e => setEditingFee({...editingFee, originalPrice: Number(e.target.value)})}
                              className="w-20 p-1 rounded bg-white/10 border border-[var(--primary)] outline-none text-sm"
                            />
                          ) : (
                            `₹${fee.originalPrice}`
                          )}
                        </td>
                        <td className="p-4 text-green-500 font-medium">
                          {editingFee?.id === fee.id ? (
                            <input 
                              type="number" 
                              value={editingFee.discount} 
                              onChange={e => setEditingFee({...editingFee, discount: Number(e.target.value)})}
                              className="w-20 p-1 rounded bg-white/10 border border-[var(--primary)] outline-none text-sm"
                            />
                          ) : (
                            `-₹${fee.discount}`
                          )}
                        </td>
                        <td className="p-4 text-lg font-extrabold text-[var(--primary)]">
                          ₹{editingFee?.id === fee.id ? (editingFee.originalPrice - editingFee.discount) : fee.finalPrice}
                        </td>
                        {isAdmin && (
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {editingFee?.id === fee.id ? (
                                <>
                                  <button onClick={handleUpdateFee} className="text-[var(--success)] p-1 hover:bg-[var(--success)]/10 rounded" title="Save">
                                    <Save size={18} />
                                  </button>
                                  <button onClick={() => setEditingFee(null)} className="text-gray-500 p-1 hover:bg-gray-500/10 rounded" title="Cancel">
                                    <X size={18} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => setEditingFee(fee)} className="text-blue-500 p-1 hover:bg-blue-500/10 rounded" title="Edit">
                                    <Edit size={18} />
                                  </button>
                                  <button onClick={() => handleDeleteFee(fee.id)} className="text-[var(--danger)] p-1 hover:bg-[var(--danger)]/10 rounded" title="Delete">
                                    <Trash2 size={18} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card bg-[var(--primary)]/5 border-[var(--primary)]/20">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] flex-shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 className="font-bold mb-1">Ready to Join?</h4>
                  <p className="text-sm opacity-80 mb-4">Select your subjects and enroll now to start your journey with us!</p>
                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('open-enrollment'))}
                    className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-[var(--primary)]/20 transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus size={18} /> Enroll Now
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card">
              <h4 className="font-bold mb-3 text-sm uppercase tracking-wider opacity-70">Payment Methods</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-[var(--border-color)]">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <QrCode size={16} />
                  </div>
                  <span className="text-sm font-medium">UPI / QR Scan</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-[var(--border-color)]">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                    <CreditCard size={16} />
                  </div>
                  <span className="text-sm font-medium">Bank Transfer</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <EnrollmentSection />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
          <Wallet size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-tight">FEE PAGE</h2>
          <p className="text-xs opacity-70 uppercase tracking-widest font-bold">Smart Billing System</p>
          <a 
            href="https://drive.google.com/file/d/1RrGU4_efhj6XaEuQIauOAWiy6-KZi5sr/view" 
            target="_blank" 
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-1 text-[10px] font-black text-[var(--primary)] uppercase tracking-wider hover:underline"
          >
            <FileText size={10} /> View Official Fee Policy (RBI Compliant)
          </a>
        </div>
      </div>

      {/* Current Dues */}
      <div className="glass-card flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">My Enrollment & Fees</h3>
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${enrollment.feeStatus === 'Paid' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
              {enrollment.feeStatus === 'Paid' ? 'NO OUTSTANDING DUES LEFT' : (enrollment.feeStatus || 'Pending')}
            </span>
          </div>
          
          <div className="bg-white/5 border border-[var(--border-color)] rounded-xl p-5 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase opacity-50 font-bold block mb-1">Batch / Class</label>
                <div className="font-bold text-[var(--primary)] text-lg">Class {enrollment.grade}</div>
              </div>
              <div>
                <label className="text-[10px] uppercase opacity-50 font-bold block mb-1">Enrolled Slots</label>
                <div className="font-bold text-gray-900 dark:text-white">{enrollment.slots || 'Not assigned yet'}</div>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase opacity-50 font-bold block mb-1">Enrolled Subjects</label>
              <div className="flex flex-wrap gap-2">
                {enrollment.subjects?.map((sub: string) => (
                  <span key={sub} className="px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold rounded-lg border border-[var(--primary)]/20">
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between opacity-80">
              <span>Subtotal</span>
              <span>₹{totalFee}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-500 font-medium">
                <span>Discount Applied</span>
                <span>-₹{discount}</span>
              </div>
            )}
            <div className="border-t border-[var(--border-color)] pt-2 mt-2 flex justify-between items-center">
              <span className="font-bold uppercase tracking-wider text-xs opacity-70">Net Payable</span>
              <span className="text-3xl font-extrabold text-[var(--primary)]">₹{netPayable}</span>
            </div>
          </div>
        </div>
        
        {enrollment.feeStatus === 'Paid' && (
          <div className="md:w-1/3 bg-white/5 border border-[var(--border-color)] rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <h4 className="font-bold text-sm uppercase mb-2">Next Month's Fee</h4>
            <div className="text-3xl font-black text-[var(--primary)] mb-2">₹{netPayable}</div>
            <p className="text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg mb-4">
              You must pay your fees on or before 5th of every month.
            </p>
            <a 
              href="#payment-methods"
              className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-bold shadow-lg hover:opacity-90 flex justify-center items-center gap-2"
            >
              Pay Now
            </a>
          </div>
        )}
      </div>

      <div className="glass-card mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest opacity-70">Monthly Fee Detail</h3>
          <span className="text-[10px] px-2 py-1 rounded-lg bg-white/10">From enrollment date</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5">
              <tr>
                <th className="p-3">Month</th>
                <th className="p-3 text-right">Total Fee</th>
                <th className="p-3 text-right">Paid</th>
                <th className="p-3 text-right">Balance</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {monthlyLedgerRows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border-color)]">
                  <td className="p-3 font-semibold">{row.month}</td>
                  <td className="p-3 text-right">₹{Math.round(Number(row.totalFee || 0)).toLocaleString()}</td>
                  <td className="p-3 text-right text-green-500">₹{Math.round(Number(row.paidAmount || 0)).toLocaleString()}</td>
                  <td className="p-3 text-right text-amber-400">₹{Math.round(Number(row.dueAmount || 0)).toLocaleString()}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${String(row.status || '').toLowerCase() === 'cleared' ? 'bg-green-500/20 text-green-500' : String(row.status || '').toLowerCase() === 'partial' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                      {row.status || (Number(row.dueAmount || 0) <= 0 ? 'Cleared' : 'Pending')}
                    </span>
                  </td>
                </tr>
              ))}
              {monthlyLedgerRows.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center opacity-60 italic">No monthly fee entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div id="payment-methods" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option 1: Payment QR */}
        <div className="glass-card flex flex-col items-center justify-center text-center p-8">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4">
            <QrCode size={24} />
          </div>
          <h3 className="font-bold mb-1 uppercase tracking-tight">Option 1: Payment QR</h3>
          <p className="text-xs opacity-70 mb-6">UPI ID: {upiId}</p>
          
          <div 
            className="bg-white p-4 rounded-2xl mb-4 cursor-pointer hover:scale-105 transition-transform shadow-lg"
            onClick={() => window.open(upiLink, '_blank')}
            title="Click to open UPI App"
          >
            <img 
              src={branding?.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`}
              alt="Payment QR Code"
              className="w-48 h-48 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <p className="text-xs opacity-70 mb-4 font-medium">Click QR to open UPI App</p>
          
          <button 
            onClick={downloadQR}
            className="flex items-center gap-2 text-[var(--primary)] text-sm font-bold hover:underline bg-[var(--primary)]/5 px-4 py-2 rounded-lg"
          >
            <DownloadIcon size={16} /> Download QR Code
          </button>
        </div>

        {/* Option 2: Direct Payment */}
        <div className="glass-card flex flex-col p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <CreditCard size={24} />
            </div>
            <div>
              <h3 className="font-bold uppercase tracking-tight">Option 2: Direct Payment</h3>
              <p className="text-xs opacity-70 font-mono">{upiId}</p>
            </div>
          </div>

          <div className="bg-white/5 border border-[var(--border-color)] rounded-xl p-5 mb-6 text-sm space-y-3 opacity-90">
            <div className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</span>
              <p>Pay using UPI ID or scan the QR code.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</span>
              <p>Take a screenshot of the successful payment.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</span>
              <p>Click "I Have Paid" to send details via WhatsApp.</p>
            </div>
          </div>

          <div className="mt-auto space-y-4">
            <a 
              href={upiLink}
              className="w-full py-4 bg-[var(--primary)] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[var(--primary)]/90 transition-all shadow-lg hover:-translate-y-0.5"
            >
              <ExternalLink size={20} /> Pay Now (₹{netPayable})
            </a>
            
            <button 
              onClick={() => {
                setPaymentData({ ...paymentData, amount: netPayable.toString() });
                setIsPaymentConfirmOpen(true);
              }}
              className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#128C7E] transition-all shadow-lg hover:-translate-y-0.5"
            >
              <CheckCircle2 size={20} /> I Have Paid
            </button>
          </div>
        </div>
      </div>

      {/* Payment History Section */}
      <div className="mt-12 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Clock size={20} />
          </div>
          <h3 className="text-xl font-bold uppercase tracking-tight">Payment History</h3>
        </div>

        <div className="glass-card overflow-hidden !p-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-white/5">
                <th className="p-4 text-xs font-bold uppercase opacity-60">Date</th>
                <th className="p-4 text-xs font-bold uppercase opacity-60">Amount</th>
                <th className="p-4 text-xs font-bold uppercase opacity-60">Status</th>
                <th className="p-4 text-xs font-bold uppercase opacity-60 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {enrollment.paymentHistory && enrollment.paymentHistory.length > 0 ? (
                [...enrollment.paymentHistory].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((payment: any, idx: number) => (
                  <tr key={idx} className="border-b border-[var(--border-color)] hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="text-sm font-medium">{new Date(payment.date).toLocaleDateString()}</div>
                      <div className="text-[10px] opacity-50">{new Date(payment.date).toLocaleTimeString()}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-bold">₹{payment.amount}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        payment.status === 'Paid' || payment.status === 'verified' ? 'bg-green-500/20 text-green-500' : 
                        payment.status === 'rejected' ? 'bg-red-500/20 text-red-500' : 
                        'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {payment.status === 'pending' ? 'Review Requested' : payment.status || 'Review Requested'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {payment.screenshot ? (
                        <button 
                          onClick={() => window.open(payment.screenshot, '_blank')}
                          className="text-[var(--primary)] text-xs font-bold hover:underline"
                        >
                          View Receipt
                        </button>
                      ) : (
                        <span className="text-xs opacity-40 italic">Link Mode</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-12 text-center opacity-50 text-sm italic">
                    No payment history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      {isPaymentConfirmOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-3xl p-6 shadow-2xl flex flex-col gap-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase italic">Submit Payment Proof</h3>
              <button 
                onClick={() => setIsPaymentConfirmOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase opacity-40 ml-1">Paid Amount (₹)</label>
                 <input 
                   disabled
                   value={paymentData.amount}
                   className="w-full p-4 bg-gray-100 dark:bg-white/5 border border-white/5 rounded-2xl font-bold opacity-60"
                 />
               </div>

               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase opacity-40 ml-1">Transaction ID / UPI Reference</label>
                 <input 
                   required
                   value={paymentData.transactionId}
                   onChange={e => setPaymentData(prev => ({...prev, transactionId: e.target.value}))}
                   className="w-full p-4 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-2xl font-bold outline-none focus:border-[var(--primary)]"
                   placeholder="12 Digit No."
                 />
               </div>

               <div className="space-y-2">
                 <div className="flex items-center justify-between">
                   <label className="text-[10px] font-black uppercase opacity-40 ml-1">Fee Month Allocation</label>
                   <button type="button" onClick={() => setMonthAllocations(prev => [...prev, { id: `month_${Date.now()}_${prev.length}`, month: new Date().toISOString().slice(0, 7), amount: '' }])} className="text-[10px] px-2 py-1 rounded bg-emerald-500/15 text-emerald-500 font-black uppercase flex items-center gap-1">
                     <Plus size={12} /> Add
                   </button>
                 </div>
                 <div className="rounded-xl border border-white/10 overflow-hidden">
                   <table className="w-full text-xs">
                     <thead className="bg-white/5">
                       <tr>
                         <th className="p-2 text-left">Month</th>
                         <th className="p-2 text-right">Due</th>
                         <th className="p-2 text-right">Payment</th>
                         <th className="p-2"></th>
                       </tr>
                     </thead>
                     <tbody>
                       {monthAllocations.map((row, idx) => {
                         const monthLedger = monthlyLedgerRows.find((l: any) => l.month === row.month);
                         const due = Number(monthLedger?.dueAmount || 0);
                         const isCleared = String(monthLedger?.status || '').toLowerCase() === 'cleared' || due <= 0;
                         return (
                           <tr key={row.id} className="border-t border-white/5">
                             <td className="p-2">
                               <select value={row.month} disabled={isCleared} onChange={(e) => setMonthAllocations(prev => prev.map((r, i) => i === idx ? { ...r, month: e.target.value } : r))} className="w-full p-2 bg-white/5 border border-white/10 rounded-lg">
                                 {availableMonths.map((m) => <option key={`${row.id}_${m}`} value={m}>{m}</option>)}
                               </select>
                             </td>
                             <td className="p-2 text-right font-bold text-amber-400">{isCleared ? 'Cleared' : `₹${Math.round(due).toLocaleString()}`}</td>
                             <td className="p-2">
                               <input type="number" min={0} max={due} disabled={isCleared} value={row.amount} onChange={(e) => setMonthAllocations(prev => prev.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))} className="w-full p-2 text-right bg-white/5 border border-white/10 rounded-lg" />
                             </td>
                             <td className="p-2 text-right">
                               {monthAllocations.length > 1 && (
                                 <button type="button" onClick={() => setMonthAllocations(prev => prev.filter((_, i) => i !== idx))} className="text-[10px] text-red-400 font-black">Remove</button>
                               )}
                             </td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
               </div>

               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase opacity-40 ml-1">Payment Image / Screenshot</label>
                 <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      id="wa-screenshot"
                      className="hidden"
                      disabled={isUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploading(true);
                        setUploadProgress(0);
                        const toastId = toast.loading('Uploading screenshot...');
                        try {
                          const { promise } = storageService.uploadFile(file, (prog) => {
                             setUploadProgress(prog);
                          });
                          const meta = await promise;
                          setPaymentData(prev => ({ ...prev, screenshotUrl: meta.url }));
                          toast.success('Screenshot uploaded', { id: toastId });
                        } catch (err) {
                          toast.error('Upload failed', { id: toastId });
                        } finally {
                          setIsUploading(false);
                          setUploadProgress(0);
                        }
                      }}
                    />
                    <label 
                      htmlFor="wa-screenshot"
                      className={`flex flex-col items-center justify-center gap-2 w-full p-6 bg-gray-100 dark:bg-white/5 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all font-bold text-sm overflow-hidden relative ${isUploading ? 'opacity-80 cursor-not-allowed' : ''}`}
                    >
                      {isUploading && (
                        <div 
                           className="absolute left-0 bottom-0 h-1 bg-[var(--primary)] transition-all ease-out duration-300"
                           style={{ width: `${uploadProgress}%` }}
                        />
                      )}
                      <div className="flex items-center gap-3">
                         {isUploading ? (
                           <Upload className="animate-bounce" size={20} />
                         ) : paymentData.screenshotUrl ? (
                           <CheckCircle2 className="text-green-500" size={24} />
                         ) : (
                           <ImageIcon className="opacity-40" size={24} />
                         )}
                         <span className="text-sm">
                           {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : paymentData.screenshotUrl ? 'Image Attached Successfully' : 'Upload Screenshot / Receipt'}
                         </span>
                      </div>
                      {!isUploading && !paymentData.screenshotUrl && (
                        <span className="text-[10px] opacity-40 uppercase tracking-widest font-black">Click here to browse</span>
                      )}
                    </label>
                 </div>
               </div>

               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase opacity-40 ml-1">Additional Notes</label>
                 <textarea 
                   value={paymentData.notes}
                   onChange={e => setPaymentData(prev => ({...prev, notes: e.target.value}))}
                   className="w-full p-4 bg-gray-100 dark:bg-white/5 border border-white/10 rounded-2xl text-sm min-h-[80px]"
                   placeholder="Optional details..."
                 />
               </div>

               <button 
                type="submit"
                disabled={isSubmittingPayment || isUploading}
                className="w-full py-4 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[var(--primary)]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
               >
                 {isSubmittingPayment ? 'Submitting...' : 'Confirm Submission'}
               </button>
            </form>
          </motion.div>
        </div>
      )}

      <div className="mt-8 glass-card">
        <div className="flex items-center gap-2 mb-3"><FileText size={16} /> <h4 className="font-black text-sm uppercase">Receipts</h4></div>
        <p className="text-[10px] opacity-60 mb-3">Computer generated receipt. No signature required.</p>
        <div className="space-y-2">
          {feeReceipts.slice(0, 20).map((r) => (
            <div key={r.id || r.receiptId} className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
              <div className="flex justify-between">
                <div className="font-bold">Receipt #{r.receiptId || r.id}</div>
                <div className="font-bold text-green-500">₹{Math.round(Number(r.amount || 0)).toLocaleString()}</div>
              </div>
              <div className="opacity-60 mt-1">{r.transactionId ? `Txn: ${r.transactionId}` : 'No transaction id'}</div>
            </div>
          ))}
          {feeReceipts.length === 0 && <div className="text-xs opacity-50 italic">No receipts yet.</div>}
        </div>
      </div>
    </div>
  );
}

export default TabFee;
