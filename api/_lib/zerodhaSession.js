let sessionState = {
  connected: false,
  userId: null,
  userName: null,
  accessToken: process.env.KITE_ACCESS_TOKEN || "",
  publicToken: "",
  loginTime: null,
  expiresAt: null,
  provider: "kite-direct",
  requestToken: null,
};

if (sessionState.accessToken) {
  sessionState.connected = true;
  sessionState.loginTime = new Date().toISOString();
}

function getSession() {
  return { ...sessionState };
}

function setSession(update) {
  sessionState = {
    ...sessionState,
    ...update,
  };

  if (sessionState.accessToken) {
    sessionState.connected = true;
    if (!sessionState.loginTime) sessionState.loginTime = new Date().toISOString();
  }

  return getSession();
}

function clearSession() {
  sessionState = {
    connected: false,
    userId: null,
    userName: null,
    accessToken: "",
    publicToken: "",
    loginTime: null,
    expiresAt: null,
    provider: sessionState.provider,
    requestToken: null,
  };
  return getSession();
}

module.exports = {
  getSession,
  setSession,
  clearSession,
};
