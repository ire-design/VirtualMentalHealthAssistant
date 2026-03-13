export const sendMessage = async (message, history = [], convoId = null) => {
  try {
    const token = localStorage.getItem('token');
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const formattedHistory = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const response = await axios.post(`${API_BASE_URL}/chat`, {
      message: message,
      history: formattedHistory,
      convo_id: convoId  // NEW
    }, { headers });
    
    return response.data;
    
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};