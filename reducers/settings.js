import * as types from '../actions/AppActions';
import * as consts from '../constants/AppConstants';

const settings = {
  fontSize: 1,
  letterSpacing: 1,
  lineHeight: 1,
  direction: false,
  nsRatio: 0.5,
  ewRatio: 0.5,
  showImageOnly: false,
  inputMethod: consts.INPUT_METHOD_SYSTEM,
  spellCheckOn: false,
  readonly: false,
  theme: 'default'
};

const actionsMap = {
  [types.RECEIVE_SETTINGS]: receiveSettings
};

export default function(state = settings, action) {
  const reduceFn = actionsMap[action.type];
  return reduceFn ? reduceFn(state, action) : state;
}

function receiveSettings(state, action) {
  return Object.assign({}, state, action.settings);
}
