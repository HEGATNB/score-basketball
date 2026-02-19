import { useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, pass);
    if (success) {
      navigate("/");
    } else {
      setError("Неверный email или пароль");
    }
  };

  return (
    <section style={{ maxWidth: 400, margin: "0 auto" }}>
      <h1>Вход в систему</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input 
          placeholder="Email (admin@sys.com)" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          style={{ padding: 8 }}
        />
        <input 
          type="password" 
          placeholder="Пароль (admin)" 
          value={pass} 
          onChange={e => setPass(e.target.value)} 
          style={{ padding: 8 }}
        />
        {error && <div style={{ color: "red" }}>{error}</div>}
        <button type="submit">Войти</button>
      </form>
      <div style={{ marginTop: 20, fontSize: "0.9em", color: "#666" }}>
        <p>Тестовые аккаунты:</p>
        <ul>
          <li>Admin: admin@sys.com / admin</li>
          <li>Analyst: oper@sys.com / oper</li>
          <li>User: user@sys.com / user</li>
        </ul>
      </div>
    </section>
  );
}
