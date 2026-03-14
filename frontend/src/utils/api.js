import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export const sendMessage = async (message, history = [], convoId = null) => {
  const formattedHistory = (history || []).map((msg) => ({
    role: msg.role,
    content: msg.content
  }));

  const response = await axios.post(
    `${API_BASE_URL}/chat`,
    { message, history: formattedHistory, convo_id: convoId },
    { headers: authHeaders() }
  );

  return response.data;
};

export const login = async (email, password) => {
  const response = await axios.post(`${API_BASE_URL}/login`, { email, password });
  return response.data;
};

export const register = async (name, email, password) => {
  const response = await axios.post(`${API_BASE_URL}/register`, {
    name,
    email,
    password
  });
  return response.data;
};

export const getConversations = async () => {
  const response = await axios.get(`${API_BASE_URL}/conversations`, {
    headers: authHeaders()
  });
  return response.data;
};

export const createConversation = async () => {
  const response = await axios.post(
    `${API_BASE_URL}/conversation/new`,
    {},
    { headers: authHeaders() }
  );
  return response.data;
};

export const getConversation = async (convoId) => {
  const response = await axios.get(`${API_BASE_URL}/conversation/${convoId}`, {
    headers: authHeaders()
  });
  return response.data;
};

export const deleteConversation = async (convoId) => {
  const response = await axios.delete(`${API_BASE_URL}/conversation/${convoId}`, {
    headers: authHeaders()
  });
  return response.data;
};

export const undoDeleteConversation = async (convoId) => {
  const response = await axios.post(
    `${API_BASE_URL}/conversation/${convoId}/undo-delete`,
    {},
    { headers: authHeaders() }
  );
  return response.data;
};

export const getDashboardSummary = async () => {
  const response = await axios.get(`${API_BASE_URL}/dashboard/summary`, {
    headers: authHeaders()
  });
  return response.data;
};