import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Calendar, 
  PieChart as PieChartIcon, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Download,
  Trash2,
  Search,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Edit2,
  ChevronRight,
  MoreVertical,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestoreService } from '../services/firestoreService';
import { collection, query, where, getDocs, orderBy, Timestamp, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { storageService } from '../services/storageService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Cell, 
  Pie,
  LineChart,
  Line,
  Legend
} from 'recharts';
import toast from 'react-hot-toast';
import { pricingService } from '../services/pricingService';

const CATEGORIES = {
  expense: ['Teacher Salary', 'Rent', 'Electricity', 'Wifi', 'Equipment', 'Promotional', 'Miscellaneous', 'Other'],
  income: ['Fee', 'Loan', 'Grant', 'Achievement Reward', 'Other']
};

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function FinanceModule() {
  const [finances, setFinances] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'ledger' | 'fees' | 'pending'>('overview');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    type: 'expense' as 'income' | 'expense',
    category: 'Other',
    amount: '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    transactionId: '',
    screenshotUrl: '',
    studentId: '',
    studentName: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [feeMonthRows, setFeeMonthRows] = useState<Array<{ id: string; month: string; amount: string }>>([
    { id: `row_${Date.now()}`, month: new Date().toISOString().slice(0, 7), amount: '' }
  ]);
  const [studentLedgerPreview, setStudentLedgerPreview] = useState<any[]>([]);

  const [dateFilter, setDateFilter] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [financeLedgers, setFinanceLedgers] = useState<any[]>([]);

  const [feesData, setFeesData] = useState<any[]>([]);
  const [pendingFilters, setPendingFilters] = useState({
    search: '',
    grade: 'ALL',
    subject: 'ALL',
    status: 'ALL',
    minDue: '',
    maxDue: '',
    sortBy: 'due_desc' as 'due_desc' | 'due_asc' | 'name_asc' | 'name_desc',
  });

  const selectedEnrollment = React.useMemo(
    () => enrollments.find((e: any) => e.id === newEntry.studentId || e.userId === newEntry.studentId || e.uid === newEntry.studentId),
    [enrollments, newEntry.studentId]
  );

  const availableFeeMonths = React.useMemo(() => {
    const startDateRaw = selectedEnrollment?.enrollmentDate
      || selectedEnrollment?.joinedAt
      || selectedEnrollment?.createdAt
      || new Date();
    const startDate = startDateRaw?.toDate ? startDateRaw.toDate() : new Date(startDateRaw);
    if (Number.isNaN(startDate.getTime())) return [new Date().toISOString().slice(0, 7)];
    const months: string[] = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date();
    last.setMonth(last.getMonth() + 6);
    while (cursor <= last) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }, [selectedEnrollment]);

  const refreshStudentLedgerPreview = async (studentId: string) => {
    const enrollmentRecord = enrollments.find((e: any) => e.id === studentId || e.userId === studentId || e.uid === studentId);
    if (!enrollmentRecord) {
      setStudentLedgerPreview([]);
      return;
    }
    try {
      const month = new Date();
      month.setMonth(month.getMonth() + 1);
      const upto = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      const rows = await pricingService.ensureMonthlyLedger(
        enrollmentRecord.id,
        enrollmentRecord.name || enrollmentRecord.email || 'Student',
        enrollmentRecord,
        upto
      );
      setStudentLedgerPreview(
        rows.sort((a: any, b: any) => String(a.month || '').localeCompare(String(b.month || '')))
      );
    } catch (err) {
      console.error('Failed to load student monthly ledger', err);
      setStudentLedgerPreview([]);
    }
  };

  useEffect(() => {
    const unsubFinances = firestoreService.listenToCollection('finances', (data) => {
      setFinances(data.sort((a, b) => b.date.seconds - a.date.seconds));
      setLoading(false);
    });

    const unsubLedger = firestoreService.listenToCollection('finance_ledger', (data) => {
      setFinanceLedgers(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    const unsubEnrollments = firestoreService.listenToCollection('enrollments', (data) => {
      setEnrollments(data);
    });

    const unsubUsers = firestoreService.listenToCollection('users', (data) => {
      setUsers(data);
    });

    const unsubFees = firestoreService.listenToCollection('fees', (data) => {
      setFeesData(data);
    });

    return () => {
      unsubFinances();
      unsubLedger();
      unsubEnrollments();
      unsubUsers();
      unsubFees();
    };
  }, []);

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.amount || !newEntry.title) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const entryId = (newEntry as any).id;
      const parsedAmount = parseFloat(newEntry.amount);
      let feeMeta: any = {};
      if (newEntry.category === 'Fee' && newEntry.type === 'income' && newEntry.studentId && parsedAmount > 0) {
        const student = selectedEnrollment;
        if (!student) {
          toast.error('Please link a valid enrolled student for fee collection');
          return;
        }
        const cleanedAllocations = feeMonthRows
          .map((r) => ({ month: r.month, amount: Number(r.amount || 0) }))
          .filter((r) => r.month && r.amount > 0);
        const allocationResult = await pricingService.allocatePaymentToMonths({
          studentId: student.id,
          studentName: student.name || student.email || 'Student',
          enrollment: student,
          amount: parsedAmount,
          transactionId: newEntry.transactionId,
          mode: 'admin-finance',
          paidBy: 'admin',
          title: newEntry.title,
          notes: newEntry.notes,
          screenshotUrl: newEntry.screenshotUrl,
          allocations: cleanedAllocations,
        });
        feeMeta = {
          receiptId: allocationResult.receiptId,
          feeAllocations: allocationResult.allocations,
          feeExcessAmount: allocationResult.excessAmount,
          feeOutstandingAfterPayment: allocationResult.outstanding,
        };
        const priorPaid = Number(student.totalPaid || 0);
        await firestoreService.updateItem('enrollments', student.id, {
          totalPaid: priorPaid + parsedAmount,
          feeStatus: allocationResult.outstanding <= 0 ? 'Paid' : 'Pending'
        });
      }
      const data = {
        ...newEntry,
        ...feeMeta,
        amount: parsedAmount,
        date: Timestamp.fromDate(new Date(newEntry.date)),
        updatedAt: Timestamp.now()
      };
      
      if (entryId) {
        delete (data as any).id;
        await firestoreService.updateItem('finances', entryId, data);
        toast.success('Entry updated successfully');
      } else {
        await firestoreService.addItem('finances', {
          ...data,
          createdAt: Timestamp.now()
        });
        toast.success('Entry added successfully');
      }
      
      setIsAddModalOpen(false);
      setNewEntry({
        type: 'expense',
        category: 'Other',
        amount: '',
        title: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        transactionId: '',
        screenshotUrl: '',
        studentId: '',
        studentName: ''
      });
      setFeeMonthRows([{ id: `row_${Date.now()}`, month: new Date().toISOString().slice(0, 7), amount: '' }]);
      setStudentLedgerPreview([]);
    } catch (err) {
      toast.error('Failed to save entry');
    }
  };

  const filteredFinances = finances.filter(f => {
    const fDate = f.date.toDate();
    const start = new Date(dateFilter.start);
    start.setHours(0,0,0,0);
    const end = new Date(dateFilter.end);
    end.setHours(23,59,59,999);
    return fDate >= start && fDate <= end;
  });

  const totals = filteredFinances.reduce((acc, f) => {
    if (f.type === 'income') acc.income += f.amount;
    else acc.expense += f.amount;
    return acc;
  }, { income: 0, expense: 0 });

  // Correct calculation for expense
  const realTotals = filteredFinances.reduce((acc, f) => {
    if (f.type === 'income') acc.income += f.amount;
    else acc.expense += f.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const chartData = filteredFinances.reduce((acc: any[], f) => {
    const dateStr = f.date.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const existing = acc.find(d => d.date === dateStr);
    if (existing) {
      if (f.type === 'income') existing.income += f.amount;
      else existing.expense += f.amount;
    } else {
      acc.push({ date: dateStr, income: f.type === 'income' ? f.amount : 0, expense: f.type === 'expense' ? f.amount : 0 });
    }
    return acc;
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const categoryData = filteredFinances.reduce((acc: any[], f) => {
    const existing = acc.find(c => c.name === f.category);
    if (existing) {
      existing.value += f.amount;
    } else {
      acc.push({ name: f.category, value: f.amount });
    }
    return acc;
  }, []);

  const pendingPayments = enrollments.filter(e => e.feeStatus !== 'Paid');
  const pendingSubjects = Array.from(new Set(
    pendingPayments.flatMap(e => (e.subjects || []) as string[])
  )).sort();
  const getPendingAmount = (e: any) => Math.max(0, Number(e.totalFee || 0) - Number(e.discount || 0) - Number(e.totalPaid || 0));
  const syncMonthlyFeeCollections = async (e: any, amount: number, paymentId: string, txId = '') => {
    const month = new Date().toISOString().slice(0, 7);
    await pricingService.recordPaymentAndUpdateLedger({
      studentId: e.id,
      studentName: e.name || 'Unknown Student',
      month,
      amount: Number(amount || 0),
      paymentId,
      transactionId: txId,
      mode: 'admin-finance',
    });
  };
  const filteredPendingPayments = pendingPayments
    .filter((e: any) => {
      const search = pendingFilters.search.trim().toLowerCase();
      const due = getPendingAmount(e);
      const statusOk = pendingFilters.status === 'ALL' ? true : (e.feeStatus || 'Pending') === pendingFilters.status;
      const gradeOk = pendingFilters.grade === 'ALL' ? true : (e.grade || '') === pendingFilters.grade;
      const subjectOk = pendingFilters.subject === 'ALL'
        ? true
        : (e.subjects || []).includes(pendingFilters.subject);
      const searchOk = !search
        ? true
        : `${e.name || ''} ${e.email || ''} ${e.whatsapp || ''}`.toLowerCase().includes(search);
      const minOk = pendingFilters.minDue === '' ? true : due >= Number(pendingFilters.minDue);
      const maxOk = pendingFilters.maxDue === '' ? true : due <= Number(pendingFilters.maxDue);
      return statusOk && gradeOk && subjectOk && searchOk && minOk && maxOk;
    })
    .sort((a: any, b: any) => {
      if (pendingFilters.sortBy === 'due_desc') return getPendingAmount(b) - getPendingAmount(a);
      if (pendingFilters.sortBy === 'due_asc') return getPendingAmount(a) - getPendingAmount(b);
      if (pendingFilters.sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      return (a.name || '').localeCompare(b.name || '');
    });
  
  // Advance fee prediction: count students enrolled but might need next month payment
  // For demo, just showing pending.

  if (loading) return <div className="flex justify-center items-center py-20"><Clock className="animate-spin text-[var(--primary)]" /></div>;

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="text-[var(--primary)]" />
            Financial Management
          </h2>
          <p className="text-sm opacity-60">Track income, expenses, and fee collection</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="date" 
            value={dateFilter.start}
            onChange={e => setDateFilter({...dateFilter, start: e.target.value})}
            className="p-2 bg-white/5 border border-white/10 rounded-xl text-xs outline-none"
          />
          <span className="opacity-30">to</span>
          <input 
            type="date" 
            value={dateFilter.end}
            onChange={e => setDateFilter({...dateFilter, end: e.target.value})}
            className="p-2 bg-white/5 border border-white/10 rounded-xl text-xs outline-none"
          />
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="p-3 bg-[var(--primary)] text-white rounded-xl shadow-lg shadow-[var(--primary)]/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg text-green-500">
              <TrendingUp size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-green-500/50">Total Income</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-black">₹{realTotals.income.toLocaleString()}</h3>
            <p className="text-xs opacity-60 flex items-center gap-1">
              <ArrowUpRight size={14} className="text-green-500" />
              Includes fees & other sources
            </p>
          </div>
        </div>

        <div className="glass-card p-6 bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/20">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
              <TrendingDown size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-red-500/50">Total Expenses</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-black">₹{realTotals.expense.toLocaleString()}</h3>
            <p className="text-xs opacity-60 flex items-center gap-1">
              <ArrowDownRight size={14} className="text-red-500" />
              Salaries, rent, overheads
            </p>
          </div>
        </div>

        <div className="glass-card p-6 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border-blue-500/20">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500">
              <Wallet size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500/50">Net Balance</span>
          </div>
          <div className="space-y-1">
            <h3 className={`text-3xl font-black ${realTotals.income - realTotals.expense >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ₹{(realTotals.income - realTotals.expense).toLocaleString()}
            </h3>
            <p className="text-xs opacity-60">Cash Flow Balance</p>
          </div>
        </div>
      </div>

      {/* Detailed Itemized Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 border-green-500/10">
          <h4 className="text-sm font-black uppercase tracking-widest text-green-500 mb-4 flex items-center gap-2">
            <TrendingUp size={16} /> Income Breakdown
          </h4>
          <div className="space-y-3">
            {CATEGORIES.income.map(cat => {
              const total = filteredFinances.filter(f => f.type === 'income' && f.category === cat).reduce((sum, f) => sum + f.amount, 0);
              const percent = realTotals.income > 0 ? (total / realTotals.income) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{cat}</span>
                    <span>₹{total.toLocaleString()} ({percent.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      className="h-full bg-green-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-6 border-red-500/10">
          <h4 className="text-sm font-black uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
            <TrendingDown size={16} /> Expense Breakdown
          </h4>
          <div className="space-y-3">
            {CATEGORIES.expense.map(cat => {
              const total = filteredFinances.filter(f => f.type === 'expense' && f.category === cat).reduce((sum, f) => sum + f.amount, 0);
              const percent = realTotals.expense > 0 ? (total / realTotals.expense) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{cat}</span>
                    <span>₹{total.toLocaleString()} ({percent.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      className="h-full bg-red-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-2xl w-fit flex-wrap">
        <button 
          onClick={() => setActiveView('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === 'overview' ? 'bg-white dark:bg-[#1e1e1e] text-[var(--primary)] shadow-sm' : 'text-gray-500'}`}
        >
          Analytics
        </button>
        <button 
          onClick={() => setActiveView('ledger')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === 'ledger' ? 'bg-white dark:bg-[#1e1e1e] text-[var(--primary)] shadow-sm' : 'text-gray-500'}`}
        >
          Day Book
        </button>
        <button 
          onClick={() => setActiveView('fees')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === 'fees' ? 'bg-white dark:bg-[#1e1e1e] text-[var(--primary)] shadow-sm' : 'text-gray-500'}`}
        >
          Student Fees
        </button>
        <button 
          onClick={() => setActiveView('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === 'pending' ? 'bg-white dark:bg-[#1e1e1e] text-[var(--primary)] shadow-sm' : 'text-gray-500'}`}
        >
          Pending {pendingPayments.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[8px]">{pendingPayments.length}</span>}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'splits' as any && (
          <motion.div 
            key="splits"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card overflow-hidden"
          >
            <div className="p-4 border-b border-white/10">
              <h3 className="font-bold flex items-center gap-2">
                <Wallet size={18} /> SPLIT LEDGER LOGS
              </h3>
              <p className="text-xs opacity-60 mt-1">Detailed log of 50-50 automatic fee splits (Admin vs Faculty).</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-100 dark:bg-white/5">
                  <tr>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-50">Date</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-50">Student Info</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-50 text-right">Amount Paid</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-50 text-right">Admin Cut (50%)</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-50 text-right">Faculty Pool (50%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {financeLedgers.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 text-xs font-medium whitespace-nowrap">
                        {new Date(log.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-bold">{log.studentName}</div>
                        <div className="flex gap-1 mt-1">
                          {(log.subjects || []).map((s: string) => (
                            <span key={s} className="px-1.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] text-[8px] rounded font-bold uppercase">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-sm font-black text-right">
                        ₹{log.amountPaid?.toLocaleString()}
                      </td>
                      <td className="p-4 text-sm font-black text-right text-indigo-500">
                        ₹{log.adminCut?.toLocaleString()}
                      </td>
                      <td className="p-4 text-sm font-black text-right text-emerald-500">
                        ₹{log.facultyCut?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {financeLedgers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center opacity-30 italic font-medium">
                        No split ledger records found. Standard payments directly add income. Full logic is configured in Enrollments.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
        {activeView === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="glass-card p-6 min-h-[400px]">
              <h4 className="text-sm font-bold mb-6 flex items-center gap-2">
                <TrendingUp size={16} className="text-[var(--primary)]" />
                Income vs Expense Flow
              </h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card p-6 min-h-[400px]">
              <h4 className="text-sm font-bold mb-6 flex items-center gap-2">
                <PieChartIcon size={16} className="text-[var(--primary)]" />
                Category Distribution
              </h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                       contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'ledger' && (
          <motion.div 
            key="ledger"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-100 dark:bg-white/5">
                  <tr>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-50">Date</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-50">Description</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-50">Category</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-50 text-right">Income</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-50 text-right">Expense</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-50">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filteredFinances.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 text-xs font-medium">
                        {f.date.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-bold">{f.title}</div>
                        {f.notes && <div className="text-[10px] opacity-50">{f.notes}</div>}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-white/5 rounded text-[10px] font-bold uppercase tracking-wider">
                          {f.category}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-black text-right text-green-500">
                        {f.type === 'income' ? `+₹${f.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-4 text-sm font-black text-right text-red-500">
                        {f.type === 'expense' ? `-₹${f.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-4 flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setNewEntry({
                              type: f.type,
                              category: f.category,
                              amount: f.amount.toString(),
                              title: f.title,
                              date: f.date.toDate().toISOString().split('T')[0],
                              notes: f.notes || '',
                              transactionId: f.transactionId || '',
                              screenshotUrl: f.screenshotUrl || '',
                              studentId: f.studentId || '',
                              studentName: f.studentName || ''
                            });
                            (newEntry as any).id = f.id;
                            setIsAddModalOpen(true);
                          }}
                          className="p-2 text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => firestoreService.deleteItem('finances', f.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredFinances.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center opacity-30 italic font-medium">
                        No transactions found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-100 dark:bg-white/5 font-black border-t border-gray-200 dark:border-white/10 text-sm">
                  <tr>
                    <td colSpan={3} className="p-4 text-right uppercase tracking-[0.2em] opacity-50">Period Totals</td>
                    <td className="p-4 text-right text-green-500">₹{realTotals.income.toLocaleString()}</td>
                    <td className="p-4 text-right text-red-500">₹{realTotals.expense.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>
        )}

        {activeView === 'fees' && (
          <motion.div 
            key="fees"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrollments.filter(e => e.feeStatus === 'Paid').slice(0, 10).map(e => (
                <div key={e.id} className="glass-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{e.name}</div>
                      <div className="text-[10px] opacity-60 uppercase">{e.grade} • Paid in Full</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black">₹{e.totalFee - (e.discount || 0)}</div>
                    <div className="text-[10px] opacity-40 italic">{new Date(e.createdAt?.seconds * 1000).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
              <p className="text-sm opacity-50 mb-4">Detailed student reports available in verified section.</p>
              <button 
                 onClick={() => {
                   const csvRows = [
                     ['Name', 'Email', 'Grade', 'Fee Status', 'Total Fee', 'Enrollment Date'],
                     ...enrollments.map(e => [
                       e.name, e.email, e.grade, e.feeStatus, e.totalFee, 
                       e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString() : 'N/A'
                     ])
                   ];
                   const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
                   const link = document.createElement("a");
                   link.setAttribute("href", encodeURI(csvContent));
                   link.setAttribute("download", `enrollment_report_${new Date().toISOString().split('T')[0]}.csv`);
                   document.body.appendChild(link);
                   link.click();
                 }}
                 className="px-6 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 mx-auto"
              >
                <Download size={14} /> Export CSV Report
              </button>
            </div>
          </motion.div>
        )}

        {activeView === 'pending' && (
          <motion.div 
            key="pending"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {pendingPayments.length > 0 && (
              <div className="glass-card p-4 space-y-3 border-amber-500/20">
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  <input
                    type="text"
                    placeholder="Search student / phone"
                    value={pendingFilters.search}
                    onChange={(e) => setPendingFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="p-2 bg-white/5 border border-white/10 rounded-xl text-xs outline-none"
                  />
                  <select
                    value={pendingFilters.grade}
                    onChange={(e) => setPendingFilters(prev => ({ ...prev, grade: e.target.value }))}
                    className="p-2 bg-white/5 border border-white/10 rounded-xl text-xs outline-none"
                  >
                    <option value="ALL">All Classes</option>
                    {['IX', 'X', 'XI', 'XII'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select
                    value={pendingFilters.subject}
                    onChange={(e) => setPendingFilters(prev => ({ ...prev, subject: e.target.value }))}
                    className="p-2 bg-white/5 border border-white/10 rounded-xl text-xs outline-none"
                  >
                    <option value="ALL">All Subjects</option>
                    {pendingSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="Min Due"
                    value={pendingFilters.minDue}
                    onChange={(e) => setPendingFilters(prev => ({ ...prev, minDue: e.target.value }))}
                    className="p-2 bg-white/5 border border-white/10 rounded-xl text-xs outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max Due"
                    value={pendingFilters.maxDue}
                    onChange={(e) => setPendingFilters(prev => ({ ...prev, maxDue: e.target.value }))}
                    className="p-2 bg-white/5 border border-white/10 rounded-xl text-xs outline-none"
                  />
                  <select
                    value={pendingFilters.sortBy}
                    onChange={(e) => setPendingFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                    className="p-2 bg-white/5 border border-white/10 rounded-xl text-xs outline-none"
                  >
                    <option value="due_desc">Due: High to Low</option>
                    <option value="due_asc">Due: Low to High</option>
                    <option value="name_asc">Name: A-Z</option>
                    <option value="name_desc">Name: Z-A</option>
                  </select>
                  <div className="text-[11px] font-bold px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    Showing {filteredPendingPayments.length}/{pendingPayments.length}
                  </div>
                </div>
              </div>
            )}

            {pendingPayments.length > 0 && (
              <div className="flex justify-end pr-2">
                <button 
                  onClick={() => {
                    const count = filteredPendingPayments.length;
                    if (!confirm(`This will prepare reminders for ${count} students. Continue?`)) return;
                    toast.success('Check your browser tabs! Reminders prepared.');
                    filteredPendingPayments.forEach((e, idx) => {
                      setTimeout(() => {
                        const msg = `*PAYMENT REMINDER*
👤 *Student:* ${e.name}
💰 *Dues:* ₹${getPendingAmount(e)}
📅 *Status:* ${e.feeStatus}

Please clear your pending dues at the earliest.`;
                        window.open(`https://wa.me/${e.whatsapp?.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
                        firestoreService.addItem('reminder_logs', {
                          studentId: e.id,
                          studentName: e.name,
                          phone: e.whatsapp || '',
                          mode: 'bulk',
                          status: 'link_opened',
                          channel: 'whatsapp',
                          messageSnapshot: msg
                        }).catch(console.error);
                      }, idx * 500); // Stagger popups
                    });
                  }}
                  className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  <MessageCircle size={14} /> WhatsApp/Sms Fee Reminder (API) ({filteredPendingPayments.length})
                </button>
              </div>
            )}
            {filteredPendingPayments.map(e => (
              <div key={e.id} className="glass-card p-4 flex flex-col gap-4 border-amber-500/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg shrink-0">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h5 className="font-bold">{e.name}</h5>
                      <p className="text-[10px] opacity-60">
                        {e.email} • <span className="font-bold text-amber-500 uppercase">{e.feeStatus}</span>
                      </p>
                      <div className="flex gap-2 mt-1">
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/5 rounded text-[8px] font-bold">Grade {e.grade}</span>
                        <span className="px-1.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded text-[8px] font-bold">₹{e.totalFee} Total</span>
                        <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded text-[8px] font-bold">₹{getPendingAmount(e)} Pending</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={async () => {
                        if (!confirm(`Mark ${e.name} as Paid and generate revenue entry?`)) return;
                      const paidAmount = e.totalFee - (e.discount || 0);
                      const adminCut = Math.floor(paidAmount * 0.5);
                      const facultyPool = paidAmount - adminCut;

                      const nextMonth = new Date();
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      nextMonth.setDate(5); // 5th of next month

                      await firestoreService.updateItem('enrollments', e.id, { 
                        feeStatus: 'Paid',
                        expiryDate: nextMonth.toISOString()
                      });
                      
                      // 1. Add to Finances (Main Revenue)
                      await firestoreService.addItem('finances', {
                        type: 'income',
                        category: 'Fee',
                        amount: paidAmount,
                        title: `Fee Collection: ${e.name}`,
                        date: Timestamp.now(),
                        createdAt: Timestamp.now(),
                        notes: `Offline fee collection for ${e.id} (Grade ${e.grade})`
                      });

                      const selectedFees = feesData.filter(f => 
                        (e.subjects || []).includes(f.subject) &&
                        (f.grade === e.grade || (f.grades && f.grades.includes(e.grade)))
                      );
                      const totalBasePrice = selectedFees.reduce((sum, f) => sum + (f.originalPrice - f.discount), 0);
                      
                      const subjectSplits: Record<string, number> = {};
                      if (totalBasePrice > 0) {
                         selectedFees.forEach(f => {
                           const ratio = (f.originalPrice - f.discount) / totalBasePrice;
                           subjectSplits[f.subject] = Math.floor(facultyPool * ratio);
                         });
                      } else {
                         (e.subjects || []).forEach((sub: string) => {
                           subjectSplits[sub] = Math.floor(facultyPool / (e.subjects?.length || 1));
                         });
                      }

                      // 2. Add to Split Ledger for Faculty Payroll
                      await firestoreService.addItem('finance_ledger', {
                        studentId: e.id,
                        studentName: e.name,
                        grade: e.grade,
                        subjects: e.subjects || [],
                        amountPaid: paidAmount,
                        adminCut: adminCut,
                        facultyCut: facultyPool,
                        subjectSplits: subjectSplits,
                        date: new Date().toISOString(),
                        enrollmentId: e.id,
                        isDistributed: false
                      });

                      await syncMonthlyFeeCollections(e, paidAmount, `admin_offline_${Date.now()}`);

                      toast.success('Payment recorded & 50-50 split generated.');
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:scale-105 transition-all"
                  >
                    Accept Payment (Offline)
                  </button>
                    <button 
                      onClick={() => {
                        const msg = `*PAYMENT REMINDER*
👤 *Student:* ${e.name}
📚 *Batch:* ${e.grade}
💰 *Dues:* ₹${getPendingAmount(e)}
📅 *Status:* ${e.feeStatus}

Please clear your pending dues to continue accessing batch materials.`;
                        window.open(`https://wa.me/${e.whatsapp?.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
                        firestoreService.addItem('reminder_logs', {
                          studentId: e.id,
                          studentName: e.name,
                          phone: e.whatsapp || '',
                          mode: 'single',
                          status: 'link_opened',
                          channel: 'whatsapp',
                          messageSnapshot: msg
                        }).catch(console.error);
                      }}
                      className="flex-1 sm:flex-none px-4 py-2 bg-indigo-500/10 text-indigo-500 rounded-xl text-xs font-bold flex justify-center items-center gap-2"
                    >
                    Send WhatsApp Reminder (Whatsapp Web App Reminder)
                  </button>
                </div>
              </div>
              {e.paymentHistory && e.paymentHistory.some((ph: any) => ph.status === 'pending') && (
                  <div className="w-full mt-4 pt-4 border-t border-amber-500/10 space-y-3">
                    <h6 className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Pending Uploaded Proofs</h6>
                    {e.paymentHistory.filter((ph: any) => ph.status === 'pending').map((ph: any, idx: number) => (
                      <div key={idx} className="bg-black/20 p-3 rounded-xl flex items-center justify-between text-sm">
                        <div className="space-y-1">
                          <span className="font-bold">₹{ph.amount}</span>
                          {ph.transactionId && <span className="block text-[10px] opacity-50 font-mono">Txn: {ph.transactionId}</span>}
                          {ph.notes && <span className="block text-[10px] opacity-50 italic">Note: {ph.notes}</span>}
                          <span className="block text-[9px] opacity-30">{new Date(ph.date).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {ph.screenshot && (
                            <button 
                              onClick={() => window.open(ph.screenshot, '_blank')}
                              className="px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg text-xs font-bold hover:bg-blue-500/20"
                            >
                              View Proof
                            </button>
                          )}
                          <button 
                            onClick={async () => {
                              if (!confirm(`Mark this proof as Verified & Accept Payment?`)) return;
                              // 1. Update the item in payment history
                              const updatedHistory = e.paymentHistory.map((item: any) => 
                                item.id === ph.id ? { ...item, status: 'verified' } : item
                              );
                              
                              const paidAmount = Number(ph.amount);
                              const adminCut = Math.floor(paidAmount * 0.5);
                              const facultyPool = paidAmount - adminCut;
                              
                              const nextMonth = new Date();
                              nextMonth.setMonth(nextMonth.getMonth() + 1);
                              nextMonth.setDate(5); // 5th of next month

                              await firestoreService.updateItem('enrollments', e.id, { 
                                feeStatus: 'Paid',
                                paymentHistory: updatedHistory,
                                totalPaid: (e.totalPaid || 0) + paidAmount,
                                expiryDate: nextMonth.toISOString()
                              });
                              
                              // 2. We already pushed into finances from student side as 'pending', let's find it and verify it
                              try {
                                const q = query(collection(db, 'finances'), where('transactionId', '==', ph.transactionId));
                                const snap = await getDocs(q);
                                if (!snap.empty) {
                                  await firestoreService.updateItem('finances', snap.docs[0].id, { status: 'verified' });
                                }
                              } catch(err) {
                                console.error('Could not verify finance log', err);
                              }
                              
                              // 3. Generate Faculty Splits
                              const selectedFees = feesData.filter(f => 
                                (e.subjects || []).includes(f.subject) &&
                                (f.grade === e.grade || (f.grades && f.grades.includes(e.grade)))
                              );
                              const totalBasePrice = selectedFees.reduce((sum, f) => sum + (f.originalPrice - f.discount), 0);
                              
                              const subjectSplits: Record<string, number> = {};
                              if (totalBasePrice > 0) {
                                 selectedFees.forEach(f => {
                                   const ratio = (f.originalPrice - f.discount) / totalBasePrice;
                                   subjectSplits[f.subject] = Math.floor(facultyPool * ratio);
                                 });
                              } else {
                                 (e.subjects || []).forEach((sub: string) => {
                                   subjectSplits[sub] = Math.floor(facultyPool / (e.subjects?.length || 1));
                                 });
                              }

                              await firestoreService.addItem('finance_ledger', {
                                studentId: e.id,
                                studentName: e.name,
                                grade: e.grade,
                                subjects: e.subjects || [],
                                amountPaid: paidAmount,
                                adminCut: adminCut,
                                facultyCut: facultyPool,
                                subjectSplits: subjectSplits,
                                date: new Date().toISOString(),
                                enrollmentId: e.id,
                                isDistributed: false
                              });

                              await syncMonthlyFeeCollections(e, paidAmount, ph.id || `proof_${Date.now()}`, ph.transactionId || '');

                              toast.success('Proof Verified & Ledger Generated!');
                            }}
                            className="px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg text-xs font-bold hover:bg-green-500/20"
                          >
                            Verify
                          </button>
                          <button 
                            onClick={async () => {
                              if (!confirm(`Reject this proof?`)) return;
                              const updatedHistory = e.paymentHistory.map((item: any) => 
                                item.id === ph.id ? { ...item, status: 'rejected' } : item
                              );
                              await firestoreService.updateItem('enrollments', e.id, { paymentHistory: updatedHistory });
                              
                              try {
                                const q = query(collection(db, 'finances'), where('transactionId', '==', ph.transactionId));
                                const snap = await getDocs(q);
                                if (!snap.empty) {
                                  await firestoreService.updateItem('finances', snap.docs[0].id, { status: 'rejected' });
                                }
                              } catch(err) {
                                console.error('Could not verify finance log', err);
                              }
                              toast.error('Proof Rejected');
                            }}
                            className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-xs font-bold hover:bg-red-500/20"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {filteredPendingPayments.length === 0 && (
              <div className="p-20 text-center glass-card opacity-30 italic">
                No pending records found for selected filters.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsAddModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#1e1e1e] rounded-3xl p-8 shadow-2xl border border-white/5 space-y-6"
            >
              <h3 className="text-2xl font-black italic tracking-tight">
                {(newEntry as any).id ? 'EDIT TRANSACTION' : 'ADD TRANSACTION'}
              </h3>
              
              <form onSubmit={handleSaveEntry} className="space-y-4">
                <div className="flex gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => setNewEntry({...newEntry, type: 'expense', category: CATEGORIES.expense[0]})}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newEntry.type === 'expense' ? 'bg-red-500 text-white' : 'text-gray-500'}`}
                  >
                    Expense
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewEntry({...newEntry, type: 'income', category: CATEGORIES.income[0]})}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newEntry.type === 'income' ? 'bg-green-500 text-white' : 'text-gray-500'}`}
                  >
                    Income
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-50 tracking-widest pl-1">Category</label>
                    <select 
                      value={newEntry.category}
                      onChange={e => {
                        const cat = e.target.value;
                        setNewEntry({...newEntry, category: cat});
                      }}
                      className="w-full p-4 bg-gray-100 dark:bg-white/10 border border-transparent focus:border-[var(--primary)] rounded-2xl outline-none text-sm transition-all [&>option]:bg-white dark:[&>option]:bg-[#1e1e1e] dark:text-white"
                    >
                      {CATEGORIES[newEntry.type].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-50 tracking-widest pl-1">Date</label>
                    <input 
                      type="date" 
                      value={newEntry.date}
                      onChange={e => setNewEntry({...newEntry, date: e.target.value})}
                      className="w-full p-4 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-2xl outline-none text-sm transition-all"
                    />
                  </div>
                </div>

                {newEntry.category === 'Fee' && (
                  <div className="space-y-4 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 mb-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase opacity-50 tracking-widest pl-1">Link to Student</label>
                      <select 
                        className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold outline-none [&>option]:bg-[#1e1e1e]"
                        value={newEntry.studentId}
                        onChange={e => {
                          const student = enrollments.find((u: any) => u.id === e.target.value);
                          setNewEntry({
                            ...newEntry, 
                            studentId: e.target.value,
                            studentName: student?.name || '',
                            title: student ? `Fee Receipt: ${student.name}` : newEntry.title
                          });
                          setFeeMonthRows([{ id: `row_${Date.now()}`, month: new Date().toISOString().slice(0, 7), amount: newEntry.amount || '' }]);
                          refreshStudentLedgerPreview(e.target.value);
                        }}
                      >
                        <option value="">Select Student...</option>
                        {enrollments.map((u: any) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-50 tracking-widest pl-1">Transaction ID / Ref</label>
                        <input 
                          type="text"
                          value={newEntry.transactionId}
                          onChange={e => setNewEntry({...newEntry, transactionId: e.target.value})}
                          placeholder="UTR / UPI Ref No."
                          className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-50 tracking-widest pl-1">Payment Image (Optional)</label>
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setIsUploading(true);
                              try {
                                const { promise } = storageService.uploadFile(file, () => {});
                                const meta = await promise;
                                setNewEntry({...newEntry, screenshotUrl: meta.url});
                                toast.success('Image uploaded!');
                              } catch (err) {
                                toast.error('Upload failed');
                              } finally {
                                setIsUploading(false);
                              }
                            }}
                            className="hidden" 
                            id="payment-screenshot"
                          />
                          <label 
                            htmlFor="payment-screenshot"
                            className="flex items-center justify-center gap-2 p-4 bg-white/5 border border-dashed border-white/20 rounded-2xl text-[10px] font-black cursor-pointer hover:bg-white/10 transition-all uppercase"
                          >
                            {isUploading ? <Loader2 className="animate-spin" size={14}/> : <ImageIcon size={14}/>}
                            {newEntry.screenshotUrl ? 'Change Image' : 'Upload Screenshot'}
                          </label>
                        </div>
                      </div>
                    </div>

                    {newEntry.studentId && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase opacity-50 tracking-widest pl-1">Fee Month Selection</label>
                          <button
                            type="button"
                            onClick={() => setFeeMonthRows(prev => [...prev, { id: `row_${Date.now()}_${prev.length}`, month: new Date().toISOString().slice(0, 7), amount: '' }])}
                            className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 text-[10px] font-black uppercase flex items-center gap-1"
                          >
                            <Plus size={12} /> Add Month
                          </button>
                        </div>
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-white/5">
                              <tr>
                                <th className="p-2 text-left">Month</th>
                                <th className="p-2 text-right">Month Fee</th>
                                <th className="p-2 text-right">Balance</th>
                                <th className="p-2 text-right">Payment</th>
                                <th className="p-2 text-center">Status</th>
                                <th className="p-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {feeMonthRows.map((row, idx) => {
                                const monthLedger = studentLedgerPreview.find((l: any) => l.month === row.month);
                                const due = Number(monthLedger?.dueAmount ?? Math.max(0, Number(selectedEnrollment?.totalFee || 0) - Number(selectedEnrollment?.discount || 0)));
                                const totalFee = Number(monthLedger?.totalFee ?? Math.max(0, Number(selectedEnrollment?.totalFee || 0) - Number(selectedEnrollment?.discount || 0)));
                                const status = monthLedger?.status || (due <= 0 ? 'Cleared' : 'Pending');
                                return (
                                  <tr key={row.id} className="border-t border-white/5">
                                    <td className="p-2">
                                      <select
                                        className="w-full p-2 bg-white/5 border border-white/10 rounded-lg"
                                        value={row.month}
                                        disabled={status === 'Cleared'}
                                        onChange={(e) => setFeeMonthRows(prev => prev.map((r, i) => i === idx ? { ...r, month: e.target.value } : r))}
                                      >
                                        {availableFeeMonths.map((m) => <option key={`${row.id}_${m}`} value={m}>{m}</option>)}
                                      </select>
                                    </td>
                                    <td className="p-2 text-right font-bold">₹{Math.round(totalFee).toLocaleString()}</td>
                                    <td className="p-2 text-right font-bold text-amber-400">₹{Math.round(due).toLocaleString()}</td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        min={0}
                                        max={due}
                                        disabled={status === 'Cleared'}
                                        value={row.amount}
                                        onChange={(e) => setFeeMonthRows(prev => prev.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))}
                                        className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-right"
                                      />
                                    </td>
                                    <td className="p-2 text-center">
                                      <span className={`px-2 py-1 rounded text-[10px] font-black ${status === 'Cleared' ? 'bg-green-500/20 text-green-500' : status === 'Partial' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10'}`}>
                                        {status}
                                      </span>
                                    </td>
                                    <td className="p-2 text-right">
                                      {feeMonthRows.length > 1 && (
                                        <button type="button" onClick={() => setFeeMonthRows(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 text-[10px] font-black">Remove</button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-50 tracking-widest pl-1">Title / Description</label>
                  <input 
                    type="text" 
                    value={newEntry.title}
                    onChange={e => setNewEntry({...newEntry, title: e.target.value})}
                    placeholder="e.g. Monthly Electricity Bill"
                    className="w-full p-4 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-2xl outline-none text-sm transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-50 tracking-widest pl-1">Amount (₹)</label>
                  <input 
                    type="number" 
                    value={newEntry.amount}
                    onChange={e => setNewEntry({...newEntry, amount: e.target.value})}
                    placeholder="0.00"
                    className="w-full p-4 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-2xl outline-none text-lg font-black transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-50 tracking-widest pl-1">Notes (Optional)</label>
                  <textarea 
                    value={newEntry.notes}
                    onChange={e => setNewEntry({...newEntry, notes: e.target.value})}
                    placeholder="Add any extra details..."
                    className="w-full p-4 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-2xl outline-none text-sm min-h-[80px] transition-all"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-[var(--primary)]/20 hover:opacity-90 active:scale-95 transition-all"
                >
                  Confirm Entry
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
