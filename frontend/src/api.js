import axios from 'axios'

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:4000'
  : 'https://bookloop-lite-backend.onrender.com'

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export default api