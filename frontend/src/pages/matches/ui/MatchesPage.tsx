import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiRequest } from '@/shared/api/client';
import { GlowingCard } from '@/shared/ui/GlowingCard';

interface Match {
  id: number;
  date: string;
  status: string;
  homeTeam: { id: number; name: string; abbrev: string };
  awayTeam: { id: number; name: string; abbrev: string };
  homeScore: number | null;
  awayScore: number | null;
}

export const MatchesPage = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      const data = await apiRequest<Match[]>('/matches');
      setMatches(data);
    } catch (err) {
      console.error('Ошибка загрузки матчей:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Матчи</h1>
      
      <div className="space-y-4">
        {matches.map((match) => (
          <Link key={match.id} to={`/matches/${match.id}`}>
            <GlowingCard className="p-6 hover:border-orange-500/50 transition-all">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm">
                      {new Date(match.date).toLocaleDateString()}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      match.status === 'finished' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {match.status === 'finished' ? 'Завершен' : 'Ожидается'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-6 mt-2">
                    <span className="font-bold text-white">{match.homeTeam.name}</span>
                    <span className="text-slate-600">VS</span>
                    <span className="font-bold text-white">{match.awayTeam.name}</span>
                  </div>
                </div>
                
                {match.status === 'finished' && match.homeScore !== null && (
                  <div className="text-2xl font-bold text-white">
                    {match.homeScore} : {match.awayScore}
                  </div>
                )}
              </div>
            </GlowingCard>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default MatchesPage;