import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const components: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="mt-3 text-base font-bold text-slate-900 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-3 text-sm font-bold text-slate-900 first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-2 text-sm font-semibold text-slate-900 first:mt-0" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="my-1.5 text-[13px] leading-relaxed first:mt-0 last:mb-0" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-1.5 list-disc space-y-0.5 pl-4 text-[13px] marker:text-slate-400" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-1.5 list-decimal space-y-0.5 pl-4 text-[13px] marker:text-slate-500" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-slate-900" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-slate-800" {...props}>
      {children}
    </em>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-2 border-l-[3px] border-primary/40 bg-slate-50/80 py-1.5 pl-3 pr-2 text-[13px] text-slate-700"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props) => <hr className="my-3 border-slate-200" {...props} />,
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes('language-'));
    if (isBlock) {
      return (
        <code
          className={`block w-full max-w-full overflow-x-auto rounded-lg bg-slate-900 p-2.5 text-xs text-slate-100 ${className ?? ''}`}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-slate-800" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre className="my-2 max-w-full overflow-x-auto rounded-lg" {...props}>
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[240px] border-collapse text-left text-[12px]" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => <thead className="bg-slate-100 text-slate-800" {...props}>{children}</thead>,
  th: ({ children, ...props }) => (
    <th className="border-b border-slate-200 px-2 py-1.5 font-semibold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-b border-slate-100 px-2 py-1.5 align-top text-slate-700" {...props}>
      {children}
    </td>
  ),
  tr: (props) => <tr {...props} />,
};

type RagMarkdownProps = {
  content: string;
  className?: string;
};

/**
 * Hiển thị câu trả lời RAG (Markdown + GFM: bảng, gạch đầu dòng, v.v.).
 */
export function RagMarkdown({ content, className = '' }: RagMarkdownProps) {
  return (
    <div className={`rag-md text-slate-800 ${className}`}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}
