import React, {PropTypes} from 'react';
import Codemirror from 'react-codemirror';
import Ime from '../services/Ime';
import shouldPureComponentUpdate from 'react-pure-render/function';
import {MAP_INPUT_METHODS, INPUT_METHOD_TIBETAN_SAMBHOTA,
  INPUT_METHOD_TIBETAN_SAMBHOTA2} from '../constants/AppConstants';
import classNames from 'classnames';
import {connect} from 'react-redux';

@connect(state => ({
  fontSize: state.app.fontSize,
  inputMethod: state.app.inputMethod,
  letterSpacing: state.app.letterSpacing,
  lineHeight: state.app.lineHeight,
  readonly: state.app.readonly,
  theme: state.app.theme
}), {}, null, {withRef: true})
export default class Editor extends React.Component {

  static PropTypes = {
    fontSize: PropTypes.number.isRequired,
    lineHeight: PropTypes.number.isRequired,
    letterSpacing: PropTypes.number.isRequired,
    readonly: PropTypes.bool.isRequired,
    style: PropTypes.prop,
    className: PropTypes.string,
    code: PropTypes.string,
    onCodemirrorChange: PropTypes.func,
    theme: PropTypes.string.isRequired,
    inputMethod: PropTypes.string.isRequired
  };

  state = {
    stacking: false
  };

  shouldComponentUpdate = shouldPureComponentUpdate;

  isVowels(e) {
    const vowelsKeyCodes = [65, 69, 73, 79, 85];
    return vowelsKeyCodes.includes(e.keyCode);
  }

  checkVowels = e => {
    const inputMethods = [
      INPUT_METHOD_TIBETAN_SAMBHOTA,
      INPUT_METHOD_TIBETAN_SAMBHOTA2
    ];
    if (this.isVowels(e) && inputMethods.includes(this.props.inputMethod)) {
      this.setState({
        stacking: false
      });
    }
  };

  isStackingKey = e => {
    const inputMethod = this.props.inputMethod;

    if (INPUT_METHOD_TIBETAN_SAMBHOTA === inputMethod) {
      // a
      return 65 === e.keyCode;
    }

    if (INPUT_METHOD_TIBETAN_SAMBHOTA2 === inputMethod) {
      // f
      return 70 === e.keyCode;
    }

    return false;
  };

  componentDidMount() {

    this.ime = Ime;
    this.codemirror = this.refs.codemirror.getCodeMirror();

    const {ime, codemirror} = this;

    this.imeKeypress = (cm, e) => ime.keypress(e, {cm});
    this.imeKeydown = (cm, e) => {
      ime.keydown(e, {cm});
      if (this.isStackingKey(e)) {
        this.setState({
          stacking: ! this.state.stacking
        });
        return;
      }
      this.checkVowels(e);
    };
    this.imeKeyup = (cm, e) => ime.keyup(e, {cm});

    codemirror.on('keypress', this.imeKeypress);
    codemirror.on('keydown', this.imeKeydown);
    codemirror.on('keyup', this.imeKeyup);

    const {width, height} = this.props.style;
    codemirror.setSize(width, height);
  }

  onCodemirrorChange = content => {
    this.props.onCodemirrorChange(this.codemirror, content);
  };

  refresh() {
    if (this.codemirror) {
      this.codemirror.refresh();
    }
  }

  componentWillUnmount() {
    const {codemirror} = this;
    codemirror.off('keypress', this.imeKeypress);
    codemirror.off('keydown', this.imeKeydown);
    codemirror.off('keyup', this.imeKeyup);
  }

  componentWillReceiveProps(nextProps) {

    this.ime.setInputMethod(MAP_INPUT_METHODS[nextProps.inputMethod]);

    if (this.props.theme !== nextProps.theme) {
      // force codemirror to reload theme
      this.codemirror.setOption('theme', nextProps.theme);
    }

    if (this.props.style.height !== nextProps.style.height) {
      this.codemirror.setSize(nextProps.style.width, nextProps.style.height);
    }
    if (this.props.style.width !== nextProps.style.width) {
      this.codemirror.setSize(nextProps.style.width, nextProps.style.height);
    }
  }

  hasFocus() {
    return this.codemirror.hasFocus();
  }

  focus() {
    return this.codemirror.focus();
  }

  undo() {
    this.codemirror.execCommand('undo');
  }

  redo() {
    this.codemirror.execCommand('redo');
  }

  componentDidUpdate(previousProps) {

    const self = this;

    ['fontSize', 'lineHeight', 'letterSpacing'].every(prop => {
      if (previousProps[prop] !== self.props[prop]) {
        self.refresh();
        return false;
      }
      return true;
    });
  }

  render() {

    const {code, className, fontSize, lineHeight, letterSpacing, readonly, theme} = this.props;

    const codemirrorProps = {
      onChange: this.onCodemirrorChange,
      componentDidMount: CM => {
        CM.keyMap.default.fallthrough = 'basic';
      },
      options: {
        mode: 'text/html',
        matchTags: {bothTags: true},
        theme: theme,
        lineWrapping: true,
        lineNumbers: true,
        undoDepth: 0,
        styleActiveLine: true,
        extraKeys: {
          Enter: (cm) => {
            cm.replaceSelection('\n', 'end');
          },
          Tab: (cm) => {
            // indent with 2 spaces
            cm.replaceSelection('  ');
          }
        }
      },
      ref: 'codemirror',
      value: code
    };

    const classBoxReadonly = {
      'box-readonly': readonly
    };

    const classReadonly = {
      'readonly': readonly,
      ['fs' + fontSize]: true,
      ['lh' + lineHeight]: true,
      ['ls' + letterSpacing]: true
    };

    const wrapperClasses = {
      [className]: true,
      'stacking': this.state.stacking
    };

    return (
      <div className={classNames(wrapperClasses)}>
        <div className={classNames(classBoxReadonly)}>
          <div className={classNames(classReadonly)}>
            <Codemirror {...codemirrorProps} />
          </div>
        </div>
      </div>
    );
  }
}
