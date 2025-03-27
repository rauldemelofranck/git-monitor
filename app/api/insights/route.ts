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
Analise os seguintes commits feitos diretamente na branch principal do repositório e forneça um resumo técnico detalhado e ESPECÍFICO em português:

${directCommits.map(c => `
COMMIT: ${c.message}
AUTOR: ${c.author}
DATA: ${new Date(c.date).toLocaleDateString()}
ARQUIVOS ALTERADOS:
${c.fileDetails.map(file => `- ${file.filename} (${file.status}, +${file.additions}, -${file.deletions})`).join('\n')}

${c.fileDetails.slice(0, 3).map(file => file.patch ? `MUDANÇAS EM ${file.filename}:\n${file.patch}\n` : '').join('\n')}
${c.fileDetails.length > 3 ? `\n... e mais ${c.fileDetails.length - 3} arquivos alterados` : ''}
`).join('\n---\n')}

Forneça uma análise TÉCNICA DETALHADA em português, sendo muito ESPECÍFICO sobre o que foi implementado. 
Por exemplo:
- Se foram adicionadas novas telas ou componentes, detalhe QUAIS telas e suas funcionalidades específicas
- Se houve refatoração de rotas, explique COMO as rotas foram reorganizadas
- Se foram implementadas novas funcionalidades, descreva EXATAMENTE o que são e como funcionam
- Se houve mudanças em fluxos (pagamento, autenticação, etc.), explique OS DETALHES da mudança

Sua análise deve incluir:
1. Detalhamento específico das funcionalidades adicionadas ou modificadas (cite nomes de telas, componentes, APIs)
2. Classificação precisa das alterações (novas features, correções, refatorações)
3. Pontos técnicos importantes sobre a implementação (padrões de design, bibliotecas utilizadas, etc.)
4. Impacto das mudanças no sistema como um todo

IMPORTANTE: Evite generalizações. Cada ponto da sua análise deve ser muito específico, citando exatamente o que foi implementado.
`;

        const directResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: directCommitsPrompt }],
          temperature: 0.3,
          max_tokens: 1000,
        });
        
        combinedAnalysis += "## ANÁLISE DETALHADA DE IMPLEMENTAÇÕES\n\n";
        combinedAnalysis += directResponse.choices[0]?.message?.content || "";
      } catch (error: any) {
        console.error("Error analyzing direct commits:", error?.message || error);
        combinedAnalysis += "## ANÁLISE DETALHADA DE IMPLEMENTAÇÕES\n\n";
        combinedAnalysis += "Não foi possível analisar os commits diretos devido a limitações técnicas.\n";
      }
    }
    
    // Analisar commits de merge
    if (mergeCommits.length > 0) {
      try {
        const mergeCommitsPrompt = `
Analise os seguintes commits de merge em um repositório e forneça um resumo técnico ESPECÍFICO e DETALHADO em português:

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

Forneça uma análise TÉCNICA DETALHADA em português, sendo muito ESPECÍFICO sobre o que foi integrado por meio destes merges.
Por exemplo:
- Identifique EXATAMENTE quais funcionalidades foram integradas (cite nomes de componentes, telas, APIs)
- Detalhe mudanças em fluxos de UI/UX (mudanças de navegação, adição de formulários, etc.)
- Especifique alterações em lógica de negócios (processos de pagamento, autenticação, etc.)
- Descreva as refatorações técnicas importantes (mudanças de arquitetura, padrões de design)

Sua análise deve incluir:
1. Descrição específica e técnica das features ou correções integradas
2. Componentes e arquivos-chave que foram modificados e seu propósito
3. Padrões técnicos observados na implementação
4. Potencial impacto no sistema e qualidade do código

IMPORTANTE: Seja extremamente específico. Cite nomes exatos de componentes, telas, e funcionalidades.
`;

        const mergeResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: mergeCommitsPrompt }],
          temperature: 0.3,
          max_tokens: 1000,
        });
        
        combinedAnalysis += "\n\n## ANÁLISE DE INTEGRAÇÕES (MERGES)\n\n";
        combinedAnalysis += mergeResponse.choices[0]?.message?.content || "";
      } catch (error: any) {
        console.error("Error analyzing merge commits:", error?.message || error);
        combinedAnalysis += "\n\n## ANÁLISE DE INTEGRAÇÕES (MERGES)\n\n";
        combinedAnalysis += "Não foi possível analisar os commits de merge devido a limitações técnicas.\n";
      }
    }

    // Análise técnica abrangente do projeto
    try {
      // Coletar todos os nomes de arquivos para entender a estrutura do projeto
      const allFiles = new Set<string>();
      processedCommits.forEach(commit => {
        commit.fileDetails.forEach(file => {
          allFiles.add(file.filename);
        });
        if (commit.mergeDetails) {
          commit.mergeDetails.changedFiles.forEach(file => {
            allFiles.add(file.filename);
          });
        }
      });

      const filesList = Array.from(allFiles);
      
      // Extrair informações sobre a estrutura do projeto
      const folderStructure = filesList.reduce((acc, file) => {
        const parts = file.split('/');
        let current = acc;
        
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
        
        return acc;
      }, {} as Record<string, any>);
      
      const projectAnalysisPrompt = `
Analise os commits e estrutura de arquivos deste projeto de desenvolvimento de software e forneça uma análise técnica detalhada em português.

ESTRUTURA DE ARQUIVOS:
${JSON.stringify(folderStructure, null, 2)}

LISTA DE ALGUNS ARQUIVOS:
${filesList.slice(0, 50).join('\n')}
${filesList.length > 50 ? `\n... e mais ${filesList.length - 50} arquivos` : ''}

COMMITS RECENTES:
${processedCommits.slice(0, 5).map(c => `- ${c.message.split('\n')[0]} (por ${c.author})`).join('\n')}

Com base nas informações acima:

1. Identifique ESPECIFICAMENTE o tipo de aplicação sendo desenvolvida (web, mobile, backend, etc.)
2. Detecte o padrão arquitetural e estrutura do projeto (MVC, microserviços, monolito, etc.)
3. Liste as principais tecnologias, frameworks e bibliotecas identificadas
4. Identifique componentes ou funcionalidades específicas implementadas recentemente
5. Analise tendências de desenvolvimento (refatorações, novas features, correções)

IMPORTANTE: Sua análise deve ser extremamente específica, técnica e detalhada. Evite generalizações. 
Identifique nomes EXATOS de telas, componentes e funcionalidades quando possível.
`;

      const projectResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: projectAnalysisPrompt }],
        temperature: 0.3,
        max_tokens: 800,
      });
      
      combinedAnalysis += "\n\n## ANÁLISE TÉCNICA DO PROJETO\n\n";
      combinedAnalysis += projectResponse.choices[0]?.message?.content || "";
      
    } catch (error: any) {
      console.error("Error creating project analysis:", error?.message || error);
      combinedAnalysis += "\n\n## ANÁLISE TÉCNICA DO PROJETO\n\n";
      combinedAnalysis += "Não foi possível gerar uma análise técnica completa do projeto devido a limitações técnicas.\n";
    }
    
    // Final da análise - recomendações
    try {
      const recommendationsPrompt = `
Com base nas informações analisadas sobre os commits e estrutura do projeto, forneça recomendações técnicas específicas e acionáveis para melhorar a qualidade do código, arquitetura e processo de desenvolvimento.

Suas recomendações devem ser:
1. Específicas: cite componentes, arquivos ou padrões exatos
2. Técnicas: ofereça soluções práticas de engenharia
3. Relevantes: relacionadas diretamente às implementações recentes
4. Detalhadas: explique como implementar cada sugestão

IMPORTANTE: Evite conselhos genéricos como "adicione mais testes". Em vez disso, sugira quais tipos específicos de testes seriam mais úteis para os componentes identificados e como implementá-los.
`;

      const recommendationsResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Você é um especialista em arquitetura de software e práticas de desenvolvimento. Sua tarefa é fornecer recomendações técnicas extremamente específicas e práticas." },
          { role: "user", content: recommendationsPrompt }
        ],
        temperature: 0.4,
        max_tokens: 600,
      });
      
      combinedAnalysis += "\n\n## RECOMENDAÇÕES TÉCNICAS\n\n";
      combinedAnalysis += recommendationsResponse.choices[0]?.message?.content || "";
    } catch (error: any) {
      console.error("Error creating recommendations:", error?.message || error);
      combinedAnalysis += "\n\n## RECOMENDAÇÕES TÉCNICAS\n\n";
      combinedAnalysis += "Não foi possível gerar recomendações técnicas específicas devido a limitações técnicas.\n";
    }

    // Estátisticas para a UI
    const stats = {
      commits: processedCommits.length,
      directCommits: directCommits.length,
      mergeCommits: mergeCommits.length,
      totalFiles,
      totalAdditions,
      totalDeletions,
      contributors
    };
    
    return NextResponse.json({ 
      success: true, 
      insight: combinedAnalysis,
      stats
    });
  } catch (error: any) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ 
      error: "Failed to generate insights", 
      message: error.message || String(error)
    }, { status: 500 });
  }
} 