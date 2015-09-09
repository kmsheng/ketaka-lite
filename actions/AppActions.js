import Store from '../services/Store';

export function toggleDirection() {
  return dispatch => {

    let settings = Store.get('settings') || {};

    settings.direction = ! settings.direction;
    Store.set('settings', settings);

    dispatch(receiveSettings(settings));
  };
}

export function setInputMethod(inputMethod) {
  return dispatch => {
    let settings = Store.get('settings') || {};

    settings.inputMethod = inputMethod;
    Store.set('settings', settings);
    dispatch(receiveSettings(settings));
  };
}

export function toggleReadonly() {
  return dispatch => {
    let settings = Store.get('settings') || {};

    settings.readonly = ! settings.readonly;
    Store.set('settings', settings);
    dispatch(receiveSettings(settings));
  };
}

export const RECEIVE_SETTINGS = 'RECEIVE_SETTINGS';

export function receiveSettings(settings) {
  return {
    type: RECEIVE_SETTINGS,
    settings
  };
}

export function setFontSize(fontSize) {
  return dispatch => {

    let settings = Store.get('settings') || {};

    settings.fontSize = fontSize;
    Store.set('settings', settings);

    dispatch(receiveSettings(settings));
  };
}

export function setLineHeight(lineHeight) {
  return dispatch => {

    let settings = Store.get('settings') || {};

    settings.lineHeight = lineHeight;
    Store.set('settings', settings);

    dispatch(receiveSettings(settings));
  };
}

export function setLetterSpacing(letterSpacing) {
  return dispatch => {

    let settings = Store.get('settings') || {};

    settings.letterSpacing = letterSpacing;
    Store.set('settings', settings);

    dispatch(receiveSettings(settings));
  };
}

export function initSettings() {
  return dispatch => {
    let settings = Store.get('settings') || {};
    dispatch(receiveSettings(settings));
  };
}

