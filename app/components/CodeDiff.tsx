"use client";

import { useState } from 'react';

type Props = {
  patch: string;
  filename: string;
};

export default function CodeDiff({ patch, filename }: Props) {
  const [expanded, setExpanded] = useState(false);
  
  if (!patch) return null;
  
  // Determine the language from the file extension for syntax highlighting
  const getLanguageFromFilename = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
        return 'javascript';
      case 'ts':
        return 'typescript';
      case 'jsx':
        return 'javascript';
      case 'tsx':
        return 'typescript';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'php':
        return 'php';
      case 'rb':
        return 'ruby';
      case 'go':
        return 'go';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      default:
        return 'plaintext';
    }
  };

  // Format the patch for display
  const formatPatch = () => {
    // Limit to 10 lines when not expanded
    const lines = patch.split('\n');
    const displayLines = expanded ? lines : lines.slice(0, 10);
    
    return displayLines.map((line, index) => {
      if (line.startsWith('+')) {
        return (
          <div key={index} className="bg-green-100 text-green-800">
            <code>{line}</code>
          </div>
        );
      } else if (line.startsWith('-')) {
        return (
          <div key={index} className="bg-red-100 text-red-800">
            <code>{line}</code>
          </div>
        );
      } else if (line.startsWith('@')) {
        return (
          <div key={index} className="bg-blue-100 text-blue-800">
            <code>{line}</code>
          </div>
        );
      } else {
        return (
          <div key={index}>
            <code>{line}</code>
          </div>
        );
      }
    });
  };

  const formattedPatch = formatPatch();
  const patchLines = patch.split('\n').length;
  
  return (
    <div className="mt-2 border rounded overflow-hidden text-xs font-mono">
      <div className="bg-gray-100 px-3 py-1 border-b flex justify-between items-center">
        <span className="font-medium">{filename}</span>
        <span className="text-gray-500 text-xs">
          {patchLines} {patchLines === 1 ? 'linha' : 'linhas'}
        </span>
      </div>
      <div className="p-2 overflow-x-auto whitespace-pre">
        {formattedPatch}
        {!expanded && patchLines > 10 && (
          <button 
            onClick={() => setExpanded(true)}
            className="mt-1 text-blue-500 hover:text-blue-700 text-xs cursor-pointer"
          >
            Mostrar mais {patchLines - 10} linhas...
          </button>
        )}
      </div>
    </div>
  );
} 