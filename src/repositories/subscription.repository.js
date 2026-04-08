const { Subscription } = require('../models');

const getActiveSubscriptionByDriverId = (driverId) =>
  Subscription.findOne({
    where: {
      driverId,
      status: 'active'
    },
    order: [['endDate', 'DESC']]
  });

module.exports = {
  getActiveSubscriptionByDriverId
};
