import { createAction } from 'redux-actions';
import * as api from '../lib/auth';
import { createAsyncAction } from '../lib/reduxHelpers';

export const LOGIN_WITH_PASSWORD = 'LOGIN_WITH_PASSWORD';
export const LOGIN_WITH_KEY = 'LOGIN_FROM_KEY';
export const LOGOUT = 'LOGOUT';
export const SET_LOGIN_ERROR_MESSAGE = 'SET_LOGIN_ERROR_MESSAGE';

// pass in email and key
export const loginWithKey = createAsyncAction(LOGIN_WITH_KEY, api.promiseToLoginWithKey);

// pass in email and password
export const loginWithPassword = createAsyncAction(LOGIN_WITH_PASSWORD, api.promiseToLoginWithPassword);

export const setLoginErrorMessage = createAction(SET_LOGIN_ERROR_MESSAGE, msg => msg);

export const logout = createAction(LOGOUT);

/*
export function loginWithKey(email, key) {
  return {
    type: LOGIN_WITH_KEY,
    payload: {
      promise: promiseToLoginWithKey(email, key),
      email,
    },
  };
}

export function loginWithPassword(email, password, destination) {
  return {
    type: LOGIN_WITH_PASSWORD,
    payload: {
      promise: promiseToLoginWithPassword(email, password),
      email,
      destination,
    },
  };
}
*/
