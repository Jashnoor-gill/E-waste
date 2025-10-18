// Socket.io client for real-time updates
import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

const HOST = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
const socket = io(`http://${HOST}:5000`);

export default socket;
