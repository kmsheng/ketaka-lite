import DocHelper from '../services/DocHelper';
import React, {PropTypes} from 'react';
import {ModalImportStatus} from '.';
import classNames from 'classnames';
import shouldPureComponentUpdate from 'react-pure-render/function';
import {Button, CollapsibleNav, DropdownButton, Glyphicon,  MenuItem, Nav, Navbar} from 'react-bootstrap';
import ReactToastr from 'react-toastr';

let {ToastContainer} = ReactToastr;
let ToastMessageFactory = React.createFactory(ReactToastr.ToastMessage.animation);

let ipc = window.require('ipc');

export default class Navigation extends React.Component {

  static PropTypes = {
    closeDoc: PropTypes.func.isRequired,
    importDoc: PropTypes.func.isRequired,
    direction: PropTypes.bool.isRequired,
    exportData: PropTypes.func.isRequired,
    importData: PropTypes.func.isRequired,
    saveAs: PropTypes.func.isRequired,
    settings: PropTypes.func.isRequired,
    toggleDirection: PropTypes.func.isRequired
  };

  shouldComponentUpdate = shouldPureComponentUpdate;

  import() {
    ipc.send('import-button-clicked');
  }

  componentDidMount() {

    let self = this;

    ipc.on('import-done', function(res) {
      self.props.importDoc(res.doc);
      self.refs.toast.success(res.message);
      DocHelper.import();
    });

    ipc.on('import-start', function() {
      self.refs.modalImportStatus.open({
        title: 'Import Status'
      });
    });

    ipc.on('import-progress', function(res) {
      self.refs.modalImportStatus.addMessage(res);
    });

    ipc.on('import-error', function(res) {
      self.refs.toast.error(res.message);
    });
  }

  render() {

    let {saveAs, exportData, settings, toggleDirection, direction} = this.props;
    let classes = {
      'btn-direction': true,
      'vertical': direction
    };

    return (
      <div>
        <Navbar className="navigation" fluid>
          <CollapsibleNav eventKey={0}>
            <Nav navbar>
              <DropdownButton eventKey={3} title="Ketaka Lite">
                <MenuItem eventKey="1" onSelect={::this.import}>Import</MenuItem>
                <MenuItem eventKey="2" onSelect={DocHelper.save}>Save</MenuItem>
                <MenuItem eventKey="3" onSelect={saveAs}>Save As</MenuItem>
                <MenuItem eventKey="4" onSelect={exportData}>Export</MenuItem>
                <MenuItem eventKey="5" onSelect={settings}>Settings</MenuItem>
              </DropdownButton>
            </Nav>
            <Nav navbar right>
              <MenuItem className="item-direction" eventKey="6" onSelect={toggleDirection}>
                <Button className={classNames(classes)} bsStyle="link"><Glyphicon glyph="pause" /></Button>
              </MenuItem>
            </Nav>
          </CollapsibleNav>
        </Navbar>
        <ModalImportStatus className="modal-import-status" ref="modalImportStatus" />
        <ToastContainer ref="toast" toastMessageFactory={ToastMessageFactory} className="toast-top-right" />
      </div>
    );
  }
}
