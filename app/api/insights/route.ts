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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { commits } = body as { commits: Commit[] };
    
    if (!commits || !Array.isArray(commits) || commits.length === 0) {
      return NextResponse.json({ error: "Invalid commits data" }, { status: 400 });
    }

    // Separate regular commits and merge commits for different analysis
    const regularCommits = commits.filter(c => !c.isMergeCommit);
    const mergeCommits = commits.filter(c => c.isMergeCommit);
    
    // Generate a detailed analysis for all commits together
    let combinedAnalysis = "";
    
    // Only analyze regular commits if there are any
    if (regularCommits.length > 0) {
      const regularCommitsPrompt = `
Analise os seguintes commits regulares em um repositório e forneça um resumo técnico detalhado em português sobre as alterações:

${regularCommits.map(c => `
COMMIT: ${c.message}
AUTOR: ${c.author}
DATA: ${new Date(c.date).toLocaleDateString()}
ARQUIVOS ALTERADOS:
${c.fileDetails.map(file => `- ${file.filename} (${file.additions} adições, ${file.deletions} remoções)`).join('\n')}

${c.fileDetails.map(file => file.patch ? `MUDANÇAS EM ${file.filename}:\n${file.patch}\n` : '').join('\n')}
`).join('\n---\n')}

Forneça:
1. Um resumo técnico das alterações principais (2-3 frases)
2. Identificação de padrões de desenvolvimento ou práticas
3. Uma categorização dos tipos de alterações (ex: correções de bugs, novas funcionalidades, refatoração)
`;

      const regularResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: regularCommitsPrompt }],
        temperature: 0.5,
        max_tokens: 700,
      });
      
      combinedAnalysis += regularResponse.choices[0]?.message?.content || "";
    }
    
    // Analyze merge commits if there are any
    if (mergeCommits.length > 0) {
      const mergeCommitsPrompt = `
Analise os seguintes commits de merge em um repositório e forneça um resumo técnico detalhado em português sobre o que foi integrado:

${mergeCommits.map(c => `
COMMIT DE MERGE: ${c.message}
AUTOR: ${c.author}
DATA: ${new Date(c.date).toLocaleDateString()}
TOTAL DE COMMITS MESCLADOS: ${c.mergeDetails?.totalCommits || "Desconhecido"}

ARQUIVOS ALTERADOS NA MESCLAGEM:
${c.mergeDetails?.changedFiles.map(file => 
  `- ${file.filename} (${file.status}, ${file.additions} adições, ${file.deletions} remoções)`
).join('\n') || "Informação não disponível"}

${c.mergeDetails?.changedFiles.map(file => 
  file.patch ? `MUDANÇAS EM ${file.filename}:\n${file.patch}\n` : ''
).join('\n') || ""}
`).join('\n---\n')}

Forneça:
1. Um resumo técnico do que foi mesclado e por que isso é importante (2-3 frases)
2. Qual parece ser o propósito desta mesclagem (nova funcionalidade, correção de bug, etc.)
3. Quais códigos ou componentes foram significativamente alterados
`;

      const mergeResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: mergeCommitsPrompt }],
        temperature: 0.5,
        max_tokens: 700,
      });
      
      if (combinedAnalysis) {
        combinedAnalysis += "\n\n--- ANÁLISE DE MERGES ---\n\n";
      }
      
      combinedAnalysis += mergeResponse.choices[0]?.message?.content || "";
    }
    
    // Final combined analysis for all commits
    if (regularCommits.length > 0 && mergeCommits.length > 0) {
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
    }
    
    const insight = combinedAnalysis || "Não foi possível gerar insights.";
    
    return NextResponse.json({ insight });
  } catch (error) {
    console.error("Error generating insights:", error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
} 