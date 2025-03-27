"use client";

import { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

type Commit = {
  fileDetails: {
    filename: string;
  }[];
  mergeDetails?: {
    changedFiles: {
      filename: string;
    }[];
  } | null;
};

type Props = {
  commits: Commit[];
};

export default function TopFilesChart({ commits }: Props) {
  const [chartData, setChartData] = useState<any>(null);
  const [tooltipMap, setTooltipMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!commits?.length) return;

    // Contar ocorrências de cada arquivo
    const fileOccurrences = new Map<string, number>();
    const tooltipMapping = new Map<string, string>();
    
    // Processar commits
    commits.forEach(commit => {
      // Arquivos em commits regulares
      commit.fileDetails.forEach(file => {
        const current = fileOccurrences.get(file.filename) || 0;
        fileOccurrences.set(file.filename, current + 1);
      });
      
      // Arquivos em merges
      if (commit.mergeDetails?.changedFiles) {
        commit.mergeDetails.changedFiles.forEach(file => {
          const current = fileOccurrences.get(file.filename) || 0;
          fileOccurrences.set(file.filename, current + 1);
        });
      }
    });
    
    // Ordenar por número de ocorrências e pegar os 8 principais
    const topFiles = Array.from(fileOccurrences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
      
    // Função para obter um nome de arquivo mais curto para exibição
    const getShortFileName = (filename: string): string => {
      // Obter apenas o nome do arquivo sem o caminho
      const parts = filename.split('/');
      const basename = parts[parts.length - 1];
      
      // Se for muito longo, truncar
      if (basename.length > 15) {
        return basename.substring(0, 12) + '...';
      }
      
      return basename;
    };
    
    // Preparar dados para o gráfico
    const labels = topFiles.map(([filename]) => getShortFileName(filename));
    const data = topFiles.map(([_, count]) => count);
    
    // Criar mapeamento para tooltip
    topFiles.forEach(([filename]) => {
      tooltipMapping.set(getShortFileName(filename), filename);
    });
    
    setTooltipMap(tooltipMapping);
    
    // Cores para o gráfico
    const backgroundColors = [
      'rgba(54, 162, 235, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)',
      'rgba(255, 99, 132, 0.8)',
      'rgba(255, 206, 86, 0.8)',
      'rgba(111, 219, 158, 0.8)',
      'rgba(232, 126, 164, 0.8)'
    ];
    
    const borderColors = [
      'rgba(54, 162, 235, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)',
      'rgba(255, 99, 132, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(111, 219, 158, 1)',
      'rgba(232, 126, 164, 1)'
    ];
    
    setChartData({
      labels,
      datasets: [
        {
          data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
        },
      ],
    });
  }, [commits]);
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          font: {
            size: 10
          },
          boxWidth: 12,
          padding: 8
        }
      },
      title: {
        display: false,
        text: 'Arquivos Mais Modificados',
      },
      tooltip: {
        callbacks: {
          title: function(tooltipItems: any[]) {
            const item = tooltipItems[0];
            const label = item.label;
            return tooltipMap.get(label) || label;
          },
          label: function(context: any) {
            const value = context.raw;
            const percentage = ((value / context.dataset.data.reduce((a: number, b: number) => a + b, 0)) * 100).toFixed(1);
            return `${value} modificações (${percentage}%)`;
          }
        }
      }
    }
  };
  
  if (!chartData) {
    return <div className="flex items-center justify-center h-full">Preparando dados...</div>;
  }
  
  return <Pie options={options} data={chartData} />;
} 