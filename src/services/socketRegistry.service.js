const driverSockets = new Map();

const registerDriverSocket = (driverId, socketId) => {
  if (!driverSockets.has(driverId)) {
    driverSockets.set(driverId, new Set());
  }

  driverSockets.get(driverId).add(socketId);
};

const unregisterDriverSocket = (driverId, socketId) => {
  if (!driverSockets.has(driverId)) {
    return;
  }

  const sockets = driverSockets.get(driverId);
  sockets.delete(socketId);

  if (sockets.size === 0) {
    driverSockets.delete(driverId);
  }
};

const getDriverSocketIds = (driverId) => Array.from(driverSockets.get(driverId) || []);

module.exports = {
  registerDriverSocket,
  unregisterDriverSocket,
  getDriverSocketIds
};
