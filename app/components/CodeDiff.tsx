"use client";

import { useState, useEffect } from 'react';

type Props = {
  patch: string;
  filename: string;
};

export default function CodeDiff({ patch, filename }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isTooLarge, setIsTooLarge] = useState(false);
  const [truncatedPatch, setTruncatedPatch] = useState<string | null>(null);
  
  // Ao montar o componente, verificar se o patch é muito grande
  useEffect(() => {
    if (!patch) return;
    
    const lines = patch.split('\n');
    if (lines.length > 300) {
      setIsTooLarge(true);
      // Truncar para exibição inicial para evitar problemas de performance
      const firstLines = lines.slice(0, 150).join('\n');
      const lastLines = lines.slice(lines.length - 150).join('\n');
      setTruncatedPatch(`${firstLines}\n\n... [${lines.length - 300} linhas omitidas] ...\n\n${lastLines}`);
    } else {
      setIsTooLarge(false);
      setTruncatedPatch(null);
    }
  }, [patch]);
  
  if (!patch) return null;
  
  // Determinar a linguagem pelo nome do arquivo para syntax highlighting
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

  // Formatar o patch para exibição
  const formatPatch = () => {
    const patchToFormat = isTooLarge && !expanded ? truncatedPatch || patch : patch;
    
    // Limitar para 15 linhas quando não expandido
    const lines = patchToFormat.split('\n');
    const displayLines = expanded ? lines : lines.slice(0, 15);
    
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
      } else if (line.includes('[linhas omitidas]')) {
        return (
          <div key={index} className="italic text-gray-500 py-1 text-center">
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
  const displayLines = formattedPatch.length;
  
  // Estatísticas resumidas
  const getCommitStats = () => {
    let additions = 0;
    let deletions = 0;
    
    patch.split('\n').forEach(line => {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    });
    
    return { additions, deletions };
  };
  
  const stats = getCommitStats();
  
  return (
    <div className="mt-2 border rounded overflow-hidden text-xs font-mono">
      <div className="bg-gray-100 px-3 py-1 border-b flex justify-between items-center">
        <span className="font-medium">{filename}</span>
        <div className="flex items-center space-x-3">
          <span className="text-green-600">+{stats.additions}</span>
          <span className="text-red-600">-{stats.deletions}</span>
          <span className="text-gray-500 text-xs">
            {patchLines} {patchLines === 1 ? 'linha' : 'linhas'}
          </span>
        </div>
      </div>
      <div className="p-2 overflow-x-auto whitespace-pre">
        {formattedPatch}
        {!expanded && patchLines > displayLines && (
          <div className="mt-2 text-center">
            <button 
              onClick={() => setExpanded(true)}
              className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer bg-blue-50 px-3 py-1 rounded"
            >
              {isTooLarge 
                ? `Mostrar todas as ${patchLines} linhas (pode ser lento)` 
                : `Mostrar mais ${patchLines - displayLines} linhas`}
            </button>
          </div>
        )}
        {expanded && isTooLarge && (
          <div className="mt-2 text-center">
            <button 
              onClick={() => setExpanded(false)}
              className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer bg-blue-50 px-3 py-1 rounded"
            >
              Mostrar versão resumida
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 