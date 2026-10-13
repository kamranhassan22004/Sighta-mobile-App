let generation = 0;
let sessionToken = null;
let initialized = false;

export const sessionSnapshot = () => ({ generation, token: sessionToken, initialized });
export const changeSession = (token = null) => {
  generation += 1;
  sessionToken = token;
  initialized = true;
  return generation;
};
export const setSessionToken = (token) => { sessionToken = token; initialized = true; };
