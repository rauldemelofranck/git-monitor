"use client";

import { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type Commit = {
  date: string;
  isMergeCommit: boolean;
};

type Props = {
  commits: Commit[];
};

export default function CommitActivityChart({ commits }: Props) {
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    if (!commits?.length) return;

    // Preparar dados para o gráfico
    const dates = new Map<string, { direct: number; merge: number }>();

    // Obter apenas os últimos 30 dias para o gráfico
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    // Criar todas as datas no período para garantir continuidade no gráfico
    const dateRange: string[] = [];
    const currentDate = new Date(thirtyDaysAgo);
    
    while (currentDate <= new Date()) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dateRange.push(dateStr);
      dates.set(dateStr, { direct: 0, merge: 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Contar commits por data
    commits.forEach(commit => {
      const commitDate = new Date(commit.date);
      
      // Ignorar commits fora do período de 30 dias
      if (commitDate < thirtyDaysAgo) return;
      
      const dateStr = commitDate.toISOString().split('T')[0];
      const current = dates.get(dateStr) || { direct: 0, merge: 0 };
      
      if (commit.isMergeCommit) {
        current.merge += 1;
      } else {
        current.direct += 1;
      }
      
      dates.set(dateStr, current);
    });

    // Formatar dados para o gráfico
    const directCommits = dateRange.map(date => dates.get(date)?.direct || 0);
    const mergeCommits = dateRange.map(date => dates.get(date)?.merge || 0);
    
    // Formatar datas para exibição (DD/MM)
    const labels = dateRange.map(date => {
      const [y, m, d] = date.split('-');
      return `${d}/${m}`;
    });

    setChartData({
      labels,
      datasets: [
        {
          label: 'Commits Diretos',
          data: directCommits,
          borderColor: 'rgba(139, 92, 246, 1)',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Merges',
          data: mergeCommits,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          fill: true,
        }
      ],
    });
  }, [commits]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
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
        text: 'Atividade de Commits',
      },
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 10
          },
          maxRotation: 0,
          maxTicksLimit: 10
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            size: 10
          },
          precision: 0
        }
      }
    }
  };

  if (!chartData) {
    return <div className="flex items-center justify-center h-full">Preparando dados...</div>;
  }

  return <Line options={options} data={chartData} />;
} 