import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-white/5">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{language || 'code'}</span>
        <button 
          onClick={handleCopy}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.85rem',
          backgroundColor: 'transparent',
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

export default function MarkdownRenderer({ content, className = '', inline = false }: MarkdownRendererProps) {
  const Component = inline ? 'span' : 'div';
  
  // Auto-LaTeX: wrap common math patterns in $ if they aren't already
  const processedContent = React.useMemo(() => {
    if (!content) return '';
    
    let text = content;

    // Convert \[ ... \] to $$ ... $$ for block math
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
    // Convert \( ... \) to $ ... $ for inline math
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
    
    // Add support for [latex]...[/latex] and <latex>...</latex> tags
    text = text.replace(/\[latex\]([\s\S]*?)\[\/latex\]/gi, '$$$$$1$$$$');
    text = text.replace(/<latex>([\s\S]*?)<\/latex>/gi, '$$$$$1$$$$');
    
    // Heuristic: if it looks like LaTeX but lacks $, wrap it.
    const mathKeywords = /\\(frac|sqrt|sum|prod|lim|int|pm|times|div|cup|cap|subset|subseteq|in|notin|deg|sin|cos|tan|log|ln|text)/g;
    
    // Quick check if text doesn't contain standard math delimiters
    if (!text.includes('$') && !text.includes('$$')) {
      if (mathKeywords.test(text)) {
        return `$${text}$`;
      }
      if (text.includes('^') && text.length < 50) {
         return `$${text}$`;
      }
    }

    return text;
  }, [content]);

  const components: any = {
    // Ensure links open in new tab
    a: ({ node, ...props }: any) => <a {...props} target="_blank" rel="noopener noreferrer" />,
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <CodeBlock
          language={match[1]}
          value={String(children).replace(/\n$/, '')}
        />
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    table: ({ node, ...props }: any) => (
      <div className="overflow-x-auto my-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
        <table {...props} className="min-w-full divide-y divide-gray-200 dark:divide-white/10" />
      </div>
    ),
    thead: ({ node, ...props }: any) => <thead {...props} className="bg-gray-50 dark:bg-white/5" />,
    th: ({ node, ...props }: any) => <th {...props} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400" />,
    td: ({ node, ...props }: any) => <td {...props} className="px-4 py-3 text-sm border-t border-gray-100 dark:border-white/5" />,
  };

  if (inline) {
    components.p = ({ node, ...props }: any) => <span {...props} />;
  }

  return (
    <Component className={`markdown-body ${className} ${inline ? 'inline-markdown' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </Component>
  );
}
