"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

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

type Props = {
  onSelectRepo: (repo: Repo) => void;
};

export default function RepoList({ onSelectRepo }: Props) {
  const { data: session } = useSession();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepos = async () => {
      if (!session?.accessToken) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const res = await fetch("/api/repos");
        
        if (!res.ok) {
          throw new Error(`Failed to fetch repositories: ${res.status}`);
        }
        
        const data = await res.json();
        setRepos(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar repositórios");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRepos();
  }, [session]);

  if (loading) {
    return <div className="py-4 text-center">Carregando repositórios...</div>;
  }

  if (error) {
    return <div className="py-4 text-center text-red-500">{error}</div>;
  }

  if (repos.length === 0) {
    return <div className="py-4 text-center">Nenhum repositório encontrado</div>;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Seus Repositórios</h2>
      <ul className="space-y-2">
        {repos.map((repo) => (
          <li 
            key={repo.id}
            className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer transition"
            onClick={() => onSelectRepo(repo)}
          >
            <h3 className="font-medium">{repo.name}</h3>
            {repo.description && (
              <p className="text-sm text-gray-600 truncate">{repo.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
} 