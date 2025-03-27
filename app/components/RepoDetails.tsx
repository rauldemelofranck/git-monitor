"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import CodeDiff from "./CodeDiff";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  html_url: string;
  description: string;
  private: boolean;
};

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
    patch: string;
  }[];
  mergeDetails: {
    baseSha: string;
    headSha: string;
    totalCommits: number;
    changedFiles: any[];
  } | null;
};

type Props = {
  repo: Repo;
};

export default function RepoDetails({ repo }: Props) {
  const { data: session } = useSession();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("main");
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);

  useEffect(() => {
    const fetchBranches = async () => {
      if (!session?.accessToken || !repo) return;
      
      setBranchesLoading(true);
      
      try {
        const res = await fetch(`/api/branches?owner=${repo.owner.login}&repo=${repo.name}`);
        
        if (!res.ok) {
          throw new Error(`Failed to fetch branches: ${res.status}`);
        }
        
        const data = await res.json();
        setBranches(data.map((branch: any) => branch.name));
        if (data.find((b: any) => b.name === "main")) {
          setSelectedBranch("main");
        } else if (data.find((b: any) => b.name === "master")) {
          setSelectedBranch("master");
        } else if (data.length > 0) {
          setSelectedBranch(data[0].name);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setBranchesLoading(false);
      }
    };
    
    fetchBranches();
  }, [repo, session]);

  useEffect(() => {
    const fetchCommits = async () => {
      if (!session?.accessToken || !repo) return;
      
      setLoading(true);
      setError(null);
      setInsight(null);
      
      try {
        const res = await fetch(`/api/commits?owner=${repo.owner.login}&repo=${repo.name}&branch=${selectedBranch}`);
        
        if (!res.ok) {
          throw new Error(`Failed to fetch commits: ${res.status}`);
        }
        
        const data = await res.json();
        setCommits(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar commits");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    if (selectedBranch) {
      fetchCommits();
    }
  }, [repo, session, selectedBranch]);

  const generateInsight = async () => {
    if (commits.length === 0) return;
    
    setInsightLoading(true);
    
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ commits }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to generate insights: ${res.status}`);
      }
      
      const data = await res.json();
      setInsight(data.insight);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar insights");
      console.error(err);
    } finally {
      setInsightLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <p>Carregando commits...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-8 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">{repo.name}</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const formatCommitMessage = (message: string) => {
    const firstLine = message.split('\n')[0];
    return firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine;
  };

  const selectedCommit = commits.find(c => c.sha === selectedCommitSha);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">{repo.name}</h2>
        <a 
          href={repo.html_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline text-sm"
        >
          Abrir no GitHub
        </a>
      </div>
      
      {repo.description && (
        <p className="text-gray-600 mb-6">{repo.description}</p>
      )}
      
      <div className="mb-4">
        <label htmlFor="branch-select" className="block text-sm font-medium text-gray-700 mb-1">
          Branch
        </label>
        <select
          id="branch-select"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          disabled={branchesLoading}
          className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Commits Recentes</h3>
          <button 
            onClick={generateInsight}
            disabled={insightLoading || commits.length === 0}
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm transition disabled:opacity-50"
          >
            {insightLoading ? "Gerando..." : "Gerar Insight"}
          </button>
        </div>
        
        {commits.length === 0 ? (
          <p className="text-center py-4 text-gray-500">Nenhum commit encontrado</p>
        ) : (
          <ul className="space-y-3">
            {commits.map((commit) => (
              <li 
                key={commit.sha} 
                className={`border-b pb-3 ${commit.isMergeCommit ? 'bg-blue-50 p-2 rounded' : ''} ${selectedCommitSha === commit.sha ? 'ring-2 ring-blue-300' : ''}`}
              >
                <div className="flex items-start">
                  {commit.isMergeCommit && (
                    <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 mr-2">
                      Merge
                    </span>
                  )}
                  <p className="font-medium">{formatCommitMessage(commit.message)}</p>
                </div>
                <div className="flex justify-between mt-1 text-sm text-gray-500">
                  <span>{commit.author}</span>
                  <span>{new Date(commit.date).toLocaleDateString()}</span>
                </div>
                <div className="mt-1 text-xs">
                  <span className="text-gray-500">Arquivos alterados: </span>
                  <span className="text-gray-700">
                    {commit.files.slice(0, 3).join(", ")}
                    {commit.files.length > 3 && ` e mais ${commit.files.length - 3}`}
                  </span>
                </div>
                
                {commit.isMergeCommit && commit.mergeDetails && (
                  <div className="mt-2 text-xs bg-blue-50 p-2 rounded">
                    <p className="font-medium text-blue-700">Detalhes do Merge:</p>
                    <p>Total de commits mesclados: {commit.mergeDetails.totalCommits}</p>
                    <p>Total de arquivos alterados: {commit.mergeDetails.changedFiles.length}</p>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                        Ver detalhes dos arquivos
                      </summary>
                      <ul className="pl-2 mt-1 space-y-1">
                        {commit.mergeDetails.changedFiles.slice(0, 5).map((file, idx) => (
                          <li key={idx}>
                            {file.filename} ({file.status}, +{file.additions}, -{file.deletions})
                          </li>
                        ))}
                        {commit.mergeDetails.changedFiles.length > 5 && (
                          <li>...e mais {commit.mergeDetails.changedFiles.length - 5} arquivos</li>
                        )}
                      </ul>
                    </details>
                  </div>
                )}
                
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => setSelectedCommitSha(selectedCommitSha === commit.sha ? null : commit.sha)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {selectedCommitSha === commit.sha ? "Ocultar alterações" : "Ver alterações"}
                  </button>
                </div>
                
                {selectedCommitSha === commit.sha && commit.fileDetails.length > 0 && (
                  <div className="mt-3 space-y-3">
                    <h4 className="text-sm font-medium">Alterações de código:</h4>
                    {commit.fileDetails
                      .filter(file => file.patch)
                      .slice(0, 3)
                      .map((file, idx) => (
                        <CodeDiff 
                          key={idx} 
                          filename={file.filename}
                          patch={file.patch}
                        />
                      ))}
                    {commit.fileDetails.filter(file => file.patch).length > 3 && (
                      <p className="text-xs text-gray-500 mt-2">
                        E mais {commit.fileDetails.filter(file => file.patch).length - 3} arquivos com alterações...
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {insight && (
        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h3 className="text-lg font-medium mb-3">Insight</h3>
          <div className="text-gray-800 whitespace-pre-line">{insight}</div>
        </div>
      )}
    </div>
  );
} 