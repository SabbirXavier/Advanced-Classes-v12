import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Search,
  ChevronRight,
  ChevronDown,
  Filter,
  AlertCircle,
  FileText,
  Download,
  MessageSquare,
  Edit2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { firestoreService } from '../services/firestoreService';
import { authService } from '../services/authService';
import { db } from '../firebase';
import { collection, query, where, getDocs, Timestamp, addDoc, updateDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface AttendanceModuleProps {
  user: any;
  isAdmin: boolean;
  isFaculty: boolean;
  facultyBatches: any[];
  source?: 'admin' | 'mybatch';
}

export default function AttendanceModule({ user, isAdmin, isFaculty, facultyBatches, source = 'mybatch' }: AttendanceModuleProps) {
  const [activeTab, setActiveTab] = useState<'student' | 'faculty' | 'faculty_admin' | 'reports'>(
    source === 'admin' ? 'reports' : (isFaculty ? 'student' : 'student')
  );
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent'>>({});
  const [loading, setLoading] = useState(true);

  const [batchFacultyRecords, setBatchFacultyRecords] = useState<any[]>([]);
  const [facultyAttendance, setFacultyAttendance] = useState<any[]>([]);
  const [facultyAttendanceDate, setFacultyAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [facultyAttendanceTime, setFacultyAttendanceTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
  const [facultyMarkClass, setFacultyMarkClass] = useState('ALL');
  const [facultyMarkSubject, setFacultyMarkSubject] = useState('ALL');

  const [adminFacultyDate, setAdminFacultyDate] = useState(new Date().toISOString().split('T')[0]);
  const [adminFacultyBatch, setAdminFacultyBatch] = useState('ALL');
  const [adminFacultySubject, setAdminFacultySubject] = useState('ALL');
  const [adminFacultyMember, setAdminFacultyMember] = useState('ALL');
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [editingFacultyTime, setEditingFacultyTime] = useState<string>('');

  const [studentAttendance, setStudentAttendance] = useState<any[]>([]);
  const [reportTab, setReportTab] = useState<'faculty' | 'student'>('student');
  const [reportDateRange, setReportDateRange] = useState<'day'|'weekly'|'monthly'|'yearly'|'range'|'all'>('day');
  const [reportDay, setReportDay] = useState(new Date().toISOString().split('T')[0]);
  const [reportFromDate, setReportFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 6)).toISOString().split('T')[0]);
  const [reportToDate, setReportToDate] = useState(new Date().toISOString().split('T')[0]);
  const [messagingConfig, setMessagingConfig] = useState({ provider: 'whatsapp', apiKey: '', template: 'Hello {name}, your attendance is marked as {status} for {date}.' });
  const [showConfig, setShowConfig] = useState(false);
  const [allEnrollments, setAllEnrollments] = useState<any[]>([]);
  const [facultyUsers, setFacultyUsers] = useState<any[]>([]);
  const [reportBatchFilter, setReportBatchFilter] = useState('ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionDetails, setSubmissionDetails] = useState<any>(null);
  const [extraStudentMeta, setExtraStudentMeta] = useState<Record<string, {name: string; whatsapp?: string}>>({});
  const [showAddStudentForm, setShowAddStudentForm] = useState(false);
  const [newStudentData, setNewStudentData] = useState({ name: '', whatsapp: '' });
  const [facultyReportSortBy, setFacultyReportSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'status'>('date_desc');
  const [showTodayFacultyExpanded, setShowTodayFacultyExpanded] = useState(false);
  const [showYesterdayFacultyExpanded, setShowYesterdayFacultyExpanded] = useState(false);

  const facultyAssignedSubject = React.useMemo(() => {
    if (isAdmin || !isFaculty || !selectedBatch) return null;
    const fb = facultyBatches?.find(f => f.batchId === selectedBatch.id);
    return fb ? fb.subject : null;
  }, [isAdmin, isFaculty, selectedBatch, facultyBatches]);

  const kolkataNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const todayDateStr = kolkataNow.toISOString().split('T')[0];
  const yesterdayDate = new Date(kolkataNow);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayDateStr = yesterdayDate.toISOString().split('T')[0];

  const todayFaculty = facultyAttendance.filter(a => a.dateStr === todayDateStr && a.isApproved);
  const yesterdayFaculty = facultyAttendance.filter(a => a.dateStr === yesterdayDateStr && a.isApproved);
  const sortedFacultyAttendance = React.useMemo(() => {
    const sorted = [...facultyAttendance];
    sorted.sort((a, b) => {
      if (facultyReportSortBy === 'date_asc') {
        return (a.date?.seconds || 0) - (b.date?.seconds || 0);
      }
      if (facultyReportSortBy === 'name_asc') {
        return (a.userName || '').localeCompare(b.userName || '');
      }
      if (facultyReportSortBy === 'name_desc') {
        return (b.userName || '').localeCompare(a.userName || '');
      }
      if (facultyReportSortBy === 'status') {
        return Number(Boolean(a.isApproved)) - Number(Boolean(b.isApproved));
      }
      return (b.date?.seconds || 0) - (a.date?.seconds || 0);
    });
    return sorted;
  }, [facultyAttendance, facultyReportSortBy]);

  useEffect(() => {
    if (facultyAssignedSubject && facultyAssignedSubject !== 'ALL') {
      setSelectedSubject(facultyAssignedSubject);
    } else {
      setSelectedSubject('ALL');
    }
  }, [facultyAssignedSubject, selectedBatch]);

  const getBatchGrade = (batch: any) => {
    if (batch.grade) return batch.grade;
    const match = `${batch.name} ${batch.tag || ''}`.match(/\b(XII|XI|X)\b/i);
    return match ? match[0].toUpperCase() : null;
  };

  const parseDateToComparable = (dateStr: string) => new Date(dateStr).getTime();

  const isDateInRange = (dateSeconds: number) => {
    if (reportDateRange === 'all') return true;
    
    const d = new Date(dateSeconds * 1000);
    d.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (reportDateRange === 'day') {
      const selected = new Date(reportDay);
      selected.setHours(0, 0, 0, 0);
      return d.getTime() === selected.getTime();
    }
    if (reportDateRange === 'weekly') {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return d.getTime() >= startOfWeek.getTime() && d.getTime() <= endOfWeek.getTime();
    }
    if (reportDateRange === 'monthly') {
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }
    if (reportDateRange === 'yearly') {
      return d.getFullYear() === today.getFullYear();
    }
    if (reportDateRange === 'range') {
      const from = new Date(reportFromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(reportToDate);
      to.setHours(23, 59, 59, 999);
      return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
    }
    return true; // fallback
  };

  const batchWiseReport = React.useMemo(() => {
    if (!isAdmin) return {};
    const report: Record<string, {
      batchName: string;
      subject: string;
      totalClasses: number;
      dates: Record<string, Record<string, { present: number; absent: number; }>>;
      students: Record<string, { name: string; email: string; whatsapp: string; present: number; absent: number; }>;
    }> = {};

    studentAttendance.forEach(a => {
       if (!a.date || !isDateInRange(a.date.seconds)) return;
       
       const batchId = a.batchId;
       const subject = a.subject || 'Various Subjects';
       if (!batchId) return;
       const reportKey = `${batchId}_${subject}`;
       if (!report[reportKey]) {
          report[reportKey] = { batchName: a.batchName || 'Unknown Batch', subject: subject, totalClasses: 0, dates: {}, students: {} };
       }
       report[reportKey].totalClasses++;
       
       const dateStr = new Date(a.date.seconds * 1000).toISOString().split('T')[0];
       if (!report[reportKey].dates[dateStr]) report[reportKey].dates[dateStr] = {};

       if (a.records) {
          Object.entries(a.records).forEach(([studentId, status]) => {
             if (!report[reportKey].students[studentId]) {
                const sData = allEnrollments.find(e => e.id === studentId);
                const exData = a.extraStudentMeta?.[studentId];
                report[reportKey].students[studentId] = {
                   name: sData ? sData.name : (exData ? exData.name : 'Unknown Student'),
                   email: sData ? sData.email : '',
                   whatsapp: sData ? sData.whatsapp : (exData ? (exData.whatsapp || '') : ''),
                   present: 0,
                   absent: 0
                };
             }
             if (!report[reportKey].dates[dateStr][studentId]) {
                 report[reportKey].dates[dateStr][studentId] = { present: 0, absent: 0 };
             }
             if (status === 'present') {
                report[reportKey].students[studentId].present++;
                report[reportKey].dates[dateStr][studentId].present++;
             } else if (status === 'absent') {
                report[reportKey].students[studentId].absent++;
                report[reportKey].dates[dateStr][studentId].absent++;
             }
          });
       }
    });

    // Ensure all registered students show up in report even if they miss this range
    allEnrollments.filter(e => e.feeStatus !== 'Pending').forEach(student => {
       const studentBatches = batches.filter(b => {
          const bGrade = getBatchGrade(b);
          if (student.batchId) return student.batchId === b.id;
          if (bGrade && student.grade === bGrade) return true;
          return false;
       });

       studentBatches.forEach(b => {
          const subjectsToInject = student.subjects && student.subjects.length > 0 ? student.subjects : ['Various Subjects'];
          subjectsToInject.forEach((sub: string) => {
             const reportKey = `${b.id}_${sub}`;
             if (!report[reportKey]) return; // only inject if class was held in selected range
             if (!report[reportKey].students[student.id]) {
                report[reportKey].students[student.id] = {
                   name: student.name || 'Unknown',
                   email: student.email || '',
                   whatsapp: student.whatsapp || '',
                   present: 0,
                   absent: 0
                };
             }
          });
       });
    });

    return report;
  }, [studentAttendance, allEnrollments, batches, isAdmin, reportDateRange]);

  const totalPresentThisMonth = React.useMemo(() => {
     let count = 0;
     const today = new Date();
     studentAttendance.forEach(a => {
        if (!a.date) return;
        const d = new Date(a.date.seconds * 1000);
        if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() && a.records) {
           Object.values(a.records).forEach(status => {
              if (status === 'present') count++;
           });
        }
     });
     return count;
  }, [studentAttendance]);

  useEffect(() => {
    const unsubBatches = firestoreService.listenToCollection('batches', (data) => {
      const filteredBatches = (isFaculty && !isAdmin) 
        ? data.filter(b => facultyBatches.some(fb => fb.batchId === b.id))
        : data;
      
      setBatches(filteredBatches);
      
      if (filteredBatches.length > 0 && !selectedBatch) {
        setSelectedBatch(filteredBatches[0]);
      }
      setLoading(false);
    });

    let unsubFacultyAttendance = () => {};
    if (isAdmin) {
      unsubFacultyAttendance = firestoreService.listenToCollection('faculty_attendance', (data) => {
        setFacultyAttendance(data.sort((a, b) => b.date?.seconds - a.date?.seconds));
      });
    } else if (isFaculty) {
      const q = query(collection(db, 'faculty_attendance'), where('userId', '==', user.uid));
      unsubFacultyAttendance = onSnapshot(q, (snapshot) => {
         const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         setFacultyAttendance(data.sort((a: any, b: any) => b.date?.seconds - a.date?.seconds));
      }, (err) => console.warn(err));
    }

    let unsubStudentAttendance = () => {};
    let unsubEnrollments = () => {};
    if (isAdmin || isFaculty) {
      unsubStudentAttendance = firestoreService.listenToCollection('attendance', (data) => {
        setStudentAttendance(data.sort((a, b) => b.date?.seconds - a.date?.seconds));
      });
    }
    if (isAdmin) {
      unsubEnrollments = firestoreService.listenToCollection('enrollments', (data) => {
        setAllEnrollments(data);
      });
      const fetchAllFaculty = async () => {
         try {
           const [snap1, snap2] = await Promise.all([
             getDocs(query(collection(db, 'users'), where('roles', 'array-contains', 'faculty'))),
             getDocs(query(collection(db, 'users'), where('role', '==', 'faculty')))
           ]);
           const allUsers = new Map();
           snap1.docs.forEach(doc => allUsers.set(doc.id, { id: doc.id, ...doc.data() }));
           snap2.docs.forEach(doc => allUsers.set(doc.id, { id: doc.id, ...doc.data() }));
           setFacultyUsers(Array.from(allUsers.values()));
         } catch (err) {
           console.error("Error fetching faculty users:", err);
         }
      };
      fetchAllFaculty();
    }

    return () => {
      unsubBatches();
      unsubFacultyAttendance();
      unsubStudentAttendance();
      unsubEnrollments();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (selectedBatch) {
      const fetchStudents = async () => {
        const batchGrade = getBatchGrade(selectedBatch);
        let q;
        if (batchGrade) {
           q = query(collection(db, 'enrollments'), where('grade', '==', batchGrade));
        } else {
           q = query(collection(db, 'enrollments'));
        }
        
        const snap = await getDocs(q);
        
        let fetchedStudents = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        // Filter out students not tied to this batch
        fetchedStudents = fetchedStudents.filter((s: any) => {
          if (s.batchId) return s.batchId === selectedBatch.id;
          if (batchGrade && s.grade === batchGrade) return true;
          return false;
        });

        // Fetch students whose explicit batchId matches, but may have a different grade
        if (batchGrade) {
           const explicitQ = query(collection(db, 'enrollments'), where('batchId', '==', selectedBatch.id));
           const explicitSnap = await getDocs(explicitQ);
           explicitSnap.docs.forEach(doc => {
              if (!fetchedStudents.some(s => s.id === doc.id)) {
                 fetchedStudents.push({ id: doc.id, ...doc.data() });
              }
           });
        }

        setStudents(fetchedStudents);
      };
      fetchStudents();
    }
  }, [selectedBatch]);

  const availableSubjects = React.useMemo(() => {
    if (facultyAssignedSubject && facultyAssignedSubject !== 'ALL') {
      return [facultyAssignedSubject];
    }
    const subs = new Set<string>();
    students.forEach((s: any) => {
      (s.subjects || []).forEach((sub: string) => subs.add(sub));
    });
    return Array.from(subs).sort();
  }, [students, facultyAssignedSubject]);

  // Mini calendar logic
  const recentDays = Array.from({length: 5}, (_, i) => {
    const d = new Date(kolkataNow);
    d.setDate(d.getDate() - (4 - i));
    return d.toISOString().split('T')[0];
  });
  
  const isDateCompleted = (dateStr: string) => {
    if (!selectedBatch) return false;
    return studentAttendance.some(a => 
      a.batchId === selectedBatch.id && 
      (selectedSubject === 'ALL' || a.subject === selectedSubject) && 
      a.date && new Date(a.date.seconds * 1000).toISOString().split('T')[0] === dateStr
    );
  };

  const visibleStudents = React.useMemo(() => {
    let filtered = students;
    if (selectedSubject !== 'ALL') {
      filtered = students.filter((s: any) => s.subjects && s.subjects.includes(selectedSubject));
    }
    const extra = Object.entries(extraStudentMeta).map(([id, meta]) => ({
       id,
       name: meta.name,
       feeStatus: 'Offline Extra',
       grade: selectedBatch?.name?.match(/\b(XII|XI|X)\b/i)?.[0] || 'N/A',
       batchName: selectedBatch?.name || '',
       subjects: [selectedSubject]
    }));
    return [...filtered, ...extra];
  }, [students, selectedSubject, extraStudentMeta, selectedBatch]);

  // Sync previous logs based on date
  useEffect(() => {
    let existingRecords: Record<string, 'present' | 'absent'> | null = null;
    let existingMeta: Record<string, {name: string; whatsapp?: string}> = {};
    
    if (selectedBatch && studentAttendance.length > 0) {
      const existingDoc = studentAttendance.find(a => 
        a.batchId === selectedBatch.id && 
        (selectedSubject === 'ALL' || a.subject === selectedSubject) && 
        a.date && new Date(a.date.seconds * 1000).toISOString().split('T')[0] === attendanceDate
      );
      if (existingDoc && existingDoc.records) {
        existingRecords = existingDoc.records;
      }
      if (existingDoc && existingDoc.extraStudentMeta) {
        existingMeta = existingDoc.extraStudentMeta;
      }
    }

    setExtraStudentMeta(existingMeta);

    const defaultRecords: Record<string, 'present' | 'absent'> = {};
    visibleStudents.forEach((student: any) => {
      // Respect previously saved records from db if they exist for this specific date
      // Also respect existing records for newly added extra students in this session
      if (existingRecords && existingRecords[student.id]) {
        defaultRecords[student.id] = existingRecords[student.id];
      } else {
        defaultRecords[student.id] = 'present';
      }
    });

    Object.keys(existingMeta).forEach(id => {
       defaultRecords[id] = existingRecords?.[id] || 'present';
    });

    setAttendanceRecords(defaultRecords);
  }, [attendanceDate, selectedBatch, selectedSubject, studentAttendance, students]); // Do not include visibleStudents to avoid loop

  const currentDayRecord = React.useMemo(() => {
    if (!selectedBatch) return null;
    return studentAttendance.find(a => 
      a.batchId === selectedBatch.id && 
      (selectedSubject === 'ALL' || a.subject === selectedSubject) && 
      a.date && new Date(a.date.seconds * 1000).toISOString().split('T')[0] === attendanceDate
    );
  }, [selectedBatch, selectedSubject, attendanceDate, studentAttendance]);

  const [studentAttendanceData, setStudentAttendanceData] = useState<any[]>([]); // To fix duplicate naming possibly, but let's just keep as is

  const handleDeleteAttendance = async () => {
    if (!currentDayRecord) return;
    if (window.confirm('Are you sure you want to completely delete the attendance record for this day?')) {
      const toastId = toast.loading('Deleting attendance...');
      try {
        await firestoreService.deleteItem('attendance', currentDayRecord.id);
        toast.success('Attendance deleted successfully!', { id: toastId });
        setAttendanceRecords({});
        setExtraStudentMeta({});
      } catch (err) {
        toast.error('Failed to delete attendance', { id: toastId });
      }
    }
  };

  const handleMarkAttendance = async () => {
    if (!selectedBatch) return;
    const toastId = toast.loading('Saving attendance...');
    try {
      const existingDoc = currentDayRecord;

      const dayString = new Date(attendanceDate).toLocaleDateString('en-US', { weekday: 'long' });

      const record = {
        batchId: selectedBatch.id,
        batchName: selectedBatch.name,
        subject: selectedSubject,
        date: Timestamp.fromDate(new Date(attendanceDate)),
        day: dayString,
        records: attendanceRecords,
        extraStudentMeta,
        markedBy: user.email,
        markedAt: serverTimestamp(),
        timeMarkedAt: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
      };

      if (existingDoc) {
        await updateDoc(doc(db, 'attendance', existingDoc.id), record);
      } else {
        await addDoc(collection(db, 'attendance'), record);
      }
      
      toast.success('Attendance saved successfully!', { id: toastId });
      
      const presentCount = Object.values(attendanceRecords).filter(v => v === 'present').length;
      setSubmissionDetails({
         batchName: selectedBatch.name,
         subject: selectedSubject,
         date: attendanceDate,
         presentCount,
         totalCount: visibleStudents.length
      });
      setShowSubmissionModal(true);
    } catch (err) {
      toast.error('Failed to save attendance', { id: toastId });
    }
  };

  const markFacultyAttendance = async () => {
    const toastId = toast.loading('Marking present...');
    try {
      if (facultyMarkClass === 'ALL' && facultyBatches?.length > 0) {
        toast.error('Please select a Class / Batch for this session', { id: toastId });
        return;
      }
      
      const existing = facultyAttendance.find(a => a.userId === user.uid && a.dateStr === facultyAttendanceDate && a.className === facultyMarkClass);
      if (existing) {
        toast.error(`Attendance already marked for ${facultyMarkClass} on this date`, { id: toastId });
        return;
      }

      const dayString = new Date(facultyAttendanceDate).toLocaleDateString('en-US', { weekday: 'long' });

      await addDoc(collection(db, 'faculty_attendance'), {
        userId: user.uid,
        userName: user.displayName || user.email,
        userEmail: user.email,
        date: serverTimestamp(),
        dateStr: facultyAttendanceDate,
        day: dayString,
        status: 'present',
        isApproved: true,
        className: facultyMarkClass,
        subject: facultyMarkSubject === 'ALL' ? (facultyAssignedSubject || '') : facultyMarkSubject,
        timeMarkedAt: facultyAttendanceTime || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        editHistory: []
      });
      toast.success('Attendance recorded (Present)', { id: toastId });
    } catch (err) {
      toast.error('Failed to mark attendance', { id: toastId });
    }
  };

  const allFacultyList = React.useMemo(() => {
    let combined: any[] = [];
    
    // Process facultyBatches so they have actual user names
    facultyBatches.forEach(fb => {
       const user = facultyUsers.find(u => u.id === fb.userId);
       if (user) {
         combined.push({
            ...fb,
            realId: fb.id,
            userName: user.name || user.email || 'Unknown Faculty',
            email: user.email || fb.userEmail,
         });
       }
    });

    facultyAttendance.forEach(a => {
       if (!combined.some(fb => fb.userId === a.userId && fb.batchName === a.className && fb.subject === a.subject)) {
          const user = facultyUsers.find(u => u.id === a.userId);
          if (user) {
            combined.push({
               userId: a.userId,
               userName: user.name || user.email || a.userName || 'Unknown Faculty',
               email: user.email || a.userEmail,
               batchName: a.className,
               subject: a.subject
            });
          }
       }
    });
    // Add any faculty that hasn't been assigned to anything yet, but ONLY if we don't have filters activated.
    // If we just want them to appear in the general list:
    facultyUsers.forEach(fu => {
       if (!combined.some(fb => fb.userId === fu.id)) {
          combined.push({
             userId: fu.id,
             userName: fu.name || fu.email || 'Unknown Faculty',
             email: fu.email,
             batchName: 'ALL',
             subject: 'ALL'
          });
       }
    });

    return combined;
  }, [facultyBatches, facultyAttendance, facultyUsers]);

  const visibleFacultyAdmin = React.useMemo(() => {
    let filtered = allFacultyList.filter(fb => {
      // Allow 'ALL' mappings to show up if no specific batch is selected, or if we want to show all faculty
      // But we will handle injected combos below.
      if (adminFacultyBatch !== 'ALL' && fb.batchName !== 'ALL' && fb.batchName !== adminFacultyBatch) return false;
      if (adminFacultySubject !== 'ALL' && fb.subject !== 'ALL' && fb.subject !== adminFacultySubject) return false;
      if (adminFacultyMember !== 'ALL' && fb.userId !== adminFacultyMember) return false;
      return true;
    });
    
    // Explicit injection for any combo of batch/subject when a specific member is selected
    if (adminFacultyMember !== 'ALL') {
       const user = facultyUsers.find(u => u.id === adminFacultyMember);
       if (user) {
          filtered.push({
             userId: user.id,
             userName: user.name || user.email,
             email: user.email,
             batchName: adminFacultyBatch !== 'ALL' ? adminFacultyBatch : 'Custom Batch',
             subject: adminFacultySubject !== 'ALL' ? adminFacultySubject : 'Custom Subject'
          });
       }
    }

    const uniqueCombos = new Map();
    filtered.forEach(fb => {
       const key = `${fb.userId}_${fb.batchName}_${fb.subject}`;
       if (!uniqueCombos.has(key)) {
         uniqueCombos.set(key, fb);
       }
    });

    return Array.from(uniqueCombos.values()).filter(fb => {
      // Final pass to clean up 'ALL' or 'Custom' masks if we have real batch filters
      if (adminFacultyBatch !== 'ALL' && fb.batchName !== adminFacultyBatch && fb.batchName === 'ALL') return false;
      if (adminFacultySubject !== 'ALL' && fb.subject !== adminFacultySubject && fb.subject === 'ALL') return false;
      return true;
    });
  }, [allFacultyList, adminFacultyBatch, adminFacultySubject, adminFacultyMember, facultyUsers]);

  const disapproveAttendance = async (id: string, reason: string) => {
    try {
      await updateDoc(doc(db, 'faculty_attendance', id), {
        status: 'absent',
        isApproved: false,
        disapprovalReason: reason,
        disapprovedAt: serverTimestamp(),
        disapprovedBy: user.email
      });
      toast.success('Attendance disapproved');
    } catch (err) {
      toast.error('Action failed');
    }
  };

  const approveAttendance = async (id: string) => {
    try {
      await updateDoc(doc(db, 'faculty_attendance', id), {
        status: 'present',
        isApproved: true,
        disapprovalReason: null
      });
      toast.success('Attendance approved');
    } catch (err) {
      toast.error('Failed to approve');
    }
  };

  const cleanOrphanRecords = async (userId: string, batchName: string, subject: string, realId?: string) => {
    try {
      if (!window.confirm('Are you sure you want to Clean Up? This will remove all historical attendance records for this assignment.')) return;
      
      const recordsToClean = facultyAttendance.filter(a => a.userId === userId && a.className === batchName && (a.subject === subject || subject === 'ALL' || a.subject === 'ALL'));
      for (const r of recordsToClean) {
        if (r.id) await firestoreService.deleteItem('faculty_attendance', r.id);
      }
      if (realId) {
        await firestoreService.deleteItem('batchFaculty', realId);
      }
      toast.success(`Removed assignment and cleaned ${recordsToClean.length} historical records.`);
    } catch (e) {
      console.error('Cleanup failed:', e);
      toast.error('Clean up failed');
    }
  };

  const deleteAttendance = async (id: string, type: 'student' | 'faculty' = 'student') => {
    try {
      if (!id) throw new Error('No record ID provided');
      await firestoreService.deleteItem(type === 'faculty' ? 'faculty_attendance' : 'attendance', id);
      toast.success('Attendance record deleted');
    } catch (err) {
      console.error('Delete attendance error:', err);
      toast.error('Failed to delete record');
    }
  };

  const adminMarkFaculty = async (uid: string, name: string, email: string, batchName: string, subject: string, status: string) => {
    const toastId = toast.loading('Updating record...');
    try {
      const existing = facultyAttendance.find(a => 
        a.userId === uid && 
        a.dateStr === adminFacultyDate && 
        a.className === batchName &&
        (a.subject === subject || a.subject === 'ALL')
      );

      const dayString = new Date(adminFacultyDate).toLocaleDateString('en-US', { weekday: 'long' });

      if (existing) {
        await updateDoc(doc(db, 'faculty_attendance', existing.id), {
          status: status,
          isApproved: status === 'present',
          disapprovalReason: status === 'absent' ? 'Marked absent by admin' : null,
          adminOverriddenBy: user.email,
          adminOverriddenAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'faculty_attendance'), {
          userId: uid,
          userName: name,
          userEmail: email,
          date: Timestamp.fromDate(new Date(`${adminFacultyDate}T00:00:00`)),
          dateStr: adminFacultyDate,
          day: dayString,
          status: status,
          isApproved: status === 'present',
          className: batchName,
          subject: subject,
          timeMarkedAt: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          editHistory: [],
          adminCreatedBy: user.email
        });
      }
      toast.success('Record updated successfully', { id: toastId });
    } catch (err) {
      toast.error('Failed to update record', { id: toastId });
    }
  };

  const adminEditFacultyTime = async (recordId: string, newTime: string) => {
    const toastId = toast.loading('Updating time...');
    try {
      await updateDoc(doc(db, 'faculty_attendance', recordId), {
        timeMarkedAt: newTime,
        editHistory: [
          ...(facultyAttendance.find(a => a.id === recordId)?.editHistory || []),
          { action: 'time_changed', newTime, at: new Date().toISOString(), by: user.email }
        ]
      });
      toast.success('Time updated successfully', { id: toastId });
      setEditingFacultyId(null);
    } catch (err) {
      toast.error('Failed to update time', { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 italic">
            <UserCheck className="text-[var(--primary)]" />
            ATTENDANCE SYSTEM
          </h2>
          <p className="text-sm opacity-60">Manage student and faculty presence</p>
        </div>
        
        <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5 overflow-x-auto custom-scrollbar-horizontal w-full">
          {(source === 'mybatch' || isAdmin) && (
            <button 
              onClick={() => setActiveTab('student')}
              className={`px-4 py-2 whitespace-nowrap rounded-xl text-xs font-bold transition-all ${activeTab === 'student' ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
            >
              {isAdmin ? 'Edit Student Logs' : 'Take Student Attendance'}
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('faculty_admin')}
              className={`px-4 py-2 whitespace-nowrap rounded-xl text-xs font-bold transition-all ${activeTab === 'faculty_admin' ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
            >
              Edit Faculty Logs
            </button>
          )}
          {(source === 'mybatch' || isAdmin) && (
            <button 
              onClick={() => setActiveTab('faculty')}
              className={`px-4 py-2 whitespace-nowrap rounded-xl text-xs font-bold transition-all ${activeTab === 'faculty' ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
              style={{
                /* Focus Mode Styling */
                
              }}
            >
              My Attendance
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 whitespace-nowrap rounded-xl text-xs font-bold transition-all ${activeTab === 'reports' ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
            >
              Master Attendance Reports
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'student' && (
          <motion.div 
            key="student"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-card p-4 space-y-2">
                <label className="text-[10px] font-black uppercase opacity-40">Select Batch</label>
                <select 
                  value={selectedBatch?.id}
                  onChange={(e) => setSelectedBatch(batches.find(b => b.id === e.target.value))}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold [&>option]:bg-gray-900"
                >
                  {batches.map((b, i) => <option key={`${b.id}-${i}`} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="glass-card p-4 space-y-2">
                <label className="text-[10px] font-black uppercase opacity-40">Select Subject</label>
                <select 
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  disabled={!!(facultyAssignedSubject && facultyAssignedSubject !== 'ALL')}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold [&>option]:bg-gray-900"
                >
                  <option value="ALL">All Subjects</option>
                  {availableSubjects.map((sub, i) => <option key={`sub-${i}`} value={sub}>{sub}</option>)}
                </select>
              </div>
              <div className="glass-card p-4 space-y-2">
                <label className="text-[10px] font-black uppercase opacity-40">Attendance Date</label>
                <input 
                  type="date" 
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold"
                />
                <div className="pt-2 flex justify-between gap-1">
                  {recentDays.map(d => {
                    const completed = isDateCompleted(d);
                    const isToday = d === todayDateStr;
                    const dateObj = new Date(d);
                    const dayString = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const isSelected = d === attendanceDate;
                    
                    return (
                      <button 
                        key={d} 
                        onClick={() => setAttendanceDate(d)}
                        className={`flex flex-col items-center p-1 rounded-lg border flex-1 transition-all ${
                          isSelected ? 'bg-white/20 border-white text-white' : 'border-transparent hover:bg-white/5 opacity-70'
                        }`}
                        title={`${d} ${completed ? '(Logged)' : '(Missing)'}`}
                      >
                        <span className="text-[8px] font-bold uppercase">{isToday ? 'TDY' : dayString.toUpperCase()}</span>
                        <div className={`w-2 h-2 rounded-full mt-1 ${completed ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="glass-card p-4 flex flex-col justify-center items-center relative">
                <div className="absolute top-2 left-4">
                  <div className="text-xl font-black">{visibleStudents.length}</div>
                  <div className="text-[10px] opacity-40 uppercase font-black tracking-wider">Tgt Students</div>
                </div>
                <div className="flex flex-col gap-2 w-full mt-4">
                  <button 
                    onClick={handleMarkAttendance}
                    className="w-full px-6 py-3 bg-green-500 text-white rounded-xl font-black text-xs shadow-lg shadow-green-500/20 hover:scale-105 transition-all"
                  >
                    {currentDayRecord ? 'UPDATE ALL' : 'SAVE ALL'}
                  </button>
                  {currentDayRecord && (
                    <button 
                      onClick={handleDeleteAttendance}
                      className="w-full px-6 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-black text-xs hover:bg-red-500 hover:text-white transition-all"
                    >
                      DELETE LOG ENTRY
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h4 className="font-bold flex items-center gap-2 text-sm italic">
                  <Users size={16} /> Mark Attendance Sheet
                </h4>
                <div className="flex gap-2">
                   <button
                     onClick={() => setShowAddStudentForm(!showAddStudentForm)}
                     className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 uppercase px-2 py-1 rounded"
                   >
                     + Offline Student
                   </button>
                   <button 
                    onClick={() => {
                      const all: any = {};
                      visibleStudents.forEach((s: any) => all[s.id] = 'present');
                      setAttendanceRecords(all);
                    }}
                    className="text-[10px] font-black opacity-50 hover:opacity-100 uppercase bg-white/5 px-2 py-1 rounded"
                   >
                     All Present
                   </button>
                   <button 
                    onClick={() => setAttendanceRecords({})}
                    className="text-[10px] font-black opacity-50 hover:opacity-100 uppercase bg-white/5 px-2 py-1 rounded"
                   >
                     Clear
                   </button>
                </div>
              </div>
              
              <AnimatePresence>
                {showAddStudentForm && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white/5 border-b border-white/5 p-4 overflow-hidden">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                      <div className="space-y-1 flex-1">
                        <label className="text-[10px] font-bold uppercase opacity-60">Student Name</label>
                        <input value={newStudentData.name} onChange={e => setNewStudentData({...newStudentData, name: e.target.value})} placeholder="E.g. John Doe" className="w-full p-2 bg-white/5 border border-white/10 rounded-lg outline-none focus:border-indigo-500 text-sm" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <label className="text-[10px] font-bold uppercase opacity-60">WhatsApp Num (optional)</label>
                        <input value={newStudentData.whatsapp} onChange={e => setNewStudentData({...newStudentData, whatsapp: e.target.value})} placeholder="10-digit number" className="w-full p-2 bg-white/5 border border-white/10 rounded-lg outline-none focus:border-indigo-500 text-sm" />
                      </div>
                      <button 
                        onClick={() => {
                          if (newStudentData.name.trim() === '') return toast.error('Enter a name');
                          const tempId = `offline_${Date.now()}`;
                          setExtraStudentMeta(prev => ({...prev, [tempId]: { name: newStudentData.name, whatsapp: newStudentData.whatsapp }}));
                          setAttendanceRecords(prev => ({...prev, [tempId]: 'present'}));
                          setNewStudentData({ name: '', whatsapp: '' });
                          setShowAddStudentForm(false);
                          toast.success('Offline student added to sheet!');
                        }}
                        className="px-6 py-2 bg-indigo-500 text-white font-bold rounded-lg hover:opacity-90 text-sm"
                      >
                        Add to Sheet
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 text-[10px] font-black uppercase opacity-40">
                      <tr>
                        <th className="p-4">Student</th>
                        <th className="p-4 text-center">Enrollment Status</th>
                        <th className="p-4">Batch Info</th>
                        <th className="p-4 text-center w-48">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {visibleStudents.map((student: any) => (
                      <tr key={student.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-sm">{student.name}</div>
                          <div className="text-[10px] opacity-40">{student.email}</div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${student.feeStatus === 'Paid' ? 'bg-green-500/20 text-green-500' : 'bg-amber-500/20 text-amber-500'}`}>
                            {student.feeStatus === 'Paid' ? 'Verified / Paid' : student.feeStatus || 'Pending'}
                          </span>
                        </td>
                        <td className="p-4 text-xs opacity-60">
                          {student.grade} • {student.batchName}
                          <div className="text-[9px] mt-1 text-indigo-400 font-bold">{(student.subjects || []).join(', ')}</div>
                        </td>
                        <td className="p-4">
                          <button 
                            onClick={() => {
                              const currentStatus = attendanceRecords[student.id] || 'present';
                              const newStatus = currentStatus === 'present' ? 'absent' : 'present';
                              setAttendanceRecords({...attendanceRecords, [student.id]: newStatus});
                            }}
                            className={`w-full py-2.5 rounded-xl border-2 transition-all duration-300 flex items-center justify-between px-4 group ${
                              (attendanceRecords[student.id] || 'present') === 'present' 
                                ? 'bg-green-500/10 border-green-500 text-green-500' 
                                : 'bg-red-500/10 border-red-500 text-red-500'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {(attendanceRecords[student.id] || 'present') === 'present' ? (
                                <UserCheck size={18} className="group-hover:scale-110 transition-transform" />
                              ) : (
                                <UserX size={18} className="group-hover:scale-110 transition-transform" />
                              )}
                              <span className="font-black text-xs uppercase tracking-widest">
                                {(attendanceRecords[student.id] || 'present') === 'present' ? 'PRESENT' : 'ABSENT'}
                              </span>
                            </div>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              (attendanceRecords[student.id] || 'present') === 'present' 
                                ? 'border-green-500 bg-green-500 text-white' 
                                : 'border-red-500'
                            }`}>
                              {(attendanceRecords[student.id] || 'present') === 'present' && <CheckCircle2 size={12} />}
                            </div>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {visibleStudents.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-sm opacity-50 italic">No students found for this selection.</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'faculty' && (
          <motion.div 
            key="faculty"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card p-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                  <Calendar size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-black italic uppercase">MARK FACULTY PRESENCE</h3>
                  <p className="text-sm opacity-60">Log your active session history</p>
                </div>
                
                <div className="w-full max-w-sm space-y-3 text-left my-4 bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="flex gap-2">
                    <div className="space-y-1 flex-1">
                      <label className="text-[10px] font-black opacity-50 uppercase">Session Date</label>
                      <input 
                        type="date" 
                        value={facultyAttendanceDate} 
                        readOnly
                        className="w-full p-2.5 bg-black/20 border border-white/10 text-white rounded-lg outline-none text-sm font-bold opacity-70 cursor-not-allowed" 
                      />
                    </div>
                    <div className="space-y-1 flex-1">
                      <label className="text-[10px] font-black opacity-50 uppercase">Session Time</label>
                      <input 
                        type="time" 
                        value={facultyAttendanceTime} 
                        readOnly
                        className="w-full p-2.5 bg-black/20 border border-white/10 text-white rounded-lg outline-none text-sm font-bold opacity-70 cursor-not-allowed" 
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="space-y-1 flex-1">
                      <label className="text-[10px] font-black opacity-50 uppercase">Class</label>
                      <select 
                        value={facultyMarkClass} 
                        onChange={e => setFacultyMarkClass(e.target.value)}
                        className="w-full p-2.5 bg-black/20 border border-white/10 text-white rounded-lg outline-none text-sm font-bold [&>option]:bg-gray-900"
                      >
                        <option value="ALL">Select Class</option>
                        {isAdmin ? batches.map((b, i) => (
                          <option key={`${b.id}-${i}`} value={b.name}>{b.name}</option>
                        )) : Array.from(new Set(facultyBatches.map(fb => fb.batchName))).map((bName, i) => (
                          <option key={`bn-${i}`} value={bName as string}>{bName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 flex-1">
                      <label className="text-[10px] font-black opacity-50 uppercase">Subject</label>
                      <select 
                        value={facultyMarkSubject} 
                        onChange={e => setFacultyMarkSubject(e.target.value)}
                        className="w-full p-2.5 bg-black/20 border border-white/10 text-white rounded-lg outline-none text-sm font-bold [&>option]:bg-gray-900"
                      >
                        <option value="ALL">Select Subject</option>
                        {isAdmin ? availableSubjects.map((s, i) => (
                          <option key={`s-${i}`} value={s}>{s}</option>
                        )) : Array.from(new Set(facultyBatches.filter(fb => facultyMarkClass === 'ALL' || fb.batchName === facultyMarkClass).map(fb => fb.subject))).map((s, i) => (
                          <option key={`fs-${i}`} value={s as string}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={markFacultyAttendance}
                  className="w-full max-w-xs py-4 bg-[var(--primary)] text-white rounded-2xl font-black italic tracking-widest shadow-xl shadow-[var(--primary)]/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  I AM PRESENT
                </button>
              </div>

              <div className="glass-card p-6 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-black opacity-40 uppercase tracking-widest mb-6">Attendance Stats</h4>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                        <div className="text-3xl font-black text-green-500">
                          {facultyAttendance.filter(a => a.userId === user.uid && a.isApproved).length}
                        </div>
                        <div className="text-[10px] font-bold opacity-60 uppercase">Working Days</div>
                     </div>
                     <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                        <div className="text-3xl font-black text-red-500">
                          {facultyAttendance.filter(a => a.userId === user.uid && !a.isApproved).length}
                        </div>
                        <div className="text-[10px] font-bold opacity-60 uppercase">Disallowed</div>
                     </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-white/5 pt-4">
                  <div className="text-[10px] font-black opacity-30 uppercase tracking-widest pl-1 mb-2">Current Month Visualizer</div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({length: new Date(kolkataNow.getFullYear(), kolkataNow.getMonth() + 1, 0).getDate()}, (_, i) => {
                       const d = i + 1;
                       const dateStr = `${kolkataNow.getFullYear()}-${String(kolkataNow.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                       const record = facultyAttendance.find(a => a.userId === user.uid && a.dateStr === dateStr);
                       let statusColor = 'bg-white/5 border border-white/10';
                       if (record) {
                          statusColor = record.isApproved ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]';
                       } else if (d < kolkataNow.getDate()) {
                          statusColor = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
                       } else if (d === kolkataNow.getDate()) {
                          statusColor = 'border-2 border-dashed border-white/20'; // Today
                       }
                       return <div key={d} className={`w-[18px] h-[18px] rounded-md ${statusColor}`} title={`${dateStr}: ${record ? (record.isApproved ? 'Present' : 'Rejected') : (d < kolkataNow.getDate() ? 'Absent' : 'Tracking')}`} />;
                    })}
                  </div>
                  <div className="flex gap-4 text-[8px] font-bold uppercase opacity-50 mt-3 pl-1">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-green-500 rounded-sm"></div> Present</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-amber-500 rounded-sm"></div> Absent</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> Rejected</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card overflow-hidden">
               <div className="p-4 border-b border-white/5 bg-white/5 font-bold italic">MY FULL ATTENDANCE LOG</div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-white/5 text-[10px] font-black uppercase opacity-40">
                     <tr>
                       <th className="p-4">Date</th>
                       <th className="p-4">Class & Subject</th>
                       <th className="p-4">Status</th>
                       <th className="p-4">Admin Check</th>
                       <th className="p-4">Note / Reason</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5 text-xs">
                      {facultyAttendance.filter(a => a.userId === user.uid).map(a => (
                        <tr key={a.id}>
                          <td className="p-4">
                            <div className="font-bold">{a.dateStr}</div>
                            {(a.adminCreatedBy || a.adminOverriddenBy) && (
                              <div className="inline-block mt-1 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 text-[8px] uppercase tracking-widest font-black rounded">
                                Edited by Admin
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="text-xs font-bold text-white/80">{a.className}</div>
                            <div className="text-[10px] text-[var(--primary)] uppercase mt-0.5">{a.subject}</div>
                          </td>
                          <td className="p-4">
                            {a.status === 'absent' ? (
                              <span className="text-red-500 font-black">ABSENT</span>
                            ) : (
                              <span className="text-green-500 font-black">PRESENT</span>
                            )}
                          </td>
                          <td className="p-4">
                            {a.isApproved ? (
                              <span className="flex items-center gap-1 text-green-500"><CheckCircle2 size={12}/> OK</span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-500"><XCircle size={12}/> DISAPPROVED</span>
                            )}
                          </td>
                          <td className="p-4 italic opacity-60">
                            {!a.isApproved ? a.disapprovalReason : (a.adminCreatedBy || a.adminOverriddenBy ? 'Admins override' : 'Valid Entry')}
                          </td>
                        </tr>
                      ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'faculty_admin' && isAdmin && (
          <motion.div 
            key="faculty_admin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-card p-4 space-y-2">
                <label className="text-[10px] font-black uppercase opacity-40">Filter Date</label>
                <input 
                  type="date" 
                  value={adminFacultyDate}
                  onChange={(e) => setAdminFacultyDate(e.target.value)}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold"
                />
              </div>
              <div className="glass-card p-4 space-y-2">
                <label className="text-[10px] font-black uppercase opacity-40">Filter Batch</label>
                <select 
                  value={adminFacultyBatch}
                  onChange={(e) => setAdminFacultyBatch(e.target.value)}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold [&>option]:bg-gray-900"
                >
                  <option value="ALL">All Batches</option>
                  {batches.map((b, i) => <option key={`b-${b.id}-${i}`} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div className="glass-card p-4 space-y-2">
                <label className="text-[10px] font-black uppercase opacity-40">Filter Subject</label>
                <select 
                  value={adminFacultySubject}
                  onChange={(e) => setAdminFacultySubject(e.target.value)}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold [&>option]:bg-gray-900"
                >
                  <option value="ALL">All Subjects</option>
                  {availableSubjects.map((sub, i) => <option key={`asub-${i}`} value={sub}>{sub}</option>)}
                </select>
              </div>
              <div className="glass-card p-4 space-y-2">
                <label className="text-[10px] font-black uppercase opacity-40">Filter Faculty</label>
                <select 
                  value={adminFacultyMember}
                  onChange={(e) => setAdminFacultyMember(e.target.value)}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold [&>option]:bg-gray-900"
                >
                  <option value="ALL">All Faculty</option>
                  {facultyUsers.map((uid, i) => (
                    <option key={`uid-${i}`} value={uid.id}>{uid.name || uid.email || uid.id}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-white/5 flex justify-between items-center">
                <h4 className="font-bold flex items-center gap-2 text-sm italic">
                  <UserCheck size={16} /> Faculty Attendance Logs
                </h4>
              </div>
              
              <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-[10px] font-black uppercase opacity-40">
                    <tr>
                      <th className="p-4">Faculty</th>
                      <th className="p-4">Batch & Subject</th>
                      <th className="p-4">Time Logged</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Array.from(new Set(visibleFacultyAdmin.map(f => f.userId))).map(uid => {
                       const userFbs = visibleFacultyAdmin.filter(f => f.userId === uid);
                       if (userFbs.length === 0) return null;
                       const primaryFb = userFbs[0];
                       
                       const userRecords = facultyAttendance.filter(a => 
                         a.userId === uid && 
                         a.dateStr === adminFacultyDate
                       );

                       return (
                         <tr key={`uid-${uid}`} className="hover:bg-white/5 border-b border-white/5">
                           <td className="p-4 font-bold text-sm align-top border-r border-white/5">
                             {primaryFb.userName || primaryFb.email || 'Unknown Faculty'}
                           </td>
                           <td className="p-4 align-top" colSpan={4}>
                             <div className="space-y-3 w-full">
                               {userFbs.map((fb, idx) => {
                                 const record = userRecords.find(r => r.className === fb.batchName && (r.subject === fb.subject || r.subject === 'ALL'));
                                 return (
                                   <div key={`${fb.batchName}-${fb.subject}-${idx}`} className="flex flex-col md:flex-row md:items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 gap-3">
                                      <div className="flex flex-col gap-1 w-full md:w-1/3">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-white/80">{fb.batchName}</span>
                                          {record && (record.adminCreatedBy || record.adminOverriddenBy) && (
                                            <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 text-[8px] uppercase tracking-widest font-black rounded">
                                              Edited Admin
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[10px] text-[var(--primary)] uppercase">{fb.subject}</span>
                                      </div>
                                      <div className="text-xs opacity-80 w-full md:w-1/4 flex items-center justify-between md:justify-start">
                                         {editingFacultyId === record?.id && record ? (
                                           <div className="flex flex-col gap-2">
                                             <input type="time" value={editingFacultyTime} onChange={e => setEditingFacultyTime(e.target.value)} className="bg-black/50 p-1 border border-white/20 rounded outline-none w-24" />
                                             <div className="flex gap-2">
                                               <button onClick={() => adminEditFacultyTime(record.id, editingFacultyTime)} className="text-green-500 hover:text-green-400 font-bold">Save</button>
                                               <button onClick={() => setEditingFacultyId(null)} className="text-white/50 hover:text-white/80">Cancel</button>
                                             </div>
                                           </div>
                                         ) : (
                                           <div className="flex flex-col">
                                              <span className="text-[10px] uppercase opacity-50 mb-1">Time Logged</span>
                                              <span className={`${record ? 'text-green-400 font-bold' : ''}`}>{record ? record.timeMarkedAt || 'Logged' : 'Not Logged'}</span>
                                           </div>
                                         )}
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end w-full md:w-auto">
                                       <button 
                                         onClick={() => adminMarkFaculty(fb.userId, fb.userName, fb.email || '', fb.batchName, fb.subject, 'present')}
                                         className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${record && record.isApproved && record.status === 'present' ? 'bg-green-500 text-white' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'}`}
                                       >
                                         <CheckCircle2 size={14} className="inline mr-1"/> Present
                                       </button>
                                       <button 
                                         onClick={() => adminMarkFaculty(fb.userId, fb.userName, fb.email || '', fb.batchName, fb.subject, 'absent')}
                                         className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${record && record.status === 'absent' ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
                                       >
                                         <XCircle size={14} className="inline mr-1"/> Absent
                                       </button>
                                       {record ? (
                                         <>
                                           <button 
                                             onClick={() => { setEditingFacultyId(record.id); setEditingFacultyTime(record.timeMarkedAt || ''); }}
                                             className="px-2 py-1.5 rounded-lg text-xs font-bold transition-all bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
                                           >
                                             <Edit2 size={14} className="inline" />
                                           </button>
                                           <button 
                                             onClick={() => {
                                               if (window.confirm('Are you sure you want to delete this attendance record?')) {
                                                 deleteAttendance(record.id, 'faculty');
                                               }
                                             }}
                                             className="px-2 py-1.5 rounded-lg text-xs font-bold transition-all bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                           >
                                             <Trash2 size={14} className="inline" />
                                           </button>
                                         </>
                                       ) : (
                                         <button 
                                           onClick={() => cleanOrphanRecords(fb.userId, fb.batchName, fb.subject, fb.realId)}
                                           className="px-2 py-1.5 rounded-lg text-xs font-bold transition-all bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                           title="Clean associated isolated records"
                                         >
                                           <Trash2 size={14} className="inline" />
                                         </button>
                                       )}
                                      </div>
                                   </div>
                                 )
                               })}
                             </div>
                           </td>
                         </tr>
                       );
                    })}
                    {visibleFacultyAdmin.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm opacity-50 italic">No faculty found for this selection.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'reports' && isAdmin && (
          <motion.div 
            key="reports"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5 w-full sm:w-auto">
                <button 
                  onClick={() => setReportTab('student')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-none ${reportTab === 'student' ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
                >
                  Student Reports
                </button>
                <button 
                  onClick={() => setReportTab('faculty')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-none ${reportTab === 'faculty' ? 'bg-[var(--primary)] text-white' : 'text-gray-500 hover:text-white'}`}
                >
                  Faculty Reports
                </button>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => setShowConfig(!showConfig)}
                  className="px-4 py-2 bg-indigo-500/10 text-indigo-500 rounded-xl text-xs font-bold transition-all hover:bg-indigo-500 hover:text-white flex items-center justify-center gap-2 flex-1 sm:flex-none"
                >
                  <MessageSquare size={14} /> SMS / WA API
                </button>
                <button 
                  onClick={() => {
                    if (reportTab === 'student') {
                      let csv = 'Batch,Subject,Student Name,Email,Total Classes,Present,Absent,Percentage\n';
                      let hasData = false;
                      Object.values(batchWiseReport).forEach(batch => {
                        Object.entries(batch.students).forEach(([id, s]) => {
                          hasData = true;
                          const total = s.present + s.absent;
                          const pct = total > 0 ? Math.round((s.present/total)*100) : 0;
                          csv += `"${batch.batchName}","${batch.subject}","${s.name}","${s.email}",${batch.totalClasses},${s.present},${s.absent},${pct}%\n`;
                        });
                      });
                      if (!hasData) return toast.error('No data to export');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `student_attendance_${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                    } else {
                      const dataToExport = sortedFacultyAttendance;
                      if (dataToExport.length === 0) return toast.error('No data to export');
                      let csv = 'Date,Faculty Name,Email,Status,Disapproval Reason\n' + dataToExport.map(r => `${r.dateStr},${r.userName},${r.userEmail},${r.isApproved ? 'Approved' : 'Disapproved'},${r.disapprovalReason || ''}`).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `faculty_attendance_${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                    }
                  }}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-xs font-bold hover:scale-105 transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none"
                >
                  <Download size={14} /> Download CSV
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showConfig && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="glass-card p-6 border-l-4 border-indigo-500 space-y-4">
                    <h3 className="font-bold flex items-center gap-2 text-indigo-500"><MessageSquare size={16} /> Automated Messaging Configuration</h3>
                    <p className="text-xs opacity-70">Configure logic to automatically send SMS or WhatsApp templates sequentially when attendance is logged.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-40">Provider</label>
                        <select className="w-full p-3 rounded-xl bg-white/5 border border-white/10 outline-none text-sm [&>option]:bg-gray-900" value={messagingConfig.provider} onChange={e => setMessagingConfig({...messagingConfig, provider: e.target.value})}>
                          <option value="whatsapp">WhatsApp (Business API)</option>
                          <option value="twilio">Twilio SMS</option>
                          <option value="msg91">MSG91</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-40">API Key / Token</label>
                        <input type="password" placeholder="Enter API Key" className="w-full p-3 rounded-xl bg-white/5 border border-white/10 outline-none text-sm focus:border-indigo-500" value={messagingConfig.apiKey} onChange={e => setMessagingConfig({...messagingConfig, apiKey: e.target.value})} />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-40">Message Template</label>
                        <textarea rows={2} className="w-full p-3 rounded-xl bg-white/5 border border-white/10 outline-none text-sm focus:border-indigo-500" value={messagingConfig.template} onChange={e => setMessagingConfig({...messagingConfig, template: e.target.value})} />
                        <div className="text-[10px] opacity-50 font-mono">Available variables: {'{name}, {status}, {date}, {batch}'}</div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => { setShowConfig(false); toast.success('Messaging config saved locally (Preview)'); }} className="px-6 py-2 bg-indigo-500 text-white rounded-xl font-bold text-xs">Save Configuration</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {reportTab === 'faculty' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="glass-card p-6 border-l-4 border-emerald-500">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-black opacity-50 uppercase tracking-widest">Today's Present Faculties</h4>
                        {todayFaculty.length > 5 && (
                          <button
                            onClick={() => setShowTodayFacultyExpanded(prev => !prev)}
                            className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 flex items-center gap-1"
                          >
                            {showTodayFacultyExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {showTodayFacultyExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        )}
                      </div>
                      <div className="text-4xl font-black text-emerald-500 mb-2">{todayFaculty.length}</div>
                      <div className="space-y-2">
                        {(showTodayFacultyExpanded ? todayFaculty : todayFaculty.slice(0, 5)).map(f => (
                           <div key={`today-${f.id}`} className="text-xs flex justify-between bg-white/5 p-2 rounded">
                             <span className="font-bold">{f.userName}</span>
                             <span className="opacity-50">{new Date(f.date?.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           </div>
                        ))}
                        {todayFaculty.length === 0 && <p className="text-xs opacity-40 italic">Nobody signed in yet.</p>}
                      </div>
                   </div>
                   <div className="glass-card p-6 border-l-4 border-blue-500">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-black opacity-50 uppercase tracking-widest">Yesterday's Present Faculties</h4>
                        {yesterdayFaculty.length > 5 && (
                          <button
                            onClick={() => setShowYesterdayFacultyExpanded(prev => !prev)}
                            className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center gap-1"
                          >
                            {showYesterdayFacultyExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {showYesterdayFacultyExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        )}
                      </div>
                      <div className="text-4xl font-black text-blue-500 mb-2">{yesterdayFaculty.length}</div>
                      <div className="space-y-2">
                        {(showYesterdayFacultyExpanded ? yesterdayFaculty : yesterdayFaculty.slice(0, 5)).map(f => (
                           <div key={`yest-${f.id}`} className="text-xs flex justify-between bg-white/5 p-2 rounded">
                             <span className="font-bold">{f.userName}</span>
                             <span className="opacity-50">{new Date(f.date?.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           </div>
                        ))}
                        {yesterdayFaculty.length === 0 && <p className="text-xs opacity-40 italic">Nobody signed in.</p>}
                      </div>
                   </div>
                </div>

                <div className="glass-card p-6 border-l-4 border-amber-500">
                 <h3 className="text-lg font-bold flex items-center gap-2 text-amber-500 mb-4">
                   <AlertCircle size={20} /> Faculty Attendance Moderation
                 </h3>
                 <div className="mb-4 flex justify-end">
                   <select
                     value={facultyReportSortBy}
                     onChange={(e) => setFacultyReportSortBy(e.target.value as any)}
                     className="p-2 bg-white/5 border border-white/10 rounded-xl outline-none text-xs font-bold [&>option]:bg-gray-900"
                   >
                     <option value="date_desc">Sort: Date (Newest)</option>
                     <option value="date_asc">Sort: Date (Oldest)</option>
                     <option value="name_asc">Sort: Name (A-Z)</option>
                     <option value="name_desc">Sort: Name (Z-A)</option>
                     <option value="status">Sort: Status</option>
                   </select>
                 </div>
                 <div className="overflow-x-auto">
                   <table className="w-full text-left">
                     <thead className="text-[10px] font-black uppercase opacity-40">
                       <tr>
                         <th className="p-4">Faculty</th>
                         <th className="p-4">Date</th>
                         <th className="p-4">Current Status</th>
                         <th className="p-4 text-right">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5 text-sm">
                        {sortedFacultyAttendance.map(a => (
                          <tr key={a.id} className="hover:bg-white/5">
                            <td className="p-4">
                              <div className="font-bold">{a.userName}</div>
                              <div className="text-[10px] opacity-40">{a.userEmail}</div>
                            </td>
                            <td className="p-4 font-mono">{a.dateStr}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${a.isApproved ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                {a.isApproved ? 'Approved' : 'Disapproved'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              {a.isApproved ? (
                                <button 
                                  onClick={() => {
                                    const reason = prompt('Enter reason for disapproval:');
                                    if (reason) disapproveAttendance(a.id, reason);
                                  }}
                                  className="px-3 py-1 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black hover:bg-red-500/20 transition-all mr-2"
                                >
                                  DISAPPROVE
                                </button>
                              ) : (
                                <button 
                                  onClick={() => approveAttendance(a.id)}
                                  className="px-3 py-1 bg-green-500/10 text-green-500 rounded-lg text-[10px] font-black hover:bg-green-500/20 transition-all mr-2"
                                >
                                  APPROVE
                                </button>
                              )}
                              <button 
                                onClick={() => {
                                  if(window.confirm('Delete this record entirely?')) {
                                     deleteAttendance(a.id, 'faculty');
                                  }
                                }}
                                className="px-3 py-1 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black hover:bg-red-500/20 transition-all"
                              >
                                DELETE
                              </button>
                            </td>
                          </tr>
                        ))}
                        {sortedFacultyAttendance.length === 0 && (
                          <tr><td colSpan={4} className="p-10 text-center opacity-40 italic">No attendance records found yet.</td></tr>
                        )}
                     </tbody>
                   </table>
                 </div>
               </div>
              </div>
            )}

             {reportTab === 'student' && (
              <div className="glass-card p-6 border-l-4 border-[var(--primary)] space-y-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                   <h3 className="text-lg font-bold flex items-center gap-2">
                     <Users size={20} /> Batch-Wise Student Attendance
                   </h3>
                   <div className="flex gap-2 items-center flex-wrap">
                     <span className="text-[10px] font-black uppercase text-green-500 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20 shadow-lg shadow-green-500/10">
                       🔥 {totalPresentThisMonth} ATTENDANCES THIS MONTH
                     </span>
                     <select 
                       value={reportDateRange}
                       onChange={(e) => setReportDateRange(e.target.value as any)}
                       className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/50 transition-all rounded-xl outline-none text-sm font-bold [&>option]:bg-gray-900"
                     >
                       <option value="day">Day Wise</option>
                       <option value="weekly">Weekly</option>
                       <option value="monthly">Monthly</option>
                       <option value="yearly">Yearly</option>
                       <option value="range">Between Dates</option>
                       <option value="all">All Time</option>
                     </select>
                     {reportDateRange === 'day' && (
                       <input
                         type="date"
                         value={reportDay}
                         onChange={(e) => setReportDay(e.target.value)}
                         className="p-2 bg-white/5 border border-white/10 rounded-xl outline-none text-sm font-bold"
                       />
                     )}
                     {reportDateRange === 'range' && (
                       <>
                         <input
                           type="date"
                           value={reportFromDate}
                           onChange={(e) => setReportFromDate(e.target.value)}
                           className="p-2 bg-white/5 border border-white/10 rounded-xl outline-none text-sm font-bold"
                         />
                         <input
                           type="date"
                           value={reportToDate}
                           onChange={(e) => setReportToDate(e.target.value)}
                           className="p-2 bg-white/5 border border-white/10 rounded-xl outline-none text-sm font-bold"
                         />
                       </>
                     )}
                     <select 
                       value={reportBatchFilter}
                       onChange={(e) => setReportBatchFilter(e.target.value)}
                       className="p-2 bg-white/5 border border-white/10 rounded-xl outline-none text-sm font-bold [&>option]:bg-gray-900"
                     >
                       <option value="ALL">All Batch Groups</option>
                       {Object.entries(batchWiseReport)
                         .sort((a, b) => a[1].batchName.localeCompare(b[1].batchName) || a[1].subject.localeCompare(b[1].subject))
                         .map(([key, data]) => (
                         <option key={key} value={key}>
                           {data.batchName} {data.subject !== 'ALL' && data.subject !== 'Various Subjects' ? `- ${data.subject}` : ''}
                         </option>
                       ))}
                     </select>
                   </div>
                 </div>
                 
                 <div className="space-y-8">
                   {Object.entries(batchWiseReport)
                     .filter(([key]) => reportBatchFilter === 'ALL' || key === reportBatchFilter)
                     .sort((a, b) => a[1].batchName.localeCompare(b[1].batchName) || a[1].subject.localeCompare(b[1].subject))
                     .map(([key, batchData]) => (
                     <div key={key} className="space-y-4">
                       <div className="flex justify-between items-end border-b border-white/10 pb-2">
                         <div>
                           <div className="flex items-center gap-3">
                             <h4 className="font-black text-[var(--primary)] text-lg">{batchData.batchName}</h4>
                             {batchData.subject !== 'ALL' && batchData.subject !== 'Various Subjects' && (
                               <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-xs font-black uppercase tracking-widest">{batchData.subject}</span>
                             )}
                           </div>
                           <div className="text-xs opacity-60 font-bold uppercase tracking-wider">{batchData.totalClasses} Total Classes Recorded</div>
                         </div>
                       </div>
                       <div className="overflow-x-auto">
                         <table className="w-full text-left">
                           <thead className="text-[10px] font-black uppercase opacity-40 bg-white/5">
                             <tr>
                               <th className="p-3">Student</th>
                               <th className="p-3 text-center">Present</th>
                               <th className="p-3 text-center">Absent</th>
                               <th className="p-3 text-center">Percentage</th>
                               <th className="p-3 text-center">Actions</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-white/5 text-sm">
                             {Object.entries(batchData.students).map(([studentId, s]) => {
                               const total = s.present + s.absent;
                               const percent = total > 0 ? Math.round((s.present / total) * 100) : 0;
                               return (
                                 <tr key={studentId} className="hover:bg-white/5 transition-colors">
                                   <td className="p-3">
                                     <div className="font-bold">{s.name}</div>
                                     <div className="text-[10px] opacity-40">{s.email || studentId}</div>
                                   </td>
                                   <td className="p-3 text-center font-black text-green-500">{s.present}</td>
                                   <td className="p-3 text-center font-black text-red-500">{s.absent}</td>
                                   <td className="p-3 text-center">
                                     <span className={`px-2 py-1 rounded-full text-[10px] font-black ${percent >= 75 ? 'bg-green-500/20 text-green-500' : percent >= 50 ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-500'}`}>
                                       {percent}%
                                     </span>
                                   </td>
                                   <td className="p-3 text-center">
                                     <a 
                                       href={`https://wa.me/${s.whatsapp}?text=${encodeURIComponent(messagingConfig.template.replace('{name}', s.name).replace('{status}', 'checked').replace('{date}', new Date().toLocaleDateString()).replace('{batch}', batchData.batchName))}`}
                                       target="_blank" rel="noopener noreferrer"
                                       className="inline-flex items-center justify-center p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-all"
                                       title="Message on WhatsApp"
                                     >
                                       <MessageSquare size={14} />
                                     </a>
                                   </td>
                                 </tr>
                               );
                             })}
                             {Object.keys(batchData.students).length === 0 && (
                               <tr><td colSpan={5} className="p-8 text-center opacity-40 italic">No students enrolled in this batch.</td></tr>
                             )}
                           </tbody>
                         </table>
                       </div>
                     </div>
                   ))}
                   
                   {Object.keys(batchWiseReport).length === 0 && (
                     <div className="p-10 text-center opacity-40 italic font-bold">No batches available.</div>
                   )}
                 </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSubmissionModal && submissionDetails && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-gray-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-sm w-full relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-black mb-1">Attendance Logged</h3>
                  <p className="text-sm opacity-60">Successfully saved to the cloud.</p>
                </div>
                
                <div className="w-full bg-white/5 rounded-xl p-4 space-y-2 text-left">
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-50 font-bold uppercase text-[10px]">Date</span>
                    <span className="font-bold">{submissionDetails.date}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-50 font-bold uppercase text-[10px]">Class</span>
                    <span className="font-bold">{submissionDetails.batchName}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-50 font-bold uppercase text-[10px]">Subject</span>
                    <span className="font-bold text-indigo-400">{submissionDetails.subject}</span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-white/10 flex justify-between items-center">
                    <span className="opacity-50 font-bold uppercase text-[10px]">Students Present</span>
                    <span className="font-black text-green-500 text-lg">{submissionDetails.presentCount} <span className="text-sm opacity-50 font-medium">/ {submissionDetails.totalCount}</span></span>
                  </div>
                </div>

                <button 
                  onClick={() => setShowSubmissionModal(false)}
                  className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-xl font-bold transition-all mt-4"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
