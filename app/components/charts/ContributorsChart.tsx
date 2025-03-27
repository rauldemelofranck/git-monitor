"use client";

import { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type Contributor = {
  name: string;
  totalCommits: number;
  directCommits: number;
  mergeCommits: number;
  additions: number;
  deletions: number;
  filesChanged: number;
};

type Props = {
  contributors: Contributor[];
};

export default function ContributorsChart({ contributors }: Props) {
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    if (!contributors?.length) return;

    // Sort contributors by total commits and get top 10
    const topContributors = [...contributors]
      .sort((a, b) => b.totalCommits - a.totalCommits)
      .slice(0, 8);

    // Create chart data
    const labels = topContributors.map(c => c.name.split(' ')[0]); // Use first name for brevity
    const directCommits = topContributors.map(c => c.directCommits);
    const mergeCommits = topContributors.map(c => c.mergeCommits);

    setChartData({
      labels,
      datasets: [
        {
          label: 'Commits Diretos',
          data: directCommits,
          backgroundColor: 'rgba(139, 92, 246, 0.8)',
          borderColor: 'rgba(124, 58, 237, 1)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
        },
        {
          label: 'Merges',
          data: mergeCommits,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgba(37, 99, 235, 1)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
        },
      ],
    });
  }, [contributors]);

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
        text: 'Contribuições por Autor',
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.raw || 0;
            return `${label}: ${value} commits`;
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
          }
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

  return <Bar options={options} data={chartData} />;
} 