const { Op } = require('sequelize');

const { Driver, Ride, User } = require('../models');
const { getDistanceInKm } = require('../utils/distance');

const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getDashboardSummary = async () => {
  const { start, end } = getTodayRange();

  const ridesToday = await Ride.findAll({
    where: {
      createdAt: {
        [Op.between]: [start, end]
      }
    }
  });

  const ridesTodayCount = ridesToday.length;
  const revenueToday = ridesToday.reduce((sum, ride) => {
    if (ride.status === 'completed' && ride.fare) {
      return sum + Number(ride.fare);
    }
    return sum;
  }, 0);

  const activeDrivers = await Driver.count({
    where: {
      kycStatus: 'approved'
    }
  });

  const onlineDrivers = await Driver.count({
    where: {
      isOnline: true
    }
  });

  const now = new Date();
  const buckets = [];
  for (let i = 7; i >= 0; i -= 1) {
    const bucketTime = new Date(now);
    bucketTime.setHours(now.getHours() - i, 0, 0, 0);
    buckets.push({
      time: bucketTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      rides: 0,
      revenue: 0
    });
  }

  ridesToday.forEach((ride) => {
    const createdAt = new Date(ride.createdAt);
    const hourIndex = Math.max(
      0,
      Math.min(
        buckets.length - 1,
        buckets.length - 1 - Math.floor((now - createdAt) / (60 * 60 * 1000))
      )
    );
    const bucket = buckets[hourIndex];
    if (bucket) {
      bucket.rides += 1;
      if (ride.status === 'completed' && ride.fare) {
        bucket.revenue += Number(ride.fare);
      }
    }
  });

  return {
    metrics: {
      ridesToday: ridesTodayCount,
      activeDrivers,
      onlineDrivers,
      revenueToday: Number(revenueToday.toFixed(2))
    },
    rideTrend: buckets
  };
};

const getUsers = async () => {
  const users = await User.findAll({
    order: [['createdAt', 'DESC']]
  });

  return Promise.all(
    users.map(async (user) => {
      const totalRides = await Ride.count({
        where: {
          riderId: user.id
        }
      });

      return {
        id: user.id,
        name: user.name || 'Rider',
        role: user.role,
        phoneNumber: user.phoneNumber,
        totalRides,
        createdAt: user.createdAt,
        status: 'active'
      };
    })
  );
};

const getDrivers = async () => {
  const drivers = await Driver.findAll({
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'phoneNumber']
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  return Promise.all(
    drivers.map(async (driver) => {
      const trips = await Ride.findAll({
        where: {
          driverId: driver.id
        }
      });

      const totalTrips = trips.length;
      const earnings = trips.reduce((sum, ride) => {
        if (ride.status === 'completed' && ride.fare) {
          return sum + Number(ride.fare);
        }
        return sum;
      }, 0);

      return {
        id: driver.id,
        name: driver.user?.name || 'Driver',
        phoneNumber: driver.user?.phoneNumber || '--',
        vehicleType: driver.vehicleType || '--',
        vehicleNumber: driver.vehicleNumber || '--',
        kycStatus: driver.kycStatus,
        isOnline: driver.isOnline,
        isActive: driver.kycStatus === 'approved',
        totalTrips,
        earnings: Number(earnings.toFixed(2))
      };
    })
  );
};

const getRides = async () => {
  const rides = await Ride.findAll({
    include: [
      {
        model: User,
        as: 'rider',
        attributes: ['name', 'phoneNumber']
      },
      {
        model: Driver,
        as: 'driver',
        attributes: ['id']
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  return rides.map((ride) => {
    const distanceKm = getDistanceInKm(
      Number(ride.pickupLat),
      Number(ride.pickupLng),
      Number(ride.dropLat),
      Number(ride.dropLng)
    );

    return {
      id: ride.id,
      riderName: ride.rider?.name || 'Rider',
      driverName: ride.driver?.id ? 'Driver Assigned' : 'Unassigned',
      pickup: `${Number(ride.pickupLat).toFixed(5)}, ${Number(ride.pickupLng).toFixed(5)}`,
      dropoff: `${Number(ride.dropLat).toFixed(5)}, ${Number(ride.dropLng).toFixed(5)}`,
      distanceKm: Number(distanceKm.toFixed(2)),
      fare: ride.fare ? Number(ride.fare) : 0,
      createdAt: ride.createdAt,
      status: ride.status
    };
  });
};

module.exports = {
  getDashboardSummary,
  getUsers,
  getDrivers,
  getRides
};
