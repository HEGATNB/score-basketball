import { Prediction } from "../model/types";

// "Бэкенд" функция: принимает ID команд, возвращает прогноз с задержкой
export async function calculatePrediction(t1: number, t2: number): Promise<Prediction> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Имитируем "умный" расчет: рандом, зависящий от ID (чтобы не прыгало)
      const baseProb = 0.5 + (t1 > t2 ? 0.1 : -0.1); 
      const p1 = Math.min(0.9, Math.max(0.1, baseProb + (Math.random() * 0.2 - 0.1)));
      
      resolve({
        id: crypto.randomUUID(),
        team1Id: t1,
        team2Id: t2,
        probabilities: {
          team1: Number((p1 * 100).toFixed(1)),
          team2: Number(((1 - p1) * 100).toFixed(1)),
        },
        expectedScore: {
          team1: Math.floor(80 + p1 * 20),
          team2: Math.floor(80 + (1 - p1) * 20),
        },
        createdAt: new Date().toISOString(),
      });
    }, 1500); // 1.5 сек задержка "думает AI"
  });
}
