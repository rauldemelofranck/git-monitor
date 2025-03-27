"use client";

import { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type Commit = {
  date: string;
  fileDetails: {
    additions: number;
    deletions: number;
  }[];
  mergeDetails?: {
    changedFiles: {
      additions: number;
      deletions: number;
    }[];
  } | null;
};

type Props = {
  commits: Commit[];
};

export default function CodeChangesChart({ commits }: Props) {
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    if (!commits?.length) return;

    // Agregar mudanças por data
    const changesByDate = new Map<string, { additions: number; deletions: number }>();
    
    // Criar range de datas (últimos 14 dias)
    const now = new Date();
    const twoWeeksAgo = new Date(now.setDate(now.getDate() - 14));
    
    const dateRange: string[] = [];
    const currentDate = new Date(twoWeeksAgo);
    
    while (currentDate <= new Date()) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dateRange.push(dateStr);
      changesByDate.set(dateStr, { additions: 0, deletions: 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Processar adições/remoções por commit
    commits.forEach(commit => {
      const commitDate = new Date(commit.date);
      
      // Ignorar commits fora do período
      if (commitDate < twoWeeksAgo) return;
      
      const dateStr = commitDate.toISOString().split('T')[0];
      const current = changesByDate.get(dateStr) || { additions: 0, deletions: 0 };
      
      // Contar adições/remoções de commits regulares
      commit.fileDetails.forEach(file => {
        current.additions += file.additions || 0;
        current.deletions += file.deletions || 0;
      });
      
      // Contar adições/remoções de merges
      if (commit.mergeDetails?.changedFiles) {
        commit.mergeDetails.changedFiles.forEach(file => {
          current.additions += file.additions || 0;
          current.deletions += file.deletions || 0;
        });
      }
      
      changesByDate.set(dateStr, current);
    });
    
    // Preparar dados para o gráfico
    const additions = dateRange.map(date => changesByDate.get(date)?.additions || 0);
    const deletions = dateRange.map(date => changesByDate.get(date)?.deletions || 0).map(v => -v); // Negativo para mostrar abaixo do eixo
    
    // Formatar datas para exibição
    const labels = dateRange.map(date => {
      const [y, m, d] = date.split('-');
      return `${d}/${m}`;
    });
    
    setChartData({
      labels,
      datasets: [
        {
          label: 'Adições',
          data: additions,
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgba(22, 163, 74, 1)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6,
        },
        {
          label: 'Remoções',
          data: deletions,
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgba(220, 38, 38, 1)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6,
        }
      ],
    });
  }, [commits]);
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 6,
          font: {
            size: 11
          }
        }
      },
      title: {
        display: false,
        text: 'Alterações de Código',
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            let value = context.raw || 0;
            // Mostrar valores positivos para remoções no tooltip
            if (label === 'Remoções') value = Math.abs(value);
            return `${label}: ${value} linhas`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 10
          },
          maxRotation: 0,
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            size: 10
          },
          callback: function(value: any) {
            return Math.abs(Number(value));
          }
        }
      }
    }
  };
  
  if (!chartData) {
    return <div className="flex items-center justify-center h-full">Preparando dados...</div>;
  }
  
  return <Bar options={options} data={chartData} />;
} 