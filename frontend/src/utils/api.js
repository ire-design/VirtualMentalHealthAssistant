import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

export const sendMessage = async (message) => {
    try{
        const response = await axios.post(`${API_BASE_URL}/chat`, {
            message: message
        });
        return response.data.reply;
    } catch (error){
        console.error('API error:', error);
        throw error;
    }
}