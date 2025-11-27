import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

interface Props {
  content: string;
}

export default function MarkdownRenderer({ content }: Props) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块渲染
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            return !inline && match ? (
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  zIndex: 10
                }}>
                  <button
                    onClick={() => handleCopyCode(codeString)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      background: copiedCode === codeString ? '#10b981' : '#374151',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {copiedCode === codeString ? (
                      <>
                        <Check size={14} />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        复制
                      </>
                    )}
                  </button>
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: '8px',
                    fontSize: '13px',
                    padding: '16px',
                    paddingTop: '40px'
                  }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code
                className={className}
                style={{
                  background: '#374151',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.9em',
                  color: '#f87171'
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          // 标题渲染
          h1: ({ children }) => (
            <h1 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginTop: '24px',
              marginBottom: '16px',
              color: '#f3f4f6',
              borderBottom: '2px solid #374151',
              paddingBottom: '8px'
            }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              marginTop: '20px',
              marginBottom: '12px',
              color: '#f3f4f6'
            }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginTop: '16px',
              marginBottom: '10px',
              color: '#e5e7eb'
            }}>
              {children}
            </h3>
          ),
          // 列表渲染
          ul: ({ children }) => (
            <ul style={{
              marginLeft: '20px',
              marginTop: '8px',
              marginBottom: '8px',
              listStyleType: 'disc',
              color: '#d4d4d4'
            }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol style={{
              marginLeft: '20px',
              marginTop: '8px',
              marginBottom: '8px',
              listStyleType: 'decimal',
              color: '#d4d4d4'
            }}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li style={{
              marginBottom: '4px',
              lineHeight: '1.6'
            }}>
              {children}
            </li>
          ),
          // 段落渲染
          p: ({ children }) => (
            <p style={{
              marginBottom: '12px',
              lineHeight: '1.6',
              color: '#d4d4d4'
            }}>
              {children}
            </p>
          ),
          // 链接渲染
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#60a5fa',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              {children}
            </a>
          ),
          // 引用渲染
          blockquote: ({ children }) => (
            <blockquote style={{
              borderLeft: '4px solid #3b82f6',
              paddingLeft: '16px',
              marginLeft: '0',
              marginTop: '12px',
              marginBottom: '12px',
              color: '#9ca3af',
              fontStyle: 'italic'
            }}>
              {children}
            </blockquote>
          ),
          // 表格渲染
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', marginTop: '12px', marginBottom: '12px' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1px solid #374151'
              }}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead style={{ background: '#374151' }}>
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th style={{
              padding: '8px 12px',
              textAlign: 'left',
              borderBottom: '2px solid #4b5563',
              color: '#f3f4f6',
              fontWeight: '600'
            }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{
              padding: '8px 12px',
              borderBottom: '1px solid #374151',
              color: '#d4d4d4'
            }}>
              {children}
            </td>
          ),
          // 水平线渲染
          hr: () => (
            <hr style={{
              border: 'none',
              borderTop: '1px solid #374151',
              marginTop: '16px',
              marginBottom: '16px'
            }} />
          ),
          // 粗体和斜体
          strong: ({ children }) => (
            <strong style={{ fontWeight: 'bold', color: '#f3f4f6' }}>
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em style={{ fontStyle: 'italic', color: '#e5e7eb' }}>
              {children}
            </em>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
