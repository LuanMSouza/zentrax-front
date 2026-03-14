import axios, { AxiosResponse, InternalAxiosRequestConfig, AxiosError } from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL
});

api.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {

        let token;

        if (typeof window !== 'undefined') {
            token = Cookies.get('token')
        } else {
            const { cookies } = await import('next/headers');
            const cookieStore = await cookies();
            token = cookieStore.get('token')?.value;
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError) => Promise.reject(error)
);

// 👉 RESPONSE
api.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.response) {
            if (error.response.status === 401 || error.response.status === 403) {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;