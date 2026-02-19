import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { dbTeams, Team } from "@/shared/api/db";

export function TeamCreatePage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState("");
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);

  if (!isAdmin) {
    return <div>Доступ запрещен</div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("Введите название");

    const newTeam: Team = {
      id: Date.now(), // Генерим ID
      name,
      wins,
      losses,
      avgPointsFor: 0,
      avgPointsAgainst: 0
    };

    dbTeams.create(newTeam, user!);
    alert("Команда создана!");
    navigate("/teams");
  };

  return (
    <section style={{ maxWidth: 400 }}>
      <h1>Новая команда</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input 
          placeholder="Название (напр. Химки)" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          style={{ padding: 8 }}
        />
        <label>
          Победы: <input type="number" value={wins} onChange={e => setWins(Number(e.target.value))} style={{ width: 60 }} />
        </label>
        <label>
          Поражения: <input type="number" value={losses} onChange={e => setLosses(Number(e.target.value))} style={{ width: 60 }} />
        </label>
        
        <button type="submit">Сохранить</button>
      </form>
    </section>
  );
}
