"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import RepoList from "./components/RepoList";
import RepoDetails from "./components/RepoDetails";

export default function Home() {
  const { data: session, status } = useSession();
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  
  return (
    <main className="min-h-screen p-6 bg-gray-100">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">GitHub Monitor</h1>
          <div>
            {status === "authenticated" ? (
              <div className="flex items-center gap-4">
                <span>Olá, {session?.user?.name}</span>
                <button 
                  onClick={() => signOut()} 
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button 
                onClick={() => signIn("github")} 
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition"
              >
                Login com GitHub
              </button>
            )}
          </div>
        </header>

        {status === "authenticated" ? (
          <div className="flex gap-6">
            <div className="w-1/3 bg-white p-4 rounded-lg shadow">
              <RepoList onSelectRepo={setSelectedRepo} />
            </div>
            <div className="w-2/3">
              {selectedRepo ? (
                <RepoDetails repo={selectedRepo} />
              ) : (
                <div className="bg-white p-8 rounded-lg shadow text-center">
                  <p className="text-gray-500">Selecione um repositório para ver detalhes</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-xl mb-4">Bem-vindo ao GitHub Monitor</p>
            <p className="text-gray-500 mb-6">
              Faça login com sua conta GitHub para ver seus repositórios e obter insights de IA
            </p>
            <button 
              onClick={() => signIn("github")} 
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-md transition"
            >
              Login com GitHub
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
