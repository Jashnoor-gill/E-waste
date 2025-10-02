// Simple in-app notification popup
export function showNotification(message) {
  let notif = document.createElement('div');
  notif.className = 'notification-popup';
  notif.innerText = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// Real-time notifications
import socket from './socket.js';
socket.on('binStatusUpdate', (bin) => {
  showNotification(`Bin status updated: ${bin.location} is now ${bin.status} (${bin.level}%)`);
});
