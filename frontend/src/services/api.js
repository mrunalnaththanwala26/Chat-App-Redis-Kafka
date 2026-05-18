import axios from 'axios';

/** Paths must not start with `/` or axios drops the baseURL path (e.g. becomes POST /register → 404). */
const authApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE || ''}/api/auth`,
});

const chatApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE || ''}/api/chat`,
});

function attachAuth(instance) {
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

attachAuth(chatApi);

export { authApi, chatApi };
