import mongoose from 'mongoose';
import fs from 'fs';

const MONGODB_URI = process.env.MONGODB_URI;
let useMongo = !!MONGODB_URI;

// Mongoose Schemas
const batchSchema = new mongoose.Schema({ name: String, tag: String, date: String, description: String, color: String, tagColor: String, timerEnabled: { type: Boolean, default: false }, targetDate: String });
const routineSchema = new mongoose.Schema({ time: String, mon: String, tue: String, wed: String, thu: String, fri: String, sat: String, sun: String });
const downloadSchema = new mongoose.Schema({ subject: String, icon: String, color: String, links: Array });
const feeSchema = new mongoose.Schema({ 
  subject: String, 
  originalPrice: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  finalPrice: { type: Number, default: 0 }
});
const enrollmentSchema = new mongoose.Schema({ 
  name: String, 
  email: String,
  grade: String, 
  whatsapp: String, 
  instagram: String, 
  subjects: Array, 
  feeStatus: { type: String, default: 'Pending' }, 
  totalFee: { type: Number, default: 1500 },
  discount: { type: Number, default: 0 },
  paymentHistory: { type: Array, default: [] },
  notes: String 
});
const chatUserSchema = new mongoose.Schema({ name: String, phone: String, photoUrl: String, bio: String, class: String, stream: String, school: String, address: String, role: { type: String, default: 'student' }, status: { type: String, default: 'active' }, warnings: { type: Number, default: 0 } });
const chatMessageSchema = new mongoose.Schema({ senderId: String, text: String, timestamp: Number, isDeleted: { type: Boolean, default: false }, isEdited: { type: Boolean, default: false }, replyTo: String });
const chatSettingsSchema = new mongoose.Schema({ roomId: String, name: String, description: String });
const pricingPlanSchema = new mongoose.Schema({ planType: String, subject: String, subjects: [String], grade: String, amount: Number, isActive: { type: Boolean, default: true } });
const pricingRuleSchema = new mongoose.Schema({ ruleType: String, priority: Number, config: Object, isActive: { type: Boolean, default: true } });
const studentFeeLedgerV2Schema = new mongoose.Schema({
  student_id: String,
  month: String,
  base_amount: Number,
  discount_amount: Number,
  net_payable: Number,
  paid_amount: Number,
  balance: Number,
  status: String,
  snapshot_json: Object,
  revision_of: String,
  createdAt: { type: Date, default: Date.now }
});
const feePaymentsV2Schema = new mongoose.Schema({
  student_id: String,
  ledger_id: String,
  amount: Number,
  idempotency_key: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
  source: String
});
const attendanceRecordSchema = new mongoose.Schema({
  faculty_id: String,
  subject: String,
  batch_id: String,
  date: String,
  status: String,
  edited_by: String,
  edit_reason: String,
  createdAt: { type: Date, default: Date.now }
});
const facultyContractSchema = new mongoose.Schema({
  faculty_id: String,
  model: String,
  config: Object,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const facultyEarningV2Schema = new mongoose.Schema({
  faculty_id: String,
  month: String,
  amount: Number,
  basis: String,
  snapshot: Object,
  createdAt: { type: Date, default: Date.now }
});
const auditLogSchema = new mongoose.Schema({
  actor_id: String,
  action: String,
  entity: String,
  entity_id: String,
  payload: Object,
  createdAt: { type: Date, default: Date.now }
});

let Batch: any, Routine: any, Download: any, Fee: any, Enrollment: any, ChatUser: any, ChatMessage: any, ChatSettings: any;
let PricingPlan: any, PricingRule: any, StudentFeeLedgerV2: any, FeePaymentV2: any, AttendanceRecord: any, FacultyContract: any, FacultyEarningV2: any, AuditLog: any;

const initModels = () => {
  Batch = mongoose.models.Batch || mongoose.model('Batch', batchSchema);
  Routine = mongoose.models.Routine || mongoose.model('Routine', routineSchema);
  Download = mongoose.models.Download || mongoose.model('Download', downloadSchema);
  Fee = mongoose.models.Fee || mongoose.model('Fee', feeSchema);
  Enrollment = mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);
  ChatUser = mongoose.models.ChatUser || mongoose.model('ChatUser', chatUserSchema);
  ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);
  ChatSettings = mongoose.models.ChatSettings || mongoose.model('ChatSettings', chatSettingsSchema);
  PricingPlan = mongoose.models.PricingPlan || mongoose.model('PricingPlan', pricingPlanSchema);
  PricingRule = mongoose.models.PricingRule || mongoose.model('PricingRule', pricingRuleSchema);
  StudentFeeLedgerV2 = mongoose.models.StudentFeeLedgerV2 || mongoose.model('StudentFeeLedgerV2', studentFeeLedgerV2Schema);
  FeePaymentV2 = mongoose.models.FeePaymentV2 || mongoose.model('FeePaymentV2', feePaymentsV2Schema);
  AttendanceRecord = mongoose.models.AttendanceRecord || mongoose.model('AttendanceRecord', attendanceRecordSchema);
  FacultyContract = mongoose.models.FacultyContract || mongoose.model('FacultyContract', facultyContractSchema);
  FacultyEarningV2 = mongoose.models.FacultyEarningV2 || mongoose.model('FacultyEarningV2', facultyEarningV2Schema);
  AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
};

if (useMongo) {
  initModels();
}

// Local Fallback State (for AI Studio Preview)
let localData: any = { batches: [], routines: [], downloads: [], fees: [], enrollments: [], chatUsers: [], chatMessages: [], chatSettings: [], pricing_plans: [], pricing_rules: [], student_fee_ledger_v2: [], fee_payments_v2: [], attendance_records: [], faculty_contracts: [], faculty_earnings_v2: [], audit_logs: [] };
const LOCAL_FILE = 'local_db.json';

export const initDB = async () => {
  if (useMongo) {
    console.log('Attempting to connect to MongoDB...');
    try {
      await mongoose.connect(MONGODB_URI!);
      console.log('Successfully connected to MongoDB');
      
      // Re-init models after connection just in case
      initModels();

      // Seed default data if empty
      const count = await Batch.countDocuments();
      console.log(`Current batch count: ${count}`);
      if (count === 0) {
        console.log('Seeding default data...');
        await Batch.insertMany([
          { name: 'CLASS XII', tag: 'URGENT', date: 'APR 15', description: 'Target: Boards + JEE.', color: 'var(--primary)', tagColor: 'var(--primary)', timerEnabled: true, targetDate: '2026-04-15T00:00:00' },
          { name: 'CLASS X', tag: 'FRESH', date: 'MAY 01', description: 'Foundation Batch.', color: 'var(--success)', tagColor: 'var(--success)', timerEnabled: false, targetDate: '' },
          { name: 'CLASS XI', tag: 'SCIENCE', date: 'JUN 01', description: 'Starts after X Results.', color: 'var(--secondary)', tagColor: 'var(--secondary)', timerEnabled: false, targetDate: '' }
        ]);
        await Routine.insertMany([
          { time: '02:30', mon: 'Math X', tue: '-', wed: '-', thu: 'Math X', fri: '-', sat: 'Math X', sun: '-' },
          { time: '04:30', mon: 'Math XI', tue: 'Math XII', wed: 'Chem XI', thu: 'Math XI', fri: 'Chem XI', sat: 'Math XII', sun: 'Math XII' },
          { time: 'EVE', mon: '-', tue: '-', wed: 'Chem XII', thu: '-', fri: 'Chem XII', sat: '-', sun: '-' }
        ]);
        await Download.insertMany([
          { subject: 'CHEMISTRY XII', icon: 'FlaskConical', color: 'var(--accent)', links: [{ label: 'PYQ Download', url: 'https://drive.google.com/file/d/1j1x7cZiluh0dxkuvGlm_I2eL9wmc-5rE/view?usp=drivesdk', icon: 'Download' }] },
          { subject: 'PHYSICS XII', icon: 'Atom', color: 'var(--secondary)', links: [{ label: 'PYQ Download', url: 'https://drive.google.com/file/d/1JlLrMddHxAinz9za-iv3etyCXTEST8jT/view?usp=drivesdk', icon: 'Download' }] },
          { subject: 'BIOLOGY XII', icon: 'Dna', color: 'var(--success)', links: [{ label: 'PYQ Download', url: 'https://drive.google.com/file/d/1p3AJTAuPgPcQqSxMiLYJlNFGjevTuyf1/view?usp=drivesdk', icon: 'Download' }] },
          { subject: 'MATHEMATICS XII', icon: 'Calculator', color: 'var(--primary)', links: [{ label: 'Question Bank', url: 'https://drive.google.com/drive/folders/1j2uD7ofSE_y5B0_PT8mGelXkQO0bPOgu', icon: 'FolderOpen' }] }
        ]);
        await Fee.insertMany([
          { subject: 'Mathematics', originalPrice: 1500, discount: 500, finalPrice: 1000 },
          { subject: 'Chemistry', originalPrice: 1500, discount: 500, finalPrice: 1000 },
          { subject: 'Physics', originalPrice: 1500, discount: 500, finalPrice: 1000 }
        ]);
        console.log('Default data seeded successfully');
      }
      if (await ChatSettings.countDocuments() === 0) {
        await ChatSettings.create({ roomId: 'main', name: 'Study Hub', description: 'Public Discussion' });
        console.log('Default chat settings created');
      }
    } catch (err) {
      console.error('MongoDB connection error:', err);
      console.log('Switching to local data due to MongoDB connection failure');
      useMongo = false; // Disable mongo for this session
      useMongoFallback();
    }
  } else {
    console.log('MONGODB_URI not provided. Using local JSON fallback.');
    useMongoFallback();
  }
};

const useMongoFallback = () => {
  if (fs.existsSync(LOCAL_FILE)) {
    console.log(`Loading local data from ${LOCAL_FILE}`);
    localData = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf-8'));
  } else {
    console.log('Local file not found. Initializing with default data.');
    localData.batches = [
      { id: 'b1', name: 'CLASS XII', tag: 'URGENT', date: 'APR 15', description: 'Target: Boards + JEE.', color: 'var(--primary)', tagColor: 'var(--primary)', timerEnabled: true, targetDate: '2026-04-15T00:00:00' },
      { id: 'b2', name: 'CLASS X', tag: 'FRESH', date: 'MAY 01', description: 'Foundation Batch.', color: 'var(--success)', tagColor: 'var(--success)', timerEnabled: false, targetDate: '' },
      { id: 'b3', name: 'CLASS XI', tag: 'SCIENCE', date: 'JUN 01', description: 'Starts after X Results.', color: 'var(--secondary)', tagColor: 'var(--secondary)', timerEnabled: false, targetDate: '' }
    ];
    localData.routines = [
      { id: 'r1', time: '02:30', mon: 'Math X', tue: '-', wed: '-', thu: 'Math X', fri: '-', sat: 'Math X', sun: '-' },
      { id: 'r2', time: '04:30', mon: 'Math XI', tue: 'Math XII', wed: 'Chem XI', thu: 'Math XI', fri: 'Chem XI', sat: 'Math XII', sun: 'Math XII' },
      { id: 'r3', time: 'EVE', mon: '-', tue: '-', wed: 'Chem XII', thu: '-', fri: 'Chem XII', sat: '-', sun: '-' }
    ];
    localData.downloads = [
      { id: 'd1', subject: 'CHEMISTRY XII', icon: 'FlaskConical', color: 'var(--accent)', links: [{ label: 'PYQ Download', url: 'https://drive.google.com/file/d/1j1x7cZiluh0dxkuvGlm_I2eL9wmc-5rE/view?usp=drivesdk', icon: 'Download' }] },
      { id: 'd2', subject: 'PHYSICS XII', icon: 'Atom', color: 'var(--secondary)', links: [{ label: 'PYQ Download', url: 'https://drive.google.com/file/d/1JlLrMddHxAinz9za-iv3etyCXTEST8jT/view?usp=drivesdk', icon: 'Download' }] },
      { id: 'd3', subject: 'BIOLOGY XII', icon: 'Dna', color: 'var(--success)', links: [{ label: 'PYQ Download', url: 'https://drive.google.com/file/d/1p3AJTAuPgPcQqSxMiLYJlNFGjevTuyf1/view?usp=drivesdk', icon: 'Download' }] },
      { id: 'd4', subject: 'MATHEMATICS XII', icon: 'Calculator', color: 'var(--primary)', links: [{ label: 'Question Bank', url: 'https://drive.google.com/drive/folders/1j2uD7ofSE_y5B0_PT8mGelXkQO0bPOgu', icon: 'FolderOpen' }] }
    ];
    localData.fees = [
      { id: 'f1', subject: 'Mathematics', originalPrice: 1500, discount: 500, finalPrice: 1000 },
      { id: 'f2', subject: 'Chemistry', originalPrice: 1500, discount: 500, finalPrice: 1000 },
      { id: 'f3', subject: 'Physics', originalPrice: 1500, discount: 500, finalPrice: 1000 }
    ];
    localData.enrollments = [
      { id: 'e1', name: 'Priyanka Singha', grade: 'XII', whatsapp: '+91 97070 58167', instagram: '', subjects: ['Physics', 'Chemistry', 'Mathematics'], feeStatus: 'Pending', notes: '' },
      { id: 'e2', name: 'Ahsin Sultana', grade: 'XII', whatsapp: '+91 8474039019', instagram: '', subjects: ['Physics', 'Chemistry', 'Mathematics'], feeStatus: 'Pending', notes: '' }
    ];
    if (!localData.chatSettings || localData.chatSettings.length === 0) {
      localData.chatSettings = [{ id: 'main', roomId: 'main', name: 'Study Hub', description: 'Public Discussion' }];
    }
    saveLocal();
    console.log('Default local data saved');
  }
};

const saveLocal = () => {
  if (!useMongo) fs.writeFileSync(LOCAL_FILE, JSON.stringify(localData, null, 2));
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const getModel = (type: string) => {
  switch(type) {
    case 'batches': return Batch;
    case 'routines': return Routine;
    case 'downloads': return Download;
    case 'fees': return Fee;
    case 'enrollments': return Enrollment;
    case 'chatUsers': return ChatUser;
    case 'chatMessages': return ChatMessage;
    case 'chatSettings': return ChatSettings;
    case 'pricing_plans': return PricingPlan;
    case 'pricing_rules': return PricingRule;
    case 'student_fee_ledger_v2': return StudentFeeLedgerV2;
    case 'fee_payments_v2': return FeePaymentV2;
    case 'attendance_records': return AttendanceRecord;
    case 'faculty_contracts': return FacultyContract;
    case 'faculty_earnings_v2': return FacultyEarningV2;
    case 'audit_logs': return AuditLog;
    default: return null;
  }
};

// Generic CRUD Operations
export const getItems = async (type: string) => {
  if (useMongo) {
    const Model = getModel(type);
    if (!Model) return [];
    const items = await Model.find();
    return items.map((i: any) => ({ ...i.toObject(), id: i._id.toString() }));
  }
  return localData[type] || [];
};

export const getItem = async (type: string, id: string) => {
  if (useMongo) {
    const Model = getModel(type);
    if (!Model) return null;
    const item = await Model.findById(id).lean();
    return item ? { ...item, id: item._id.toString() } : null;
  }
  return localData[type]?.find((i: any) => i.id === id) || null;
};

export const createItem = async (type: string, data: any) => {
  if (useMongo) {
    const Model = getModel(type);
    if (!Model) return null;
    try {
      const item = await Model.create(data);
      return item._id.toString();
    } catch (err: any) {
      if (err.code === 12501 || err.message.includes('quota') || err.message.includes('space')) {
        throw new Error('STORAGE_FULL');
      }
      throw err;
    }
  }
  const id = generateId();
  if (!localData[type]) localData[type] = [];
  localData[type].push({ ...data, id });
  saveLocal();
  return id;
};

export const updateItem = async (type: string, id: string, data: any) => {
  if (useMongo) {
    const Model = getModel(type);
    if (!Model) return false;
    const { id: _, _id, ...updateData } = data; // Remove id to avoid immutable field error
    try {
      await Model.findByIdAndUpdate(id, updateData);
      return true;
    } catch (err: any) {
      if (err.code === 12501 || err.message.includes('quota') || err.message.includes('space')) {
        throw new Error('STORAGE_FULL');
      }
      throw err;
    }
  }
  if (!localData[type]) return false;
  const index = localData[type].findIndex((i: any) => i.id === id);
  if (index !== -1) {
    localData[type][index] = { ...localData[type][index], ...data, id };
    saveLocal();
  }
  return true;
};

export const deleteItem = async (type: string, id: string) => {
  if (useMongo) {
    const Model = getModel(type);
    if (!Model) return false;
    await Model.findByIdAndDelete(id);
    return true;
  }
  if (!localData[type]) return false;
  localData[type] = localData[type].filter((i: any) => i.id !== id);
  saveLocal();
  return true;
};

export const wipeLocal = async () => {
  if (useMongo) return false;
  localData = { batches: [], routines: [], downloads: [], fees: [], enrollments: [], chatUsers: [], chatMessages: [], chatSettings: [] };
  saveLocal();
  return true;
};

export const getMessages = async (limit: number, skip: number) => {
  if (useMongo) {
    const msgs = await ChatMessage.find().sort({ timestamp: -1 }).skip(skip).limit(limit).lean();
    return msgs.map((m: any) => ({ ...m, id: m._id.toString() })).reverse();
  } else {
    const msgs = [...localData.chatMessages].sort((a: any, b: any) => b.timestamp - a.timestamp);
    return msgs.slice(skip, skip + limit).reverse();
  }
};
