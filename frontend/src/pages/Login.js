import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  async function handleLogin() {
    try {
      await axios.post(`${process.env.REACT_APP_FASTAPI_URL}/login`, { email, password }, { withCredentials: true });
      window.location.reload();
    } catch (error) {
      alert("로그인 실패");
    }
  }

  return (
    <div>
      <h2>로그인</h2>
      <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin}>로그인</button>
      <p>계정이 없으신가요? <button onClick={() => navigate("/register")}>회원가입</button></p>
    </div>
  );
}

export default Login;