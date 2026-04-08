const admin = require('firebase-admin');

const env = require('./env');

if (!admin.apps.length) {
  const initializeOptions = {
    projectId: env.firebase.projectId
  };

  if (env.firebase.clientEmail && env.firebase.privateKey) {
    initializeOptions.credential = admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey
    });
  }

  admin.initializeApp(initializeOptions);
}

module.exports = admin;
