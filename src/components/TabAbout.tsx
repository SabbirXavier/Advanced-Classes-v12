import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function TabAbout({ onNavigate }: { onNavigate: (tab: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold">About Us</h2>
        <button 
          onClick={() => onNavigate('home')}
          className="bg-transparent border-none text-[var(--primary)] font-semibold cursor-pointer flex items-center gap-1.5 hover:opacity-80"
        >
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      <div className="glass-card">
        <div className="text-lg font-bold mb-2 text-[var(--primary)]">Introduction</div>
        <p className="opacity-90 leading-relaxed">Advanced Classes, Sonai is an academically driven coaching initiative aimed at strengthening students' foundations in Mathematics and Science.</p>
      </div>

      <div className="glass-card">
        <div className="text-lg font-bold mb-2 text-[var(--primary)]">Vision</div>
        <p className="opacity-90 leading-relaxed">To build strong conceptual foundations and encourage analytical thinking. We prioritize understanding over rote learning.</p>
      </div>

      <div className="glass-card">
        <div className="text-lg font-bold mb-3 text-[var(--primary)]">Features</div>
        <ul className="list-none space-y-3">
          <li className="flex items-start gap-3 pb-3 border-b border-[var(--border-color)] transition-all hover:translate-x-1 hover:bg-white/10 hover:rounded-lg hover:px-2 last:border-0">
            <CheckCircle2 className="text-[var(--success)] shrink-0 mt-0.5" size={18} />
            <span className="opacity-90">Step-by-step concept explanation.</span>
          </li>
          <li className="flex items-start gap-3 pb-3 border-b border-[var(--border-color)] transition-all hover:translate-x-1 hover:bg-white/10 hover:rounded-lg hover:px-2 last:border-0">
            <CheckCircle2 className="text-[var(--success)] shrink-0 mt-0.5" size={18} />
            <span className="opacity-90">74-Inch Smart Board Integration.</span>
          </li>
          <li className="flex items-start gap-3 pb-3 border-b border-[var(--border-color)] transition-all hover:translate-x-1 hover:bg-white/10 hover:rounded-lg hover:px-2 last:border-0">
            <CheckCircle2 className="text-[var(--success)] shrink-0 mt-0.5" size={18} />
            <span className="opacity-90">Exam-oriented preparation.</span>
          </li>
          <li className="flex items-start gap-3 pb-3 border-b border-[var(--border-color)] transition-all hover:translate-x-1 hover:bg-white/10 hover:rounded-lg hover:px-2 last:border-0">
            <CheckCircle2 className="text-[var(--success)] shrink-0 mt-0.5" size={18} />
            <span className="opacity-90">Strict Discipline & Routines.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
