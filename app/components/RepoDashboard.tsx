"use client";

import { useState, useEffect } from "react";
import CommitActivityChart from "./charts/CommitActivityChart";
import ContributorsChart from "./charts/ContributorsChart";
import CodeChangesChart from "./charts/CodeChangesChart"; 
import TopFilesChart from "./charts/TopFilesChart";
import StatsCard from "./StatsCard";
import { 
  ChartBarIcon, 
  CodeBracketIcon, 
  UserGroupIcon, 
  DocumentIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PuzzlePieceIcon,
  LightBulbIcon,
  ClipboardDocumentCheckIcon,
  WrenchScrewdriverIcon
} from "@heroicons/react/24/outline";

type Commit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  files: string[];
  isMergeCommit: boolean;
  fileDetails: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }[];
  mergeDetails?: {
    totalCommits: number;
    changedFiles: {
      filename: string;
      status: string;
      additions: number;
      deletions: number;
    }[];
  };
};

type RepoStats = {
  commits: number;
  mergeCommits: number;
  directCommits: number;
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  contributors: {
    name: string;
    totalCommits: number;
    mergeCommits: number;
    directCommits: number;
    additions: number;
    deletions: number;
    filesChanged: number;
  }[];
};

type InsightSection = {
  title: string;
  content: string;
  icon: React.ElementType;
};

type Props = {
  commits: Commit[];
  repoStats: RepoStats | null;
  repoName: string;
  insight: string | null;
};

export default function RepoDashboard({ commits, repoStats, repoName, insight }: Props) {
  const [insightSections, setInsightSections] = useState<InsightSection[]>([]);

  // Parse insight string into sections based on markdown headers
  useEffect(() => {
    if (!insight) return;

    const sections: InsightSection[] = [];
    const lines = insight.split('\n');
    let currentTitle = "";
    let currentContent: string[] = [];
    let currentIcon = ChartBarIcon;

    for (const line of lines) {
      if (line.startsWith('##')) {
        // Se já tem conteúdo para a seção anterior, adiciona
        if (currentTitle && currentContent.length > 0) {
          sections.push({
            title: currentTitle,
            content: currentContent.join('\n'),
            icon: currentIcon
          });
        }
        
        // Inicia nova seção
        currentTitle = line.replace(/^##\s*/, '').trim();
        currentContent = [];
        
        // Define ícone baseado no título
        if (currentTitle.includes('IMPLEMENTAÇÕES') || currentTitle.includes('DETALHADA')) {
          currentIcon = LightBulbIcon;
        } else if (currentTitle.includes('INTEGRAÇÕES') || currentTitle.includes('MERGES')) {
          currentIcon = CodeBracketIcon;
        } else if (currentTitle.includes('ANÁLISE TÉCNICA')) {
          currentIcon = ClipboardDocumentCheckIcon;
        } else if (currentTitle.includes('RECOMENDAÇÕES')) {
          currentIcon = WrenchScrewdriverIcon;
        } else {
          currentIcon = ChartBarIcon;
        }
      } else if (line.startsWith('#')) {
        // Ignora outros níveis de cabeçalho
        continue;
      } else {
        currentContent.push(line);
      }
    }

    // Adiciona a última seção
    if (currentTitle && currentContent.length > 0) {
      sections.push({
        title: currentTitle,
        content: currentContent.join('\n'),
        icon: currentIcon
      });
    }

    setInsightSections(sections);
  }, [insight]);

  if (!repoStats || commits.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-gray-500">Gere insights primeiro para visualizar o dashboard</p>
      </div>
    );
  }

  const codeBalance = repoStats.totalAdditions - repoStats.totalDeletions;
  const codeBalanceColor = codeBalance >= 0 ? "green" : "red";

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard 
          title="Total de Commits"
          value={repoStats.commits.toString()}
          subtitle={`${repoStats.directCommits} diretos, ${repoStats.mergeCommits} merges`}
          icon={ChartBarIcon}
          color="blue"
        />
        <StatsCard 
          title="Contribuidores"
          value={repoStats.contributors.length.toString()}
          subtitle="Pessoas envolvidas"
          icon={UserGroupIcon}
          color="purple"
        />
        <StatsCard 
          title="Arquivos Alterados"
          value={repoStats.totalFiles.toString()}
          subtitle="Em todos os commits"
          icon={DocumentIcon}
          color="indigo"
        />
        <StatsCard 
          title="Balanço de Código"
          value={`${Math.abs(codeBalance)}`}
          subtitle={codeBalance >= 0 ? "Linhas adicionadas" : "Linhas removidas"}
          icon={codeBalance >= 0 ? ArrowUpIcon : ArrowDownIcon}
          color={codeBalanceColor}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium mb-4 flex items-center text-gray-700">
            <ChartBarIcon className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
            Atividade de Commits
          </h3>
          <div className="h-60">
            <CommitActivityChart commits={commits} />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium mb-4 flex items-center text-gray-700">
            <UserGroupIcon className="h-3.5 w-3.5 mr-1.5 text-purple-500" />
            Principais Contribuidores
          </h3>
          <div className="h-60">
            <ContributorsChart contributors={repoStats.contributors} />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium mb-4 flex items-center text-gray-700">
            <CodeBracketIcon className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
            Alterações de Código
          </h3>
          <div className="h-60">
            <CodeChangesChart commits={commits} />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium mb-4 flex items-center text-gray-700">
            <PuzzlePieceIcon className="h-3.5 w-3.5 mr-1.5 text-green-500" />
            Arquivos Mais Modificados
          </h3>
          <div className="h-60">
            <TopFilesChart commits={commits} />
          </div>
        </div>
      </div>

      {/* Analysis Sections */}
      {insight && insightSections.length > 0 && (
        <div className="space-y-6">
          {insightSections.map((section, index) => (
            <div key={index} className="bg-white p-5 rounded-lg shadow-sm">
              <h3 className="text-base font-medium mb-4 flex items-center text-gray-800">
                <section.icon className="h-4 w-4 mr-2 text-blue-500" />
                {section.title}
              </h3>
              
              <div className="prose prose-sm max-w-none">
                <div className="text-sm text-gray-700 whitespace-pre-line">{section.content}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 