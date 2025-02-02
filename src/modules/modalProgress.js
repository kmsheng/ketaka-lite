import {each, isFunction} from 'lodash';

const INIT_MODAL = 'ketaka-lite/modalProgress/INIT_MODAL';
const ADD_MESSAGES = 'ketaka-lite/modalProgress/ADD_MESSAGES';
const CLOSE_MODAL = 'ketaka-lite/modalProgress/CLOSE_MODAL';
const OPEN_MODAL = 'ketaka-lite/modalProgress/OPEN_MODAL';
const SET_MESSAGES = 'ketaka-lite/modalProgress/SET_MESSAGES';
const SET_OPTIONS = 'ketaka-lite/modalProgress/SET_OPTIONS';

const initialState = {
  title: '',
  firstButtonStyle: 'link',
  firstButtonText: 'First Button',
  messages: [],
  isModalVisible: false,
  progress: 0,
  progressBarStyle: 'info',
  progressBarActive: false,
  secondButtonStyle: 'primary',
  secondButtonText: 'Second Button',
  showFirstButton: false,
  showSecondButton: false
};

const actionsMap = {

  [INIT_MODAL]: state => initialState,

  [OPEN_MODAL]: (state, action) => Object.assign({}, state, action.args),

  [CLOSE_MODAL]: state => Object.assign({}, state, {isModalVisible: false}),

  [ADD_MESSAGES]: (state, action) => Object.assign({}, state, {messages: [...state.messages, ...action.messages]}),

  [SET_MESSAGES]: (state, action) => Object.assign({}, state, {messages: action.messages}),

  [SET_OPTIONS]: (state, action) => Object.assign({}, state, action.options)
};

export default function reducer(state = initialState, action) {
  const reduceFn = actionsMap[action.type];
  return reduceFn ? reduceFn(state, action) : state;
}

function removeFuncProp(args) {
  each(args, (value, prop) => {
    if (isFunction(value)) {
      delete args[prop];
    }
  });
  return args;
}

export function openModal(args = {}) {
  args.isModalVisible = true;
  return {
    type: OPEN_MODAL,
    args: removeFuncProp(args)
  };
}

export function closeModal() {
  return {
    type: CLOSE_MODAL
  };
}

export function addMessages(messages = []) {
  return {
    type: ADD_MESSAGES,
    messages
  };
}

export function setMessages(messages = []) {
  return {
    type: SET_MESSAGES,
    messages
  };
}

export function setOptions(options = []) {
  return {
    type: SET_OPTIONS,
    options
  };
}

export function initModal() {
  return {
    type: INIT_MODAL
  };
}
