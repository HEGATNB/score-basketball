import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiRequest } from '@/shared/api/client';

// Предзагрузка данных для часто используемых страниц
export const PrefetchProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  useEffect(() => {
    // Предзагрузка команд всегда
    apiRequest('/teams').catch(() => {});

    // Предзагрузка матчей для главной
    if (location.pathname === '/') {
      apiRequest('/matches?limit=5').catch(() => {});
    }
  }, [location]);

  return <>{children}</>;
};