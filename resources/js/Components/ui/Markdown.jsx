import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/Lib/utils';

/**
 * Renders an LLM answer as rich text: GitHub-flavoured Markdown
 * (bold, italic, lists, tables, code, blockquotes, links) plus LaTeX
 * math via KaTeX ($inline$ and $$block$$). Emoji render natively.
 *
 * Styled for the dark navy/gold theme — no Tailwind typography plugin needed.
 */
const components = {
    p: ({ children }) => <p className="text-sm text-navy-100 leading-relaxed mb-3 last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
    em: ({ children }) => <em className="italic text-navy-50">{children}</em>,
    del: ({ children }) => <del className="text-navy-400 line-through">{children}</del>,
    a: ({ children, href }) => (
        <a href={href} target="_blank" rel="noopener noreferrer"
           className="text-gold-400 underline decoration-gold-500/40 underline-offset-2 hover:text-gold-300 transition">
            {children}
        </a>
    ),
    h1: ({ children }) => <h1 className="text-base font-bold text-white mt-4 mb-2 first:mt-0">{children}</h1>,
    h2: ({ children }) => <h2 className="text-sm font-bold text-white mt-4 mb-2 first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold text-navy-50 mt-3 mb-1.5 first:mt-0">{children}</h3>,
    h4: ({ children }) => <h4 className="text-xs font-semibold uppercase tracking-wide text-navy-300 mt-3 mb-1 first:mt-0">{children}</h4>,
    ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-3 text-sm text-navy-100 marker:text-gold-500/70">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-3 text-sm text-navy-100 marker:text-navy-400">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-gold-500/40 pl-3 my-3 text-navy-300 italic">{children}</blockquote>
    ),
    hr: () => <hr className="my-4 border-white/10" />,
    code: ({ inline, className, children }) => {
        if (inline) {
            return (
                <code className="px-1.5 py-0.5 rounded bg-navy-950/70 border border-white/10 text-[0.8em] font-mono text-gold-300">
                    {children}
                </code>
            );
        }
        return (
            <code className={cn('block font-mono text-xs text-navy-100', className)}>{children}</code>
        );
    },
    pre: ({ children }) => (
        <pre className="my-3 p-3 rounded-lg bg-navy-950/70 border border-white/10 overflow-x-auto text-xs leading-relaxed">
            {children}
        </pre>
    ),
    table: ({ children }) => (
        <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-xs border-collapse">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead className="bg-navy-800/50">{children}</thead>,
    th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-navy-200 border-b border-white/10">{children}</th>,
    td: ({ children }) => <td className="px-3 py-2 text-navy-100 border-b border-white/5">{children}</td>,
    tr: ({ children }) => <tr className="even:bg-white/[0.02]">{children}</tr>,
    img: ({ src, alt }) => (
        <img src={src} alt={alt} className="my-3 max-w-full rounded-lg border border-white/10" loading="lazy" />
    ),
};

function Markdown({ children, className }) {
    return (
        <div className={cn('rag-markdown', className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={components}
            >
                {children || ''}
            </ReactMarkdown>
        </div>
    );
}

export default memo(Markdown);
