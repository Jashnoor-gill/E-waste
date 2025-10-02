// Socket.io client for real-time updates
import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

const socket = io('http://localhost:5000');

export default socket;
