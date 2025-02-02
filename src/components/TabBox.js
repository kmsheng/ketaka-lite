import React, {PropTypes, cloneElement} from 'react';
import classNames from 'classnames';
import shouldPureComponentUpdate from 'react-pure-render/function';
import {Nav, NavItem, utils} from 'react-bootstrap';

export default class TabBox extends React.Component {

  static PropTypes = {
    activeKey: PropTypes.any,
    bsStyle: PropTypes.oneOf(['tabs', 'pills']),
    onClose: PropTypes.func,
    onSelect: PropTypes.func
  };

  static defaultProps = {
    bsStyle: 'tabs'
  };

  shouldComponentUpdate = shouldPureComponentUpdate;

  getPanelId(props, child) {
    if (child.props.id) {
      return child.props.id + '___panel';
    }
    if (props.id) {
      return props.id + '___panel___' + child.props.eventKey;
    }
  }

  getTabId(props, child) {
    if (child.props.id) {
      return child.props.id + '___tab';
    }
    if (props.id) {
     return props.id + '___tab___' + child.props.eventKey;
    }
  }

  renderTab = child => {

    const {eventKey, className, tab, disabled, noCloseButton} = child.props;
    const {onClose} = this.props;
    const classes = {
      'close': true,
      'hidden': noCloseButton
    };

    return (
      <NavItem linkId={this.getTabId(this.props, child)} ref={'tab' + eventKey}
         aria-controls={this.getPanelId(this.props, child)} eventKey={eventKey}
         className={className} disabled={disabled}>
        {tab}
        <span className={classNames(classes)} onClick={onClose.bind(null, child.props)}>&times;</span>
      </NavItem>
    );
  };

  renderPane = (child, index) => {

    const activeKey = this.props.activeKey;
    const active = (child.props.eventKey === activeKey);

    return cloneElement(child, {
      active,
      id: this.getPanelId(this.props, child),
      'aria-labelledby': this.getTabId(this.props, child),
      key: child.key ? child.key : index
    });
  };

  render() {
    let {id, activeKey, ...props} = this.props;
    return (
      <div>
        <Nav {...props} activeKey={activeKey} onSelect={this.props.onSelect}>
          {utils.ValidComponentChildren.map(this.props.children, this.renderTab, this)}
        </Nav>
        <div id={id} className="tab-content">
          {utils.ValidComponentChildren.map(this.props.children, this.renderPane)}
        </div>
      </div>
    );
  }
}
