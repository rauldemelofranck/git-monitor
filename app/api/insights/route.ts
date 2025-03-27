import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type FileDetail = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
};

type MergeDetail = {
  baseSha: string;
  headSha: string;
  totalCommits: number;
  changedFiles: FileDetail[];
};

type Commit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  files: string[];
  isMergeCommit: boolean;
  mergeDetails: MergeDetail | null;
  fileDetails: FileDetail[];
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Função para truncar patches longos para evitar exceder limites de tokens
const truncatePatch = (patch: string, maxLines = 20): string => {
  if (!patch) return "";
  const lines = patch.split('\n');
  if (lines.length <= maxLines) return patch;
  
  const firstHalf = lines.slice(0, maxLines / 2).join('\n');
  const secondHalf = lines.slice(lines.length - maxLines / 2).join('\n');
  return `${firstHalf}\n\n... [${lines.length - maxLines} linhas omitidas] ...\n\n${secondHalf}`;
};

// Processa commits para otimizar os tokens e remover informações excessivas
const processCommitsForAnalysis = (commits: Commit[]): Commit[] => {
  return commits.map(commit => {
    // Limitar número de arquivos processados por commit
    const limitedFileDetails = commit.fileDetails
      .slice(0, 5) // Limita a 5 arquivos por commit
      .map(file => ({
        ...file,
        patch: truncatePatch(file.patch)
      }));
    
    // Se tiver mergeDetails, também limita os arquivos
    let processedMergeDetails = null;
    if (commit.mergeDetails) {
      const limitedChangedFiles = commit.mergeDetails.changedFiles
        .slice(0, 5)
        .map(file => ({
          ...file,
          patch: truncatePatch(file.patch)
        }));
      
      processedMergeDetails = {
        ...commit.mergeDetails,
        changedFiles: limitedChangedFiles
      };
    }
    
    return {
      ...commit,
      fileDetails: limitedFileDetails,
      mergeDetails: processedMergeDetails
    };
  });
};

// Analisa estatísticas de autores de commits
const analyzeContributors = (commits: Commit[]) => {
  const contributors: Record<string, { 
    count: number, 
    directCommits: number,
    mergeCommits: number,
    additions: number,
    deletions: number,
    files: Set<string>
  }> = {};
  
  // Extrair métricas por colaborador
  commits.forEach(commit => {
    const author = commit.author || "Unknown";
    
    if (!contributors[author]) {
      contributors[author] = { 
        count: 0, 
        directCommits: 0, 
        mergeCommits: 0,
        additions: 0,
        deletions: 0,
        files: new Set()
      };
    }
    
    // Incrementar contadores
    contributors[author].count += 1;
    
    if (commit.isMergeCommit) {
      contributors[author].mergeCommits += 1;
      
      // Adicionar estatísticas de merges
      if (commit.mergeDetails) {
        commit.mergeDetails.changedFiles.forEach(file => {
          contributors[author].additions += file.additions || 0;
          contributors[author].deletions += file.deletions || 0;
          contributors[author].files.add(file.filename);
        });
      }
    } else {
      contributors[author].directCommits += 1;
      
      // Adicionar estatísticas de commits diretos
      commit.fileDetails.forEach(file => {
        contributors[author].additions += file.additions || 0;
        contributors[author].deletions += file.deletions || 0;
        contributors[author].files.add(file.filename);
      });
    }
  });
  
  // Converter para array para ordenação
  const contributorsArray = Object.entries(contributors).map(([name, stats]) => ({
    name,
    totalCommits: stats.count,
    directCommits: stats.directCommits,
    mergeCommits: stats.mergeCommits,
    additions: stats.additions,
    deletions: stats.deletions,
    filesChanged: stats.files.size
  }));
  
  // Ordenar por total de commits
  return contributorsArray.sort((a, b) => b.totalCommits - a.totalCommits);
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { commits } = body as { commits: Commit[] };
    
    if (!commits || !Array.isArray(commits) || commits.length === 0) {
      return NextResponse.json({ error: "Invalid commits data" }, { status: 400 });
    }

    // Processar commits para otimizar o consumo de tokens
    const processedCommits = processCommitsForAnalysis(commits);

    // Separar tipos de commits para análise
    const mergeCommits = processedCommits.filter(c => c.isMergeCommit);
    const directCommits = processedCommits.filter(c => !c.isMergeCommit && c.fileDetails.length > 0);
    
    // Analisar contribuidores
    const contributors = analyzeContributors(processedCommits);
    
    // Gerar análise completa
    let combinedAnalysis = "";
    
    // Estatísticas gerais
    const totalFiles = new Set(processedCommits.flatMap(c => c.files)).size;
    const totalAdditions = processedCommits.reduce((sum, commit) => 
      sum + commit.fileDetails.reduce((s, f) => s + (f.additions || 0), 0), 0);
    const totalDeletions = processedCommits.reduce((sum, commit) => 
      sum + commit.fileDetails.reduce((s, f) => s + (f.deletions || 0), 0), 0);
    
    combinedAnalysis += "--- ESTATÍSTICAS DO REPOSITÓRIO ---\n\n";
    combinedAnalysis += `Total de commits analisados: ${processedCommits.length}\n`;
    combinedAnalysis += `Commits diretos: ${directCommits.length}\n`;
    combinedAnalysis += `Merges: ${mergeCommits.length}\n`;
    combinedAnalysis += `Arquivos alterados: ${totalFiles}\n`;
    combinedAnalysis += `Linhas adicionadas: ${totalAdditions}\n`;
    combinedAnalysis += `Linhas removidas: ${totalDeletions}\n\n`;
    
    combinedAnalysis += "Principais Contribuidores:\n";
    contributors.slice(0, 5).forEach(contributor => {
      combinedAnalysis += `- ${contributor.name}: ${contributor.totalCommits} commits (${contributor.directCommits} diretos, ${contributor.mergeCommits} merges)\n`;
    });
    combinedAnalysis += "\n";
    
    // Analisar commits diretos na branch principal
    if (directCommits.length > 0) {
      try {
        const directCommitsPrompt = `
Analise os seguintes commits feitos diretamente na branch principal do repositório e forneça um resumo técnico detalhado em português:

${directCommits.map(c => `
COMMIT: ${c.message}
AUTOR: ${c.author}
DATA: ${new Date(c.date).toLocaleDateString()}
ARQUIVOS ALTERADOS:
${c.fileDetails.map(file => `- ${file.filename} (${file.status}, +${file.additions}, -${file.deletions})`).join('\n')}

${c.fileDetails.slice(0, 3).map(file => file.patch ? `MUDANÇAS EM ${file.filename}:\n${file.patch}\n` : '').join('\n')}
${c.fileDetails.length > 3 ? `\n... e mais ${c.fileDetails.length - 3} arquivos alterados` : ''}
`).join('\n---\n')}

Forneça:
1. Um resumo técnico das mudanças (2-3 frases)
2. Identifique padrões e práticas de desenvolvimento
3. Classifique as alterações (novas features, correções, ajustes de desempenho, etc.)
`;

        const directResponse = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: directCommitsPrompt }],
          temperature: 0.5,
          max_tokens: 700,
        });
        
        combinedAnalysis += "--- ANÁLISE DE ALTERAÇÕES DIRETAS NA BRANCH PRINCIPAL ---\n\n";
        combinedAnalysis += directResponse.choices[0]?.message?.content || "";
      } catch (error: any) {
        console.error("Error analyzing direct commits:", error?.message || error);
        combinedAnalysis += "--- ANÁLISE DE ALTERAÇÕES DIRETAS NA BRANCH PRINCIPAL ---\n\n";
        combinedAnalysis += "Não foi possível analisar os commits diretos devido a limitações técnicas.\n";
      }
    }
    
    // Analisar commits de merge
    if (mergeCommits.length > 0) {
      try {
        const mergeCommitsPrompt = `
Analise os seguintes commits de merge em um repositório e forneça um resumo técnico detalhado em português:

${mergeCommits.map(c => `
COMMIT DE MERGE: ${c.message}
AUTOR: ${c.author}
DATA: ${new Date(c.date).toLocaleDateString()}
TOTAL DE COMMITS MESCLADOS: ${c.mergeDetails?.totalCommits || "Desconhecido"}

ARQUIVOS ALTERADOS NA MESCLAGEM:
${c.mergeDetails?.changedFiles.map(file => 
  `- ${file.filename} (${file.status}, +${file.additions}, -${file.deletions})`
).join('\n') || "Informação não disponível"}

${c.mergeDetails?.changedFiles.slice(0, 3).map(file => 
  file.patch ? `MUDANÇAS EM ${file.filename}:\n${file.patch}\n` : ''
).join('\n') || ""}
${c.mergeDetails?.changedFiles && c.mergeDetails.changedFiles.length > 3 ? `\n... e mais ${c.mergeDetails.changedFiles.length - 3} arquivos alterados` : ''}
`).join('\n---\n')}

Forneça:
1. Um resumo técnico do conteúdo dos merges (2-3 frases)
2. Propósito dos merges (novas features, correções, refatoração)
3. Componentes/arquivos mais significativamente alterados
`;

        const mergeResponse = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: mergeCommitsPrompt }],
          temperature: 0.5,
          max_tokens: 700,
        });
        
        if (combinedAnalysis) {
          combinedAnalysis += "\n\n--- ANÁLISE DE MERGES ---\n\n";
        } else {
          combinedAnalysis += "--- ANÁLISE DE MERGES ---\n\n";
        }
        
        combinedAnalysis += mergeResponse.choices[0]?.message?.content || "";
      } catch (error: any) {
        console.error("Error analyzing merge commits:", error?.message || error);
        if (combinedAnalysis) {
          combinedAnalysis += "\n\n--- ANÁLISE DE MERGES ---\n\n";
        } else {
          combinedAnalysis += "--- ANÁLISE DE MERGES ---\n\n";
        }
        combinedAnalysis += "Não foi possível analisar os merges devido a limitações técnicas.\n";
      }
    }
    
    // Gerar conclusão final se tiver ambos tipos de commits
    if (directCommits.length > 0 && mergeCommits.length > 0) {
      try {
        const finalPrompt = `
Com base nestas análises anteriores:

${combinedAnalysis}

Gere uma conclusão concisa (max. 3 frases) sobre a direção geral do desenvolvimento deste repositório.
`;
        
        const finalResponse = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: finalPrompt }],
          temperature: 0.5,
          max_tokens: 250,
        });
        
        combinedAnalysis += "\n\n--- CONCLUSÃO ---\n\n";
        combinedAnalysis += finalResponse.choices[0]?.message?.content || "";
      } catch (error: any) {
        console.error("Error generating conclusion:", error?.message || error);
        combinedAnalysis += "\n\n--- CONCLUSÃO ---\n\n";
        combinedAnalysis += "Não foi possível gerar uma conclusão devido a limitações técnicas.\n";
      }
    }
    
    const insight = combinedAnalysis || "Não foi possível gerar insights.";
    
    return NextResponse.json({ 
      insight,
      stats: {
        commits: processedCommits.length,
        directCommits: directCommits.length,
        mergeCommits: mergeCommits.length,
        totalFiles,
        totalAdditions,
        totalDeletions,
        contributors: contributors.slice(0, 5)
      }
    });
  } catch (error: any) {
    console.error("Error generating insights:", error?.message || error);
    return NextResponse.json({ 
      error: "Failed to generate insights", 
      message: error?.message || "Unknown error" 
    }, { status: 500 });
  }
} 