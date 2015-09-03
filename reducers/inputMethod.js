import * as types from '../actions/AppActions';
import * as constants from '../constants/AppConstants';

const actionsMap = {
  [types.SET_INPUT_METHOD]: setInputMethod
};

export default function inputMethod(state = constants.INPUT_METHOD_TIBETAN_SAMBHOTA2, action) {
  const reduceFn = actionsMap[action.type];
  return reduceFn ? reduceFn(state, action) : state;
}

function setInputMethod(state, action) {
  state = action.inputMethod;
  return state;
}
