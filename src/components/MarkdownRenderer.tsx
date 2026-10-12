import React from 'react';

interface MarkdownProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownProps) {
  if (!content) return null;

  // Split text by markdown headers, horizontal rules, or multi-newlines
  const blocks = content.split(/\n\n+/);

  return (
    <div className="md-container">
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Horizontal Rule
        if (/^(---|[*]{3,}|_{3,})$/.test(trimmed)) {
          return <hr key={bIdx} className="md-hr" />;
        }

        // Code blocks: ```code```
        if (trimmed.startsWith('```')) {
          const lines = trimmed.split('\n');
          const codeText = lines.slice(1, lines[lines.length - 1].startsWith('```') ? -1 : undefined).join('\n');
          return (
            <pre key={bIdx} className="md-pre">
              <code>{codeText}</code>
            </pre>
          );
        }

        // Headings
        if (trimmed.startsWith('### ')) {
          return <h4 key={bIdx} className="md-h3">{parseInline(trimmed.slice(4))}</h4>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={bIdx} className="md-h2">{parseInline(trimmed.slice(3))}</h3>;
        }
        if (trimmed.startsWith('# ')) {
          return <h2 key={bIdx} className="md-h1">{parseInline(trimmed.slice(2))}</h2>;
        }

        // Callout / Tip block (e.g. starts with 💡 or 📌)
        if (trimmed.startsWith('💡') || trimmed.startsWith('📌') || trimmed.includes('**Tip:**') || trimmed.includes('**सुझाव:**')) {
          return (
            <div key={bIdx} className="md-tip">
              <div>{parseInline(trimmed)}</div>
            </div>
          );
        }

        // Check if block contains list items (e.g. * item, - item, 1. item)
        const lines = trimmed.split('\n');
        const hasListItems = lines.some(l => /^\s*([*•-]|\d+\.)\s+/.test(l.trim()));

        if (hasListItems) {
          return (
            <div key={bIdx} className="md-block">
              {lines.map((line, lIdx) => {
                const isListItem = /^\s*([*•-]|\d+\.)\s+/.test(line.trim());
                if (isListItem) {
                  const cleaned = line.trim().replace(/^([*•-]|\d+\.)\s+/, '');
                  return (
                    <div key={lIdx} className="md-list-row">
                      <span className="md-bullet">•</span>
                      <div className="md-list-text">{parseInline(cleaned)}</div>
                    </div>
                  );
                }
                return (
                  <p key={lIdx} className="md-p" style={{ marginBottom: 6 }}>
                    {parseInline(line)}
                  </p>
                );
              })}
            </div>
          );
        }

        // Regular Paragraphs with single line breaks
        return (
          <p key={bIdx} className="md-p">
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {parseInline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    const codeMatch = remaining.match(/`(.*?)`/);

    let firstIndex = remaining.length;
    let matchType: 'bold' | 'code' | null = null;
    let matchObj: RegExpMatchArray | null = null;

    if (boldMatch && boldMatch.index! < firstIndex) {
      firstIndex = boldMatch.index!;
      matchType = 'bold';
      matchObj = boldMatch;
    }
    if (codeMatch && codeMatch.index! < firstIndex) {
      firstIndex = codeMatch.index!;
      matchType = 'code';
      matchObj = codeMatch;
    }

    if (!matchType || !matchObj) {
      parts.push(remaining);
      break;
    }

    if (firstIndex > 0) {
      parts.push(remaining.slice(0, firstIndex));
    }

    if (matchType === 'bold') {
      parts.push(<strong key={key++} className="md-strong">{parseInline(matchObj[1])}</strong>);
    } else if (matchType === 'code') {
      parts.push(<code key={key++} className="md-code">{matchObj[1]}</code>);
    }

    remaining = remaining.slice(firstIndex + matchObj[0].length);
  }

  return parts;
}
